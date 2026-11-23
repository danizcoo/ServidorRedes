import Painel, { BotaoFecharPainel } from './Painel';
import { Avatar } from './FichaPaciente';
import { useModoTecnico } from '../modo';
import {
  GENEROS, TELECOM_SISTEMAS, TELECOM_USOS, ENDERECO_USOS, rotulo, corPasta,
  idPaciente, nomeCompleto, formatarData, idadeExibida, enderecoTexto, idiomas,
  falecido, dataObito, nascimentoMultiplo,
} from '../fhir';

// Código de barras Code 39 do número do cadastro, como nas pulseiras hospitalares.
// É um código real: um leitor comum lê "*<número>*" e devolve o número.
// Cada caractere tem 9 elementos (barra, espaço, barra...), 3 deles largos.
const CODE39 = {
  0: 'nnnwwnwnn', 1: 'wnnwnnnnw', 2: 'nnwwnnnnw', 3: 'wnwwnnnnn', 4: 'nnnwwnnnw',
  5: 'wnnwwnnnn', 6: 'nnwwwnnnn', 7: 'nnnwnnwnw', 8: 'wnnwnnwnn', 9: 'nnwwnnwnn',
  '*': 'nwnnwnwnn',
};
const ESTREITA = 2;
const LARGA = 5;
const MARGEM = 10 * ESTREITA;

function CodigoBarras({ id }) {
  if (!Number.isInteger(id)) return null;
  const barras = [];
  let x = MARGEM;
  `*${id}*`.split('').forEach((c, n) => {
    CODE39[c].split('').forEach((el, i) => {
      const largura = el === 'w' ? LARGA : ESTREITA;
      if (i % 2 === 0) barras.push(<rect key={`${n}-${i}`} x={x} y="0" width={largura} height="32" />);
      x += largura;
    });
    x += ESTREITA; // espaço entre caracteres
  });
  const total = x - ESTREITA + MARGEM;
  return (
    <svg className="codigo-barras" viewBox={`0 0 ${total} 32`} width={total} height="32" role="img" aria-label={`Código de barras do cadastro nº ${id}`} shapeRendering="crispEdges">
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
          {obito && <Item termo="Óbito">{dataObito(p) ? `Sim, em ${dataObito(p)}${anos !== null ? ` (${anos} anos)` : ''}` : 'Sim'}</Item>}
          {nascimentoMultiplo(p).startsWith('Sim') && <Item termo="Nascimento múltiplo">{nascimentoMultiplo(p)}</Item>}
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
