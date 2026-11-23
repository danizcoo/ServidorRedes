import Painel from './Painel';
import {
  GENEROS, TELECOM_SISTEMAS, TELECOM_USOS, ENDERECO_USOS, rotulo,
  idPaciente, nomeCompleto, formatarData, idade, enderecoTexto,
} from '../fhir';

function Item({ termo, children }) {
  return (
    <div className="item">
      <dt>{termo}</dt>
      <dd>{children || <span className="nao-informado">Não informado</span>}</dd>
    </div>
  );
}

export default function DetalhesPaciente({ paciente: p, aoFechar, aoEditar, aoExcluir }) {
  const id = idPaciente(p);
  const anos = idade(p.birthDate);
  const ident = Array.isArray(p.identifier) ? p.identifier : p.identifier ? [p.identifier] : [];

  const rodape = (
    <>
      <button type="button" className="botao botao-perigo" onClick={aoExcluir}>Excluir</button>
      <button type="button" className="botao botao-primario" onClick={aoEditar}>Editar</button>
    </>
  );

  return (
    <Painel titulo={nomeCompleto(p) || 'Paciente sem nome'} subtitulo={`GET /Patient/${id}`} aoFechar={aoFechar} rodape={rodape} fecharNoFundo>
      <div className="detalhes">
        <section>
          <h3>Identificação</h3>
          <dl>
            <Item termo="ID">{id}</Item>
            {ident.map((i, n) => (
              <Item key={n} termo="identifier">{`${i.system ? `${i.system} | ` : ''}${i.value ?? ''}`}</Item>
            ))}
            <Item termo="Situação">{p.active === false ? 'Inativo' : 'Ativo'}</Item>
          </dl>
        </section>

        <section>
          <h3>Dados pessoais</h3>
          <dl>
            <Item termo="Gênero">{rotulo(GENEROS, p.gender)}</Item>
            <Item termo="Nascimento">{p.birthDate && `${formatarData(p.birthDate)}${anos !== null ? ` (${anos} anos)` : ''}`}</Item>
            <Item termo="Estado civil">{p.maritalStatus?.text || p.maritalStatus?.coding?.[0]?.display}</Item>
            <Item termo="Idiomas">
              {(p.communication || []).map((c) => `${c.language?.text || c.language?.coding?.[0]?.code}${c.preferred ? ' (preferido)' : ''}`).join(', ')}
            </Item>
          </dl>
        </section>

        <section>
          <h3>Telefones e e-mails</h3>
          {(p.telecom || []).length ? (
            <dl>
              {p.telecom.map((t, i) => (
                <Item key={i} termo={[rotulo(TELECOM_SISTEMAS, t.system), t.use && rotulo(TELECOM_USOS, t.use).toLowerCase()].filter(Boolean).join(', ')}>
                  {t.value}
                </Item>
              ))}
            </dl>
          ) : <p className="nao-informado">Nenhum cadastrado.</p>}
        </section>

        <section>
          <h3>Endereços</h3>
          {(p.address || []).length ? (
            <dl>
              {p.address.map((a, i) => (
                <Item key={i} termo={rotulo(ENDERECO_USOS, a.use) || 'Endereço'}>{enderecoTexto(a)}</Item>
              ))}
            </dl>
          ) : <p className="nao-informado">Nenhum cadastrado.</p>}
        </section>

        <section>
          <h3>Contatos do paciente</h3>
          {(p.contact || []).length ? (
            <dl>
              {p.contact.map((c, i) => (
                <Item key={i} termo={c.relationship?.[0]?.text || c.relationship?.[0]?.coding?.[0]?.display || 'Contato'}>
                  {[[...(c.name?.given || []), c.name?.family].filter(Boolean).join(' '), ...(c.telecom || []).map((t) => t.value)]
                    .filter(Boolean).join(', ')}
                </Item>
              ))}
            </dl>
          ) : <p className="nao-informado">Nenhum cadastrado.</p>}
        </section>

        <details className="json">
          <summary>Recurso FHIR em JSON</summary>
          <pre>{JSON.stringify(p, null, 2)}</pre>
        </details>
      </div>
    </Painel>
  );
}
