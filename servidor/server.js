// Servidor PatientsOnFIRE - ponto de entrada.
// Implementado apenas com o módulo http nativo do Node.js (sem Express ou outros frameworks).

const http = require('http');
const { criarRoteador, normalizarCaminhoBase } = require('./src/roteador');
const { criarRotasCreateRead } = require('./src/routes/createRead');
const { criarRotasUpdateDelete } = require('./src/routes/updateDelete');
const { enviarErro, enviarSemConteudo } = require('./src/util/resposta');

const PORTA = Number(process.env.PORT) || 3000;
const CAMINHO_BASE = process.env.CAMINHO_BASE || ''; // {caminho} opcional, ex.: "/fhir"

// CORS: permite que o cliente HTML (outra origem, ou file://) acesse a API
const CABECALHOS_CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Expose-Headers': 'Location', // o cliente precisa ler o Location do 201
};

// Monta o servidor. Recebe as dependências para permitir testes com outro armazenamento.
function criarServidor({ armazenamento, validar = null, caminhoBase = CAMINHO_BASE } = {}) {
  const roteador = criarRoteador({ caminhoBase });
  criarRotasCreateRead({ armazenamento, validar }).forEach(roteador.adicionar);
  criarRotasUpdateDelete({ armazenamento }).forEach(roteador.adicionar);

  return http.createServer(async (req, res) => {
    for (const [nome, valor] of Object.entries(CABECALHOS_CORS)) res.setHeader(nome, valor);

    // Preflight CORS
    if (req.method === 'OPTIONS') return enviarSemConteudo(res, 204);

    try {
      await roteador.tratar(req, res);
    } catch (err) {
      // Falha inesperada (ex.: armazenamento): 500 e o servidor continua no ar
      console.error(`[${new Date().toISOString()}] ${req.method} ${req.url}:`, err);
      enviarErro(res, 500, 'exception', 'Erro interno no servidor.');
    }
  });
}

module.exports = { criarServidor };

// Executado diretamente (npm start): usa o armazenamento real e começa a escutar
if (require.main === module) {
  const armazenamento = require('./src/storage');
  const servidor = criarServidor({ armazenamento });
  servidor.listen(PORTA, () => {
    console.log(`PatientsOnFIRE rodando em http://localhost:${PORTA}${normalizarCaminhoBase(CAMINHO_BASE)}`);
  });
}
