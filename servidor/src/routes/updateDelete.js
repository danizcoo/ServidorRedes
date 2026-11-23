// Operações Update e Delete (Pessoa 3).
//
// Este arquivo é a mesma lógica que existia em src/routes/patient.js (versão Express),
// portada para o módulo http puro e para as funções compartilhadas de identificador
// e de erro (OperationOutcome). O comportamento foi mantido; a Pessoa 3 continua
// responsável por evoluí-lo (validação completa, 422, 410 etc.).
//
//   PUT    {caminho}/Patient/<ID>  -> 200 OK                     | 400, 404, 413
//   DELETE {caminho}/Patient/<ID>  -> 204 No Content             | 400

const { interpretarId, extrairIdentificador } = require('../util/identificador');
const { lerCorpoJson } = require('../util/corpo');
const { enviarJson, enviarSemConteudo, enviarErro } = require('../util/resposta');
const { validarMinimo } = require('../validacao/validarMinimo');

function criarRotasUpdateDelete({ armazenamento } = {}) {
  if (!armazenamento) throw new Error('criarRotasUpdateDelete: informe o armazenamento.');

  // ---------- PUT /Patient/<ID> — Update ----------
  async function update(req, res, { params }) {
    const id = interpretarId(params.id);
    if (id === null) return enviarErro(res, 400, 'invalid', 'ID deve ser um inteiro positivo.');

    const corpo = await lerCorpoJson(req);
    if (!corpo.ok) return enviarErro(res, corpo.status, corpo.code, corpo.mensagem);

    const minimo = validarMinimo(corpo.dados);
    if (!minimo.ok) return enviarErro(res, 400, 'invalid', minimo.mensagem);

    if (extrairIdentificador(corpo.dados) !== id) {
      return enviarErro(res, 400, 'invalid', 'identifier ausente ou diferente do ID da URL.');
    }

    // TODO (Pessoa 3): validação do recurso (400 / 422)
    const atualizado = await armazenamento.atualizar(id, corpo.dados);
    if (!atualizado) return enviarErro(res, 404, 'not-found', `Recurso Patient/${id} não encontrado.`);
    return enviarJson(res, 200, atualizado);
  }

  // ---------- DELETE /Patient/<ID> — Delete ----------
  async function remover(req, res, { params }) {
    const id = interpretarId(params.id);
    if (id === null) return enviarErro(res, 400, 'invalid', 'ID deve ser um inteiro positivo.');

    await armazenamento.excluir(id);
    return enviarSemConteudo(res, 204);
  }

  return [
    { metodo: 'PUT', caminho: '/Patient/:id', tratar: update },
    { metodo: 'DELETE', caminho: '/Patient/:id', tratar: remover },
  ];
}

module.exports = { criarRotasUpdateDelete };
