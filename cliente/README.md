# Cliente CRUDEPatients

Interface web em HTML, CSS e JavaScript puro (sem frameworks e sem build) que gerencia recursos **Patient** FHIR v5.0.0 no servidor PatientsOnFIRE. As chamadas à API são feitas com `fetch`.

## Como executar

1. Suba o servidor (porta 3000), conforme [servidor/README.md](../servidor/README.md).
2. Abra `cliente/index.html` no navegador (dois cliques no arquivo já funciona).

Se preferir servir por HTTP: `python3 -m http.server 5500` dentro de `cliente/` e abra `http://localhost:5500`.

O endereço do servidor fica na constante `API`, no início de `script.js`.

## Funcionalidades

| Ação na interface | Requisição | Respostas tratadas |
|---|---|---|
| Lista de pacientes | `GET /PatientIDs` e depois `GET /Patient/<ID>` para cada ID | 200, 204 (lista vazia) |
| Buscar por ID / Ver | `GET /Patient/<ID>` | 200, 400, 404 |
| Novo paciente | `POST /Patient` | 201 + `Location`, 400, 422 |
| Editar | `PUT /Patient/<ID>` com `identifier` igual ao ID | 200, 400, 404, 422 |
| Excluir (com confirmação) | `DELETE /Patient/<ID>` | 204, 400 |

- Cada resposta aparece numa mensagem com o código HTTP (ex.: `HTTP 201 — Paciente cadastrado com o ID 4`). Em caso de erro, é mostrado o texto enviado pelo servidor em `{ "erro": "..." }`.
- O painel **Requisições** lista método, caminho e código de cada chamada feita ao servidor.
- A tela de detalhes mostra o JSON FHIR completo do recurso.
- Na edição, o cliente parte do recurso recebido do servidor, então campos que o formulário não mostra são preservados.

## Estrutura

```
cliente/
├── index.html   # estrutura da página
├── style.css    # estilos
└── script.js    # fetch para a API, lista, formulário e exclusão
```
