import StatusHttp, { classeStatus } from './StatusHttp';

const hora = (d) => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

// Painel lateral que mostra cada fetch feito ao servidor e o código HTTP recebido.
export default function RegistroRequisicoes({ itens, aoLimpar }) {
  const comErro = itens.filter((r) => classeStatus(r.status) !== 'ok').length;
  return (
    <section className="registro" aria-labelledby="titulo-registro">
      <div className="registro-topo">
        <div>
          <h2 id="titulo-registro">Requisições</h2>
          <p className="registro-contagem">
            {itens.length === 0 ? 'Nenhuma ainda' : `${itens.length} ${itens.length === 1 ? 'chamada' : 'chamadas'}${comErro ? `, ${comErro} sem sucesso` : ''}`}
          </p>
        </div>
        {itens.length > 0 && (
          <button type="button" className="botao-texto" onClick={aoLimpar}>Limpar</button>
        )}
      </div>
      {itens.length === 0 ? (
        <p className="registro-vazio">Cada chamada ao servidor aparece aqui, com o código HTTP da resposta.</p>
      ) : (
        <ol className="registro-lista">
          {itens.map((r) => (
            <li key={r.id} className={`req req-${classeStatus(r.status)}`}>
              <span className="req-metodo">{r.metodo}</span>
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
