// Validação do formulário (feita no navegador, antes de enviar) e máscaras de entrada.
// O servidor continua sendo a referência: ele responde 400/422 para o que passar daqui.

export const digitos = (s) => (s || '').replace(/\D/g, '');

// (51) 3333-4444 ou (51) 99999-0000. Números com "+" (internacionais) não são mascarados.
export function mascaraTelefone(valor) {
  if (/^\s*\+/.test(valor)) return valor;
  const d = digitos(valor).slice(0, 11);
  if (d.length === 0) return '';
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function mascaraCep(valor) {
  const d = digitos(valor).slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

export const ehBrasil = (pais) => !pais || /^bra[sz]il|^br$/i.test(pais.trim());

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function erroTelefone(v) {
  const n = digitos(v).length;
  return n < 8 || n > 15 ? 'O telefone deve ter entre 8 e 15 dígitos.' : null;
}

function erroTelecom(sistema, valor) {
  if (!valor.trim()) return null;
  if (sistema === 'email') return EMAIL.test(valor.trim()) ? null : 'E-mail inválido. Exemplo: nome@dominio.com';
  if (['phone', 'sms', 'fax', 'pager'].includes(sistema)) return erroTelefone(valor);
  if (sistema === 'url') {
    try { new URL(valor.trim()); return null; } catch { return 'Endereço inválido. Comece com http:// ou https://'; }
  }
  return null;
}

// Retorna um objeto { caminhoDoCampo: mensagem }. Vazio = formulário válido.
export function validarFormulario(form) {
  const erros = {};

  if (!form.given.trim() && !form.family.trim()) {
    erros.given = 'Informe o nome ou o sobrenome do paciente.';
  }

  if (form.birthDate) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(form.birthDate);
    const hoje = new Date().toISOString().slice(0, 10);
    if (!m) erros.birthDate = 'Data inválida.';
    else if (form.birthDate > hoje) erros.birthDate = 'A data de nascimento não pode estar no futuro.';
    else if (Number(m[1]) < 1900) erros.birthDate = 'Confira o ano: a data é anterior a 1900.';
  }

  if (form.falecido && form.dataObito) {
    const hoje = new Date().toISOString().slice(0, 10);
    if (form.dataObito > hoje) erros.dataObito = 'A data do óbito não pode estar no futuro.';
    else if (form.birthDate && form.dataObito < form.birthDate) erros.dataObito = 'A data do óbito não pode ser anterior ao nascimento.';
  }

  if (form.nascimentoMultiplo === 'sim' && form.ordemNascimento !== '') {
    const n = Number(form.ordemNascimento);
    if (!Number.isInteger(n) || n < 1 || n > 20) erros.ordemNascimento = 'Use um número inteiro: 1 para o primeiro a nascer, 2 para o segundo…';
  }

  form.telecom.forEach((t, i) => {
    const e = erroTelecom(t.system, t.value);
    if (e) erros[`telecom.${i}.value`] = e;
  });

  form.address.forEach((a, i) => {
    if (a.postalCode && ehBrasil(a.country) && digitos(a.postalCode).length !== 8) {
      erros[`address.${i}.postalCode`] = 'O CEP deve ter 8 dígitos.';
    }
  });

  form.contact.forEach((c, i) => {
    if (!c.given.trim() && !c.family.trim() && !c.phone.trim() && !c.email.trim()) {
      erros[`contact.${i}.given`] = 'Preencha nome, telefone ou e-mail do contato, ou remova-o.';
    }
    const tel = c.phone.trim() && erroTelefone(c.phone);
    if (tel) erros[`contact.${i}.phone`] = tel;
    if (c.email.trim() && !EMAIL.test(c.email.trim())) erros[`contact.${i}.email`] = 'E-mail inválido.';
  });

  return erros;
}

// Consulta o CEP no ViaCEP (serviço público dos Correios/IBGE).
export async function buscarCep(cep) {
  const d = digitos(cep);
  const resposta = await fetch(`https://viacep.com.br/ws/${d}/json/`);
  if (!resposta.ok) throw new Error('CEP não encontrado.');
  const dados = await resposta.json();
  if (dados.erro) throw new Error('CEP não encontrado.');
  return { line: dados.logradouro || '', district: dados.bairro || '', city: dados.localidade || '', state: dados.uf || '' };
}
