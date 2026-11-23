// Funções para escrever respostas HTTP com o módulo http puro do Node.
// Todo erro 4xx/5xx sai como um recurso FHIR OperationOutcome:
//   { resourceType: 'OperationOutcome', issue: [{ severity, code, diagnostics }] }

const TIPO_JSON = 'application/json; charset=utf-8';

// Responde com um corpo JSON.
function enviarJson(res, status, dados, cabecalhos = {}) {
  const corpo = JSON.stringify(dados);
  res.writeHead(status, {
    ...cabecalhos,
    'Content-Type': TIPO_JSON,
    'Content-Length': Buffer.byteLength(corpo),
  });
  res.end(corpo);
}

// Responde sem corpo (ex.: 204 No Content).
function enviarSemConteudo(res, status = 204, cabecalhos = {}) {
  res.writeHead(status, cabecalhos);
  res.end();
}

// Monta um OperationOutcome com um único issue.
function operationOutcome(code, diagnostics, severity = 'error') {
  return {
    resourceType: 'OperationOutcome',
    issue: [{ severity, code, diagnostics }],
  };
}

// Responde um erro no formato padronizado.
// code: structure | invalid | business-rule | not-found | deleted | too-costly | not-supported | exception
function enviarErro(res, status, code, mensagem, cabecalhos = {}) {
  if (res.headersSent) {
    res.end();
    return;
  }
  enviarJson(res, status, operationOutcome(code, mensagem), cabecalhos);
}

module.exports = { enviarJson, enviarSemConteudo, enviarErro, operationOutcome };
