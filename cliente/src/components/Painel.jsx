import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from 'react';
import { movimentoReduzido } from '../animacao';

const FecharPainel = createContext(() => {});

// Fecha o painel com a animação de saída (para botões como "Cancelar" e "Fechar").
export function BotaoFecharPainel({ className = 'botao', children, ...resto }) {
  const fechar = useContext(FecharPainel);
  return <button type="button" className={className} onClick={fechar} {...resto}>{children}</button>;
}

// Janela modal baseada no <dialog> nativo (foco preso, Esc fecha).
// variante "gaveta" desliza da direita; "confirmacao" é uma caixa central.
// `topo` é um conteúdo opcional exibido logo abaixo do título.
export default function Painel({
  titulo, subtitulo, topo, aoFechar, rodape, children,
  variante = 'gaveta', larga = false, fecharNoFundo = false,
}) {
  const ref = useRef(null);
  const idTitulo = useId();
  const [fechando, setFechando] = useState(false);

  useEffect(() => {
    const dialogo = ref.current;
    if (!dialogo.open) dialogo.showModal();
    return () => { if (dialogo.open) dialogo.close(); };
  }, []);

  const fechar = useCallback(() => {
    if (fechando) return;
    if (movimentoReduzido()) { aoFechar(); return; }
    setFechando(true);
    setTimeout(aoFechar, 190);
  }, [aoFechar, fechando]);

  return (
    <FecharPainel.Provider value={fechar}>
      <dialog
        ref={ref}
        className={`painel painel-${variante}${larga ? ' painel-larga' : ''}${fechando ? ' fechando' : ''}`}
        aria-labelledby={idTitulo}
        onCancel={(e) => { e.preventDefault(); fechar(); }}
        onClick={(e) => { if (fecharNoFundo && e.target === ref.current) fechar(); }}
      >
        <header className="painel-topo">
          <div className="painel-titulos">
            <h2 id={idTitulo}>{titulo}</h2>
            {subtitulo && <p className="painel-subtitulo">{subtitulo}</p>}
          </div>
          <button type="button" className="botao-icone botao-fechar" onClick={fechar} aria-label="Fechar">
            <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
              <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </header>
        {topo}
        <div className="painel-corpo">{children}</div>
        {rodape && <footer className="painel-rodape">{rodape}</footer>}
      </dialog>
    </FecharPainel.Provider>
  );
}
