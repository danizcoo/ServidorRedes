// Validação mínima e provisória do recurso Patient.
// Só confere a estrutura básica: o corpo é um objeto JSON com resourceType "Patient".
// A validação completa dos campos (gender, birthDate, name, telecom, address...) e as
// regras de negócio (422) ficam no validador da Pessoa 3, que é plugado no Create
// pelo parâmetro `validar` de criarRotasCreateRead().
//
// Retorno no mesmo contrato do validador da Pessoa 3:
//   { ok: true } | { ok: false, status: 400, mensagem }

function validarMinimo(paciente) {
  if (paciente === null || typeof paciente !== 'object' || Array.isArray(paciente)) {
    return {
      ok: false,
      status: 400,
      mensagem: 'O corpo da requisição deve ser um objeto JSON com um recurso Patient.',
    };
  }

  if (paciente.resourceType !== 'Patient') {
    const recebido = paciente.resourceType === undefined ? 'ausente' : JSON.stringify(paciente.resourceType);
    return {
      ok: false,
      status: 400,
      mensagem: `resourceType deve ser "Patient" (recebido: ${recebido}).`,
    };
  }

  return { ok: true };
}

module.exports = { validarMinimo };
