// Resumo do cadastro. Os blocos de ativos e inativos são também o filtro de situação.

function MarcaFiltro({ ligado }) {
  return (
    <svg className="resumo-marca" viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
      {ligado
        ? <path d="M5 10.5l3.2 3.2L15 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        : <path d="M4 5h12l-4.5 5.5V15l-3 1.5v-6z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />}
    </svg>
  );
}

function Filtro({ valor, rotulo, quantidade, situacao, aoAlternar }) {
  const ligado = situacao === valor;
  return (
    <button
      type="button"
      className="resumo-item resumo-filtro"
      aria-pressed={ligado}
      onClick={() => aoAlternar(valor)}
      title={ligado ? 'Mostrar todos os cadastros' : `Mostrar só os cadastros ${valor}`}
    >
      <span className="sr-only">Filtrar: </span>
      <span className="resumo-numero">{quantidade}</span>
      <span className="resumo-rotulo">{rotulo}</span>
      <MarcaFiltro ligado={ligado} />
    </button>
  );
}

export default function Resumo({ stats, situacao, aoFiltrarSituacao }) {
  const alternar = (valor) => aoFiltrarSituacao(situacao === valor ? 'todos' : valor);
  return (
    <section className="resumo" aria-label="Resumo do cadastro">
      <div className="resumo-item">
        <span className="resumo-numero">{stats.total}</span>
        <span className="resumo-rotulo">{stats.total === 1 ? 'paciente' : 'pacientes'}</span>
      </div>
      <Filtro valor="ativos" rotulo={stats.ativos === 1 ? 'ativo' : 'ativos'} quantidade={stats.ativos} situacao={situacao} aoAlternar={alternar} />
      <Filtro valor="inativos" rotulo={stats.inativos === 1 ? 'inativo' : 'inativos'} quantidade={stats.inativos} situacao={situacao} aoAlternar={alternar} />
      <div className="resumo-item resumo-idade">
        <span className="resumo-numero">{stats.idadeMedia ?? '—'}</span>
        <span className="resumo-rotulo">anos de idade média</span>
      </div>
    </section>
  );
}
