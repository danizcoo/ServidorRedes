// Regra única de identificador do recurso Patient (Create, Read, Update, Delete).
//
// O servidor grava o ID lógico em dois lugares:
//   - id         -> string com o número ("5"), como pede o modelo FHIR;
//   - identifier -> lista com um Identifier { use, system, value }, como pede o enunciado.

const SISTEMA_ID = 'urn:patientsonfire:patient-id';

// Converte o <ID> da URL (ou outro valor) em número inteiro positivo.
// Devolve null para "abc", "0", "-1", "01", "1.5", "" etc.
function interpretarId(texto) {
  if (typeof texto === 'number') texto = String(texto);
  if (typeof texto !== 'string' || !/^[1-9]\d*$/.test(texto)) return null;
  const numero = Number(texto);
  return Number.isSafeInteger(numero) ? numero : null;
}

// Elemento identifier no formato gravado pelo servidor.
function montarIdentifier(id) {
  return [{ use: 'official', system: SISTEMA_ID, value: String(id) }];
}

// Devolve uma cópia do recurso com id e identifier do servidor.
// Qualquer id/identifier enviado pelo cliente é descartado.
function aplicarIdentificador(paciente, id) {
  const { id: _idCliente, identifier: _identifierCliente, resourceType: _tipo, ...resto } = paciente;
  return {
    resourceType: 'Patient',
    id: String(id),
    identifier: montarIdentifier(id),
    ...resto,
  };
}

// Lê o número contido em identifier. Aceita o formato FHIR completo e formas simplificadas:
//   [{ "system": "urn:patientsonfire:patient-id", "value": "5" }]
//   [{ "value": "5" }]   { "value": 5 }   5   "5"
// Devolve null se não houver um inteiro positivo.
function extrairIdentificador(paciente) {
  if (!paciente || typeof paciente !== 'object') return null;
  let ident = paciente.identifier;

  if (Array.isArray(ident)) {
    const doServidor = ident.find((item) => item && item.system === SISTEMA_ID);
    ident = doServidor || ident[0];
  }
  if (ident && typeof ident === 'object') ident = ident.value;

  return interpretarId(ident);
}

module.exports = {
  SISTEMA_ID,
  interpretarId,
  montarIdentifier,
  aplicarIdentificador,
  extrairIdentificador,
};
