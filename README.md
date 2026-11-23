# PatientsOnFIRE

Serviço web REST para recursos **Patient** FHIR v5.0.0 e o cliente web **CRUDEPatients**.

```
.
├── servidor/   # API REST em Node.js puro, módulo http (porta 3000)
├── cliente/    # interface em HTML, CSS e JavaScript puro (fetch)
└── relatorio/  # artigo no formato SBC
```

## Como executar

Requer Node.js 18 ou superior para o servidor. Não há dependências para instalar:

```bash
cd servidor
npm start
```

Depois, abra `cliente/index.html` no navegador.

Mais detalhes em [servidor/README.md](servidor/README.md) e [cliente/README.md](cliente/README.md).
