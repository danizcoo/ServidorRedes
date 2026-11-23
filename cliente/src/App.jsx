import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as api from './api';
import { idPaciente, nomeCompleto, idade, telecomPrincipal, cidade, estatisticas, formatarData, SISTEMA_ID } from './fhir';
import { PACIENTES_EXEMPLO } from './exemplos';
import { ModoTecnico } from './modo';
import Resumo from './components/Resumo';
import ListaPacientes from './components/ListaPacientes';
import FormularioPaciente from './components/FormularioPaciente';
import DetalhesPaciente from './components/DetalhesPaciente';
import Painel, { BotaoFecharPainel } from './components/Painel';
import Segmentado from './components/Segmentado';
import { Avatar } from './components/FichaPaciente';
import { espera, movimentoReduzido } from './animacao';
import RegistroRequisicoes from './components/RegistroRequisicoes';
import StatusHttp from './components/StatusHttp';

const GENEROS_FILTRO = [
  ['todos', 'Todos'], ['female', 'Feminino'], ['male', 'Masculino'], ['other', 'Outro'], ['unknown', 'Não informado'],
];

const VISOES = [
  {
    valor: 'fichas',
    rotulo: 'Fichas',
    icone: <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><rect x="3" y="3" width="6" height="6" rx="1.5" fill="currentColor" /><rect x="11" y="3" width="6" height="6" rx="1.5" fill="currentColor" /><rect x="3" y="11" width="6" height="6" rx="1.5" fill="currentColor" /><rect x="11" y="11" width="6" height="6" rx="1.5" fill="currentColor" /></svg>,
  },
  {
    valor: 'tabela',
    rotulo: 'Tabela',
    icone: <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>,
  },
];

const DURACAO_AVISO = { sucesso: 4500, aviso: 6000, erro: 9000 };

// Cadastros sem nome vão para o fim da ordem alfabética.
function compararNomes(a, b) {
  const na = nomeCompleto(a);
  const nb = nomeCompleto(b);
  if (!na !== !nb) return na ? -1 : 1;
  return na.localeCompare(nb, 'pt-BR');
}

const ORDENS = {
  'nome': { grupo: 'Nome', rotulo: 'Nome, de A a Z', cmp: compararNomes },
  'id-desc': { grupo: 'Cadastro', rotulo: 'Mais recentes', cmp: (a, b) => idPaciente(b) - idPaciente(a) },
  'id': { grupo: 'Cadastro', rotulo: 'Mais antigos', cmp: (a, b) => idPaciente(a) - idPaciente(b) },
  'idade': { grupo: 'Idade', rotulo: 'Mais novos', cmp: (a, b) => (idade(a.birthDate) ?? 999) - (idade(b.birthDate) ?? 999) },
  'idade-desc': { grupo: 'Idade', rotulo: 'Mais velhos', cmp: (a, b) => (idade(b.birthDate) ?? -1) - (idade(a.birthDate) ?? -1) },
};
const GRUPOS_ORDEM = [...new Set(Object.values(ORDENS).map((o) => o.grupo))];

const FILTROS_INICIAIS = { busca: '', genero: 'todos', situacao: 'todos' };

// Busca e filtros ficam na URL (?busca=&genero=&situacao=), para poder
// recarregar a página ou guardar o link de uma lista filtrada.
function filtrosDaUrl() {
  const q = new URLSearchParams(window.location.search);
  const genero = q.get('genero');
  const situacao = q.get('situacao');
  return {
    busca: q.get('busca') || '',
    genero: GENEROS_FILTRO.some(([v]) => v === genero) ? genero : 'todos',
    situacao: ['ativos', 'inativos'].includes(situacao) ? situacao : 'todos',
  };
}

function filtrosParaUrl(filtros) {
  const q = new URLSearchParams(window.location.search);
  for (const [chave, valor] of Object.entries(filtros)) {
    if (valor && valor !== FILTROS_INICIAIS[chave]) q.set(chave, valor);
    else q.delete(chave);
  }
  const busca = q.toString();
  window.history.replaceState(null, '', `${window.location.pathname}${busca ? `?${busca}` : ''}${window.location.hash}`);
}

// Tela estreita (celular): a tabela não cabe, então a lista fica sempre em fichas.
function useEstreito(consulta = '(max-width: 640px)') {
  const [estreito, setEstreito] = useState(() => window.matchMedia?.(consulta).matches ?? false);
  useEffect(() => {
    const mq = window.matchMedia?.(consulta);
    if (!mq) return undefined;
    const mudar = () => setEstreito(mq.matches);
    mq.addEventListener('change', mudar);
    return () => mq.removeEventListener('change', mudar);
  }, [consulta]);
  return estreito;
}

const ICONE_AVISO = {
  sucesso: <path d="M5 10.5l3.2 3.2L15 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />,
  aviso: <path d="M10 6v5M10 14h.01" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />,
  erro: <path d="M7 7l6 6M13 7l-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />,
};

function lerPreferencia(chave, padrao) {
  try { return localStorage.getItem(chave) ?? padrao; } catch { return padrao; }
}
function salvarPreferencia(chave, valor) {
  try { localStorage.setItem(chave, valor); } catch { /* sem armazenamento: ignora */ }
}

function corresponde(p, termo) {
  if (!termo) return true;
  const t = termo.toLowerCase();
  const soDigitos = t.replace(/\D/g, '');
  const telefone = (telecomPrincipal(p)?.value || '').replace(/\D/g, '');
  return nomeCompleto(p).toLowerCase().includes(t)
    || String(idPaciente(p)) === t
    || cidade(p).toLowerCase().includes(t)
    || (soDigitos.length >= 3 && telefone.includes(soDigitos));
}

export default function App() {
  const [pacientes, setPacientes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erroLista, setErroLista] = useState(null);
  const [filtros, setFiltros] = useState(filtrosDaUrl);
  const [ordem, setOrdem] = useState(() => lerPreferencia('crude.ordem', 'nome'));
  const [visao, setVisao] = useState(() => lerPreferencia('crude.visao', 'fichas'));
  const [tecnico, setTecnico] = useState(() => lerPreferencia('crude.tecnico', 'nao') === 'sim');
  // painel aberto: { tipo: 'novo' } | { tipo: 'editar' | 'ver', paciente }
  const [painel, setPainel] = useState(null);
  const [aExcluir, setAExcluir] = useState(null);
  const [excluindo, setExcluindo] = useState(false);
  const [progressoExemplos, setProgressoExemplos] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [registro, setRegistro] = useState([]);
  const [saindo, setSaindo] = useState(null); // ID do paciente sendo excluído (animação de saída)
  const [destaque, setDestaque] = useState(null); // ID do paciente recém-salvo
  const [abrindo, setAbrindo] = useState(null); // { id, tipo } enquanto busca o paciente para abrir
  const [inativando, setInativando] = useState(false);
  const estreito = useEstreito();
  const timerAviso = useRef([]);
  const refBusca = useRef(null);

  const fecharAviso = useCallback(() => {
    timerAviso.current.forEach(clearTimeout);
    setAviso((a) => (a ? { ...a, saindo: true } : a));
    timerAviso.current = [setTimeout(() => setAviso(null), movimentoReduzido() ? 0 : 220)];
  }, []);

  // `tecnico` é o texto extra mostrado só no modo técnico (ex.: o cabeçalho Location).
  const avisar = useCallback((tipo, texto, status, tecnico, duracaoPropria) => {
    timerAviso.current.forEach(clearTimeout);
    const duracao = duracaoPropria || DURACAO_AVISO[tipo] || 5000;
    setAviso({ tipo, texto, status, tecnico, duracao, chave: Date.now() });
    timerAviso.current = [setTimeout(fecharAviso, duracao)];
  }, [fecharAviso]);

  function destacar(id) {
    if (!id) return;
    setDestaque(id);
    setTimeout(() => setDestaque((d) => (d === id ? null : d)), 2600);
  }

  useEffect(() => api.aoRequisitar((item) => setRegistro((r) => [item, ...r].slice(0, 80))), []);
  useEffect(() => salvarPreferencia('crude.ordem', ordem), [ordem]);
  useEffect(() => salvarPreferencia('crude.visao', visao), [visao]);
  useEffect(() => salvarPreferencia('crude.tecnico', tecnico ? 'sim' : 'nao'), [tecnico]);
  useEffect(() => filtrosParaUrl(filtros), [filtros]);

  // Lista: GET /PatientIDs e depois GET /Patient/<ID> para cada ID.
  const carregar = useCallback(async () => {
    setCarregando(true);
    setErroLista(null);
    try {
      const ids = await api.listarIDs();
      const resultados = await Promise.allSettled(ids.map((id) => api.lerPaciente(id)));
      const lidos = [];
      const falhas = [];
      resultados.forEach((r, i) => {
        if (r.status === 'fulfilled') lidos.push(r.value);
        else falhas.push(`${ids[i]} (${r.reason.status || 'sem resposta'})`);
      });
      setPacientes(lidos);
      if (falhas.length) {
        avisar('aviso', `${falhas.length === 1 ? 'Um cadastro não pôde ser lido' : `${falhas.length} cadastros não puderam ser lidos`}.`, undefined, `IDs: ${falhas.join(', ')}`);
      }
    } catch (e) {
      setPacientes([]);
      setErroLista(e);
    } finally {
      setCarregando(false);
    }
  }, [avisar]);

  useEffect(() => { carregar(); }, [carregar]);

  // Atalhos: N cadastra, / vai para a busca.
  useEffect(() => {
    function tecla(e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (document.querySelector('dialog[open]')) return;
      if (e.target.closest('input, textarea, select, [contenteditable]')) return;
      if (e.key === 'n' || e.key === 'N') { e.preventDefault(); setPainel({ tipo: 'novo' }); }
      if (e.key === '/') { e.preventDefault(); refBusca.current?.focus(); }
    }
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, []);

  const stats = useMemo(() => estatisticas(pacientes), [pacientes]);

  const visiveis = useMemo(() => {
    const termo = filtros.busca.trim();
    return pacientes
      .filter((p) => corresponde(p, termo))
      .filter((p) => filtros.genero === 'todos'
        || (filtros.genero === 'unknown' ? !['female', 'male', 'other'].includes(p.gender) : p.gender === filtros.genero))
      .filter((p) => filtros.situacao === 'todos' || (filtros.situacao === 'ativos' ? p.active !== false : p.active === false))
      .sort(ORDENS[ordem]?.cmp || ORDENS.nome.cmp);
  }, [pacientes, filtros, ordem]);

  const filtrando = filtros.busca.trim() !== '' || filtros.genero !== 'todos' || filtros.situacao !== 'todos';
  const filtrar = (campo, valor) => setFiltros((f) => ({ ...f, [campo]: valor }));

  // Visualizar/editar sempre buscam a versão atual no servidor.
  async function abrir(tipo, id) {
    if (abrindo) return;
    setAbrindo({ id, tipo });
    try {
      const paciente = await api.lerPaciente(id);
      setPainel({ tipo, paciente });
    } catch (e) {
      const sumiu = e.status === 404 || e.status === 410;
      avisar(sumiu ? 'aviso' : 'erro', sumiu ? 'Este paciente não está mais no cadastro. A lista foi atualizada.' : e.message, e.status, e.tecnico);
      if (sumiu) carregar();
    } finally {
      setAbrindo(null);
    }
  }

  // Erros (400, 404, 422...) sobem para o formulário, que os exibe.
  // `recurso` é um objeto (aba Formulário) ou o texto da aba JSON.
  async function salvar(recurso) {
    if (painel.tipo === 'novo') {
      const r = await api.criarPaciente(recurso);
      // O número é o que a recepção informa ao paciente: o aviso fica mais tempo na tela.
      avisar(
        'sucesso',
        r.id ? <>Paciente cadastrado com o <b className="aviso-numero">nº {r.id}</b>.</> : 'Paciente cadastrado.',
        r.status,
        `Location: ${r.location || '(não informado)'}`,
        r.id ? 10000 : undefined,
      );
      destacar(r.id);
    } else {
      const id = idPaciente(painel.paciente);
      const corpo = typeof recurso === 'object' && !recurso.identifier
        ? { ...recurso, identifier: [{ system: SISTEMA_ID, value: String(id) }] }
        : recurso;
      const r = await api.atualizarPaciente(id, corpo);
      avisar('sucesso', 'Alterações salvas.', r.status, `PUT /Patient/${id}`);
      destacar(id);
    }
    setPainel(null);
    carregar();
  }

  async function confirmarExclusao() {
    const id = idPaciente(aExcluir);
    setExcluindo(true);
    try {
      const r = await api.excluirPaciente(id);
      setAExcluir(null);
      setPainel(null);
      setSaindo(id);
      avisar('sucesso', r.status === 202 ? 'Exclusão solicitada.' : 'Paciente excluído.', r.status, `DELETE /Patient/${id}`);
      if (!movimentoReduzido()) await espera(320);
    } catch (e) {
      setAExcluir(null);
      setPainel(null);
      avisar('erro', e.message, e.status, e.tecnico);
    } finally {
      setExcluindo(false);
      await carregar();
      setSaindo(null);
    }
  }

  // Alternativa à exclusão: PUT com active=false. O cadastro continua guardado.
  async function inativar() {
    const id = idPaciente(aExcluir);
    setInativando(true);
    try {
      const r = await api.atualizarPaciente(id, { ...aExcluir, active: false });
      setAExcluir(null);
      setPainel(null);
      avisar('sucesso', `${nomeCompleto(aExcluir) || `Cadastro nº ${id}`} agora está inativo.`, r.status, `PUT /Patient/${id} com active: false`);
      destacar(id);
      carregar();
    } catch (e) {
      avisar('erro', e.message, e.status, e.tecnico);
    } finally {
      setInativando(false);
    }
  }

  async function carregarExemplos() {
    let criados = 0;
    try {
      for (let i = 0; i < PACIENTES_EXEMPLO.length; i += 1) {
        setProgressoExemplos(`${i + 1} de ${PACIENTES_EXEMPLO.length}`);
        await api.criarPaciente(PACIENTES_EXEMPLO[i]);
        criados += 1;
      }
      avisar('sucesso', `${criados} pacientes de exemplo cadastrados.`, 201);
    } catch (e) {
      avisar('erro', `${criados} de ${PACIENTES_EXEMPLO.length} exemplos cadastrados. ${e.message}`, e.status, e.tecnico);
    } finally {
      setProgressoExemplos(null);
      carregar();
    }
  }

  const semCadastros = pacientes.length === 0;
  const vazio = semCadastros && !carregando && !erroLista;
  const visaoEfetiva = estreito ? 'fichas' : visao;
  const ocupadoNaExclusao = excluindo || inativando;

  return (
    <ModoTecnico.Provider value={tecnico}>
      <header className="faixa">
        <div className="faixa-conteudo">
          <div className="marca">
            <svg className="marca-icone" viewBox="0 0 40 40" width="40" height="40" aria-hidden="true">
              <rect x="1" y="1" width="38" height="38" rx="10" fill="currentColor" />
              <path d="M16 9h8v7h7v8h-7v7h-8v-7H9v-8h7z" fill="var(--faixa)" />
            </svg>
            <div>
              <h1>Cadastro de pacientes</h1>
              <p>CRUDEPatients</p>
            </div>
          </div>
          <div className="faixa-acoes">
            {tecnico && (
              <button type="button" className="botao botao-fantasma" onClick={carregarExemplos} disabled={progressoExemplos !== null}>
                {progressoExemplos && <span className="spinner" aria-hidden="true" />}
                {progressoExemplos ? `Cadastrando ${progressoExemplos}…` : 'Carregar exemplos'}
              </button>
            )}
            {!vazio && (
              <button type="button" className="botao botao-destaque" onClick={() => setPainel({ tipo: 'novo' })} aria-keyshortcuts="N">
                Cadastrar paciente
                <kbd aria-hidden="true">N</kbd>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className={`conteudo${semCadastros ? ' conteudo-sem-cadastros' : ''}`}>
        {!semCadastros && (
          <Resumo stats={stats} situacao={filtros.situacao} aoFiltrarSituacao={(v) => filtrar('situacao', v)} />
        )}

        <div className={`area${tecnico ? ' area-tecnica' : ''}`}>
          <section className="pacientes" aria-labelledby="titulo-pacientes">
            {semCadastros ? <h2 id="titulo-pacientes" className="sr-only">Pacientes</h2> : (
            <div className="barra-ferramentas">
              <div className="ferramentas-linha">
                <h2 id="titulo-pacientes">
                  Pacientes
                  {filtrando && <span className="contagem">{visiveis.length} de {pacientes.length}</span>}
                </h2>
                <div className="busca">
                  <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
                    <circle cx="9" cy="9" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
                    <path d="M13 13l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                  <input
                    ref={refBusca}
                    type="search"
                    placeholder="Nome, nº, cidade ou telefone"
                    aria-label="Buscar pacientes por nome, número do cadastro, cidade ou telefone"
                    aria-keyshortcuts="/"
                    value={filtros.busca}
                    onChange={(e) => filtrar('busca', e.target.value)}
                  />
                  <kbd aria-hidden="true">/</kbd>
                </div>
              </div>

              <div className="ferramentas-linha ferramentas-filtros">
                <label className="seletor">
                  <span>Gênero</span>
                  <select value={filtros.genero} onChange={(e) => filtrar('genero', e.target.value)}>
                    {GENEROS_FILTRO.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
                  </select>
                </label>
                <label className="seletor">
                  <span>Ordenar</span>
                  <select value={ordem} onChange={(e) => setOrdem(e.target.value)}>
                    {GRUPOS_ORDEM.map((g) => (
                      <optgroup key={g} label={g}>
                        {Object.entries(ORDENS).filter(([, o]) => o.grupo === g).map(([v, o]) => (
                          <option key={v} value={v}>{o.rotulo}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </label>
                {filtrando && (
                  <button type="button" className="botao-texto" onClick={() => setFiltros(FILTROS_INICIAIS)}>Limpar filtros</button>
                )}
                <span className="espaco" />
                <button type="button" className="botao botao-icone-texto" onClick={carregar} disabled={carregando} title="Buscar a lista de novo no servidor">
                  <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" className={carregando ? 'girando' : undefined}>
                    <path d="M16 10a6 6 0 1 1-2-4.5M16 3v4h-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="rotulo-atualizar">Atualizar</span>
                </button>
                {!estreito && (
                  <Segmentado className="segmentado-visao" rotulo="Modo de exibição" opcoes={VISOES} valor={visao} aoMudar={setVisao} />
                )}
              </div>
            </div>
            )}

            <ListaPacientes
              pacientes={visiveis}
              total={pacientes.length}
              visao={visaoEfetiva}
              saindo={saindo}
              destaque={destaque}
              abrindo={abrindo}
              carregando={carregando}
              erro={erroLista}
              filtrando={filtrando}
              aoTentarDeNovo={carregar}
              aoCadastrar={() => setPainel({ tipo: 'novo' })}
              aoCarregarExemplos={carregarExemplos}
              aoLimparFiltros={() => setFiltros(FILTROS_INICIAIS)}
              aoVer={(id) => abrir('ver', id)}
              aoEditar={(id) => abrir('editar', id)}
            />
          </section>

          {tecnico && <RegistroRequisicoes itens={registro} aoLimpar={() => setRegistro([])} aoDesligar={() => setTecnico(false)} />}
        </div>
      </main>

      <footer className="rodape-app">
        <p>CRUDEPatients, cliente do servidor PatientsOnFIRE (FHIR v5.0.0).</p>
        <label className="interruptor interruptor-rodape">
          <input type="checkbox" checked={tecnico} onChange={(e) => setTecnico(e.target.checked)} aria-describedby="dica-tecnico" />
          <span className="interruptor-trilho" aria-hidden="true" />
          Modo técnico
        </label>
        <p id="dica-tecnico" className="rodape-dica">Mostra as requisições HTTP, os códigos de status e o JSON FHIR.</p>
      </footer>

      {painel?.tipo === 'ver' && (
        <DetalhesPaciente
          paciente={painel.paciente}
          aoFechar={() => setPainel(null)}
          aoEditar={() => setPainel({ tipo: 'editar', paciente: painel.paciente })}
          aoExcluir={() => setAExcluir(painel.paciente)}
        />
      )}

      {(painel?.tipo === 'novo' || painel?.tipo === 'editar') && (
        <FormularioPaciente
          key={painel.tipo + (painel.paciente ? idPaciente(painel.paciente) : '')}
          paciente={painel.paciente || null}
          aoSalvar={salvar}
          aoFechar={() => setPainel(null)}
        />
      )}

      {aExcluir && (
        <Painel
          variante="confirmacao"
          titulo="Excluir este cadastro?"
          aoFechar={() => !ocupadoNaExclusao && setAExcluir(null)}
          fecharNoFundo
          rodape={(
            <>
              <BotaoFecharPainel disabled={ocupadoNaExclusao} data-autofocus>Cancelar</BotaoFecharPainel>
              <span className="espaco" />
              {aExcluir.active !== false && (
                <button type="button" className="botao" onClick={inativar} disabled={ocupadoNaExclusao}>
                  {inativando && <span className="spinner" aria-hidden="true" />}
                  {inativando ? 'Inativando…' : 'Inativar'}
                </button>
              )}
              <button type="button" className="botao botao-perigo-cheio" onClick={confirmarExclusao} disabled={ocupadoNaExclusao}>
                {excluindo && <span className="spinner" aria-hidden="true" />}
                {excluindo ? 'Excluindo…' : 'Excluir de vez'}
              </button>
            </>
          )}
        >
          <div className="pulseira-mini">
            <Avatar paciente={aExcluir} />
            <div>
              <p className="pulseira-mini-nome">{nomeCompleto(aExcluir) || 'Paciente sem nome'}</p>
              <p className="pulseira-mini-linha">
                {[`Nº ${idPaciente(aExcluir)}`, aExcluir.birthDate && `nasc. ${formatarData(aExcluir.birthDate)}`, cidade(aExcluir)]
                  .filter(Boolean).join(' · ')}
              </p>
            </div>
          </div>
          <p>A exclusão apaga o cadastro e não pode ser desfeita.</p>
          {aExcluir.active !== false && (
            <p className="confirmacao-alternativa">
              Se o paciente só deixou de ser atendido, prefira <b>Inativar</b>: o cadastro sai da lista de ativos e continua guardado.
            </p>
          )}
          {tecnico && (
            <p className="nota-tecnica">
              <code>DELETE /Patient/{idPaciente(aExcluir)}</code>. Depois disso, uma leitura desse ID retorna 404 ou 410.
            </p>
          )}
        </Painel>
      )}

      <div className="aviso-area" aria-live="polite">
        {aviso && (
          <div
            key={aviso.chave}
            className={`aviso aviso-${aviso.tipo}${aviso.saindo ? ' aviso-saindo' : ''}`}
            role={aviso.tipo === 'erro' ? 'alert' : 'status'}
            style={{ '--duracao': `${aviso.duracao}ms` }}
          >
            <span className="aviso-tempo" aria-hidden="true" />
            <svg className="aviso-icone" viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
              {ICONE_AVISO[aviso.tipo] || ICONE_AVISO.aviso}
            </svg>
            {tecnico && aviso.status !== undefined && <StatusHttp status={aviso.status} />}
            <p>
              {aviso.texto}
              {tecnico && aviso.tecnico && <span className="aviso-tecnico">{aviso.tecnico}</span>}
            </p>
            <button type="button" className="botao-icone" onClick={fecharAviso} aria-label="Fechar aviso">
              <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
                <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </ModoTecnico.Provider>
  );
}
