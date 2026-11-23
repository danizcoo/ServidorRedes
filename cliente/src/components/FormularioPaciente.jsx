import { useRef, useState } from 'react';
import Painel from './Painel';
import ErroServidor from './ErroServidor';
import {
  GENEROS, ESTADOS_CIVIS, TELECOM_SISTEMAS, TELECOM_USOS, ENDERECO_USOS, PARENTESCOS, IDIOMAS,
  paraFormulario, deFormulario, novoTelecom, novoEndereco, novoContato, novoIdioma, idPaciente, nomeCompleto,
} from '../fhir';

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

// `largura` (p/m/g) é usada nas linhas flexíveis; `colunas` (1–12) na grade.
function Campo({ rotulo, largura, colunas, children }) {
  return (
    <label className={`campo${largura ? ` campo-${largura}` : ''}`} style={colunas ? { '--colunas': colunas } : undefined}>
      <span className="campo-rotulo">{rotulo}</span>
      {children}
    </label>
  );
}

function BotaoRemover({ aoClicar, rotulo }) {
  return (
    <button type="button" className="botao-icone botao-remover" onClick={aoClicar} aria-label={rotulo} title={rotulo}>
      <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
        <path d="M5 10h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    </button>
  );
}

const TIPO_INPUT = { email: 'email', phone: 'tel', sms: 'tel', fax: 'tel', url: 'url' };

export default function FormularioPaciente({ paciente, aoSalvar, aoFechar }) {
  const [form, setForm] = useState(() => paraFormulario(paciente));
  const [erro, setErro] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const refErro = useRef(null);

  const editando = Boolean(paciente);
  const id = editando ? idPaciente(paciente) : null;

  const definir = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }));
  const definirItem = (lista, i, campo, valor) =>
    setForm((f) => ({ ...f, [lista]: f[lista].map((item, j) => (j === i ? { ...item, [campo]: valor } : item)) }));
  const adicionar = (lista, fabrica) => setForm((f) => ({ ...f, [lista]: [...f[lista], fabrica()] }));
  const remover = (lista, i) => setForm((f) => ({ ...f, [lista]: f[lista].filter((_, j) => j !== i) }));

  async function enviar(e) {
    e.preventDefault();
    setErro(null);
    setSalvando(true);
    try {
      await aoSalvar(deFormulario(form, paciente || {}));
    } catch (err) {
      setErro(err);
      requestAnimationFrame(() => refErro.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    } finally {
      setSalvando(false);
    }
  }

  const rodape = (
    <>
      <button type="button" className="botao" onClick={aoFechar}>Cancelar</button>
      <button type="submit" form="form-paciente" className="botao botao-primario" disabled={salvando}>
        {salvando ? 'Salvando…' : editando ? 'Salvar alterações' : 'Cadastrar paciente'}
      </button>
    </>
  );

  return (
    <Painel
      titulo={editando ? `Editar ${nomeCompleto(paciente) || 'paciente'}` : 'Cadastrar paciente'}
      subtitulo={editando ? `PUT /Patient/${id}` : 'POST /Patient — o servidor atribui o ID'}
      aoFechar={aoFechar}
      rodape={rodape}
    >
      <form id="form-paciente" className="formulario" onSubmit={enviar}>
        <div ref={refErro}>{erro && <ErroServidor erro={erro} />}</div>

        <fieldset>
          <legend>Nome</legend>
          <div className="grade">
            <Campo rotulo="Tratamento" colunas={2}>
              <input value={form.prefix} onChange={(e) => definir('prefix', e.target.value)} placeholder="Dr., Sra." autoComplete="honorific-prefix" />
            </Campo>
            <Campo rotulo="Nome" colunas={5}>
              <input value={form.given} onChange={(e) => definir('given', e.target.value)} autoComplete="given-name" autoFocus />
            </Campo>
            <Campo rotulo="Sobrenome" colunas={5}>
              <input value={form.family} onChange={(e) => definir('family', e.target.value)} autoComplete="family-name" />
            </Campo>
          </div>
        </fieldset>

        <fieldset>
          <legend>Dados pessoais</legend>
          <div className="grade">
            <Campo rotulo="Gênero" colunas={4}>
              <Selecao valor={form.gender} opcoes={GENEROS} aoMudar={(v) => definir('gender', v)} vazio="Não informado" />
            </Campo>
            <Campo rotulo="Data de nascimento" colunas={4}>
              <input type="date" value={form.birthDate} onChange={(e) => definir('birthDate', e.target.value)} max={new Date().toISOString().slice(0, 10)} />
            </Campo>
            <Campo rotulo="Estado civil" colunas={4}>
              <Selecao valor={form.maritalStatus} opcoes={ESTADOS_CIVIS} aoMudar={(v) => definir('maritalStatus', v)} vazio="Não informado" />
            </Campo>
          </div>
          <label className="opcao">
            <input type="checkbox" checked={form.active} onChange={(e) => definir('active', e.target.checked)} />
            Cadastro ativo
          </label>
        </fieldset>

        <fieldset>
          <legend>Telefones e e-mails</legend>
          {form.telecom.map((t, i) => (
            <div className="linha-repetida" key={i}>
              <Campo rotulo="Tipo" largura="p">
                <Selecao valor={t.system} opcoes={TELECOM_SISTEMAS} aoMudar={(v) => definirItem('telecom', i, 'system', v)} />
              </Campo>
              <Campo rotulo="Valor" largura="g">
                <input type={TIPO_INPUT[t.system] || 'text'} value={t.value} onChange={(e) => definirItem('telecom', i, 'value', e.target.value)} />
              </Campo>
              <Campo rotulo="Uso" largura="p">
                <Selecao valor={t.use} opcoes={TELECOM_USOS} aoMudar={(v) => definirItem('telecom', i, 'use', v)} vazio="—" />
              </Campo>
              <BotaoRemover rotulo="Remover contato" aoClicar={() => remover('telecom', i)} />
            </div>
          ))}
          <button type="button" className="botao-texto" onClick={() => adicionar('telecom', novoTelecom)}>Adicionar telefone ou e-mail</button>
        </fieldset>

        <fieldset>
          <legend>Endereços</legend>
          {form.address.map((a, i) => (
            <div className="bloco-repetido" key={i}>
              <div className="grade">
                <Campo rotulo="Uso" colunas={3}>
                  <Selecao valor={a.use} opcoes={ENDERECO_USOS} aoMudar={(v) => definirItem('address', i, 'use', v)} vazio="—" />
                </Campo>
                <Campo rotulo="Logradouro e número" colunas={9}>
                  <textarea rows={2} value={a.line} onChange={(e) => definirItem('address', i, 'line', e.target.value)} placeholder="Uma linha por parte do endereço" autoComplete="street-address" />
                </Campo>
                <Campo rotulo="Bairro" colunas={5}>
                  <input value={a.district} onChange={(e) => definirItem('address', i, 'district', e.target.value)} />
                </Campo>
                <Campo rotulo="Cidade" colunas={5}>
                  <input value={a.city} onChange={(e) => definirItem('address', i, 'city', e.target.value)} autoComplete="address-level2" />
                </Campo>
                <Campo rotulo="UF" colunas={2}>
                  <input value={a.state} onChange={(e) => definirItem('address', i, 'state', e.target.value)} maxLength={30} autoComplete="address-level1" />
                </Campo>
                <Campo rotulo="CEP" colunas={4}>
                  <input value={a.postalCode} onChange={(e) => definirItem('address', i, 'postalCode', e.target.value)} inputMode="numeric" autoComplete="postal-code" />
                </Campo>
                <Campo rotulo="País" colunas={5}>
                  <input value={a.country} onChange={(e) => definirItem('address', i, 'country', e.target.value)} autoComplete="country-name" />
                </Campo>
              </div>
              <button type="button" className="botao-texto botao-texto-perigo" onClick={() => remover('address', i)}>Remover endereço</button>
            </div>
          ))}
          <button type="button" className="botao-texto" onClick={() => adicionar('address', novoEndereco)}>Adicionar endereço</button>
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
                <Campo rotulo="Nome" colunas={5}>
                  <input value={c.given} onChange={(e) => definirItem('contact', i, 'given', e.target.value)} />
                </Campo>
                <Campo rotulo="Sobrenome" colunas={5}>
                  <input value={c.family} onChange={(e) => definirItem('contact', i, 'family', e.target.value)} />
                </Campo>
                <Campo rotulo="Telefone" colunas={6}>
                  <input type="tel" value={c.phone} onChange={(e) => definirItem('contact', i, 'phone', e.target.value)} />
                </Campo>
                <Campo rotulo="E-mail" colunas={6}>
                  <input type="email" value={c.email} onChange={(e) => definirItem('contact', i, 'email', e.target.value)} />
                </Campo>
              </div>
              <button type="button" className="botao-texto botao-texto-perigo" onClick={() => remover('contact', i)}>Remover contato</button>
            </div>
          ))}
          <button type="button" className="botao-texto" onClick={() => adicionar('contact', novoContato)}>Adicionar contato</button>
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
          <button type="button" className="botao-texto" onClick={() => adicionar('communication', novoIdioma)}>Adicionar idioma</button>
        </fieldset>
      </form>
    </Painel>
  );
}
