// Conversão entre o recurso Patient (FHIR v5.0.0) e o estado do formulário,
// além de tabelas de códigos e funções de exibição.

export const SISTEMA_ID = 'urn:patientsonfire:id';

const V3_ESTADO_CIVIL = 'http://terminology.hl7.org/CodeSystem/v3-MaritalStatus';
const V3_NULL_FLAVOR = 'http://terminology.hl7.org/CodeSystem/v3-NullFlavor';
const V2_PARENTESCO = 'http://terminology.hl7.org/CodeSystem/v2-0131';
const BCP47 = 'urn:ietf:bcp:47';

// ---------- tabelas de códigos (value sets FHIR) ----------
export const GENEROS = [
  { value: 'female', label: 'Feminino' },
  { value: 'male', label: 'Masculino' },
  { value: 'other', label: 'Outro' },
  { value: 'unknown', label: 'Desconhecido' },
];

export const ESTADOS_CIVIS = [
  { value: 'S', label: 'Solteiro(a)', system: V3_ESTADO_CIVIL },
  { value: 'M', label: 'Casado(a)', system: V3_ESTADO_CIVIL },
  { value: 'T', label: 'União estável', system: V3_ESTADO_CIVIL },
  { value: 'L', label: 'Separado(a) judicialmente', system: V3_ESTADO_CIVIL },
  { value: 'D', label: 'Divorciado(a)', system: V3_ESTADO_CIVIL },
  { value: 'W', label: 'Viúvo(a)', system: V3_ESTADO_CIVIL },
  { value: 'U', label: 'Não casado(a)', system: V3_ESTADO_CIVIL },
  { value: 'UNK', label: 'Desconhecido', system: V3_NULL_FLAVOR },
];

export const TELECOM_SISTEMAS = [
  { value: 'phone', label: 'Telefone' },
  { value: 'email', label: 'E-mail' },
  { value: 'sms', label: 'SMS' },
  { value: 'fax', label: 'Fax' },
  { value: 'pager', label: 'Pager' },
  { value: 'url', label: 'Site' },
  { value: 'other', label: 'Outro' },
];

export const TELECOM_USOS = [
  { value: 'mobile', label: 'Celular' },
  { value: 'home', label: 'Residencial' },
  { value: 'work', label: 'Trabalho' },
  { value: 'temp', label: 'Temporário' },
  { value: 'old', label: 'Antigo' },
];

export const ENDERECO_USOS = [
  { value: 'home', label: 'Residencial' },
  { value: 'work', label: 'Trabalho' },
  { value: 'temp', label: 'Temporário' },
  { value: 'billing', label: 'Cobrança' },
  { value: 'old', label: 'Antigo' },
];

export const PARENTESCOS = [
  { value: 'N', label: 'Parente próximo' },
  { value: 'C', label: 'Contato de emergência' },
  { value: 'E', label: 'Empregador' },
  { value: 'I', label: 'Seguradora' },
  { value: 'F', label: 'Agência federal' },
  { value: 'S', label: 'Agência estadual' },
  { value: 'U', label: 'Desconhecido' },
];

export const IDIOMAS = [
  { value: 'pt-BR', label: 'Português (Brasil)' },
  { value: 'pt-PT', label: 'Português (Portugal)' },
  { value: 'sgn-BR', label: 'Libras' },
  { value: 'es', label: 'Espanhol' },
  { value: 'en-US', label: 'Inglês (EUA)' },
  { value: 'en-GB', label: 'Inglês (Reino Unido)' },
  { value: 'fr', label: 'Francês' },
  { value: 'it', label: 'Italiano' },
  { value: 'de', label: 'Alemão' },
  { value: 'ja', label: 'Japonês' },
  { value: 'zh', label: 'Chinês' },
];

export function rotulo(lista, valor) {
  const item = lista.find((i) => i.value === valor);
  return item ? item.label : valor || '';
}

// ---------- utilitários ----------
const palavras = (s) => (s || '').trim().split(/\s+/).filter(Boolean);

function vazio(v) {
  if (v === undefined || v === null || v === '') return true;
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === 'object') return Object.keys(v).length === 0;
  return false;
}

// Remove recursivamente chaves vazias ('' / null / undefined / [] / {}).
export function limpar(valor) {
  if (Array.isArray(valor)) return valor.map(limpar).filter((v) => !vazio(v));
  if (valor && typeof valor === 'object') {
    const saida = {};
    for (const [k, v] of Object.entries(valor)) {
      const limpo = limpar(v);
      if (!vazio(limpo)) saida[k] = limpo;
    }
    return saida;
  }
  return typeof valor === 'string' ? valor.trim() : valor;
}

function definir(recurso, chave, valor) {
  const limpo = limpar(valor);
  if (vazio(limpo)) delete recurso[chave];
  else recurso[chave] = limpo;
}

// ---------- formulário ----------
export const novoTelecom = () => ({ system: 'phone', value: '', use: 'mobile' });
export const novoEndereco = () => ({
  use: 'home', line: '', district: '', city: '', state: '', postalCode: '', country: 'Brasil',
});
export const novoContato = () => ({ relationship: 'N', family: '', given: '', phone: '', email: '' });
export const novoIdioma = () => ({ language: 'pt-BR', preferred: false });

export function formularioVazio() {
  return {
    active: true,
    prefix: '',
    given: '',
    family: '',
    gender: '',
    birthDate: '',
    maritalStatus: '',
    telecom: [novoTelecom()],
    address: [novoEndereco()],
    contact: [],
    communication: [{ language: 'pt-BR', preferred: true }],
  };
}

// Patient -> estado do formulário
export function paraFormulario(p) {
  if (!p) return formularioVazio();
  const nome = (p.name || [])[0] || {};
  return {
    active: p.active !== false,
    prefix: (nome.prefix || []).join(' '),
    given: (nome.given || []).join(' '),
    family: nome.family || '',
    gender: p.gender || '',
    birthDate: p.birthDate || '',
    maritalStatus: p.maritalStatus?.coding?.[0]?.code || '',
    telecom: (p.telecom || []).map((t) => ({
      system: t.system || 'phone',
      value: t.value || '',
      use: t.use || '',
    })),
    address: (p.address || []).map((a) => ({
      use: a.use || '',
      line: (a.line || []).join('\n'),
      district: a.district || '',
      city: a.city || '',
      state: a.state || '',
      postalCode: a.postalCode || '',
      country: a.country || '',
    })),
    contact: (p.contact || []).map((c) => ({
      relationship: c.relationship?.[0]?.coding?.[0]?.code || '',
      family: c.name?.family || '',
      given: (c.name?.given || []).join(' '),
      phone: c.telecom?.find((t) => t.system === 'phone')?.value || '',
      email: c.telecom?.find((t) => t.system === 'email')?.value || '',
    })),
    communication: (p.communication || []).map((c) => ({
      language: c.language?.coding?.[0]?.code || c.language?.text || '',
      preferred: Boolean(c.preferred),
    })),
  };
}

// Estado do formulário -> Patient.
// `base` é o recurso original (na edição): campos que o formulário não
// controla (extension, photo, link...) são preservados.
export function deFormulario(form, base = {}) {
  const r = { ...base, resourceType: 'Patient' };

  r.active = Boolean(form.active);

  const nomeOriginal = (base.name || [])[0] || {};
  const nome = limpar({
    ...nomeOriginal,
    text: undefined,
    use: nomeOriginal.use || 'official',
    prefix: palavras(form.prefix),
    given: palavras(form.given),
    family: form.family,
  });
  const temNome = nome.family || nome.given;
  definir(r, 'name', temNome ? [nome, ...(base.name || []).slice(1)] : (base.name || []).slice(1));

  definir(r, 'telecom', form.telecom
    .filter((t) => t.value.trim())
    .map((t) => ({ system: t.system, value: t.value, use: t.use })));

  definir(r, 'gender', form.gender);
  definir(r, 'birthDate', form.birthDate);

  definir(r, 'address', form.address
    .map((a) => ({
      use: a.use,
      line: a.line.split('\n'),
      district: a.district,
      city: a.city,
      state: a.state,
      postalCode: a.postalCode,
      country: a.country,
    }))
    .filter((a) => [a.line.join(''), a.district, a.city, a.state, a.postalCode].some((v) => v.trim())));

  const civil = ESTADOS_CIVIS.find((e) => e.value === form.maritalStatus);
  if (civil) {
    r.maritalStatus = {
      coding: [{ system: civil.system, code: civil.value, display: civil.label }],
      text: civil.label,
    };
  } else if (!form.maritalStatus) {
    delete r.maritalStatus;
  } // código desconhecido vindo do servidor: mantém como estava

  definir(r, 'contact', form.contact
    .map((c) => {
      const parentesco = PARENTESCOS.find((p) => p.value === c.relationship);
      return {
        relationship: parentesco
          ? [{ coding: [{ system: V2_PARENTESCO, code: parentesco.value, display: parentesco.label }], text: parentesco.label }]
          : undefined,
        name: { family: c.family, given: palavras(c.given) },
        telecom: [
          { system: 'phone', value: c.phone },
          { system: 'email', value: c.email },
        ].filter((t) => t.value.trim()),
      };
    })
    // regra pat-1 do FHIR: o contato precisa ter nome, telecom, endereço ou organização
    .filter((c) => c.name.given.length || c.name.family.trim() || c.telecom.length));

  definir(r, 'communication', form.communication
    .filter((c) => c.language)
    .map((c) => {
      const idioma = IDIOMAS.find((i) => i.value === c.language);
      return {
        language: {
          coding: [{ system: BCP47, code: c.language, display: idioma?.label }],
          text: idioma?.label || c.language,
        },
        preferred: c.preferred || undefined,
      };
    }));

  return r;
}

// ---------- exibição ----------
export function idPaciente(p) {
  const ident = Array.isArray(p?.identifier) ? p.identifier[0] : p?.identifier;
  const n = Number(ident?.value ?? p?.id);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export function nomeCompleto(p) {
  const n = (p?.name || [])[0];
  if (!n) return '';
  return n.text || [...(n.prefix || []), ...(n.given || []), n.family].filter(Boolean).join(' ');
}

export function formatarData(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso || '';
}

export function idade(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  if (!m) return null;
  const hoje = new Date();
  let anos = hoje.getFullYear() - Number(m[1]);
  const mes = hoje.getMonth() + 1 - Number(m[2]);
  if (mes < 0 || (mes === 0 && hoje.getDate() < Number(m[3]))) anos -= 1;
  return anos >= 0 ? anos : null;
}

export function telecomPrincipal(p) {
  const t = p?.telecom || [];
  return t.find((x) => x.system === 'phone') || t.find((x) => x.system === 'email') || t[0] || null;
}

export function enderecoTexto(a) {
  if (!a) return '';
  if (a.text) return a.text;
  const local = [a.city, a.state].filter(Boolean).join('/');
  return [...(a.line || []), a.district, local, a.postalCode, a.country].filter(Boolean).join(', ');
}
