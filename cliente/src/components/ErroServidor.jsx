import StatusHttp from './StatusHttp';

// Caixa de erro com o código HTTP e as mensagens devolvidas pelo servidor.
export default function ErroServidor({ erro }) {
  const detalhes = erro.detalhes || [];
  return (
    <div className="erro-servidor" role="alert">
      <StatusHttp status={erro.status} />
      <p>{erro.descricao || erro.message}</p>
      {detalhes.length > 0 && (
        <ul>{detalhes.map((d, i) => <li key={i}>{d}</li>)}</ul>
      )}
    </div>
  );
}
