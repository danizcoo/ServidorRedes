// Roteador mínimo sobre o módulo http do Node (substitui o express.Router()).
//
// Rotas são registradas como { metodo, caminho, tratar }, com parâmetros no estilo ":id".
// O handler recebe (req, res, { params, caminhoBase, url }).
//
//   caminho existe, método não  -> 405 Method Not Allowed + cabeçalho Allow
//   caminho não existe          -> 404 Not Found

const { enviarErro } = require('./util/resposta');

// "/fhir/" -> "/fhir"; "fhir" -> "/fhir"; "" ou "/" -> ""
function normalizarCaminhoBase(caminho) {
  const limpo = String(caminho || '').split('/').filter(Boolean).join('/');
  return limpo ? `/${limpo}` : '';
}

function segmentos(caminho) {
  return caminho.split('/').filter(Boolean);
}

function decodificar(segmento) {
  try {
    return decodeURIComponent(segmento);
  } catch {
    return segmento;
  }
}

// Compara os segmentos da rota com os da URL. Devolve os parâmetros ou null.
function casar(partesRota, partesUrl) {
  if (partesRota.length !== partesUrl.length) return null;
  const params = {};
  for (let i = 0; i < partesRota.length; i++) {
    const rota = partesRota[i];
    if (rota.startsWith(':')) params[rota.slice(1)] = decodificar(partesUrl[i]);
    else if (rota !== partesUrl[i]) return null;
  }
  return params;
}

function criarRoteador({ caminhoBase = '' } = {}) {
  const base = normalizarCaminhoBase(caminhoBase);
  const rotas = [];

  function adicionar({ metodo, caminho, tratar }) {
    rotas.push({ metodo: metodo.toUpperCase(), partes: segmentos(caminho), tratar });
  }

  async function tratar(req, res) {
    const url = new URL(req.url, 'http://localhost');
    let caminho = url.pathname;

    // Remove o {caminho} opcional do início da URL
    if (base) {
      if (caminho !== base && !caminho.startsWith(`${base}/`)) {
        return enviarErro(res, 404, 'not-found', `Rota não encontrada: ${req.method} ${url.pathname}`);
      }
      caminho = caminho.slice(base.length);
    }

    const partesUrl = segmentos(caminho);
    const candidatas = [];
    for (const rota of rotas) {
      const params = casar(rota.partes, partesUrl);
      if (params) candidatas.push({ rota, params });
    }

    if (candidatas.length === 0) {
      return enviarErro(res, 404, 'not-found', `Rota não encontrada: ${req.method} ${url.pathname}`);
    }

    const escolhida = candidatas.find((c) => c.rota.metodo === req.method);
    if (!escolhida) {
      const permitidos = [...new Set(candidatas.map((c) => c.rota.metodo))].join(', ');
      return enviarErro(res, 405, 'not-supported', `Método ${req.method} não suportado em ${url.pathname}.`, {
        Allow: permitidos,
      });
    }

    return escolhida.rota.tratar(req, res, { params: escolhida.params, caminhoBase: base, url });
  }

  return { adicionar, tratar, caminhoBase: base };
}

module.exports = { criarRoteador, normalizarCaminhoBase };
