import StatusHttp, { classeStatus } from './StatusHttp';

const hora = (d) => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

// Painel lateral que mostra cada fetch feito ao servidor e o código HTTP recebido.
export default function RegistroRequisicoes({ itens, aoLimpar }) {
  return (
    <section className="registro" aria-labelledby="titulo-registro">
      <div className="registro-topo">
        <h2 id="titulo-registro">Requisições</h2>
        {itens.length > 0 && (
          <button type="button" className="botao-texto" onClick={aoLimpar}>Limpar</button>
        )}
      </div>
      {itens.length === 0 ? (
        <p className="registro-vazio">Cada chamada ao servidor aparece aqui, com o código HTTP da resposta.</p>
      ) : (
        <ol className="registro-lista" aria-live="polite">
          {itens.map((r) => (
            <li key={r.id} className={`req req-${classeStatus(r.status)}`}>
              <span className={`req-metodo metodo-${r.metodo.toLowerCase()}`}>{r.metodo}</span>
              <code className="req-caminho">{r.caminho}</code>
              <StatusHttp status={r.status} />
              <time className="req-hora" dateTime={r.hora.toISOString()}>{hora(r.hora)}</time>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
