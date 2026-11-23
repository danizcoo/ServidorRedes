import { GENEROS, rotulo, idPaciente, nomeCompleto, idade, formatarData, telecomPrincipal } from '../fhir';

function resumo(p) {
  const partes = [];
  if (p.gender) partes.push(rotulo(GENEROS, p.gender));
  const anos = idade(p.birthDate);
  if (anos !== null) partes.push(`${anos} ${anos === 1 ? 'ano' : 'anos'}`);
  return partes.join(', ');
}

export default function ListaPacientes({ pacientes, carregando, erro, filtro, aoTentarDeNovo, aoVer, aoEditar, aoExcluir, aoCadastrar }) {
  if (erro) {
    return (
      <div className="lista-estado lista-erro" role="alert">
        <p><strong>Não foi possível carregar a lista de pacientes.</strong></p>
        <p>{erro}</p>
        <button type="button" className="botao" onClick={aoTentarDeNovo}>Tentar de novo</button>
      </div>
    );
  }

  if (carregando && pacientes.length === 0) {
    return <div className="lista-estado" aria-busy="true"><p>Carregando pacientes…</p></div>;
  }

  if (pacientes.length === 0) {
    return (
      <div className="lista-estado">
        <p><strong>Nenhum paciente cadastrado.</strong></p>
        <p>O servidor respondeu <code>GET /PatientIDs</code> sem nenhum ID. Cadastre o primeiro paciente para começar.</p>
        <button type="button" className="botao botao-primario" onClick={aoCadastrar}>Cadastrar paciente</button>
      </div>
    );
  }

  const termo = filtro.trim().toLowerCase();
  const visiveis = termo
    ? pacientes.filter((p) => nomeCompleto(p).toLowerCase().includes(termo) || String(idPaciente(p)) === termo)
    : pacientes;

  if (visiveis.length === 0) {
    return <div className="lista-estado"><p>Nenhum paciente corresponde a “{filtro}”.</p></div>;
  }

  return (
    <ul className="lista" aria-busy={carregando}>
      {visiveis.map((p) => {
        const id = idPaciente(p);
        const nome = nomeCompleto(p);
        const contato = telecomPrincipal(p);
        return (
          <li key={id} className={`paciente${p.active === false ? ' paciente-inativo' : ''}`}>
            <span className="paciente-id" aria-label={`ID ${id}`}>{id}</span>
            <div className="paciente-dados">
              <button type="button" className="paciente-nome" onClick={() => aoVer(id)}>
                {nome || <em>Sem nome</em>}
              </button>
              <span className="paciente-resumo">
                {resumo(p) || 'Sem gênero ou data de nascimento'}
                {p.active === false && <span className="etiqueta">Inativo</span>}
              </span>
            </div>
            <div className="paciente-extra">
              {p.birthDate && <span>Nascimento {formatarData(p.birthDate)}</span>}
              {contato && <span>{contato.value}</span>}
            </div>
            <div className="paciente-acoes">
              <button type="button" className="botao botao-pequeno" onClick={() => aoVer(id)}>Visualizar</button>
              <button type="button" className="botao botao-pequeno" onClick={() => aoEditar(id)}>Editar</button>
              <button type="button" className="botao botao-pequeno botao-perigo" onClick={() => aoExcluir(p)}>Excluir</button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
