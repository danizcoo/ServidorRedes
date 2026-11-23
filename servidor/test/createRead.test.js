// Testes das operações Create, Read e PatientIDs.
// Usa apenas o que vem com o Node.js: node:test, node:assert e fetch (Node 18+).
// Executar: npm test   (ou: node --test test/)

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { criarServidor } = require('../server');
const { interpretarId, extrairIdentificador, aplicarIdentificador } = require('../src/util/identificador');

// ---------- armazenamento em memória, só para os testes ----------
function criarArmazenamentoMemoria() {
  const pacientes = new Map();
  const excluidos = new Set();
  let proximoId = 1;
  return {
    criar(recurso) {
      const id = proximoId++;
      pacientes.set(id, { ...recurso, id: String(id) });
      return id; // o contrato aceita número ou recurso
    },
    ler: (id) => pacientes.get(id) || null,
    atualizar(id, recurso) {
      if (!pacientes.has(id)) return null;
      pacientes.set(id, recurso);
      return recurso;
    },
    excluir(id) {
      const existia = pacientes.delete(id);
      if (existia) excluidos.add(id);
      return existia;
    },
    listarIDs: () => [...pacientes.keys()],
    foiExcluido: (id) => excluidos.has(id),
  };
}

// Sobe um servidor numa porta livre e devolve a URL base
async function subir(opcoes) {
  const servidor = criarServidor(opcoes);
  await new Promise((ok) => servidor.listen(0, ok));
  const base = `http://127.0.0.1:${servidor.address().port}`;
  return { servidor, base, fechar: () => new Promise((ok) => servidor.close(ok)) };
}

const MARIA = {
  resourceType: 'Patient',
  name: [{ family: 'Silva', given: ['Maria'] }],
  gender: 'female',
  birthDate: '1985-04-12',
};

function post(base, corpo, tipo = 'application/json') {
  return fetch(`${base}/Patient`, {
    method: 'POST',
    headers: tipo ? { 'Content-Type': tipo } : {},
    body: typeof corpo === 'string' ? corpo : JSON.stringify(corpo),
  });
}

async function esperarErro(resposta, status, code) {
  assert.equal(resposta.status, status);
  assert.match(resposta.headers.get('content-type'), /^application\/json/);
  const oo = await resposta.json();
  assert.equal(oo.resourceType, 'OperationOutcome');
  assert.equal(oo.issue[0].severity, 'error');
  assert.equal(oo.issue[0].code, code);
  assert.equal(typeof oo.issue[0].diagnostics, 'string');
  return oo;
}

// ---------- funções compartilhadas ----------
describe('util/identificador', () => {
  test('interpretarId aceita só inteiros positivos', () => {
    assert.equal(interpretarId('1'), 1);
    assert.equal(interpretarId('42'), 42);
    assert.equal(interpretarId(7), 7);
    for (const ruim of ['abc', '0', '-1', '01', '1.5', '', ' 1', '1e3', '99999999999999999999', null, undefined]) {
      assert.equal(interpretarId(ruim), null, `deveria rejeitar ${JSON.stringify(ruim)}`);
    }
  });

  test('extrairIdentificador aceita formato completo e simplificado', () => {
    assert.equal(extrairIdentificador({ identifier: [{ system: 'urn:patientsonfire:patient-id', value: '5' }] }), 5);
    assert.equal(extrairIdentificador({ identifier: [{ value: '5' }] }), 5);
    assert.equal(extrairIdentificador({ identifier: { value: 5 } }), 5);
    assert.equal(extrairIdentificador({ identifier: 5 }), 5);
    assert.equal(extrairIdentificador({ identifier: '5' }), 5);
    assert.equal(
      extrairIdentificador({
        identifier: [{ system: 'urn:outro', value: '99' }, { system: 'urn:patientsonfire:patient-id', value: '5' }],
      }),
      5,
    );
    assert.equal(extrairIdentificador({}), null);
    assert.equal(extrairIdentificador({ identifier: [] }), null);
    assert.equal(extrairIdentificador({ identifier: [{ value: 'x' }] }), null);
  });

  test('aplicarIdentificador descarta id/identifier do cliente sem alterar o original', () => {
    const original = { resourceType: 'Patient', id: '999', identifier: [{ value: '999' }], gender: 'male' };
    const final = aplicarIdentificador(original, 3);
    assert.deepEqual(final, {
      resourceType: 'Patient',
      id: '3',
      identifier: [{ use: 'official', system: 'urn:patientsonfire:patient-id', value: '3' }],
      gender: 'male',
    });
    assert.equal(original.id, '999');
  });
});

// ---------- endpoints ----------
describe('Create, Read e PatientIDs', () => {
  let srv;
  before(async () => { srv = await subir({ armazenamento: criarArmazenamentoMemoria() }); });
  after(() => srv.fechar());

  test('GET /PatientIDs sem pacientes -> 204 sem corpo', async () => {
    const r = await fetch(`${srv.base}/PatientIDs`);
    assert.equal(r.status, 204);
    assert.equal(await r.text(), '');
  });

  test('POST /Patient -> 201 + Location + recurso com id/identifier do servidor', async () => {
    const r = await post(srv.base, { ...MARIA, id: '999', identifier: [{ value: '999' }] });
    assert.equal(r.status, 201);
    assert.equal(r.headers.get('location'), '/Patient/1');
    const criado = await r.json();
    assert.equal(criado.resourceType, 'Patient');
    assert.equal(criado.id, '1');
    assert.deepEqual(criado.identifier, [{ use: 'official', system: 'urn:patientsonfire:patient-id', value: '1' }]);
    assert.deepEqual(criado.name, MARIA.name);
    assert.equal(criado.gender, 'female');
    assert.ok(!Number.isNaN(Date.parse(criado.meta.lastUpdated)));
  });

  test('POST aceita application/fhir+json com charset', async () => {
    const r = await post(srv.base, MARIA, 'application/fhir+json; charset=utf-8');
    assert.equal(r.status, 201);
    assert.equal(r.headers.get('location'), '/Patient/2');
  });

  test('GET /Patient/<ID> -> 200 com o mesmo conteúdo devolvido no Create', async () => {
    const criado = await (await post(srv.base, MARIA)).json();
    const r = await fetch(`${srv.base}/Patient/${criado.id}`);
    assert.equal(r.status, 200);
    assert.match(r.headers.get('content-type'), /^application\/json/);
    const lido = await r.json();
    assert.deepEqual(lido, criado);
    assert.equal(lido.identifier[0].value, criado.id);
  });

  test('GET /PatientIDs -> 200 com array de números em ordem crescente', async () => {
    const r = await fetch(`${srv.base}/PatientIDs`);
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), [1, 2, 3]);
  });

  test('POST sem Content-Type JSON -> 400 invalid', async () => {
    await esperarErro(await post(srv.base, MARIA, 'text/plain'), 400, 'invalid');
    await esperarErro(await post(srv.base, JSON.stringify(MARIA), null), 400, 'invalid');
  });

  test('POST sem corpo -> 400 invalid', async () => {
    await esperarErro(await post(srv.base, ''), 400, 'invalid');
  });

  test('POST com JSON malformado -> 400 structure', async () => {
    const oo = await esperarErro(await post(srv.base, '{"resourceType": "Patient",'), 400, 'structure');
    assert.match(oo.issue[0].diagnostics, /^JSON malformado/);
  });

  test('POST com corpo que não é objeto -> 400 invalid', async () => {
    for (const corpo of ['[]', '42', 'null', '"Patient"']) {
      await esperarErro(await post(srv.base, corpo), 400, 'invalid');
    }
  });

  test('POST com resourceType diferente de Patient -> 400 invalid', async () => {
    const oo = await esperarErro(await post(srv.base, { resourceType: 'Observation' }), 400, 'invalid');
    assert.equal(oo.issue[0].diagnostics, 'resourceType deve ser "Patient" (recebido: "Observation").');
    await esperarErro(await post(srv.base, { name: [] }), 400, 'invalid');
  });

  test('POST com corpo maior que 1 MB -> 413 too-costly', async () => {
    const grande = { ...MARIA, text: { div: 'x'.repeat(1024 * 1024 + 10) } };
    await esperarErro(await post(srv.base, grande), 413, 'too-costly');
  });

  test('erros no POST não consomem ID', async () => {
    const r = await post(srv.base, MARIA);
    assert.equal(r.headers.get('location'), '/Patient/4');
  });

  test('GET /Patient/<ID> com ID inválido -> 400 invalid', async () => {
    for (const id of ['abc', '0', '-1', '01', '1.5']) {
      await esperarErro(await fetch(`${srv.base}/Patient/${id}`), 400, 'invalid');
    }
  });

  test('GET /Patient/<ID> inexistente -> 404 not-found', async () => {
    const oo = await esperarErro(await fetch(`${srv.base}/Patient/9999`), 404, 'not-found');
    assert.equal(oo.issue[0].diagnostics, 'Recurso Patient/9999 não encontrado.');
  });

  test('GET /Patient/<ID> excluído -> 410 deleted, e some do PatientIDs', async () => {
    const d = await fetch(`${srv.base}/Patient/2`, { method: 'DELETE' });
    assert.equal(d.status, 204);
    await esperarErro(await fetch(`${srv.base}/Patient/2`), 410, 'deleted');
    assert.deepEqual(await (await fetch(`${srv.base}/PatientIDs`)).json(), [1, 3, 4]);
  });

  test('CORS: preflight 204 e Location exposto', async () => {
    const r = await fetch(`${srv.base}/Patient`, { method: 'OPTIONS' });
    assert.equal(r.status, 204);
    assert.equal(r.headers.get('access-control-allow-origin'), '*');
    assert.match(r.headers.get('access-control-allow-methods'), /POST/);
    assert.match(r.headers.get('access-control-allow-headers'), /Content-Type/);
    const g = await fetch(`${srv.base}/PatientIDs`);
    assert.equal(g.headers.get('access-control-allow-origin'), '*');
    assert.equal(g.headers.get('access-control-expose-headers'), 'Location');
  });

  test('rota inexistente -> 404; método não suportado -> 405 com Allow', async () => {
    await esperarErro(await fetch(`${srv.base}/Observation/1`), 404, 'not-found');
    const r = await fetch(`${srv.base}/PatientIDs`, { method: 'POST' });
    await esperarErro(r, 405, 'not-supported');
    assert.equal(r.headers.get('allow'), 'GET');
  });
});

describe('integração com o validador (Pessoa 3)', () => {
  let srv;
  let chamadas = 0;
  async function validar(p) {
    chamadas++;
    if (p.gender && !['male', 'female', 'other', 'unknown'].includes(p.gender)) {
      return { ok: false, status: 400, mensagem: 'gender deve ser male, female, other ou unknown.' };
    }
    if (p.birthDate && p.birthDate > '2100-01-01') {
      return { ok: false, status: 422, mensagem: 'birthDate não pode estar no futuro.' };
    }
    if (p.active === 'talvez') return undefined; // fora do contrato
    return { ok: true };
  }
  before(async () => { srv = await subir({ armazenamento: criarArmazenamentoMemoria(), validar }); });
  after(() => srv.fechar());

  test('{ ok: false, status: 400 } -> 400 invalid com a mensagem do validador', async () => {
    const oo = await esperarErro(await post(srv.base, { ...MARIA, gender: 'x' }), 400, 'invalid');
    assert.equal(oo.issue[0].diagnostics, 'gender deve ser male, female, other ou unknown.');
  });

  test('{ ok: false, status: 422 } -> 422 business-rule', async () => {
    const oo = await esperarErro(await post(srv.base, { ...MARIA, birthDate: '2999-01-01' }), 422, 'business-rule');
    assert.equal(oo.issue[0].diagnostics, 'birthDate não pode estar no futuro.');
  });

  test('retorno fora do contrato -> 400', async () => {
    await esperarErro(await post(srv.base, { ...MARIA, active: 'talvez' }), 400, 'invalid');
  });

  test('validador não é chamado se a estrutura mínima falhar', async () => {
    const antes = chamadas;
    await esperarErro(await post(srv.base, { resourceType: 'Observation' }), 400, 'invalid');
    assert.equal(chamadas, antes);
  });

  test('nenhum ID foi consumido pelos erros; { ok: true } -> 201 /Patient/1', async () => {
    const r = await post(srv.base, MARIA);
    assert.equal(r.status, 201);
    assert.equal(r.headers.get('location'), '/Patient/1');
  });
});

describe('caminho base opcional ({caminho})', () => {
  let srv;
  before(async () => { srv = await subir({ armazenamento: criarArmazenamentoMemoria(), caminhoBase: '/fhir/' }); });
  after(() => srv.fechar());

  test('Location inclui o caminho e as rotas respondem sob ele', async () => {
    const r = await fetch(`${srv.base}/fhir/Patient`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(MARIA),
    });
    assert.equal(r.status, 201);
    assert.equal(r.headers.get('location'), '/fhir/Patient/1');
    assert.equal((await fetch(`${srv.base}/fhir/Patient/1`)).status, 200);
    assert.deepEqual(await (await fetch(`${srv.base}/fhir/PatientIDs`)).json(), [1]);
    await esperarErro(await fetch(`${srv.base}/Patient/1`), 404, 'not-found');
  });
});

describe('falhas do armazenamento', () => {
  let srv;
  const quebrado = {
    criar() { throw new Error('disco cheio'); },
    atualizar() { throw new Error('disco cheio'); },
    ler() { throw new Error('disco cheio'); },
    listarIDs() { throw new Error('disco cheio'); },
    excluir() { throw new Error('disco cheio'); },
  };
  before(async () => {
    srv = await subir({ armazenamento: quebrado });
    srv.consoleError = console.error;
    console.error = () => {}; // silencia o log esperado do 500
  });
  after(async () => {
    console.error = srv.consoleError;
    await srv.fechar();
  });

  test('Create, Read e PatientIDs -> 500 exception e o servidor continua no ar', async () => {
    await esperarErro(await post(srv.base, MARIA), 500, 'exception');
    await esperarErro(await fetch(`${srv.base}/Patient/1`), 500, 'exception');
    await esperarErro(await fetch(`${srv.base}/PatientIDs`), 500, 'exception');
    const r = await fetch(`${srv.base}/Patient/abc`);
    assert.equal(r.status, 400);
  });

  test('PatientIDs limpa a lista do armazenamento (números, sem duplicados, ordenada)', async () => {
    const s = await subir({
      armazenamento: { ...quebrado, listarIDs: () => [8, '5', 1, 5, 0, -2, 'x', 1.5, null, 11] },
    });
    try {
      assert.deepEqual(await (await fetch(`${s.base}/PatientIDs`)).json(), [1, 5, 8, 11]);
    } finally {
      await s.fechar();
    }
  });
});

// Garante que o módulo http do Node foi usado (sem frameworks).
test('package.json não tem dependências', () => {
  const pacote = require('../package.json');
  assert.equal(pacote.dependencies, undefined);
  assert.ok(http.createServer);
});
