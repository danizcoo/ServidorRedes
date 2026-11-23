// Resumo compacto do cadastro. Ativos/inativos também funcionam como filtro.
import { useContador } from '../animacao';

function Numero({ valor }) {
  const n = useContador(valor);
  return <span className="resumo-numero">{n ?? '—'}</span>;
}

export default function Resumo({ stats, situacao, aoFiltrarSituacao }) {
  const alternar = (valor) => aoFiltrarSituacao(situacao === valor ? 'todos' : valor);
  return (
    <section className="resumo" aria-label="Resumo do cadastro">
      <div className="resumo-item">
        <Numero valor={stats.total} />
        <span className="resumo-rotulo">{stats.total === 1 ? 'paciente cadastrado' : 'pacientes cadastrados'}</span>
      </div>
      <button type="button" className="resumo-item" aria-pressed={situacao === 'ativos'} onClick={() => alternar('ativos')}>
        <Numero valor={stats.ativos} />
        <span className="resumo-rotulo">{stats.ativos === 1 ? 'ativo' : 'ativos'}</span>
      </button>
      <button type="button" className="resumo-item" aria-pressed={situacao === 'inativos'} onClick={() => alternar('inativos')}>
        <Numero valor={stats.inativos} />
        <span className="resumo-rotulo">{stats.inativos === 1 ? 'inativo' : 'inativos'}</span>
      </button>
      <div className="resumo-item">
        <Numero valor={stats.idadeMedia} />
        <span className="resumo-rotulo">anos, idade média</span>
      </div>
    </section>
  );
}
