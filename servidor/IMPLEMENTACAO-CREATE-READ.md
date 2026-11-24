# PatientsOnFIRE — Implementação de Create, Read e PatientIDs

Responsável: Pessoa 2 (Cainã) · Branch: `server-create-read` · 23/11/2026

Este documento descreve o que foi desenvolvido para as operações **Create**, **Read** e **PatientIDs** do servidor PatientsOnFIRE e lista tudo o que foi **alterado** no projeto que já existia. A implementação segue o enunciado do Trabalho 2, a divisão de tarefas do grupo e a especificação "PatientsOnFIRE — Especificação: Create, Read e PatientIDs".

---

## 1. Resumo

- As três operações foram implementadas e testadas: `POST /Patient`, `GET /Patient/<ID>` e `GET /PatientIDs`.
- O servidor passou a usar **apenas Node.js** (módulo `http` nativo). Express e cors foram removidos, e o projeto não tem mais nenhuma dependência externa.
- Para remover o Express foi preciso reescrever a parte do servidor que dependia dele: ponto de entrada, roteamento, CORS e leitura do corpo JSON. As rotas de Update e Delete foram portadas para o novo formato **sem mudar a lógica**.
- Todos os erros agora são respondidos como recurso FHIR **OperationOutcome**, como define a especificação.
- Foram escritos 29 testes automáticos com `node:test`, que vem com o Node. Todos passam.

---

## 2. Como executar e testar

```bash
cd servidor
npm start        # sobe em http://localhost:3000 (não precisa mais de npm install)
npm test         # roda os 29 testes
```

Variáveis opcionais: `PORT` (porta) e `CAMINHO_BASE` (o `{caminho}` opcional do enunciado, ex.: `/fhir`).

---

## 3. O que foi desenvolvido (código novo)

### 3.1 Arquitetura sem frameworks

```
requisição HTTP
   │
   ▼
server.js ── CORS em toda resposta, OPTIONS → 204, try/catch → 500
   │
   ▼
src/roteador.js ── remove o {caminho}, casa método + rota (/Patient/:id), 404 / 405
   │
   ├── src/routes/createRead.js    POST /Patient · GET /Patient/:id · GET /PatientIDs
   └── src/routes/updateDelete.js  PUT /Patient/:id · DELETE /Patient/:id
          │
          ├── src/util/corpo.js          lê o corpo: Content-Type, limite 1 MB, JSON.parse
          ├── src/util/identificador.js  regra única de id / identifier
          ├── src/util/resposta.js       enviarJson, enviarSemConteudo, enviarErro
          ├── src/validacao/validarMinimo.js
          └── src/storage.js             armazenamento (Pessoa 1)
```

Cada rota é um objeto `{ metodo, caminho, tratar }`. O handler recebe `(req, res, { params, caminhoBase, url })`. Ele cumpre o papel que `req.params` tinha no Express.

### 3.2 Arquivos novos

| Arquivo | O que faz |
|---|---|
| `src/routes/createRead.js` | As três operações da Pessoa 2. Exporta `criarRotasCreateRead({ armazenamento, validar })`, que devolve a lista de rotas. |
| `src/util/identificador.js` | Regra única do ID: `interpretarId`, `montarIdentifier`, `aplicarIdentificador`, `extrairIdentificador`, `SISTEMA_ID`. |
| `src/util/resposta.js` | `enviarJson`, `enviarSemConteudo`, `enviarErro` (OperationOutcome) e `operationOutcome`. |
| `src/util/corpo.js` | `lerCorpoJson(req)`: confere o Content-Type, limita o corpo a 1 MB e interpreta o JSON. Substitui o `express.json()`. |
| `src/validacao/validarMinimo.js` | Validação provisória: o corpo é um objeto com `resourceType: "Patient"`. |
| `src/roteador.js` | Roteador mínimo: parâmetros `:id`, `{caminho}` opcional, 404 e 405. Substitui o `express.Router()`. |
| `src/routes/updateDelete.js` | Update e Delete portados do antigo `patient.js` (ver seção 4). |
| `test/createRead.test.js` | 29 testes com `node:test` + `fetch`, usando um armazenamento em memória. |
| `IMPLEMENTACAO-CREATE-READ.md` | Este documento. |

### 3.3 Regra do identificador (`util/identificador.js`)

O servidor grava o ID em dois lugares. Assim cumpre o enunciado, que diz que o `<ID>` "também está contido no elemento identifier", e também o modelo FHIR, onde o ID lógico fica em `id`:

```json
"id": "5",
"identifier": [{ "use": "official", "system": "urn:patientsonfire:patient-id", "value": "5" }]
```

| Função | Entrada → saída | Quem usa |
|---|---|---|
| `interpretarId(texto)` | `"5"` → `5`. `"abc"`, `"0"`, `"-1"`, `"01"`, `"1.5"` e números acima de `Number.MAX_SAFE_INTEGER` → `null` | Read, Update, Delete, PatientIDs |
| `montarIdentifier(id)` | `5` → `[{ use, system, value: "5" }]` | `aplicarIdentificador`, `storage.js` |
| `aplicarIdentificador(paciente, id)` | cópia do recurso sem o `id`/`identifier` do cliente e com os do servidor | Create |
| `extrairIdentificador(paciente)` | aceita `[{system, value}]`, `[{value}]`, `{value}`, `5`, `"5"` → número ou `null`. Numa lista, dá preferência ao item com o `system` do servidor | Update |

### 3.4 POST /Patient — Create

Passos, na ordem da especificação:

1. **Content-Type** precisa ser `application/json` ou `application/fhir+json`, com ou sem `; charset=...`. Se não for: 400 `invalid`.
2. **Tamanho**: corpo acima de 1 MB → 413 `too-costly`. O resto do corpo é descartado sem ir para a memória, e isso vale também para envio *chunked*.
3. **Corpo vazio** → 400 `invalid`. **JSON malformado** → 400 `structure`, com a mensagem do `JSON.parse`.
4. **Validação mínima** (sempre roda): o corpo não é objeto (`[]`, `42`, `null`) ou o `resourceType` não é `"Patient"` → 400 `invalid`.
5. **Validador da Pessoa 3** (se tiver sido plugado): `{ ok: false, status: 422 }` → 422 `business-rule`. Qualquer outro retorno que não seja `{ ok: true }` → 400 `invalid`. O validador pode ser `async`.
   Até aqui nada foi gravado e **nenhum ID foi consumido**.
6. `armazenamento.criar(recebido)` gera o próximo ID sequencial. O código aceita tanto o número quanto o recurso como retorno.
7. `aplicarIdentificador` + `meta.lastUpdated` (ISO 8601). Se o cliente mandou um `meta` que é objeto, os outros campos dele são mantidos.
8. `armazenamento.atualizar(id, recurso)` grava a versão final.
9. Resposta **201 Created** com `Location: {caminho}/Patient/<ID>` e, no corpo, o recurso como ficou gravado. Por isso o corpo do 201 é idêntico ao que o Read devolve depois.

### 3.5 GET /Patient/<ID> — Read

1. `<ID>` que não é inteiro positivo → 400 `invalid`.
2. Encontrou → **200** com o recurso exatamente como foi gravado.
3. Não encontrou → se `armazenamento.foiExcluido(id)` for `true`, responde **410** `deleted`. Caso contrário, **404** `not-found`. Se o armazenamento não tiver `foiExcluido`, a resposta é sempre 404.

### 3.6 GET /PatientIDs — PatientIDs

1. Lê `armazenamento.listarIDs()`.
2. Limpa a lista: converte para número, descarta o que não é inteiro positivo, remove duplicados e ordena em ordem crescente.
3. **200** com o array de **números**, ex.: `[1, 5, 8, 11]`. Lista vazia → **204** sem corpo.

### 3.7 Comportamento comum a todas as rotas

- **CORS** em toda resposta: `Access-Control-Allow-Origin: *`, métodos `GET, POST, PUT, DELETE, OPTIONS`, cabeçalho `Content-Type` e `Access-Control-Expose-Headers: Location`, para o cliente conseguir ler o `Location`. Toda requisição `OPTIONS` (preflight) recebe 204.
- **Erros** no formato OperationOutcome. O cliente lê `issue[0].diagnostics`.
- **500 `exception`** quando o armazenamento lança erro. O erro vai para o log e o servidor continua no ar.
- **404** para rota inexistente e **405 + `Allow`** para método não suportado numa rota que existe (ex.: `POST /PatientIDs`).
- **`{caminho}` opcional** pela variável `CAMINHO_BASE`. O `Location` já sai com o prefixo.

### 3.8 Matriz de códigos implementada

| HTTP | Create | Read | PatientIDs | `issue[0].code` |
|---|---|---|---|---|
| 200 | — | encontrado | há pacientes | — |
| 201 | criado + `Location` | — | — | — |
| 204 | — | — | lista vazia | — |
| 400 | Content-Type, corpo vazio, não é Patient, validador | `<ID>` inválido | — | `invalid` / `structure` |
| 404 | — | ID inexistente | — | `not-found` |
| 405 | método errado | método errado | método errado | `not-supported` |
| 410 | — | excluído | — | `deleted` |
| 413 | corpo > 1 MB | — | — | `too-costly` |
| 422 | regra de negócio | — | — | `business-rule` |
| 500 | falha no armazenamento | falha no armazenamento | falha no armazenamento | `exception` |

### 3.9 Como a Pessoa 3 pluga o validador

Hoje o servidor sobe sem validador completo. Quando o módulo existir, basta passá-lo em `server.js`:

```js
const { validarPaciente } = require('./src/validacao'); // módulo da Pessoa 3
const servidor = criarServidor({ armazenamento, validar: validarPaciente });
```

O contrato é `{ ok: true }` ou `{ ok: false, status: 400 | 422, mensagem }`. Os testes do grupo "integração com o validador (Pessoa 3)" já cobrem esse caminho com um validador de exemplo.

A Pessoa 3 também pode reaproveitar `interpretarId`, `extrairIdentificador`, `enviarErro` e `lerCorpoJson`, que `updateDelete.js` já usa.

**Diferença em relação à especificação:** o exemplo da especificação usa `app.use(criarRotasCreateRead(...))`, que é Express. Sem Express, `criarRotasCreateRead(...)` devolve uma lista de rotas, e `criarServidor` registra essa lista no roteador. O contrato das opções (`armazenamento`, `validar`) não mudou.

### 3.10 Testes

`test/createRead.test.js` (29 testes, todos passando em Node 24):

- **Funções de identificador:** IDs válidos e inválidos, formatos simplificados de `identifier`, `aplicarIdentificador` sem alterar o objeto original.
- **Create:** 201 + `Location` + corpo; `id`/`identifier` do cliente ignorados; `application/fhir+json`; 400 para Content-Type, corpo vazio, não objeto e `resourceType` errado; 400 `structure`; 413; erros não consomem ID.
- **Read:** 200 igual ao corpo do Create; 400 para `abc`, `0`, `-1`, `01`, `1.5`; 404; 410 após DELETE.
- **PatientIDs:** 204 vazio; 200 ordenado; limpeza da lista (`[8,'5',1,5,0,-2,'x',1.5,null,11]` → `[1,5,8,11]`); IDs excluídos não aparecem.
- **Validador:** 400, 422, retorno fora do contrato tratado como 400, validador não chamado quando a estrutura mínima falha.
- **Infraestrutura:** CORS, 404, 405 + `Allow`, `{caminho}`, 500 com o servidor continuando no ar, `package.json` sem dependências.

Também foi feito um teste manual com `curl` contra o servidor real (`npm start`, armazenamento em arquivo): criar, ler, atualizar, excluir, 410 após excluir (também depois de reiniciar o servidor), 413 com envio *chunked* e servidor no ar depois disso.

---

## 4. O que foi ALTERADO no projeto existente

### 4.1 Resumo por arquivo

| Arquivo | Situação | Dono original |
|---|---|---|
| `servidor/server.js` | **reescrito** (Express → `node:http`) | Pessoa 1 |
| `servidor/package.json` | **alterado** (dependências removidas, script `test`, `engines`) | Pessoa 1 |
| `servidor/package-lock.json` | **alterado** (sem pacotes) | Pessoa 1 |
| `servidor/src/routes/patient.js` | **removido** (substituído por `createRead.js` + `updateDelete.js`) | Pessoas 1/2/3 |
| `servidor/src/storage.js` | **alterado** (formato do `identifier`, `foiExcluido`) | Pessoa 1 |
| `servidor/README.md` | **reescrito** | Pessoa 1 |
| `README.md` (raiz) | **alterado** (sem Express, sem `npm install`) | — |
| `cliente/script.js` | **alterado** (lê mensagem do OperationOutcome) | Pessoa 4 |
| `cliente/README.md` | **alterado** (formato de erro, 410) | Pessoa 4 |

### 4.2 Detalhes

**`servidor/server.js` (reescrito)**
- Antes: `express()`, `cors()`, `express.json()`, middlewares de tipo, erro e 404, e `app.listen`.
- Agora: `http.createServer`. O CORS é feito à mão com os mesmos valores de antes (origem `*`, mesmos métodos, `Content-Type`, `Location` exposto) e o preflight `OPTIONS` responde 204. O `try/catch` em volta do roteador responde 500.
- O arquivo exporta `criarServidor({ armazenamento, validar, caminhoBase })` e só chama `listen` quando é executado direto (`npm start`). Isso permite testar com outro armazenamento.
- Novidades: variável `CAMINHO_BASE` e porta lida com `Number(process.env.PORT)`.

**`servidor/package.json` e `package-lock.json`**
- Removidas as dependências `express` e `cors`. **Não é mais necessário rodar `npm install`.**
- Adicionados `"test": "node --test"` e `"engines": { "node": ">=18" }`.

**`servidor/src/routes/patient.js` (removido)**
- Create, Read e PatientIDs foram reimplementados em `createRead.js`, seguindo a especificação.
- Update e Delete foram para `updateDelete.js` com **a mesma lógica**: ID inválido → 400; corpo que não é Patient → 400; `identifier` diferente do ID da URL → 400; recurso inexistente → 404; Delete → sempre 204. O que mudou foi a forma: `extrairIdentificador` no lugar de `storage.obterId`, `lerCorpoJson` no lugar de `express.json()` e erros em OperationOutcome. O `TODO (Pessoa 3)` de validação foi mantido.
- Ganho colateral para o Update: Content-Type errado ou JSON malformado agora retornam mensagens específicas, e corpo acima de 1 MB retorna 413.

**`servidor/src/storage.js`**
1. **Formato do `identifier`:** a função local `montarIdentifier` foi removida, e o arquivo passou a importar a de `util/identificador.js`.
   - Antes: `[{ system: "urn:patientsonfire:id", value: "5" }]`
   - Agora: `[{ use: "official", system: "urn:patientsonfire:patient-id", value: "5" }]`, como na especificação.
   - Sem essa mudança, `storage.atualizar` sobrescreveria o identifier gravado pelo Create, e o Read devolveria um formato diferente do especificado.
2. **`foiExcluido(id)` (nova):** `excluir` passa a guardar os IDs removidos num `Set` `excluidos`, e o Read usa isso para responder 410.
3. **Persistência:** `data/patients.json` ganhou o campo `excluidos`. Arquivos antigos sem esse campo continuam carregando normalmente.
- As outras funções (`criar`, `ler`, `atualizar`, `excluir`, `listarIDs`, `obterId`) não mudaram.

**`cliente/script.js` (Pessoa 4)**
- Só a função `mostrarErro` mudou. Ela lia `r.dados.erro` e agora lê `r.dados.issue[0].diagnostics` (OperationOutcome). Sem isso o cliente continuaria funcionando, mas mostraria só a mensagem genérica de cada código.

**READMEs**
- `servidor/README.md`: nova estrutura de pastas, variáveis, testes, endpoints com 410/413/405, formato de erro e decisões de projeto.
- `README.md` (raiz): "Node.js + Express" → "Node.js puro". Removido o `npm install`. Requisito unificado em Node 18+; antes a raiz dizia 20 e o servidor dizia 18.
- `cliente/README.md`: o formato de erro passou a ser OperationOutcome, e 410 entrou na tabela.

### 4.3 Mudanças de comportamento que o grupo precisa saber

| Antes | Agora | Afeta |
|---|---|---|
| Erros como `{ "erro": "..." }` | OperationOutcome (`issue[0].diagnostics`) | Pessoa 4 (já ajustado), Pessoa 5 (testes) |
| `identifier.system = urn:patientsonfire:id` | `urn:patientsonfire:patient-id` + `use: official` | Pessoa 1, Pessoa 5. Um `data/patients.json` antigo continua funcionando, mas os pacientes antigos mantêm o formato antigo até serem atualizados |
| Read de paciente excluído → 404 | → 410 Gone | Pessoa 4 (o cliente já tratava 410), Pessoa 5 |
| Create com corpo `{}` ou Content-Type errado → 400 `"O corpo deve ser um recurso Patient em JSON."` | 400 com mensagem específica (Content-Type, corpo vazio, JSON malformado, resourceType) | Pessoa 5 |
| Create não gravava `meta.lastUpdated` | grava | — |
| Corpo grande: limite padrão do Express (100 KB) | limite de 1 MB → 413 | Pessoa 5 |
| Método errado → 404 "Rota não encontrada" | 405 + `Allow` | Pessoa 5 |
| `npm install` obrigatório | não precisa | todos |

---

## 5. Pendências e pontos para o grupo

- **Pessoa 1:** revisar as mudanças em `server.js` e `storage.js`, que são da sua responsabilidade. A troca do Express por `node:http` atende à regra de "sem frameworks", mas muda a base do servidor.
- **Pessoa 3:** plugar o validador completo em `criarServidor({ validar })` (seção 3.9) e decidir se o Update também deve gravar `meta.lastUpdated` e responder 410 para IDs excluídos. Hoje o Update responde 404 nesse caso.
- **Pessoa 5:** os testes de `test/createRead.test.js` podem servir de base para a suíte integrada. Basta rodar `npm test`.
- **Relatório:** a seção "Implementação: Create, Read, PatientIDs" pode usar as seções 3.4 a 3.8 deste documento.
