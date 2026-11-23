import { useEffect, useId, useRef } from 'react';

// Janela modal baseada no <dialog> nativo (foco preso, Esc fecha).
// variante "gaveta" desliza da direita; "confirmacao" é uma caixa central.
export default function Painel({ titulo, subtitulo, aoFechar, rodape, children, variante = 'gaveta', fecharNoFundo = false }) {
  const ref = useRef(null);
  const idTitulo = useId();

  useEffect(() => {
    const dialogo = ref.current;
    if (!dialogo.open) dialogo.showModal();
    return () => { if (dialogo.open) dialogo.close(); };
  }, []);

  return (
    <dialog
      ref={ref}
      className={`painel painel-${variante}`}
      aria-labelledby={idTitulo}
      onCancel={(e) => { e.preventDefault(); aoFechar(); }}
      onClick={(e) => { if (fecharNoFundo && e.target === ref.current) aoFechar(); }}
    >
      <header className="painel-topo">
        <div>
          <h2 id={idTitulo}>{titulo}</h2>
          {subtitulo && <p className="painel-subtitulo">{subtitulo}</p>}
        </div>
        <button type="button" className="botao-icone" onClick={aoFechar} aria-label="Fechar">
          <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
            <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      </header>
      <div className="painel-corpo">{children}</div>
      {rodape && <footer className="painel-rodape">{rodape}</footer>}
    </dialog>
  );
}
