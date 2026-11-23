import { cloneElement, useId, useMemo, useRef, useState } from 'react';
import Painel, { BotaoFecharPainel } from './Painel';
import ErroServidor from './ErroServidor';
import {
  GENEROS, ESTADOS_CIVIS, TELECOM_SISTEMAS, TELECOM_USOS, ENDERECO_USOS, PARENTESCOS, IDIOMAS,
  paraFormulario, deFormulario, novoTelecom, novoEndereco, novoContato, novoIdioma, idPaciente, nomeCompleto,
} from '../fhir';
import { validarFormulario, mascaraTelefone, mascaraCep, ehBrasil, digitos, buscarCep } from '../validacao';
import { useModoTecnico } from '../modo';

const SISTEMAS_TELEFONE = ['phone', 'sms', 'fax', 'pager'];
const TIPO_INPUT = { email: 'email', phone: 'tel', sms: 'tel', fax: 'tel', pager: 'tel', url: 'url' };
const DICA_TELECOM = { email: 'nome@dominio.com', phone: '(51) 99999-0000', sms: '(51) 99999-0000', url: 'https://' };

// <select> que também mostra um valor vindo do servidor que não está na lista.
function Selecao({ valor, opcoes, aoMudar, vazio, ...resto }) {
  const conhecido = !valor || opcoes.some((o) => o.value === valor);
  return (
    <select value={valor} onChange={(e) => aoMudar(e.target.value)} {...resto}>
      {vazio !== undefined && <option value="">{vazio}</option>}
      {!conhecido && <option value={valor}>{valor}</option>}
      {opcoes.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

// `colunas` (1–12) posiciona o campo na grade; `largura` (p/m/g) nas linhas flexíveis.
function Campo({ rotulo, colunas, largura, erro, dica, children }) {
  const id = useId();
  const msg = erro || dica;
  const controle = cloneElement(children, {
    id,
    'aria-invalid': erro ? true : undefined,
    'aria-describedby': msg ? `${id}-msg` : undefined,
  });
  return (
    <div className={`campo${largura ? ` campo-${largura}` : ''}${erro ? ' campo-com-erro' : ''}`} style={colunas ? { '--colunas': colunas } : undefined}>
      <label htmlFor={id} className="campo-rotulo">{rotulo}</label>
      {controle}
      {msg && <p id={`${id}-msg`} className={erro ? 'campo-erro' : 'campo-dica'}>{msg}</p>}
    </div>
  );
}

function BotaoRemover({ aoClicar, rotulo }) {
  return (
    <button type="button" className="botao-icone botao-remover" onClick={aoClicar} aria-label={rotulo} title={rotulo}>
      <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
        <path d="M4 6h12M8 6V4h4v2M6 6l1 10h6l1-10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

function statusJson(texto) {
  if (!texto.trim()) return { ok: false, msg: 'O corpo está vazio.' };
  try {
    const v = JSON.parse(texto);
    if (!v || typeof v !== 'object' || Array.isArray(v)) return { ok: false, valido: true, msg: 'JSON válido, mas não é um objeto.' };
    return { ok: true, valor: v, msg: v.resourceType === 'Patient' ? 'JSON válido.' : 'JSON válido, mas resourceType não é "Patient".' };
  } catch (e) {
    return { ok: false, msg: `Erro de sintaxe: ${e.message}` };
  }
}

export default function FormularioPaciente({ paciente, aoSalvar, aoFechar }) {
  const tecnico = useModoTecnico();
  const [base, setBase] = useState(() => paciente || {});
  const [form, setForm] = useState(() => paraFormulario(paciente));
  const [aba, setAba] = useState('form');
  const [textoJson, setTextoJson] = useState('');
  const [avisoAba, setAvisoAba] = useState(null);
  const [tocados, setTocados] = useState(() => new Set());
  const [tentouEnviar, setTentouEnviar] = useState(false);
  const [tentativas, setTentativas] = useState(0);
  const [erroServidor, setErroServidor] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [cep, setCep] = useState({}); // índice do endereço -> { estado, msg }
  const refTopo = useRef(null);

  const editando = Boolean(paciente);
  const id = editando ? idPaciente(paciente) : null;
  const erros = useMemo(() => validarFormulario(form), [form]);
  const qtdErros = Object.keys(erros).length;
  const json = useMemo(() => statusJson(textoJson), [textoJson]);

  const erroDe = (caminho) => (tentouEnviar || tocados.has(caminho) ? erros[caminho] : undefined);
  const tocar = (e) => {
    const nome = e.target.name;
    if (nome && !tocados.has(nome)) setTocados((t) => new Set(t).add(nome));
  };

  const definir = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }));
  const definirItem = (lista, i, campo, valor) =>
    setForm((f) => ({ ...f, [lista]: f[lista].map((item, j) => (j === i ? { ...item, [campo]: valor } : item)) }));
  const adicionar = (lista, fabrica) => setForm((f) => ({ ...f, [lista]: [...f[lista], fabrica()] }));
  const remover = (lista, i) => setForm((f) => ({ ...f, [lista]: f[lista].filter((_, j) => j !== i) }));

  async function aoMudarCep(i, valor, pais) {
    const brasil = ehBrasil(pais);
    definirItem('address', i, 'postalCode', brasil ? mascaraCep(valor) : valor);
    if (!brasil || digitos(valor).length !== 8) {
      setCep((c) => ({ ...c, [i]: undefined }));
      return;
    }
    setCep((c) => ({ ...c, [i]: { estado: 'buscando', msg: 'Buscando endereço pelo CEP…' } }));
    try {
      const end = await buscarCep(valor);
      setForm((f) => ({
        ...f,
        address: f.address.map((a, j) => (j !== i ? a : {
          ...a,
          line: a.line || end.line,
          district: a.district || end.district,
          city: a.city || end.city,
          state: a.state || end.state,
        })),
      }));
      setCep((c) => ({ ...c, [i]: { estado: 'ok', msg: 'Endereço preenchido pelo CEP. Complete o número.' } }));
    } catch {
      setCep((c) => ({ ...c, [i]: { estado: 'erro', msg: 'CEP não encontrado. Preencha o endereço manualmente.' } }));
    }
  }

  function trocarAba(nova) {
    if (nova === aba) return;
    setAvisoAba(null);
    if (nova === 'json') {
      setTextoJson(JSON.stringify(deFormulario(form, base), null, 2));
      setAba('json');
      return;
    }
    if (!json.ok) {
      setAvisoAba('Corrija o JSON antes de voltar ao formulário, ou salve assim mesmo para ver a resposta do servidor.');
      return;
    }
    setBase(json.valor);
    setForm(paraFormulario(json.valor));
    setAba('form');
  }

  async function enviar(e) {
    e.preventDefault();
    setErroServidor(null);
    if (!(tecnico && aba === 'json') && qtdErros > 0) {
      setTentouEnviar(true);
      setTentativas((t) => t + 1);
      requestAnimationFrame(() => document.querySelector('#form-paciente [aria-invalid="true"]')?.focus());
      return;
    }
    setSalvando(true);
    try {
      await aoSalvar(tecnico && aba === 'json' ? textoJson : deFormulario(form, base));
    } catch (err) {
      setErroServidor(err);
      requestAnimationFrame(() => refTopo.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    } finally {
      setSalvando(false);
    }
  }

  const rodape = (
    <>
      {aba === 'form' && tentouEnviar && qtdErros > 0 && (
        <p className="rodape-aviso" key={tentativas}>{qtdErros === 1 ? 'Corrija 1 campo destacado.' : `Corrija ${qtdErros} campos destacados.`}</p>
      )}
      <span className="espaco" />
      <BotaoFecharPainel>Cancelar</BotaoFecharPainel>
      <button type="submit" form="form-paciente" className="botao botao-primario" disabled={salvando}>
        {salvando && <span className="spinner" aria-hidden="true" />}
        {salvando ? 'Salvando…' : editando ? 'Salvar alterações' : 'Cadastrar paciente'}
      </button>
    </>
  );

  const abas = (
    <div className="abas" role="tablist" aria-label="Modo de edição">
      <button type="button" role="tab" aria-selected={aba === 'form'} className="aba" onClick={() => trocarAba('form')}>Formulário</button>
      <button type="button" role="tab" aria-selected={aba === 'json'} className="aba" onClick={() => trocarAba('json')}>JSON FHIR</button>
    </div>
  );

  return (
    <Painel
      titulo={editando ? `Editar ${nomeCompleto(paciente) || 'paciente'}` : 'Cadastrar paciente'}
      subtitulo={tecnico
        ? <code>{editando ? `PUT /Patient/${id}` : 'POST /Patient'}</code>
        : (editando ? `Cadastro nº ${id}` : 'O número do cadastro é gerado ao salvar.')}
      topo={tecnico ? abas : null}
      aoFechar={aoFechar}
      rodape={rodape}
    >
      <form id="form-paciente" className="formulario" onSubmit={enviar} onBlur={tocar} noValidate>
        <div ref={refTopo}>
          {erroServidor && <ErroServidor erro={erroServidor} />}
          {avisoAba && <p className="aviso-inline">{avisoAba}</p>}
        </div>

        {tecnico && aba === 'json' ? (
          <div className="editor-json">
            <label htmlFor="texto-json" className="campo-rotulo">Corpo da requisição</label>
            <textarea
              id="texto-json"
              className="json-texto"
              value={textoJson}
              onChange={(e) => setTextoJson(e.target.value)}
              spellCheck={false}
              rows={22}
              aria-describedby="json-status"
            />
            <p id="json-status" className={`json-status ${json.ok ? 'json-ok' : 'json-erro'}`}>{json.msg}</p>
            <p className="ajuda">
              O texto é enviado exatamente como está, inclusive com erros. Use para testar as respostas 400 e 422 do servidor.
              {editando && ' Na atualização, o identifier precisa ser igual ao ID da URL.'}
            </p>
          </div>
        ) : (
          <>
            <fieldset>
              <legend>Nome</legend>
              <div className="grade">
                <Campo rotulo="Tratamento" colunas={2}>
                  <input name="prefix" value={form.prefix} onChange={(e) => definir('prefix', e.target.value)} placeholder="Dr., Sra." autoComplete="honorific-prefix" />
                </Campo>
                <Campo rotulo="Nome" colunas={5} erro={erroDe('given')}>
                  <input name="given" value={form.given} onChange={(e) => definir('given', e.target.value)} autoComplete="given-name" autoFocus />
                </Campo>
                <Campo rotulo="Sobrenome" colunas={5}>
                  <input name="family" value={form.family} onChange={(e) => definir('family', e.target.value)} autoComplete="family-name" />
                </Campo>
              </div>
            </fieldset>

            <fieldset>
              <legend>Dados pessoais</legend>
              <div className="grade">
                <Campo rotulo="Gênero" colunas={4}>
                  <Selecao valor={form.gender} opcoes={GENEROS} aoMudar={(v) => definir('gender', v)} vazio="Não informado" />
                </Campo>
                <Campo rotulo="Data de nascimento" colunas={4} erro={erroDe('birthDate')}>
                  <input name="birthDate" type="date" value={form.birthDate} onChange={(e) => definir('birthDate', e.target.value)} />
                </Campo>
                <Campo rotulo="Estado civil" colunas={4}>
                  <Selecao valor={form.maritalStatus} opcoes={ESTADOS_CIVIS} aoMudar={(v) => definir('maritalStatus', v)} vazio="Não informado" />
                </Campo>
              </div>
              <label className="interruptor">
                <input type="checkbox" checked={form.active} onChange={(e) => definir('active', e.target.checked)} />
                <span className="interruptor-trilho" aria-hidden="true" />
                Cadastro ativo
              </label>
            </fieldset>

            <fieldset>
              <legend>Nascimento múltiplo e óbito</legend>
              <div className="grade">
                <Campo rotulo="Nascimento múltiplo (gêmeos, trigêmeos…)" colunas={6}>
                  <Selecao
                    valor={form.nascimentoMultiplo}
                    opcoes={[{ value: 'nao', label: 'Não' }, { value: 'sim', label: 'Sim' }]}
                    aoMudar={(v) => definir('nascimentoMultiplo', v)}
                    vazio="Não informado"
                  />
                </Campo>
                {form.nascimentoMultiplo === 'sim' && (
                  <Campo rotulo="Ordem de nascimento" colunas={6} erro={erroDe('ordemNascimento')} dica="Opcional. 1 para o primeiro a nascer.">
                    <input name="ordemNascimento" type="number" min="1" max="20" value={form.ordemNascimento} onChange={(e) => definir('ordemNascimento', e.target.value)} />
                  </Campo>
                )}
              </div>
              <label className="opcao opcao-espaco">
                <input type="checkbox" checked={form.falecido} onChange={(e) => definir('falecido', e.target.checked)} />
                Paciente falecido
              </label>
              {form.falecido && (
                <div className="grade grade-espaco">
                  <Campo rotulo="Data do óbito" colunas={6} erro={erroDe('dataObito')} dica="Opcional.">
                    <input name="dataObito" type="date" value={form.dataObito} onChange={(e) => definir('dataObito', e.target.value)} />
                  </Campo>
                </div>
              )}
            </fieldset>

            <fieldset>
              <legend>Telefones e e-mails</legend>
              {form.telecom.map((t, i) => (
                <div className="linha-repetida" key={i}>
                  <Campo rotulo="Tipo" largura="p">
                    <Selecao valor={t.system} opcoes={TELECOM_SISTEMAS} aoMudar={(v) => definirItem('telecom', i, 'system', v)} />
                  </Campo>
                  <Campo rotulo="Valor" largura="g" erro={erroDe(`telecom.${i}.value`)}>
                    <input
                      name={`telecom.${i}.value`}
                      type={TIPO_INPUT[t.system] || 'text'}
                      value={t.value}
                      placeholder={DICA_TELECOM[t.system]}
                      onChange={(e) => definirItem('telecom', i, 'value', SISTEMAS_TELEFONE.includes(t.system) ? mascaraTelefone(e.target.value) : e.target.value)}
                    />
                  </Campo>
                  <Campo rotulo="Uso" largura="p">
                    <Selecao valor={t.use} opcoes={TELECOM_USOS} aoMudar={(v) => definirItem('telecom', i, 'use', v)} vazio="—" />
                  </Campo>
                  <BotaoRemover rotulo="Remover telefone ou e-mail" aoClicar={() => remover('telecom', i)} />
                </div>
              ))}
              <button type="button" className="botao-adicionar" onClick={() => adicionar('telecom', novoTelecom)}>Adicionar telefone ou e-mail</button>
            </fieldset>

            <fieldset>
              <legend>Endereços</legend>
              {form.address.map((a, i) => (
                <div className="bloco-repetido" key={i}>
                  <div className="grade">
                    <Campo rotulo="CEP" colunas={3} erro={erroDe(`address.${i}.postalCode`)} dica={cep[i]?.msg}>
                      <input
                        name={`address.${i}.postalCode`}
                        value={a.postalCode}
                        onChange={(e) => aoMudarCep(i, e.target.value, a.country)}
                        inputMode="numeric"
                        placeholder="00000-000"
                        autoComplete="postal-code"
                      />
                    </Campo>
                    <Campo rotulo="Uso" colunas={3}>
                      <Selecao valor={a.use} opcoes={ENDERECO_USOS} aoMudar={(v) => definirItem('address', i, 'use', v)} vazio="—" />
                    </Campo>
                    <Campo rotulo="País" colunas={6}>
                      <input value={a.country} onChange={(e) => definirItem('address', i, 'country', e.target.value)} autoComplete="country-name" />
                    </Campo>
                    <Campo rotulo="Logradouro, número e complemento" colunas={12}>
                      <textarea rows={2} value={a.line} onChange={(e) => definirItem('address', i, 'line', e.target.value)} placeholder="Uma linha por parte do endereço" autoComplete="street-address" />
                    </Campo>
                    <Campo rotulo="Bairro" colunas={5}>
                      <input value={a.district} onChange={(e) => definirItem('address', i, 'district', e.target.value)} />
                    </Campo>
                    <Campo rotulo="Cidade" colunas={5}>
                      <input value={a.city} onChange={(e) => definirItem('address', i, 'city', e.target.value)} autoComplete="address-level2" />
                    </Campo>
                    <Campo rotulo="UF" colunas={2}>
                      <input value={a.state} onChange={(e) => definirItem('address', i, 'state', e.target.value.toUpperCase())} maxLength={30} autoComplete="address-level1" />
                    </Campo>
                  </div>
                  <button type="button" className="botao-texto botao-texto-perigo" onClick={() => remover('address', i)}>Remover endereço</button>
                </div>
              ))}
              <button type="button" className="botao-adicionar" onClick={() => adicionar('address', novoEndereco)}>Adicionar endereço</button>
            </fieldset>

            <fieldset>
              <legend>Contatos do paciente</legend>
              <p className="ajuda">Familiares, responsáveis ou contatos de emergência.</p>
              {form.contact.map((c, i) => (
                <div className="bloco-repetido" key={i}>
                  <div className="grade">
                    <Campo rotulo="Relação" colunas={4}>
                      <Selecao valor={c.relationship} opcoes={PARENTESCOS} aoMudar={(v) => definirItem('contact', i, 'relationship', v)} vazio="Não informada" />
                    </Campo>
                    <Campo rotulo="Nome" colunas={4} erro={erroDe(`contact.${i}.given`)}>
                      <input name={`contact.${i}.given`} value={c.given} onChange={(e) => definirItem('contact', i, 'given', e.target.value)} />
                    </Campo>
                    <Campo rotulo="Sobrenome" colunas={4}>
                      <input value={c.family} onChange={(e) => definirItem('contact', i, 'family', e.target.value)} />
                    </Campo>
                    <Campo rotulo="Telefone" colunas={6} erro={erroDe(`contact.${i}.phone`)}>
                      <input name={`contact.${i}.phone`} type="tel" value={c.phone} placeholder="(51) 99999-0000" onChange={(e) => definirItem('contact', i, 'phone', mascaraTelefone(e.target.value))} />
                    </Campo>
                    <Campo rotulo="E-mail" colunas={6} erro={erroDe(`contact.${i}.email`)}>
                      <input name={`contact.${i}.email`} type="email" value={c.email} onChange={(e) => definirItem('contact', i, 'email', e.target.value)} />
                    </Campo>
                  </div>
                  <button type="button" className="botao-texto botao-texto-perigo" onClick={() => remover('contact', i)}>Remover contato</button>
                </div>
              ))}
              <button type="button" className="botao-adicionar" onClick={() => adicionar('contact', novoContato)}>Adicionar contato</button>
            </fieldset>

            <fieldset>
              <legend>Idiomas</legend>
              {form.communication.map((c, i) => (
                <div className="linha-repetida" key={i}>
                  <Campo rotulo="Idioma" largura="g">
                    <Selecao valor={c.language} opcoes={IDIOMAS} aoMudar={(v) => definirItem('communication', i, 'language', v)} vazio="Selecione" />
                  </Campo>
                  <label className="opcao">
                    <input type="checkbox" checked={c.preferred} onChange={(e) => definirItem('communication', i, 'preferred', e.target.checked)} />
                    Preferido
                  </label>
                  <BotaoRemover rotulo="Remover idioma" aoClicar={() => remover('communication', i)} />
                </div>
              ))}
              <button type="button" className="botao-adicionar" onClick={() => adicionar('communication', novoIdioma)}>Adicionar idioma</button>
            </fieldset>
          </>
        )}
      </form>
    </Painel>
  );
}
