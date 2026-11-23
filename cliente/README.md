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

### Interface

A interface tem dois modos, alternados pelo interruptor **Modo técnico** no cabeçalho (a escolha fica salva no navegador):

- **Normal (padrão):** voltado a quem usa o cadastro no dia a dia, como a recepção ou a secretaria. Mostra só os dados dos pacientes e mensagens em linguagem simples.
- **Técnico:** para a apresentação e o relatório. Mostra o painel **Requisições** (método, caminho e código HTTP de cada chamada), os códigos de status nas mensagens, o caminho de cada operação (`PUT /Patient/3`), o `identifier`, o JSON do recurso, a aba **JSON FHIR** no formulário e o botão **Carregar exemplos**.

Recursos:

- **Resumo:** total de pacientes, ativos, inativos e idade média. Ativos e inativos também funcionam como filtro.
- **Fichas:** cada paciente aparece como uma pasta de prontuário, com a aba colorida pelo último dígito do número (como no arquivamento médico *terminal-digit*). Há também a visão em tabela.
- **Busca, filtros e ordenação:** por nome, número, cidade ou telefone; por gênero e situação; por nome, data de cadastro ou idade.
- **Formulário com validação enquanto digita:** nome obrigatório, datas de nascimento e óbito coerentes, e-mail, telefone e CEP. Telefone e CEP têm máscara, e o CEP preenche o endereço pelo [ViaCEP](https://viacep.com.br).
- **Campos do Patient:** nome, gênero, nascimento, estado civil, situação, nascimento múltiplo (`multipleBirth[x]`), óbito (`deceased[x]`), telefones e e-mails, endereços, contatos e idiomas. Os demais elementos (`photo`, `generalPractitioner`, `managingOrganization`, `link`…) podem ser editados pela aba JSON e são preservados na edição.
- **Aba JSON FHIR (modo técnico):** o texto é enviado como está, o que serve para testar as respostas 400 e 422 do servidor.
- **Carregar exemplos (modo técnico):** cadastra 8 pacientes de exemplo via `POST /Patient` (veja `src/exemplos.js`).
- **Atalhos:** `N` cadastra um paciente e `/` vai para a busca.

### Mensagens e códigos HTTP

- Cada código HTTP tem sua própria mensagem (201, 200, 204, 400, 404, 410, 422 e servidor fora do ar). No modo técnico, o código aparece junto da mensagem.
- Os detalhes enviados pelo servidor também são mostrados, nos formatos `{ "erro": "..." }`, `{ "erros": [...] }` ou `OperationOutcome` do FHIR.
- Se o servidor estiver fora do ar, a interface avisa e oferece "Tentar de novo".

## Estrutura

```
cliente/
├── index.html
├── vite.config.js
└── src/
    ├── main.jsx
    ├── App.jsx                     # estado da tela, filtros e fluxo das operações CRUD
    ├── api.js                      # fetch para o servidor e mensagens por código HTTP
    ├── fhir.js                     # conversão Patient <-> formulário, value sets e estatísticas
    ├── validacao.js                # validação, máscaras e consulta de CEP
    ├── modo.js                     # contexto do modo técnico
    ├── exemplos.js                 # pacientes FHIR de exemplo
    ├── animacao.js                 # animação da lista (FLIP) e contador do resumo
    ├── styles.css
    └── components/
        ├── Resumo.jsx              # resumo do cadastro (total, ativos, inativos, idade média)
        ├── ListaPacientes.jsx      # fichas ou tabela, estados vazio/erro
        ├── FichaPaciente.jsx       # ficha de prontuário e avatar
        ├── FormularioPaciente.jsx  # cadastro e edição (formulário ou JSON)
        ├── DetalhesPaciente.jsx    # visualização com pulseira de identificação
        ├── Painel.jsx              # gaveta lateral e janela de confirmação (<dialog>)
        ├── Segmentado.jsx          # filtros com indicador deslizante
        ├── RegistroRequisicoes.jsx
        ├── ErroServidor.jsx
        └── StatusHttp.jsx
```
