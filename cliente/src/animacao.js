// Utilitários de animação. Tudo respeita a preferência do sistema por menos movimento.
import { useLayoutEffect, useRef } from 'react';

export function movimentoReduzido() {
  return typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

export const espera = (ms) => new Promise((r) => setTimeout(r, ms));

// Anima a lista quando itens mudam de posição, entram ou trocam de grupo (técnica FLIP).
// Cada item precisa do atributo data-chave. `grupo` reinicia as posições (ex.: fichas x tabela).
export function useListaAnimada(ref, grupo) {
  const posicoes = useRef(new Map());
  const grupoAnterior = useRef(grupo);

  useLayoutEffect(() => {
    const container = ref.current;
    if (!container) return;
    if (grupoAnterior.current !== grupo) {
      posicoes.current = new Map();
      grupoAnterior.current = grupo;
    }
    const reduzir = movimentoReduzido();
    const novas = new Map();
    let entradas = 0;

    container.querySelectorAll('[data-chave]').forEach((item) => {
      // offsetLeft/offsetTop medem o layout sem as transformações de animações em andamento
      const pos = { x: item.offsetLeft, y: item.offsetTop };
      const chave = item.dataset.chave;
      novas.set(chave, pos);
      if (reduzir || !item.animate) return;

      const antiga = posicoes.current.get(chave);
      if (antiga) {
        const dx = antiga.x - pos.x;
        const dy = antiga.y - pos.y;
        if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
          item.animate(
            [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }],
            { duration: 380, easing: 'cubic-bezier(.2,.8,.2,1)' },
          );
        }
      } else {
        item.animate(
          [{ opacity: 0, transform: 'translateY(14px) scale(.98)' }, { opacity: 1, transform: 'none' }],
          { duration: 340, delay: Math.min(entradas, 10) * 35, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' },
        );
        entradas += 1;
      }
    });
    posicoes.current = novas;
  });
}
