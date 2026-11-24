// Operações Create, Read e PatientIDs (Pessoa 2).
//
//   POST {caminho}/Patient        -> 201 Created + Location   | 400, 413, 422, 500
//   GET  {caminho}/Patient/<ID>   -> 200 OK + recurso Patient  | 400, 404, 410, 500
//   GET  {caminho}/PatientIDs     -> 200 OK + [1, 5, 8]        | 204 (lista vazia), 500
//
// Uso:
//   const rotas = criarRotasCreateRead({ armazenamento, validar });
//   rotas.forEach((rota) => roteador.adicionar(rota));
//
// `armazenamento` precisa ter: criar, atualizar, ler, listarIDs e (opcional) foiExcluido.
// `validar` é o validador da Pessoa 3 (pode ser async). Retorno esperado:
//   { ok: true } | { ok: false, status: 400 | 422, mensagem }

const { interpretarId, aplicarIdentificador } = require('../util/identificador');
const { lerCorpoJson } = require('../util/corpo');
const { enviarJson, enviarSemConteudo, enviarErro } = require('../util/resposta');
const { validarMinimo } = require('../validacao/validarMinimo');

// Converte o retorno do validador em { ok } ou em um erro pronto para enviarErro().
// Qualquer retorno fora do contrato é tratado como 400.
function interpretarValidacao(resultado) {
  if (resultado && resultado.ok === true) return { ok: true };
  const mensagem = (resultado && resultado.mensagem) || 'Recurso Patient inválido.';
  if (resultado && resultado.ok === false && resultado.status === 422) {
    return { ok: false, status: 422, code: 'business-rule', mensagem };
  }
  return { ok: false, status: 400, code: 'invalid', mensagem };
}

// armazenamento.criar() pode devolver o número do ID ou o recurso já com id/identifier.
function idDoCriado(criado) {
  if (criado && typeof criado === 'object') return interpretarId(String(criado.id));
  return interpretarId(criado);
}

// Copia meta do cliente (se for objeto) e grava a data e hora da gravação.
function comMetaAtualizada(paciente, agora = new Date()) {
  const metaCliente = paciente.meta && typeof paciente.meta === 'object' && !Array.isArray(paciente.meta)
    ? paciente.meta
    : {};
  return { ...paciente, meta: { ...metaCliente, lastUpdated: agora.toISOString() } };
}

function criarRotasCreateRead({ armazenamento, validar = null } = {}) {
  if (!armazenamento) throw new Error('criarRotasCreateRead: informe o armazenamento.');

  // ---------- POST /Patient — Create ----------
  async function create(req, res, { caminhoBase }) {
    // 1 e 2. Content-Type, corpo vazio, tamanho e JSON malformado
    const corpo = await lerCorpoJson(req);
    if (!corpo.ok) return enviarErro(res, corpo.status, corpo.code, corpo.mensagem);
    const recebido = corpo.dados;

    // 3. Validação: estrutura mínima sempre; validador completo (Pessoa 3) se plugado.
    //    Até aqui nada foi gravado e nenhum ID foi consumido.
    const minimo = interpretarValidacao(validarMinimo(recebido));
    if (!minimo.ok) return enviarErro(res, minimo.status, minimo.code, minimo.mensagem);

    if (typeof validar === 'function') {
      const completo = interpretarValidacao(await validar(recebido));
      if (!completo.ok) return enviarErro(res, completo.status, completo.code, completo.mensagem);
    }

    // 4. Gera o ID (próximo número sequencial do armazenamento)
    const id = idDoCriado(await armazenamento.criar(recebido));
    if (id === null) throw new Error('armazenamento.criar() não devolveu um ID inteiro positivo.');

    // 5. Monta o recurso final: id/identifier do servidor + meta.lastUpdated
    const recurso = comMetaAtualizada(aplicarIdentificador(recebido, id));

    // 6. Grava a versão final. Responde com o que ficou gravado, para o corpo
    //    do 201 ser igual ao que um Read devolverá depois.
    const gravado = await armazenamento.atualizar(id, recurso);
    const final = gravado && typeof gravado === 'object' ? gravado : recurso;

    // 7. 201 Created + Location
    return enviarJson(res, 201, final, { Location: `${caminhoBase}/Patient/${id}` });
  }

  // ---------- GET /Patient/<ID> — Read ----------
  async function read(req, res, { params }) {
    const id = interpretarId(params.id);
    if (id === null) {
      return enviarErro(res, 400, 'invalid', `ID inválido: "${params.id}". O ID deve ser um inteiro positivo.`);
    }

    const paciente = await armazenamento.ler(id);
    if (paciente) return enviarJson(res, 200, paciente); // devolvido sem alterações

    const excluido = typeof armazenamento.foiExcluido === 'function' && (await armazenamento.foiExcluido(id));
    if (excluido) return enviarErro(res, 410, 'deleted', `Recurso Patient/${id} foi excluído.`);
    return enviarErro(res, 404, 'not-found', `Recurso Patient/${id} não encontrado.`);
  }

  // ---------- GET /PatientIDs — PatientIDs ----------
  async function patientIDs(req, res) {
    const lista = await armazenamento.listarIDs();
    if (!Array.isArray(lista)) throw new Error('armazenamento.listarIDs() não devolveu uma lista.');

    // Converte para número, descarta o que não for inteiro positivo, remove duplicados e ordena
    const ids = [...new Set(lista.map((valor) => interpretarId(valor)).filter((id) => id !== null))]
      .sort((a, b) => a - b);

    if (ids.length === 0) return enviarSemConteudo(res, 204);
    return enviarJson(res, 200, ids);
  }

  return [
    { metodo: 'POST', caminho: '/Patient', tratar: create },
    { metodo: 'GET', caminho: '/Patient/:id', tratar: read },
    { metodo: 'GET', caminho: '/PatientIDs', tratar: patientIDs },
  ];
}

module.exports = { criarRotasCreateRead, interpretarValidacao };
