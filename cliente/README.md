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
| Excluir (pela visualização, com confirmação) | `DELETE /Patient/<ID>` | 200, 202, 204, 404 |
| Inativar (alternativa à exclusão) | `PUT /Patient/<ID>` com `active: false` | 200, 400, 404, 422 |

### Interface

A interface tem dois modos, alternados pelo interruptor **Modo técnico** no rodapé da página (a escolha fica salva no navegador; no modo técnico, o painel Requisições também tem o botão **Desligar**):

- **Normal (padrão):** voltado a quem usa o cadastro no dia a dia, como a recepção ou a secretaria. Mostra só os dados dos pacientes e mensagens em linguagem simples. Os menus do formulário trazem só as opções do dia a dia (ex.: telefone e e-mail); códigos FHIR como fax, pager ou seguradora ficam no modo técnico, mas continuam aparecendo se já estiverem no cadastro.
- **Técnico:** para a apresentação e o relatório. Mostra o painel **Requisições** (método, caminho e código HTTP de cada chamada), os códigos de status nas mensagens, o caminho de cada operação (`PUT /Patient/3`), o `identifier`, o JSON do recurso, a aba **JSON FHIR** no formulário e o botão **Carregar exemplos**.

Recursos:

- **Resumo:** total de pacientes, ativos, inativos e idade média. Ativos e inativos são também o filtro de situação.
- **Fichas:** cada paciente aparece como uma pasta de prontuário, com a aba colorida pelo último dígito do número (como no arquivamento médico *terminal-digit*). Campos vazios não aparecem na ficha. Há também a visão em tabela (no celular, a lista fica sempre em fichas).
- **Visualização:** a pulseira de identificação traz um código de barras Code 39 real do número do cadastro.
- **Busca, filtros e ordenação:** por nome, número, cidade ou telefone; por gênero e situação; por nome, data de cadastro ou idade. A busca e os filtros ficam na URL (`?busca=&genero=&situacao=`).
- **Cadastro:** o aviso de sucesso mostra o número gerado. Fechar o formulário com alterações não salvas (Esc, X, Cancelar) pede confirmação.
- **Exclusão:** a confirmação identifica o paciente (número, nascimento e cidade) e oferece **Inativar** como alternativa, já que a exclusão não pode ser desfeita.
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
    ├── animacao.js                 # animação da lista (FLIP)
    ├── styles.css
    └── components/
        ├── Resumo.jsx              # resumo do cadastro (total, ativos, inativos, idade média)
        ├── ListaPacientes.jsx      # fichas ou tabela, estados vazio/erro
        ├── FichaPaciente.jsx       # ficha de prontuário e avatar
        ├── FormularioPaciente.jsx  # cadastro e edição (formulário ou JSON)
        ├── DetalhesPaciente.jsx    # visualização com pulseira de identificação
        ├── Painel.jsx              # gaveta lateral e janela de confirmação (<dialog>)
        ├── Segmentado.jsx          # alternância fichas/tabela com indicador deslizante
        ├── RegistroRequisicoes.jsx
        ├── ErroServidor.jsx
        └── StatusHttp.jsx
```
