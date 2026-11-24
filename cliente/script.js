// CRUDEPatients - cliente em HTML, CSS e JavaScript puro.
// Conversa com o servidor PatientsOnFIRE usando fetch.

const API = 'http://localhost:3000';

// Mensagem mostrada para cada código HTTP
const MENSAGENS = {
  0: 'Servidor fora do ar. Confira se ele está rodando em ' + API + '.',
  200: 'OK',
  201: 'Paciente cadastrado.',
  204: 'Sem conteúdo.',
  400: 'Requisição inválida.',
  404: 'Paciente não encontrado.',
  410: 'Paciente excluído.',
  422: 'Os dados não atendem às regras do recurso Patient.',
  500: 'Erro interno do servidor.',
};

const GENEROS = { female: 'Feminino', male: 'Masculino', other: 'Outro', unknown: 'Não informado' };

let pacientes = [];      // recursos Patient carregados na lista
let selecionado = null;  // paciente aberto nos detalhes ou no formulário

// ---------- elementos da página ----------
const $ = (id) => document.getElementById(id);
const formPaciente = $('form-paciente');

// ---------- requisições ----------

// Faz a requisição e devolve { status, ok, dados, location }.
// status 0 = sem resposta (servidor fora do ar).
async function requisicao(metodo, caminho, corpo) {
  const opcoes = { method: metodo, headers: {} };
  if (corpo !== undefined) {
    opcoes.headers['Content-Type'] = 'application/json';
    opcoes.body = JSON.stringify(corpo);
  }

  let resposta;
  try {
    resposta = await fetch(API + caminho, opcoes);
  } catch {
    registrar(metodo, caminho, 0);
    return { status: 0, ok: false, dados: null, location: null };
  }

  const texto = await resposta.text();
  let dados = null;
  if (texto) {
    try { dados = JSON.parse(texto); } catch { dados = texto; }
  }

  registrar(metodo, caminho, resposta.status);
  return {
    status: resposta.status,
    ok: resposta.ok,
    dados,
    location: resposta.headers.get('Location'),
  };
}

// ---------- mensagens e registro ----------

function mostrarMensagem(texto, status) {
  const caixa = $('mensagem');
  const erro = status === 0 || status >= 400;
  caixa.className = 'mensagem ' + (erro ? 'erro' : 'sucesso');
  caixa.textContent = (status ? `HTTP ${status} — ` : '') + texto;
  caixa.hidden = false;
}

// Mensagem de erro: usa o texto que o servidor mandou no OperationOutcome
// (issue[0].diagnostics) ou, se não houver, o padrão do código
function mostrarErro(r) {
  const issue = r.dados && Array.isArray(r.dados.issue) ? r.dados.issue[0] : null;
  const texto = (issue && issue.diagnostics) || MENSAGENS[r.status] || 'Erro inesperado.';
  mostrarMensagem(texto, r.status);
}

function registrar(metodo, caminho, status) {
  const item = document.createElement('li');
  const classe = status === 0 || status >= 400 ? 'erro' : 'sucesso';
  const hora = new Date().toLocaleTimeString('pt-BR');
  item.innerHTML = `
    <span class="hora">${hora}</span>
    <span class="metodo">${metodo}</span>
    <code>${esc(caminho)}</code>
    <span class="status ${classe}">${status || 'sem resposta'}</span>`;
  $('registro').prepend(item);
}

// ---------- utilitários ----------

// Evita que dados do servidor virem HTML na página
function esc(valor) {
  return String(valor ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function idDe(p) {
  const ident = Array.isArray(p.identifier) ? p.identifier[0] : p.identifier;
  return Number((ident && ident.value) || p.id);
}

function nomeDe(p) {
  const n = (p.name || [])[0];
  if (!n) return '(sem nome)';
  return n.text || [...(n.given || []), n.family].filter(Boolean).join(' ');
}

function telecomDe(p, sistema) {
  const t = (p.telecom || []).find((x) => x.system === sistema);
  return t ? t.value : '';
}

function cidadeDe(p) {
  const a = (p.address || [])[0];
  return a ? [a.city, a.state].filter(Boolean).join('/') : '';
}

function formatarData(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso || '';
}

// ---------- lista (GET /PatientIDs + GET /Patient/<ID>) ----------

async function carregarLista() {
  const r = await requisicao('GET', '/PatientIDs');
  if (r.status === 0 || !r.ok) {
    mostrarErro(r);
    return;
  }

  const ids = r.status === 204 ? [] : r.dados;
  const respostas = await Promise.all(ids.map((id) => requisicao('GET', `/Patient/${id}`)));
  pacientes = respostas.filter((x) => x.ok).map((x) => x.dados);
  desenharTabela();
}

function desenharTabela() {
  $('lista-vazia').hidden = pacientes.length > 0;
  $('tabela-pacientes').innerHTML = pacientes.map((p) => {
    const id = idDe(p);
    const ativo = p.active !== false;
    return `
      <tr>
        <td>${id}</td>
        <td>${esc(nomeDe(p))}</td>
        <td>${esc(GENEROS[p.gender] || '')}</td>
        <td>${esc(formatarData(p.birthDate))}</td>
        <td>${esc(telecomDe(p, 'phone'))}</td>
        <td>${esc(cidadeDe(p))}</td>
        <td><span class="etiqueta ${ativo ? 'ativo' : 'inativo'}">${ativo ? 'Ativo' : 'Inativo'}</span></td>
        <td class="acoes-linha">
          <button type="button" data-ver="${id}">Ver</button>
          <button type="button" data-editar="${id}">Editar</button>
        </td>
      </tr>`;
  }).join('');
}

// ---------- detalhes (GET /Patient/<ID>) ----------

async function verPaciente(id) {
  const r = await requisicao('GET', `/Patient/${id}`);
  if (!r.ok) {
    mostrarErro(r);
    return;
  }
  selecionado = r.dados;
  const p = r.dados;
  const a = (p.address || [])[0] || {};

  const campos = [
    ['Nome', nomeDe(p)],
    ['Gênero', GENEROS[p.gender]],
    ['Nascimento', formatarData(p.birthDate)],
    ['Telefone', telecomDe(p, 'phone')],
    ['E-mail', telecomDe(p, 'email')],
    ['Endereço', [(a.line || []).join(', '), cidadeDe(p), a.postalCode].filter(Boolean).join(' — ')],
    ['Situação', p.active === false ? 'Inativo' : 'Ativo'],
  ];

  $('detalhes-titulo').textContent = `Paciente ${idDe(p)}`;
  $('detalhes-dados').innerHTML = campos
    .filter(([, valor]) => valor)
    .map(([rotulo, valor]) => `<dt>${rotulo}</dt><dd>${esc(valor)}</dd>`)
    .join('');
  $('detalhes-json').textContent = JSON.stringify(p, null, 2);

  mostrarPainel('painel-detalhes');
}

// ---------- formulário ----------

function abrirFormulario(paciente) {
  selecionado = paciente;
  formPaciente.reset();

  if (paciente) {
    const n = (paciente.name || [])[0] || {};
    const a = (paciente.address || [])[0] || {};
    const f = formPaciente.elements;
    f.given.value = (n.given || []).join(' ');
    f.family.value = n.family || '';
    f.gender.value = paciente.gender || '';
    f.birthDate.value = paciente.birthDate || '';
    f.phone.value = telecomDe(paciente, 'phone');
    f.email.value = telecomDe(paciente, 'email');
    f.line.value = (a.line || []).join(', ');
    f.city.value = a.city || '';
    f.state.value = a.state || '';
    f.postalCode.value = a.postalCode || '';
    f.active.checked = paciente.active !== false;
    $('form-titulo').textContent = `Editar paciente ${idDe(paciente)}`;
  } else {
    $('form-titulo').textContent = 'Novo paciente';
  }

  mostrarPainel('painel-form');
  formPaciente.elements.given.focus();
}

// Coloca o valor no objeto, ou remove a chave se estiver vazio
function definir(obj, chave, valor) {
  const vazio = valor === '' || valor == null || (Array.isArray(valor) && valor.length === 0);
  if (vazio) delete obj[chave];
  else obj[chave] = valor;
}

// Monta o recurso Patient a partir do formulário.
// Na edição, parte do recurso original para não perder campos que o formulário não mostra.
function montarPatient() {
  const f = formPaciente.elements;
  const p = selecionado ? structuredClone(selecionado) : {};
  p.resourceType = 'Patient';
  p.active = f.active.checked;

  const nome = { use: 'official', family: f.family.value.trim() };
  const given = f.given.value.trim().split(/\s+/).filter(Boolean);
  if (given.length) nome.given = given;
  if (!nome.family) delete nome.family;
  p.name = [nome];

  definir(p, 'gender', f.gender.value);
  definir(p, 'birthDate', f.birthDate.value);

  // telefone e e-mail substituem os anteriores; outros contatos (fax, url...) são mantidos
  const telecom = (p.telecom || []).filter((t) => t.system !== 'phone' && t.system !== 'email');
  if (f.phone.value.trim()) telecom.push({ system: 'phone', value: f.phone.value.trim(), use: 'mobile' });
  if (f.email.value.trim()) telecom.push({ system: 'email', value: f.email.value.trim() });
  definir(p, 'telecom', telecom);

  const endereco = { ...((p.address || [])[0] || {}) };
  definir(endereco, 'line', f.line.value.trim() ? [f.line.value.trim()] : []);
  definir(endereco, 'city', f.city.value.trim());
  definir(endereco, 'state', f.state.value.trim().toUpperCase());
  definir(endereco, 'postalCode', f.postalCode.value.trim());
  const outrosEnderecos = (p.address || []).slice(1);
  definir(p, 'address', Object.keys(endereco).length ? [endereco, ...outrosEnderecos] : outrosEnderecos);

  return p;
}

// POST /Patient (novo) ou PUT /Patient/<ID> (edição)
async function salvar(evento) {
  evento.preventDefault();
  const paciente = montarPatient();
  $('btn-salvar').disabled = true;

  let r;
  if (selecionado) {
    const id = idDe(selecionado);
    r = await requisicao('PUT', `/Patient/${id}`, paciente);
    if (r.ok) mostrarMensagem(`Paciente ${id} atualizado.`, r.status);
  } else {
    r = await requisicao('POST', '/Patient', paciente);
    if (r.ok) mostrarMensagem(`Paciente cadastrado com o ID ${idDe(r.dados)} (Location: ${r.location}).`, r.status);
  }

  $('btn-salvar').disabled = false;
  if (!r.ok) {
    mostrarErro(r);
    return;
  }
  fecharPaineis();
  carregarLista();
}

// ---------- exclusão (DELETE /Patient/<ID>) ----------

async function excluir() {
  const id = idDe(selecionado);
  if (!confirm(`Excluir o paciente ${id} (${nomeDe(selecionado)})? Essa ação não pode ser desfeita.`)) return;

  const r = await requisicao('DELETE', `/Patient/${id}`);
  if (!r.ok) {
    mostrarErro(r);
    return;
  }
  mostrarMensagem(`Paciente ${id} excluído.`, r.status);
  fecharPaineis();
  carregarLista();
}

// ---------- painéis ----------

function mostrarPainel(id) {
  $('painel-detalhes').hidden = id !== 'painel-detalhes';
  $('painel-form').hidden = id !== 'painel-form';
}

function fecharPaineis() {
  selecionado = null;
  mostrarPainel(null);
}

// ---------- eventos ----------

$('endereco-api').textContent = API;
$('campo-nascimento').max = new Date().toISOString().slice(0, 10);

$('btn-atualizar').addEventListener('click', carregarLista);
$('btn-novo').addEventListener('click', () => abrirFormulario(null));
$('btn-editar').addEventListener('click', () => abrirFormulario(selecionado));
$('btn-excluir').addEventListener('click', excluir);
$('btn-limpar-registro').addEventListener('click', () => { $('registro').innerHTML = ''; });
formPaciente.addEventListener('submit', salvar);

document.querySelectorAll('[data-fechar]').forEach((botao) => botao.addEventListener('click', fecharPaineis));

$('form-busca').addEventListener('submit', (evento) => {
  evento.preventDefault();
  verPaciente($('busca-id').value);
});

// Botões "Ver" e "Editar" de cada linha da tabela
$('tabela-pacientes').addEventListener('click', async (evento) => {
  const botao = evento.target.closest('button');
  if (!botao) return;
  if (botao.dataset.ver) verPaciente(botao.dataset.ver);
  if (botao.dataset.editar) {
    const r = await requisicao('GET', `/Patient/${botao.dataset.editar}`);
    if (r.ok) abrirFormulario(r.dados);
    else mostrarErro(r);
  }
});

carregarLista();
