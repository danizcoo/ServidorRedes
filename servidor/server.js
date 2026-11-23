// Servidor PatientsOnFIRE - ponto de entrada
const express = require('express');
const cors = require('cors');
const patientRoutes = require('./src/routes/patient');

const PORTA = process.env.PORT || 3000;
const app = express();

// CORS: permite que o cliente HTML (outra origem) acesse a API
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
  exposedHeaders: ['Location'] // necessário para o cliente ler o cabeçalho Location
}));

app.use(express.json({ type: ['application/json', 'application/fhir+json'] }));

// Toda resposta com corpo é JSON
app.use((req, res, next) => {
  res.type('application/json');
  next();
});

app.use('/', patientRoutes);

// JSON malformado -> 400
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ erro: 'JSON inválido.' });
  }
  console.error(err);
  res.status(500).json({ erro: 'Erro interno do servidor.' });
});

// Rota inexistente -> 404
app.use((req, res) => res.status(404).json({ erro: 'Rota não encontrada.' }));

app.listen(PORTA, () => {
  console.log(`PatientsOnFIRE rodando em http://localhost:${PORTA}`);
});
