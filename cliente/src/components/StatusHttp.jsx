import { STATUS_TEXTO } from '../api';

export function classeStatus(status) {
  if (status >= 200 && status < 300) return 'ok';
  if (status === 404 || status === 410) return 'aviso';
  return 'erro';
}

// Selo com o código HTTP, ex.: "201 Created".
export default function StatusHttp({ status }) {
  return (
    <span className={`status status-${classeStatus(status)}`}>
      <b>{status || '—'}</b> {STATUS_TEXTO[status] || ''}
    </span>
  );
}
