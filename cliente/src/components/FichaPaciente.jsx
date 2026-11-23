import {
  GENEROS, TELECOM_SISTEMAS, rotulo, idPaciente, nomeCompleto, idadeExibida, formatarData,
  telecomPrincipal, corPasta, iniciais, cidade, contatoEmergencia, idiomas, falecido, dataObito,
} from '../fhir';

export function Avatar({ paciente, tamanho = 'm' }) {
  return (
    <span className={`avatar avatar-${tamanho}`} style={{ '--pasta': corPasta(idPaciente(paciente)) }} aria-hidden="true">
      {iniciais(paciente)}
    </span>
  );
}

function Dado({ termo, children, classe }) {
  return (
    <div className={classe}>
      <dt>{termo}</dt>
      <dd>{children || <span className="vazio">—</span>}</dd>
    </div>
  );
}

// Ficha no formato de pasta de prontuário: a aba traz o ID e tem a cor do último dígito.
export default function FichaPaciente({ paciente: p, saindo, destaque, aoVer, aoEditar, aoExcluir }) {
  const id = idPaciente(p);
  const nome = nomeCompleto(p);
  const anos = idadeExibida(p);
  const obito = falecido(p);
  const tel = telecomPrincipal(p);
  const emerg = contatoEmergencia(p);
  const langs = idiomas(p);
  const idadeTexto = anos !== null && `${obito ? 'faleceu aos ' : ''}${anos} ${anos === 1 ? 'ano' : 'anos'}`;
  const sub = [p.gender && rotulo(GENEROS, p.gender), idadeTexto].filter(Boolean).join(', ');

  return (
    <article
      className={['ficha', p.active === false && 'ficha-inativa', saindo && 'item-saindo', destaque && 'ficha-destaque'].filter(Boolean).join(' ')}
      style={{ '--pasta': corPasta(id) }}
      data-chave={id}
      aria-labelledby={`ficha-${id}`}
    >
      <span className="ficha-aba" title="A cor da aba segue o último dígito do número, como nas pastas de arquivo médico">
        Nº <b>{id}</b>
      </span>
      {p.active === false && <span className="carimbo">Inativo</span>}

      <header className="ficha-topo">
        <Avatar paciente={p} />
        <div className="ficha-identidade">
          <h3 id={`ficha-${id}`}>
            <button type="button" className="ficha-nome" onClick={aoVer}>{nome || 'Paciente sem nome'}</button>
          </h3>
          <p className="ficha-sub">{sub || 'Gênero e idade não informados'}</p>
          {obito && <span className="etiqueta etiqueta-obito">Óbito{dataObito(p) ? ` em ${dataObito(p)}` : ''}</span>}
        </div>
      </header>

      <dl className="ficha-dados">
        <Dado termo="Nascimento">{formatarData(p.birthDate)}</Dado>
        <Dado termo="Estado civil">{p.maritalStatus?.text || p.maritalStatus?.coding?.[0]?.display}</Dado>
        <Dado termo={tel ? rotulo(TELECOM_SISTEMAS, tel.system) : 'Telefone'}>{tel?.value}</Dado>
        <Dado termo="Cidade">{cidade(p)}</Dado>
        <Dado termo="Emergência" classe="ficha-emergencia">
          {emerg && [emerg.nome, emerg.tel].filter(Boolean).join(', ')}
        </Dado>
      </dl>

      {langs.length > 0 && (
        <ul className="idiomas" aria-label="Idiomas">
          {langs.map((l, i) => (
            <li key={i} className={l.preferido ? 'idioma-preferido' : undefined} title={l.preferido ? 'Idioma preferido' : undefined}>
              {l.texto}
            </li>
          ))}
        </ul>
      )}

      <footer className="ficha-acoes">
        <button type="button" className="botao botao-pequeno" onClick={aoVer}>Visualizar</button>
        <button type="button" className="botao botao-pequeno" onClick={aoEditar}>Editar</button>
        <button type="button" className="botao botao-pequeno botao-perigo" onClick={aoExcluir}>Excluir</button>
      </footer>
    </article>
  );
}
