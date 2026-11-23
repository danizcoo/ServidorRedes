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
// Foco inicial: o elemento marcado com data-autofocus; sem ele, o título.
// `sujo`: há alterações não salvas, então fechar pede confirmação antes.
export default function Painel({
  titulo, subtitulo, topo, aoFechar, rodape, children,
  variante = 'gaveta', larga = false, fecharNoFundo = false, sujo = false,
}) {
  const ref = useRef(null);
  const refTitulo = useRef(null);
  const refContinuar = useRef(null);
  const refFocoAntes = useRef(null);
  const idTitulo = useId();
  const idDescarte = useId();
  const [fechando, setFechando] = useState(false);
  const [descartando, setDescartando] = useState(false);

  useEffect(() => {
    const dialogo = ref.current;
    if (!dialogo.open) dialogo.showModal();
    // showModal() foca o primeiro elemento focável (o X); o autoFocus do React
    // roda antes dele e perde o foco. Por isso o foco inicial é definido aqui.
    const alvo = dialogo.querySelector('[data-autofocus]') || refTitulo.current;
    alvo?.focus();
    return () => { if (dialogo.open) dialogo.close(); };
  }, []);

  const fecharDeVez = useCallback(() => {
    if (fechando) return;
    if (movimentoReduzido()) { aoFechar(); return; }
    setFechando(true);
    setTimeout(aoFechar, 190);
  }, [aoFechar, fechando]);

  const fechar = useCallback(() => {
    if (sujo) {
      if (!descartando) refFocoAntes.current = document.activeElement;
      setDescartando(true);
      return;
    }
    fecharDeVez();
  }, [sujo, descartando, fecharDeVez]);

  const continuarEditando = () => {
    setDescartando(false);
    requestAnimationFrame(() => refFocoAntes.current?.focus?.());
  };

  useEffect(() => {
    if (descartando) refContinuar.current?.focus();
  }, [descartando]);

  return (
    <FecharPainel.Provider value={fechar}>
      <dialog
        ref={ref}
        className={`painel painel-${variante}${larga ? ' painel-larga' : ''}${fechando ? ' fechando' : ''}`}
        aria-labelledby={idTitulo}
        onCancel={(e) => {
          e.preventDefault();
          // Esc com a pergunta de descarte aberta volta para a edição.
          if (descartando) continuarEditando();
          else fechar();
        }}
        onClick={(e) => { if (fecharNoFundo && e.target === ref.current) fechar(); }}
      >
        <header className="painel-topo">
          <div className="painel-titulos">
            <h2 id={idTitulo} ref={refTitulo} tabIndex={-1}>{titulo}</h2>
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
        {descartando ? (
          <footer className="painel-rodape painel-descarte">
            <p id={idDescarte} className="descarte-texto">Descartar o que foi preenchido?</p>
            <span className="espaco" />
            <button type="button" className="botao" ref={refContinuar} onClick={continuarEditando} aria-describedby={idDescarte}>
              Continuar editando
            </button>
            <button type="button" className="botao botao-perigo-cheio" onClick={fecharDeVez}>Descartar</button>
          </footer>
        ) : (
          rodape && <footer className="painel-rodape">{rodape}</footer>
        )}
      </dialog>
    </FecharPainel.Provider>
  );
}
