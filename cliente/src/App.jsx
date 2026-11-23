import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as api from './api';
import { idPaciente, nomeCompleto, idade, telecomPrincipal, cidade, estatisticas, SISTEMA_ID } from './fhir';
import { PACIENTES_EXEMPLO } from './exemplos';
import { ModoTecnico } from './modo';
import Resumo from './components/Resumo';
import ListaPacientes from './components/ListaPacientes';
import FormularioPaciente from './components/FormularioPaciente';
import DetalhesPaciente from './components/DetalhesPaciente';
import Painel, { BotaoFecharPainel } from './components/Painel';
import Segmentado from './components/Segmentado';
import { espera, movimentoReduzido } from './animacao';
import RegistroRequisicoes from './components/RegistroRequisicoes';
import StatusHttp from './components/StatusHttp';

const GENEROS_FILTRO = [
  ['todos', 'Todos'], ['female', 'Feminino'], ['male', 'Masculino'], ['other', 'Outro'], ['unknown', 'Não informado'],
].map(([valor, rotulo]) => ({ valor, rotulo }));

const SITUACOES_FILTRO = [['todos', 'Todas'], ['ativos', 'Ativos'], ['inativos', 'Inativos']]
  .map(([valor, rotulo]) => ({ valor, rotulo }));

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

const ORDENS = {
  'nome': { rotulo: 'Nome, de A a Z', cmp: (a, b) => nomeCompleto(a).localeCompare(nomeCompleto(b), 'pt-BR') },
  'id-desc': { rotulo: 'Mais recentes', cmp: (a, b) => idPaciente(b) - idPaciente(a) },
  'id': { rotulo: 'Mais antigos', cmp: (a, b) => idPaciente(a) - idPaciente(b) },
  'idade': { rotulo: 'Mais novos', cmp: (a, b) => (idade(a.birthDate) ?? 999) - (idade(b.birthDate) ?? 999) },
  'idade-desc': { rotulo: 'Mais velhos', cmp: (a, b) => (idade(b.birthDate) ?? -1) - (idade(a.birthDate) ?? -1) },
};

const FILTROS_INICIAIS = { busca: '', genero: 'todos', situacao: 'todos' };

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
  const [filtros, setFiltros] = useState(FILTROS_INICIAIS);
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
  const timerAviso = useRef([]);
  const refBusca = useRef(null);

  const fecharAviso = useCallback(() => {
    timerAviso.current.forEach(clearTimeout);
    setAviso((a) => (a ? { ...a, saindo: true } : a));
    timerAviso.current = [setTimeout(() => setAviso(null), movimentoReduzido() ? 0 : 220)];
  }, []);

  // `tecnico` é o texto extra mostrado só no modo técnico (ex.: o cabeçalho Location).
  const avisar = useCallback((tipo, texto, status, tecnico) => {
    timerAviso.current.forEach(clearTimeout);
    const duracao = DURACAO_AVISO[tipo] || 5000;
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
      setErroLista(e.message);
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
    try {
      const paciente = await api.lerPaciente(id);
      setPainel({ tipo, paciente });
    } catch (e) {
      const sumiu = e.status === 404 || e.status === 410;
      avisar(sumiu ? 'aviso' : 'erro', sumiu ? 'Este paciente não está mais no cadastro. A lista foi atualizada.' : e.message, e.status);
      if (sumiu) carregar();
    }
  }

  // Erros (400, 404, 422...) sobem para o formulário, que os exibe.
  // `recurso` é um objeto (aba Formulário) ou o texto da aba JSON.
  async function salvar(recurso) {
    if (painel.tipo === 'novo') {
      const r = await api.criarPaciente(recurso);
      avisar('sucesso', 'Paciente cadastrado.', r.status, `Location: ${r.location || '(não informado)'}`);
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
      avisar('erro', e.message, e.status);
    } finally {
      setExcluindo(false);
      await carregar();
      setSaindo(null);
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
      avisar('erro', `${criados} de ${PACIENTES_EXEMPLO.length} exemplos cadastrados. ${e.message}`, e.status);
    } finally {
      setProgressoExemplos(null);
      carregar();
    }
  }

  return (
    <ModoTecnico.Provider value={tecnico}>
      <header className="faixa">
        <div className="faixa-conteudo">
          <div className="marca">
            <svg className="marca-icone" viewBox="0 0 40 40" width="44" height="44" aria-hidden="true">
              <rect x="1" y="1" width="38" height="38" rx="10" fill="currentColor" />
              <path d="M16 9h8v7h7v8h-7v7h-8v-7H9v-8h7z" fill="var(--faixa)" />
            </svg>
            <div>
              <h1>CRUDEPatients</h1>
              <p>Cadastro de pacientes</p>
            </div>
          </div>
          <div className="faixa-acoes">
            <label className="interruptor interruptor-faixa" title="Mostra as requisições HTTP, os códigos de status e o JSON FHIR">
              <input type="checkbox" checked={tecnico} onChange={(e) => setTecnico(e.target.checked)} />
              <span className="interruptor-trilho" aria-hidden="true" />
              Modo técnico
            </label>
            {tecnico && (
              <button type="button" className="botao botao-fantasma" onClick={carregarExemplos} disabled={progressoExemplos !== null}>
                {progressoExemplos && <span className="spinner" aria-hidden="true" />}
                {progressoExemplos ? `Cadastrando ${progressoExemplos}…` : 'Carregar exemplos'}
              </button>
            )}
            <button type="button" className="botao botao-destaque" onClick={() => setPainel({ tipo: 'novo' })} title="Atalho: N">
              Cadastrar paciente
            </button>
          </div>
        </div>
      </header>

      <main className="conteudo">
        <Resumo stats={stats} situacao={filtros.situacao} aoFiltrarSituacao={(v) => filtrar('situacao', v)} />

        <div className={`area${tecnico ? ' area-tecnica' : ''}`}>
          <section className="pacientes" aria-labelledby="titulo-pacientes">
            <div className="barra-ferramentas">
              <div className="ferramentas-linha">
                <h2 id="titulo-pacientes">
                  Pacientes
                  <span className="contagem">
                    {filtrando ? `${visiveis.length} de ${pacientes.length}` : pacientes.length}
                  </span>
                </h2>
                <div className="busca">
                  <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
                    <circle cx="9" cy="9" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
                    <path d="M13 13l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                  <input
                    ref={refBusca}
                    type="search"
                    placeholder="Buscar por nome, cidade ou telefone"
                    aria-label="Buscar pacientes por nome, ID, cidade ou telefone"
                    value={filtros.busca}
                    onChange={(e) => filtrar('busca', e.target.value)}
                  />
                  <kbd aria-hidden="true">/</kbd>
                </div>
                <button type="button" className="botao botao-icone-texto" onClick={carregar} disabled={carregando} title="Buscar a lista de novo no servidor">
                  <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" className={carregando ? 'girando' : undefined}>
                    <path d="M16 10a6 6 0 1 1-2-4.5M16 3v4h-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Atualizar
                </button>
                <Segmentado className="segmentado-visao" rotulo="Modo de exibição" opcoes={VISOES} valor={visao} aoMudar={setVisao} />
              </div>

              <div className="ferramentas-linha ferramentas-filtros">
                <Segmentado rotulo="Filtrar por gênero" opcoes={GENEROS_FILTRO} valor={filtros.genero} aoMudar={(v) => filtrar('genero', v)} />
                <Segmentado rotulo="Filtrar por situação" opcoes={SITUACOES_FILTRO} valor={filtros.situacao} aoMudar={(v) => filtrar('situacao', v)} />
                <label className="ordenar">
                  <span>Ordenar</span>
                  <select value={ordem} onChange={(e) => setOrdem(e.target.value)}>
                    {Object.entries(ORDENS).map(([v, o]) => <option key={v} value={v}>{o.rotulo}</option>)}
                  </select>
                </label>
              </div>
            </div>

            <ListaPacientes
              pacientes={visiveis}
              total={pacientes.length}
              visao={visao}
              saindo={saindo}
              destaque={destaque}
              carregando={carregando}
              erro={erroLista}
              filtrando={filtrando}
              aoTentarDeNovo={carregar}
              aoCadastrar={() => setPainel({ tipo: 'novo' })}
              aoCarregarExemplos={carregarExemplos}
              aoLimparFiltros={() => setFiltros(FILTROS_INICIAIS)}
              aoVer={(id) => abrir('ver', id)}
              aoEditar={(id) => abrir('editar', id)}
              aoExcluir={(p) => setAExcluir(p)}
            />
          </section>

          {tecnico && <RegistroRequisicoes itens={registro} aoLimpar={() => setRegistro([])} />}
        </div>
      </main>

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
          titulo={`Excluir ${nomeCompleto(aExcluir) || 'este paciente'}?`}
          aoFechar={() => !excluindo && setAExcluir(null)}
          fecharNoFundo
          rodape={(
            <>
              <BotaoFecharPainel disabled={excluindo} autoFocus>Cancelar</BotaoFecharPainel>
              <button type="button" className="botao botao-perigo-cheio" onClick={confirmarExclusao} disabled={excluindo}>
                {excluindo && <span className="spinner" aria-hidden="true" />}
                {excluindo ? 'Excluindo…' : 'Excluir paciente'}
              </button>
            </>
          )}
        >
          <p>O cadastro será removido e não poderá ser recuperado.</p>
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
