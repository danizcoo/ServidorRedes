import { useEffect, useRef } from 'react';
import FichaPaciente, { Avatar } from './FichaPaciente';
import { useListaAnimada } from '../animacao';
import { useModoTecnico } from '../modo';
import { GENEROS, rotulo, idPaciente, nomeCompleto, idadeExibida, telecomPrincipal, cidade, falecido } from '../fhir';

function Recorte({ children, largura }) {
  if (!children) return <span className="vazio">—</span>;
  return <span className="recorte" style={{ '--largura': largura }} title={children}>{children}</span>;
}

function Tabela({ pacientes, refCorpo, saindo, destaque, abrindo, aoVer, aoEditar }) {
  return (
    <div className="tabela-rolagem">
      <table className="tabela">
        <thead>
          <tr>
            <th scope="col" className="col-id">Nº</th>
            <th scope="col">Paciente</th>
            <th scope="col" className="col-genero">Gênero</th>
            <th scope="col" className="col-num">Idade</th>
            <th scope="col">Telefone ou e-mail</th>
            <th scope="col">Cidade</th>
            <th scope="col" className="col-acoes"><span className="sr-only">Ações</span></th>
          </tr>
        </thead>
        <tbody ref={refCorpo}>
          {pacientes.map((p) => {
            const id = idPaciente(p);
            const anos = idadeExibida(p);
            const nome = nomeCompleto(p);
            const ocupado = abrindo?.id === id;
            return (
              <tr
                key={id}
                data-chave={id}
                aria-busy={ocupado || undefined}
                className={[p.active === false && 'linha-inativa', saindo === id && 'item-saindo', destaque === id && 'linha-destaque'].filter(Boolean).join(' ') || undefined}
              >
                <td className="col-id">{id}</td>
                <td>
                  <span className="tabela-paciente">
                    <Avatar paciente={p} tamanho="p" />
                    <button type="button" className="ficha-nome" onClick={() => aoVer(id)} title={nome || undefined} disabled={Boolean(abrindo)}>
                      {nome || 'Paciente sem nome'}
                    </button>
                    {ocupado && abrindo.tipo === 'ver' && <span className="spinner spinner-tinta" aria-hidden="true" />}
                    {p.active === false && <span className="etiqueta etiqueta-inativo">Inativo</span>}
                    {falecido(p) && <span className="etiqueta etiqueta-obito">Óbito</span>}
                  </span>
                </td>
                <td className="col-genero">{rotulo(GENEROS, p.gender) || <span className="vazio">—</span>}</td>
                <td className="col-num">{anos ?? <span className="vazio">—</span>}</td>
                <td><Recorte largura="22ch">{telecomPrincipal(p)?.value}</Recorte></td>
                <td><Recorte largura="18ch">{cidade(p)}</Recorte></td>
                <td className="col-acoes">
                  <button type="button" className="botao botao-pequeno" onClick={() => aoEditar(id)} disabled={Boolean(abrindo)} aria-busy={(ocupado && abrindo.tipo === 'editar') || undefined}>
                    {ocupado && abrindo.tipo === 'editar' && <span className="spinner" aria-hidden="true" />}
                    Editar
                  </button>
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
  pacientes, total, visao, carregando, erro, filtrando, saindo, destaque, abrindo,
  aoTentarDeNovo, aoCadastrar, aoCarregarExemplos, aoLimparFiltros, aoVer, aoEditar,
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
        <p>{erro.descricao || erro.message}</p>
        {tecnico && erro.tecnico && <p className="nota-tecnica"><code>{erro.tecnico}</code></p>}
        <button type="button" className="botao botao-primario" onClick={aoTentarDeNovo}>Tentar de novo</button>
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
        <h3>Nenhum paciente encontrado</h3>
        <p>Confira a grafia ou busque pelo número do cadastro.</p>
        {filtrando && <button type="button" className="botao" onClick={aoLimparFiltros}>Limpar busca e filtros</button>}
      </div>
    );
  }

  if (visao === 'tabela') {
    return <Tabela pacientes={pacientes} refCorpo={refLista} saindo={saindo} destaque={destaque} abrindo={abrindo} aoVer={aoVer} aoEditar={aoEditar} />;
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
            abrindo={abrindo?.id === id ? abrindo.tipo : null}
            aoVer={() => aoVer(id)}
            aoEditar={() => aoEditar(id)}
          />
        );
      })}
    </div>
  );
}
