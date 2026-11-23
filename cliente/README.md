# Cliente CRUDEPatients

Interface web em React (Vite) que gerencia recursos **Patient** FHIR v5.0.0 no servidor PatientsOnFIRE.

## Como executar

Com o servidor já rodando na porta 3000:

```bash
cd cliente
npm install
npm run dev
```

Abra `http://localhost:5173`.

Para usar o servidor em outro endereço:

```bash
VITE_API_URL=http://localhost:4000 npm run dev
```

Para gerar a versão estática: `npm run build`. Os arquivos vão para `dist/`.

## Funcionalidades

| Ação na interface | Requisição | Respostas tratadas |
|---|---|---|
| Lista de pacientes | `GET /PatientIDs` e depois `GET /Patient/<ID>` para cada ID | 200, 204 (lista vazia), 404/410 por paciente |
| Visualizar | `GET /Patient/<ID>` | 200, 404, 410 |
| Cadastrar paciente | `POST /Patient` | 201 + `Location`, 400, 422 |
| Editar | `PUT /Patient/<ID>` com `identifier` igual ao ID | 200, 400, 404, 422 |
| Excluir (com confirmação) | `DELETE /Patient/<ID>` | 200, 202, 204, 404 |

- O formulário cobre nome, gênero, data de nascimento, estado civil, situação (ativo), telefones e e-mails, endereços, contatos do paciente e idiomas.
- Os códigos usados são os dos value sets FHIR: `AdministrativeGender`, `v3-MaritalStatus`, `v2-0131` e BCP 47.
- Na edição, os campos que o formulário não controla (por exemplo `extension` e `photo`) são preservados.
- Toda chamada ao servidor aparece no painel **Requisições**, com método, caminho e código HTTP.
- As mensagens de sucesso e de erro mostram o código HTTP. Quando o servidor manda detalhes, eles também aparecem.
- Formatos de erro aceitos: `{ "erro": "..." }`, `{ "erros": [...] }` e `OperationOutcome` do FHIR.
- Se o servidor estiver fora do ar, a interface avisa e oferece "Tentar de novo".

## Estrutura

```
cliente/
├── index.html
├── vite.config.js
└── src/
    ├── main.jsx
    ├── App.jsx                     # estado da tela e fluxo das operações CRUD
    ├── api.js                      # fetch para o servidor e mensagens por código HTTP
    ├── fhir.js                     # conversão Patient <-> formulário e value sets
    ├── styles.css
    └── components/
        ├── ListaPacientes.jsx
        ├── FormularioPaciente.jsx  # cadastro e edição
        ├── DetalhesPaciente.jsx    # visualização, com o JSON do recurso
        ├── Painel.jsx              # gaveta lateral e janela de confirmação (<dialog>)
        ├── RegistroRequisicoes.jsx
        ├── ErroServidor.jsx
        └── StatusHttp.jsx
```
