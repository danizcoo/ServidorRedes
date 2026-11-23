# Servidor PatientsOnFIRE

Serviço web REST que gerencia recursos **Patient** FHIR v5.0.0, escrito apenas com o módulo `http` nativo do Node.js, sem Express nem outras dependências.

## Requisitos
- Node.js 18 ou superior

## Como executar
```bash
cd servidor
npm start
```
O servidor sobe em `http://localhost:3000`. Variáveis de ambiente opcionais:

| Variável | Padrão | Uso |
|---|---|---|
| `PORT` | `3000` | porta HTTP (ex.: `PORT=4000 npm start`) |
| `CAMINHO_BASE` | vazio | `{caminho}` opcional do enunciado (ex.: `CAMINHO_BASE=/fhir` → `/fhir/Patient/1`) |

## Testes
```bash
npm test
```
Usa só o que já vem com o Node (`node:test`, `node:assert` e `fetch`).

## Estrutura
```
servidor/
├── server.js                    # ponto de entrada: http.createServer, CORS, erro 500
├── src/
│   ├── roteador.js              # roteador mínimo (:id, 404, 405, {caminho})
│   ├── storage.js               # armazenamento: criar, ler, atualizar, excluir, listarIDs, foiExcluido
│   ├── routes/
│   │   ├── createRead.js        # Create, Read, PatientIDs (Pessoa 2)
│   │   └── updateDelete.js      # Update, Delete (Pessoa 3)
│   ├── util/
│   │   ├── identificador.js     # interpretarId, aplicarIdentificador, extrairIdentificador
│   │   ├── corpo.js             # leitura do corpo JSON (Content-Type, 1 MB)
│   │   └── resposta.js          # enviarJson, enviarSemConteudo, enviarErro (OperationOutcome)
│   └── validacao/
│       └── validarMinimo.js     # validação estrutural provisória
├── test/createRead.test.js      # testes de Create, Read e PatientIDs
└── data/patients.json           # persistência (gerado automaticamente)
```

## Endpoints
| Operação | Requisição | Sucesso | Erros |
|---|---|---|---|
| Create | `POST /Patient` | 201 + `Location: /Patient/<ID>` + recurso | 400, 413, 422, 500 |
| Read | `GET /Patient/<ID>` | 200 + recurso | 400, 404, 410, 500 |
| Update | `PUT /Patient/<ID>` | 200 + recurso | 400, 404, 413, 500 |
| Delete | `DELETE /Patient/<ID>` | 204 | 400, 500 |
| PatientIDs | `GET /PatientIDs` | 200 + `[1, 5, 8]` ou 204 se vazio | 500 |

Rota inexistente: 404. Rota existente com método não suportado: 405 + cabeçalho `Allow`.

Todo erro vem como um recurso FHIR `OperationOutcome`:
```json
{ "resourceType": "OperationOutcome",
  "issue": [{ "severity": "error", "code": "not-found", "diagnostics": "Recurso Patient/7 não encontrado." }] }
```

## Exemplos (curl)
```bash
curl -i -X POST http://localhost:3000/Patient -H "Content-Type: application/json" \
  -d '{"resourceType":"Patient","name":[{"family":"Silva","given":["Ana"]}],"gender":"female","birthDate":"1990-05-10"}'
curl -i http://localhost:3000/Patient/1
curl -i http://localhost:3000/PatientIDs
```

## Decisões de projeto
- Sem frameworks: roteamento, CORS e leitura do corpo são feitos com `node:http`.
- IDs inteiros positivos, sequenciais e nunca reutilizados após exclusão.
- O ID é gravado em `id` (`"5"`) e em `identifier` (`[{ use: "official", system: "urn:patientsonfire:patient-id", value: "5" }]`).
- IDs excluídos ficam registrados para o Read responder 410 Gone.
- Armazenamento em memória com persistência em `data/patients.json`.

Detalhes da implementação de Create, Read e PatientIDs em [IMPLEMENTACAO-CREATE-READ.md](IMPLEMENTACAO-CREATE-READ.md).
