// Camada de armazenamento dos recursos Patient.
// Mantém os dados em memória e persiste em data/patients.json.
// IDs: inteiros positivos e sequenciais, nunca reutilizados.

const fs = require('fs');
const path = require('path');

const ARQUIVO = path.join(__dirname, '..', 'data', 'patients.json');

let pacientes = new Map(); // id (number) -> recurso Patient
let proximoId = 1;

// ---------- persistência ----------
function carregar() {
  try {
    if (fs.existsSync(ARQUIVO)) {
      const dados = JSON.parse(fs.readFileSync(ARQUIVO, 'utf8'));
      pacientes = new Map(dados.pacientes.map((p) => [obterId(p), p]));
      proximoId = dados.proximoId || 1;
    }
  } catch (err) {
    console.error('Aviso: não foi possível ler', ARQUIVO, '- iniciando vazio.', err.message);
  }
}

function salvar() {
  const dados = { proximoId, pacientes: Array.from(pacientes.values()) };
  fs.mkdirSync(path.dirname(ARQUIVO), { recursive: true });
  fs.writeFileSync(ARQUIVO, JSON.stringify(dados, null, 2), 'utf8');
}

// ---------- identifier ----------
// Monta o elemento identifier do recurso a partir do ID numérico.
function montarIdentifier(id) {
  return [{ system: 'urn:patientsonfire:id', value: String(id) }];
}

// Extrai o ID numérico do elemento identifier (retorna null se inválido).
function obterId(recurso) {
  const ident = recurso && recurso.identifier;
  const valor = Array.isArray(ident) ? ident[0] && ident[0].value : ident && ident.value;
  const n = Number(valor);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// ---------- operações ----------
function criar(recurso) {
  const id = proximoId++;
  const novo = { ...recurso, resourceType: 'Patient', id: String(id), identifier: montarIdentifier(id) };
  pacientes.set(id, novo);
  salvar();
  return novo;
}

function ler(id) {
  return pacientes.get(id) || null;
}

function atualizar(id, recurso) {
  if (!pacientes.has(id)) return null;
  const atualizado = { ...recurso, resourceType: 'Patient', id: String(id), identifier: montarIdentifier(id) };
  pacientes.set(id, atualizado);
  salvar();
  return atualizado;
}

function excluir(id) {
  const existia = pacientes.delete(id);
  if (existia) salvar();
  return existia;
}

function listarIDs() {
  return Array.from(pacientes.keys()).sort((a, b) => a - b);
}

carregar();

module.exports = { criar, ler, atualizar, excluir, listarIDs, obterId };
