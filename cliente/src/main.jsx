import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

// Sem <StrictMode>: em desenvolvimento ele executa os efeitos duas vezes,
// o que duplicaria as requisições mostradas no painel "Requisições".
createRoot(document.getElementById('root')).render(<App />);
