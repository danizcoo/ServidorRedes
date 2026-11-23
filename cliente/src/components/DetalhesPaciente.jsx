import Painel, { BotaoFecharPainel } from './Painel';
import { Avatar } from './FichaPaciente';
import { useModoTecnico } from '../modo';
import {
  GENEROS, TELECOM_SISTEMAS, TELECOM_USOS, ENDERECO_USOS, rotulo, corPasta,
  idPaciente, nomeCompleto, formatarData, idadeExibida, enderecoTexto, idiomas,
  falecido, dataObito, nascimentoMultiplo,
} from '../fhir';

// Código de barras decorativo e determinístico, derivado do ID (como nas pulseiras hospitalares).
function CodigoBarras({ id }) {
  const semente = String(id).padStart(4, '0') + 'PATIENT';
  const barras = [];
  let x = 0;
  for (let i = 0; i < 28; i += 1) {
    const c = semente.charCodeAt(i % semente.length) + i * 7;
    const largura = 1 + (c % 3);
    if (i % 2 === 0) barras.push(<rect key={i} x={x} y="0" width={largura} height="28" />);
    x += largura + 1;
  }
  return (
    <svg className="codigo-barras" viewBox={`0 0 ${x} 28`} width={x * 1.4} height="28" aria-hidden="true" preserveAspectRatio="none">
      {barras}
    </svg>
  );
}

function Item({ termo, children }) {
  return (
    <div className="item">
      <dt>{termo}</dt>
      <dd>{children || <span className="vazio">Não informado</span>}</dd>
    </div>
  );
}

function Secao({ titulo, vazio, children }) {
  return (
    <section className="detalhe-secao">
      <h3>{titulo}</h3>
      {vazio ? <p className="vazio">Nenhum cadastrado.</p> : <dl>{children}</dl>}
    </section>
  );
}

export default function DetalhesPaciente({ paciente: p, aoFechar, aoEditar, aoExcluir }) {
  const tecnico = useModoTecnico();
  const id = idPaciente(p);
  const anos = idadeExibida(p);
  const obito = falecido(p);
  const ident = Array.isArray(p.identifier) ? p.identifier : p.identifier ? [p.identifier] : [];
  const telecom = p.telecom || [];
  const enderecos = p.address || [];
  const contatos = p.contact || [];
  const langs = idiomas(p);

  const pulseira = (
    <div className={`pulseira${p.active === false ? ' pulseira-inativa' : ''}`} style={{ '--pasta': corPasta(id) }}>
      <Avatar paciente={p} tamanho="g" />
      <div className="pulseira-texto">
        <span className="pulseira-id">Nº {id}</span>
        <span className="pulseira-linha">
          {[p.gender && rotulo(GENEROS, p.gender), p.birthDate && `nasc. ${formatarData(p.birthDate)}`, anos !== null && `${obito ? 'faleceu aos ' : ''}${anos} anos`]
            .filter(Boolean).join(', ') || 'Gênero e nascimento não informados'}
        </span>
      </div>
      <CodigoBarras id={id} />
      {p.active === false && <span className="carimbo carimbo-pulseira">Inativo</span>}
    </div>
  );

  const rodape = (
    <>
      <button type="button" className="botao botao-perigo" onClick={aoExcluir}>Excluir</button>
      <span className="espaco" />
      <BotaoFecharPainel>Fechar</BotaoFecharPainel>
      <button type="button" className="botao botao-primario" onClick={aoEditar}>Editar</button>
    </>
  );

  return (
    <Painel
      titulo={nomeCompleto(p) || 'Paciente sem nome'}
      subtitulo={tecnico ? <code>GET /Patient/{id}</code> : undefined}
      topo={pulseira}
      aoFechar={aoFechar}
      rodape={rodape}
      larga
      fecharNoFundo
    >
      <div className="detalhes">
        <Secao titulo="Dados pessoais">
          <Item termo="Gênero">{rotulo(GENEROS, p.gender)}</Item>
          <Item termo="Nascimento">{p.birthDate && `${formatarData(p.birthDate)}${anos !== null && !obito ? ` (${anos} anos)` : ''}`}</Item>
          <Item termo="Óbito">{obito ? (dataObito(p) ? `Sim, em ${dataObito(p)}${anos !== null ? ` (${anos} anos)` : ''}` : 'Sim') : 'Não'}</Item>
          <Item termo="Nascimento múltiplo">{nascimentoMultiplo(p)}</Item>
          <Item termo="Estado civil">{p.maritalStatus?.text || p.maritalStatus?.coding?.[0]?.display}</Item>
          <Item termo="Situação">{p.active === false ? 'Inativo' : 'Ativo'}</Item>
          <Item termo="Idiomas">
            {langs.length > 0 && (
              <ul className="idiomas">
                {langs.map((l, i) => <li key={i} className={l.preferido ? 'idioma-preferido' : undefined}>{l.texto}{l.preferido ? ' (preferido)' : ''}</li>)}
              </ul>
            )}
          </Item>
        </Secao>

        <Secao titulo="Identificação">
          <Item termo="Número do cadastro">{id}</Item>
          {tecnico && ident.map((i, n) => (
            <Item key={n} termo="identifier"><code>{`${i.system ? `${i.system} | ` : ''}${i.value ?? ''}`}</code></Item>
          ))}
        </Secao>

        <Secao titulo="Telefones e e-mails" vazio={!telecom.length}>
          {telecom.map((t, i) => (
            <Item key={i} termo={[rotulo(TELECOM_SISTEMAS, t.system), t.use && rotulo(TELECOM_USOS, t.use).toLowerCase()].filter(Boolean).join(', ')}>
              {t.value}
            </Item>
          ))}
        </Secao>

        <Secao titulo="Endereços" vazio={!enderecos.length}>
          {enderecos.map((a, i) => (
            <Item key={i} termo={rotulo(ENDERECO_USOS, a.use) || 'Endereço'}>{enderecoTexto(a)}</Item>
          ))}
        </Secao>

        <Secao titulo="Contatos do paciente" vazio={!contatos.length}>
          {contatos.map((c, i) => (
            <Item key={i} termo={c.relationship?.[0]?.text || c.relationship?.[0]?.coding?.[0]?.display || 'Contato'}>
              {[[...(c.name?.given || []), c.name?.family].filter(Boolean).join(' '), ...(c.telecom || []).map((t) => t.value)]
                .filter(Boolean).join(', ')}
            </Item>
          ))}
        </Secao>

        {tecnico && (
          <details className="json">
            <summary>Recurso FHIR em JSON</summary>
            <pre>{JSON.stringify(p, null, 2)}</pre>
          </details>
        )}
      </div>
    </Painel>
  );
}
