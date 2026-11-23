import StatusHttp from './StatusHttp';
import { useModoTecnico } from '../modo';

// Caixa de erro com a mensagem do servidor (e o código HTTP no modo técnico).
export default function ErroServidor({ erro }) {
  const tecnico = useModoTecnico();
  const detalhes = erro.detalhes || [];
  return (
    <div className="erro-servidor" role="alert">
      {tecnico && <StatusHttp status={erro.status} />}
      <p><strong>{erro.descricao || erro.message}</strong></p>
      {detalhes.length > 0 && (
        <ul>{detalhes.map((d, i) => <li key={i}>{d}</li>)}</ul>
      )}
    </div>
  );
}
