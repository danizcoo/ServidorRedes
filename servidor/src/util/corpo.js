// Leitura do corpo das requisições com o módulo http puro do Node
// (substitui o express.json()).

const LIMITE_PADRAO = 1024 * 1024; // 1 MB
const TIPOS_ACEITOS = ['application/json', 'application/fhir+json'];

// true se o Content-Type for JSON (ignora parâmetros como "; charset=utf-8").
function ehJson(req) {
  const tipo = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
  return TIPOS_ACEITOS.includes(tipo);
}

// Lê o corpo cru como texto. Devolve { texto } ou { excedeu: true } se passar do limite.
// Quando passa do limite, o restante do corpo é descartado sem guardar em memória.
function lerTexto(req, limite) {
  return new Promise((resolve, reject) => {
    const declarado = Number(req.headers['content-length']);
    if (Number.isFinite(declarado) && declarado > limite) {
      req.resume(); // descarta o corpo
      resolve({ excedeu: true });
      return;
    }

    const partes = [];
    let total = 0;
    let excedeu = false;

    req.on('data', (parte) => {
      if (excedeu) return;
      total += parte.length;
      if (total > limite) {
        excedeu = true;
        partes.length = 0;
        return;
      }
      partes.push(parte);
    });
    req.on('end', () => {
      resolve(excedeu ? { excedeu: true } : { texto: Buffer.concat(partes).toString('utf8') });
    });
    req.on('error', reject);
  });
}

// Lê e interpreta o corpo JSON da requisição.
// Sucesso: { ok: true, dados }
// Falha:   { ok: false, status, code, mensagem } — pronto para enviarErro().
async function lerCorpoJson(req, { limite = LIMITE_PADRAO } = {}) {
  if (!ehJson(req)) {
    req.resume();
    return {
      ok: false,
      status: 400,
      code: 'invalid',
      mensagem: 'Content-Type deve ser application/json (ou application/fhir+json).',
    };
  }

  const { texto, excedeu } = await lerTexto(req, limite);
  if (excedeu) {
    return {
      ok: false,
      status: 413,
      code: 'too-costly',
      mensagem: `Corpo da requisição excede o tamanho máximo (${Math.round(limite / 1024 / 1024)} MB).`,
    };
  }

  if (texto.trim() === '') {
    return {
      ok: false,
      status: 400,
      code: 'invalid',
      mensagem: 'O corpo da requisição está vazio. Envie um recurso Patient em JSON.',
    };
  }

  try {
    return { ok: true, dados: JSON.parse(texto) };
  } catch (err) {
    return { ok: false, status: 400, code: 'structure', mensagem: `JSON malformado: ${err.message}` };
  }
}

module.exports = { lerCorpoJson, ehJson, LIMITE_PADRAO };
