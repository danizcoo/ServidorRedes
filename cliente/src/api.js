// Comunicação com o servidor PatientsOnFIRE via fetch.
// Cada requisição é registrada (método, caminho, status) para o painel
// "Requisições" da interface.

export const API_URL = (import.meta.env?.VITE_API_URL || 'http://localhost:3000').replace(/\/+$/, '');

export const STATUS_TEXTO = {
  0: 'Sem resposta',
  200: 'OK',
  201: 'Created',
  202: 'Accepted',
  204: 'No Content',
  400: 'Bad Request',
  404: 'Not Found',
  405: 'Method Not Allowed',
  410: 'Gone',
  415: 'Unsupported Media Type',
  422: 'Unprocessable Entity',
  500: 'Internal Server Error',
};

const DESCRICAO_ERRO = {
  0: 'Sem conexão com o cadastro. Confira a internet e tente de novo; se continuar, avise o suporte.',
  400: 'Os dados foram recusados pelo servidor. Confira os campos e tente de novo.',
  404: 'Paciente não encontrado.',
  410: 'Este paciente foi excluído.',
  422: 'Os dados não atendem às regras do cadastro.',
  500: 'O servidor encontrou um erro interno. Tente de novo em instantes.',
};

// `tecnico`: detalhe extra mostrado só no modo técnico (ex.: o endereço do servidor).
export class ErroApi extends Error {
  constructor(status, descricao, detalhes = [], tecnico = '') {
    super(detalhes.length ? `${descricao} ${detalhes.join(' ')}` : descricao);
    this.name = 'ErroApi';
    this.status = status;
    this.descricao = descricao;
    this.detalhes = detalhes;
    this.tecnico = tecnico;
  }
}

// Extrai mensagens do corpo de erro, aceitando { erro }, { erros: [] },
// OperationOutcome do FHIR, etc.
function extrairDetalhes(dados) {
  if (!dados) return [];
  if (typeof dados === 'string') return [dados];
  const lista = [];
  if (dados.resourceType === 'OperationOutcome' && Array.isArray(dados.issue)) {
    for (const issue of dados.issue) {
      const texto = issue.diagnostics || issue.details?.text;
      if (texto) lista.push(issue.expression?.length ? `${issue.expression.join(', ')}: ${texto}` : texto);
    }
  }
  for (const chave of ['erro', 'mensagem', 'message', 'error']) {
    if (typeof dados[chave] === 'string') lista.push(dados[chave]);
  }
  for (const chave of ['erros', 'detalhes', 'errors', 'details']) {
    const v = dados[chave];
    if (typeof v === 'string') lista.push(v);
    else if (Array.isArray(v)) {
      lista.push(...v.map((e) => (typeof e === 'string' ? e : e.mensagem || e.message || e.erro || JSON.stringify(e))));
    }
  }
  return [...new Set(lista)];
}

// ---------- registro de requisições ----------
const ouvintes = new Set();
let sequencia = 0;

export function aoRequisitar(fn) {
  ouvintes.add(fn);
  return () => ouvintes.delete(fn);
}

function registrar(entrada) {
  const item = { id: ++sequencia, hora: new Date(), ...entrada };
  ouvintes.forEach((fn) => fn(item));
}

async function requisicao(metodo, caminho, corpo) {
  const opcoes = { method: metodo, headers: { Accept: 'application/fhir+json, application/json' } };
  if (corpo !== undefined) {
    opcoes.headers['Content-Type'] = 'application/json';
    // texto é enviado como está (aba JSON do formulário), inclusive se tiver erro de sintaxe
    opcoes.body = typeof corpo === 'string' ? corpo : JSON.stringify(corpo);
  }

  let resposta;
  try {
    resposta = await fetch(API_URL + caminho, opcoes);
  } catch {
    registrar({ metodo, caminho, status: 0 });
    throw new ErroApi(0, DESCRICAO_ERRO[0], [], `${metodo} ${API_URL}${caminho} não obteve resposta. Confira se o servidor está rodando.`);
  }

  const texto = await resposta.text();
  let dados = null;
  if (texto) {
    try { dados = JSON.parse(texto); } catch { dados = texto; }
  }
  registrar({ metodo, caminho, status: resposta.status });

  if (!resposta.ok) {
    const descricao = DESCRICAO_ERRO[resposta.status] || `O servidor respondeu com erro HTTP ${resposta.status}.`;
    throw new ErroApi(resposta.status, descricao, extrairDetalhes(dados));
  }
  return { status: resposta.status, dados, location: resposta.headers.get('Location') };
}

// ---------- operações CRUD ----------

// GET /PatientIDs -> [1, 5, 8] (200) ou lista vazia (204)
export async function listarIDs() {
  const r = await requisicao('GET', '/PatientIDs');
  if (r.status === 204 || r.dados === null) return [];
  if (!Array.isArray(r.dados)) throw new ErroApi(r.status, 'Resposta inesperada de /PatientIDs: era esperado um array JSON.');
  return r.dados;
}

// GET /Patient/<ID>
export async function lerPaciente(id) {
  const r = await requisicao('GET', `/Patient/${encodeURIComponent(id)}`);
  return r.dados;
}

// POST /Patient -> 201 + Location: /Patient/<ID>
// O identifier é atribuído pelo servidor, então não é enviado.
// `recurso` pode ser um objeto ou o texto JSON digitado na aba JSON.
export async function criarPaciente(recurso) {
  let corpo = recurso;
  if (typeof recurso === 'object') {
    const { identifier, id, ...resto } = recurso;
    corpo = resto;
  }
  const r = await requisicao('POST', '/Patient', corpo);
  const idNovo = Number(/\/Patient\/(\d+)/.exec(r.location || '')?.[1]) || null;
  return { status: r.status, paciente: r.dados, location: r.location, id: idNovo };
}

// PUT /Patient/<ID> -> 200 (identifier deve ser igual ao ID da URL)
export async function atualizarPaciente(id, recurso) {
  const r = await requisicao('PUT', `/Patient/${encodeURIComponent(id)}`, recurso);
  return { status: r.status, paciente: r.dados };
}

// DELETE /Patient/<ID> -> 200, 202 ou 204
export async function excluirPaciente(id) {
  const r = await requisicao('DELETE', `/Patient/${encodeURIComponent(id)}`);
  return { status: r.status };
}
