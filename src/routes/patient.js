// Roteamento base: /Patient, /Patient/:id e /PatientIDs.
// Pessoa 2 (Create/Read/PatientIDs) e Pessoa 3 (Update/Delete/validação)
// refinam a lógica de cada rota a partir deste esqueleto.

const express = require('express');
const storage = require('../storage');

const router = express.Router();

function parseId(valor) {
  return /^[1-9]\d*$/.test(valor) ? Number(valor) : null;
}

function corpoValido(body) {
  return body && typeof body === 'object' && !Array.isArray(body) && body.resourceType === 'Patient';
}

// CREATE
router.post('/Patient', (req, res) => {
  // TODO (Pessoa 3): plugar o módulo de validação (400 sintaxe / 422 regras de negócio)
  if (!corpoValido(req.body)) {
    return res.status(400).json({ erro: 'O corpo deve ser um recurso Patient em JSON.' });
  }
  const novo = storage.criar(req.body);
  res.status(201).set('Location', `/Patient/${novo.id}`).json(novo);
});

// READ
router.get('/Patient/:id', (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return res.status(400).json({ erro: 'ID deve ser um inteiro positivo.' });
  const paciente = storage.ler(id);
  if (!paciente) return res.status(404).json({ erro: `Patient ${id} não encontrado.` });
  res.status(200).json(paciente);
});

// UPDATE
router.put('/Patient/:id', (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return res.status(400).json({ erro: 'ID deve ser um inteiro positivo.' });
  if (!corpoValido(req.body)) {
    return res.status(400).json({ erro: 'O corpo deve ser um recurso Patient em JSON.' });
  }
  if (storage.obterId(req.body) !== id) {
    return res.status(400).json({ erro: 'identifier ausente ou diferente do ID da URL.' });
  }
  // TODO (Pessoa 3): validação do recurso (422)
  const atualizado = storage.atualizar(id, req.body);
  if (!atualizado) return res.status(404).json({ erro: `Patient ${id} não encontrado.` });
  res.status(200).json(atualizado);
});

// DELETE
router.delete('/Patient/:id', (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return res.status(400).json({ erro: 'ID deve ser um inteiro positivo.' });
  storage.excluir(id);
  res.status(204).end();
});

// PatientIDs
router.get('/PatientIDs', (req, res) => {
  const ids = storage.listarIDs();
  if (ids.length === 0) return res.status(204).end();
  res.status(200).json(ids);
});

module.exports = router;
