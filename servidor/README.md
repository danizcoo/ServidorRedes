# Servidor PatientsOnFIRE

Serviço web REST (Node.js + Express) que gerencia recursos **Patient** FHIR v5.0.0.

## Requisitos
- Node.js 18 ou superior

## Como executar
```bash
cd servidor
npm install
npm start
```
O servidor sobe em `http://localhost:3000` (para outra porta: `PORT=4000 npm start`).

## Estrutura
```
servidor/
├── server.js              # ponto de entrada, CORS, JSON, tratamento de erros
├── src/
│   ├── storage.js         # armazenamento: criar, ler, atualizar, excluir, listarIDs
│   └── routes/patient.js  # rotas /Patient, /Patient/:id, /PatientIDs
└── data/patients.json     # persistência (gerado automaticamente)
```

## Endpoints
| Operação | Requisição | Sucesso | Erros |
|---|---|---|---|
| Create | `POST /Patient` | 201 + `Location: /Patient/<ID>` | 400, 422 |
| Read | `GET /Patient/<ID>` | 200 + JSON | 400, 404 |
| Update | `PUT /Patient/<ID>` | 200 | 400, 404, 422 |
| Delete | `DELETE /Patient/<ID>` | 204 | 400 |
| PatientIDs | `GET /PatientIDs` | 200 + `[1, 5, 8]` ou 204 se vazio | - |

## Exemplos (curl)
```bash
curl -i -X POST http://localhost:3000/Patient -H "Content-Type: application/json" \
  -d '{"resourceType":"Patient","name":[{"family":"Silva","given":["Ana"]}],"gender":"female","birthDate":"1990-05-10"}'
curl -i http://localhost:3000/Patient/1
curl -i http://localhost:3000/PatientIDs
```

## Decisões de projeto
- IDs inteiros positivos, sequenciais e nunca reutilizados após exclusão.
- O ID é gravado em `identifier` (`[{system, value}]`) e também em `id`.
- Armazenamento em memória com persistência em `data/patients.json`.
