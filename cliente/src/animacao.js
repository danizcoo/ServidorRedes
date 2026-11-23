// Utilitários de animação. Tudo respeita a preferência do sistema por menos movimento.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

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

// Número que "conta" até o valor novo.
export function useContador(valor, duracao = 600) {
  const [mostrado, setMostrado] = useState(valor);
  const atual = useRef(valor);

  useEffect(() => {
    if (typeof valor !== 'number') { setMostrado(valor); return undefined; }
    const inicio = typeof atual.current === 'number' ? atual.current : 0;
    if (movimentoReduzido() || inicio === valor) {
      atual.current = valor;
      setMostrado(valor);
      return undefined;
    }
    let quadro;
    const t0 = performance.now();
    const passo = (t) => {
      const p = Math.min(1, (t - t0) / duracao);
      const suave = 1 - (1 - p) ** 3;
      const n = Math.round(inicio + (valor - inicio) * suave);
      atual.current = n;
      setMostrado(n);
      if (p < 1) quadro = requestAnimationFrame(passo);
    };
    quadro = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(quadro);
  }, [valor, duracao]);

  return mostrado;
}
