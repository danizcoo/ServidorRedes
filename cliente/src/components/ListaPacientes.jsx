import { useEffect, useRef } from 'react';
import FichaPaciente, { Avatar } from './FichaPaciente';
import { useListaAnimada } from '../animacao';
import { useModoTecnico } from '../modo';
import { GENEROS, rotulo, idPaciente, nomeCompleto, idadeExibida, telecomPrincipal, cidade, falecido } from '../fhir';

function Tabela({ pacientes, refCorpo, saindo, destaque, aoVer, aoEditar, aoExcluir }) {
  return (
    <div className="tabela-rolagem">
      <table className="tabela">
        <thead>
          <tr>
            <th scope="col" className="col-id">ID</th>
            <th scope="col">Paciente</th>
            <th scope="col">Gênero</th>
            <th scope="col" className="col-num">Idade</th>
            <th scope="col">Telefone ou e-mail</th>
            <th scope="col">Cidade</th>
            <th scope="col"><span className="sr-only">Ações</span></th>
          </tr>
        </thead>
        <tbody ref={refCorpo}>
          {pacientes.map((p) => {
            const id = idPaciente(p);
            const anos = idadeExibida(p);
            return (
              <tr
                key={id}
                data-chave={id}
                className={[p.active === false && 'linha-inativa', saindo === id && 'item-saindo', destaque === id && 'linha-destaque'].filter(Boolean).join(' ') || undefined}
              >
                <td className="col-id">{id}</td>
                <td>
                  <span className="tabela-paciente">
                    <Avatar paciente={p} tamanho="p" />
                    <button type="button" className="ficha-nome" onClick={() => aoVer(id)}>{nomeCompleto(p) || 'Sem nome'}</button>
                    {p.active === false && <span className="etiqueta etiqueta-inativo">Inativo</span>}
                    {falecido(p) && <span className="etiqueta etiqueta-obito">Óbito</span>}
                  </span>
                </td>
                <td>{rotulo(GENEROS, p.gender) || <span className="vazio">—</span>}</td>
                <td className="col-num">{anos ?? <span className="vazio">—</span>}</td>
                <td>{telecomPrincipal(p)?.value || <span className="vazio">—</span>}</td>
                <td>{cidade(p) || <span className="vazio">—</span>}</td>
                <td>
                  <span className="tabela-acoes">
                    <button type="button" className="botao botao-pequeno" onClick={() => aoEditar(id)}>Editar</button>
                    <button type="button" className="botao botao-pequeno botao-perigo" onClick={() => aoExcluir(p)}>Excluir</button>
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function ListaPacientes({
  pacientes, total, visao, carregando, erro, filtrando, saindo, destaque,
  aoTentarDeNovo, aoCadastrar, aoCarregarExemplos, aoLimparFiltros, aoVer, aoEditar, aoExcluir,
}) {
  const tecnico = useModoTecnico();
  const refLista = useRef(null);
  useListaAnimada(refLista, visao);

  // Leva a tela até o paciente recém-salvo.
  useEffect(() => {
    if (!destaque) return;
    const item = refLista.current?.querySelector(`[data-chave="${destaque}"]`);
    item?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [destaque, pacientes]);
  if (erro) {
    return (
      <div className="estado estado-erro" role="alert">
        <h3>Não foi possível carregar o cadastro</h3>
        <p>{erro}</p>
        <button type="button" className="botao" onClick={aoTentarDeNovo}>Tentar de novo</button>
      </div>
    );
  }

  if (carregando && total === 0) {
    return (
      <div className="fichas" aria-busy="true" aria-label="Carregando pacientes">
        {[0, 1, 2].map((i) => <div key={i} className="ficha ficha-esqueleto" />)}
      </div>
    );
  }

  if (total === 0) {
    return (
      <div className="estado estado-vazio">
        <svg viewBox="0 0 64 48" width="72" height="54" aria-hidden="true">
          <path d="M4 10a4 4 0 0 1 4-4h14l5 5h29a4 4 0 0 1 4 4v25a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z" fill="none" stroke="currentColor" strokeWidth="2.5" />
          <path d="M28 21h8M32 17v8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
        <h3>Nenhum paciente cadastrado</h3>
        <p>
          Cadastre o primeiro paciente para começar.
          {tecnico && <> O servidor respondeu <code>GET /PatientIDs</code> com 204 No Content.</>}
        </p>
        <div className="estado-acoes">
          <button type="button" className="botao botao-primario" onClick={aoCadastrar}>Cadastrar paciente</button>
          {tecnico && <button type="button" className="botao" onClick={aoCarregarExemplos}>Carregar exemplos</button>}
        </div>
      </div>
    );
  }

  if (pacientes.length === 0) {
    return (
      <div className="estado">
        <h3>Nenhum paciente corresponde aos filtros</h3>
        {filtrando && <button type="button" className="botao" onClick={aoLimparFiltros}>Limpar filtros</button>}
      </div>
    );
  }

  if (visao === 'tabela') {
    return <Tabela pacientes={pacientes} refCorpo={refLista} saindo={saindo} destaque={destaque} aoVer={aoVer} aoEditar={aoEditar} aoExcluir={aoExcluir} />;
  }

  return (
    <div className="fichas" aria-busy={carregando} ref={refLista}>
      {pacientes.map((p) => {
        const id = idPaciente(p);
        return (
          <FichaPaciente
            key={id}
            paciente={p}
            saindo={saindo === id}
            destaque={destaque === id}
            aoVer={() => aoVer(id)}
            aoEditar={() => aoEditar(id)}
            aoExcluir={() => aoExcluir(p)}
          />
        );
      })}
    </div>
  );
}
