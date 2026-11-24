// Camada de armazenamento dos recursos Patient.
// Mantém os dados em memória e persiste em data/patients.json.
// IDs: inteiros positivos e sequenciais, nunca reutilizados.

const fs = require('fs');
const path = require('path');
const { montarIdentifier } = require('./util/identificador');

const ARQUIVO = path.join(__dirname, '..', 'data', 'patients.json');

let pacientes = new Map(); // id (number) -> recurso Patient
let proximoId = 1;
let excluidos = new Set(); // IDs já excluídos (permite ao Read responder 410 Gone)

// ---------- persistência ----------
function carregar() {
  try {
    if (fs.existsSync(ARQUIVO)) {
      const dados = JSON.parse(fs.readFileSync(ARQUIVO, 'utf8'));
      pacientes = new Map(dados.pacientes.map((p) => [obterId(p), p]));
      proximoId = dados.proximoId || 1;
      excluidos = new Set(dados.excluidos || []);
    }
  } catch (err) {
    console.error('Aviso: não foi possível ler', ARQUIVO, '- iniciando vazio.', err.message);
  }
}

function salvar() {
  const dados = { proximoId, excluidos: Array.from(excluidos), pacientes: Array.from(pacientes.values()) };
  fs.mkdirSync(path.dirname(ARQUIVO), { recursive: true });
  fs.writeFileSync(ARQUIVO, JSON.stringify(dados, null, 2), 'utf8');
}

// ---------- identifier ----------
// montarIdentifier vem de util/identificador.js (regra única, compartilhada com as rotas).

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
  if (existia) {
    excluidos.add(id);
    salvar();
  }
  return existia;
}

// true se o ID já existiu e foi excluído (o Read responde 410 em vez de 404).
function foiExcluido(id) {
  return excluidos.has(id);
}

function listarIDs() {
  return Array.from(pacientes.keys()).sort((a, b) => a - b);
}

carregar();

module.exports = { criar, ler, atualizar, excluir, listarIDs, foiExcluido, obterId };
