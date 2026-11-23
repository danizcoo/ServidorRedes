# PatientsOnFIRE

Serviço web REST para recursos **Patient** FHIR v5.0.0 e o cliente web **CRUDEPatients**.

```
.
├── servidor/   # API REST em Node.js + Express (porta 3000)
├── cliente/    # interface em React + Vite (porta 5173)
└── relatorio/  # artigo no formato SBC
```

## Como executar

Requer Node.js 20 ou superior. Use dois terminais:

```bash
# terminal 1 — servidor
cd servidor
npm install
npm start
```

```bash
# terminal 2 — cliente
cd cliente
npm install
npm run dev
```

Depois, abra `http://localhost:5173`.

Mais detalhes em [servidor/README.md](servidor/README.md) e [cliente/README.md](cliente/README.md).
