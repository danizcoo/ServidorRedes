import { useCallback, useEffect, useRef, useState } from 'react';
import * as api from './api';
import { idPaciente, nomeCompleto, SISTEMA_ID } from './fhir';
import ListaPacientes from './components/ListaPacientes';
import FormularioPaciente from './components/FormularioPaciente';
import DetalhesPaciente from './components/DetalhesPaciente';
import Painel from './components/Painel';
import RegistroRequisicoes from './components/RegistroRequisicoes';
import StatusHttp from './components/StatusHttp';

const MENSAGEM_EXCLUSAO = {
  200: 'Paciente excluído.',
  202: 'Exclusão aceita pelo servidor.',
  204: 'Paciente excluído.',
};

export default function App() {
  const [pacientes, setPacientes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erroLista, setErroLista] = useState(null);
  const [filtro, setFiltro] = useState('');
  // painel aberto: { tipo: 'novo' } | { tipo: 'editar' | 'ver', paciente }
  const [painel, setPainel] = useState(null);
  const [aExcluir, setAExcluir] = useState(null);
  const [excluindo, setExcluindo] = useState(false);
  const [aviso, setAviso] = useState(null);
  const [registro, setRegistro] = useState([]);
  const timerAviso = useRef(null);

  const avisar = useCallback((tipo, texto, status) => {
    clearTimeout(timerAviso.current);
    setAviso({ tipo, texto, status, chave: Date.now() });
    timerAviso.current = setTimeout(() => setAviso(null), tipo === 'erro' ? 9000 : 5000);
  }, []);

  useEffect(() => api.aoRequisitar((item) => setRegistro((r) => [item, ...r].slice(0, 60))), []);

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
        else falhas.push(`Patient/${ids[i]} (${r.reason.status || 'sem resposta'})`);
      });
      setPacientes(lidos);
      if (falhas.length) avisar('aviso', `Alguns pacientes não puderam ser lidos: ${falhas.join(', ')}.`);
    } catch (e) {
      setPacientes([]);
      setErroLista(e.message);
    } finally {
      setCarregando(false);
    }
  }, [avisar]);

  useEffect(() => { carregar(); }, [carregar]);

  // Visualizar/editar sempre buscam a versão atual no servidor.
  async function abrir(tipo, id) {
    try {
      const paciente = await api.lerPaciente(id);
      setPainel({ tipo, paciente });
    } catch (e) {
      avisar(e.status === 404 || e.status === 410 ? 'aviso' : 'erro', e.message, e.status);
      if (e.status === 404 || e.status === 410) carregar();
    }
  }

  // Erros (400, 404, 422...) sobem para o formulário, que os exibe.
  async function salvar(recurso) {
    if (painel.tipo === 'novo') {
      const r = await api.criarPaciente(recurso);
      avisar('sucesso', `Paciente cadastrado. Location: ${r.location || '(não informado)'}`, r.status);
    } else {
      const id = idPaciente(painel.paciente);
      const comIdentifier = recurso.identifier ? recurso : { ...recurso, identifier: [{ system: SISTEMA_ID, value: String(id) }] };
      const r = await api.atualizarPaciente(id, comIdentifier);
      avisar('sucesso', `Alterações salvas em Patient/${id}.`, r.status);
    }
    setPainel(null);
    carregar();
  }

  async function confirmarExclusao() {
    const id = idPaciente(aExcluir);
    setExcluindo(true);
    try {
      const r = await api.excluirPaciente(id);
      avisar('sucesso', MENSAGEM_EXCLUSAO[r.status] || 'Paciente excluído.', r.status);
    } catch (e) {
      avisar('erro', e.message, e.status);
    } finally {
      setExcluindo(false);
      setAExcluir(null);
      setPainel(null);
      carregar();
    }
  }

  const ultima = registro[0];
  const conectado = !ultima || ultima.status !== 0;

  return (
    <div className="app">
      <header className="cabecalho">
        <div className="marca">
          <h1>CRUDEPatients</h1>
          <p>
            Pacientes FHIR no servidor{' '}
            <span className={`servidor ${conectado ? 'servidor-on' : 'servidor-off'}`} title={conectado ? 'Servidor respondendo' : 'Servidor sem resposta'}>
              {api.API_URL.replace(/^https?:\/\//, '')}
            </span>
          </p>
        </div>
        <button type="button" className="botao botao-primario" onClick={() => setPainel({ tipo: 'novo' })}>
          Cadastrar paciente
        </button>
      </header>

      <main className="conteudo">
        <section className="pacientes" aria-labelledby="titulo-pacientes">
          <div className="pacientes-topo">
            <h2 id="titulo-pacientes">
              Pacientes <span className="contagem">{pacientes.length}</span>
            </h2>
            <div className="pacientes-ferramentas">
              <input
                type="search"
                className="busca"
                placeholder="Buscar por nome ou ID"
                aria-label="Buscar por nome ou ID"
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
              />
              <button type="button" className="botao" onClick={carregar} disabled={carregando}>
                {carregando ? 'Atualizando…' : 'Atualizar'}
              </button>
            </div>
          </div>
          <ListaPacientes
            pacientes={pacientes}
            carregando={carregando}
            erro={erroLista}
            filtro={filtro}
            aoTentarDeNovo={carregar}
            aoCadastrar={() => setPainel({ tipo: 'novo' })}
            aoVer={(id) => abrir('ver', id)}
            aoEditar={(id) => abrir('editar', id)}
            aoExcluir={(p) => setAExcluir(p)}
          />
        </section>

        <RegistroRequisicoes itens={registro} aoLimpar={() => setRegistro([])} />
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
          titulo={`Excluir ${nomeCompleto(aExcluir) || `o paciente ${idPaciente(aExcluir)}`}?`}
          aoFechar={() => !excluindo && setAExcluir(null)}
          fecharNoFundo
          rodape={(
            <>
              <button type="button" className="botao" onClick={() => setAExcluir(null)} disabled={excluindo} autoFocus>Cancelar</button>
              <button type="button" className="botao botao-perigo-cheio" onClick={confirmarExclusao} disabled={excluindo}>
                {excluindo ? 'Excluindo…' : 'Excluir paciente'}
              </button>
            </>
          )}
        >
          <p>
            O registro <code>Patient/{idPaciente(aExcluir)}</code> será removido do servidor.
            Depois disso, uma leitura desse ID retorna 404 ou 410.
          </p>
        </Painel>
      )}

      <div className="aviso-area" aria-live="polite">
        {aviso && (
          <div key={aviso.chave} className={`aviso aviso-${aviso.tipo}`} role={aviso.tipo === 'erro' ? 'alert' : 'status'}>
            {aviso.status !== undefined && <StatusHttp status={aviso.status} />}
            <p>{aviso.texto}</p>
            <button type="button" className="botao-icone" onClick={() => setAviso(null)} aria-label="Fechar aviso">
              <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
                <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
