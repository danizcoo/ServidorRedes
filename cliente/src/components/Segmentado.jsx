import { useLayoutEffect, useRef, useState } from 'react';

// Grupo de botões em que só um fica selecionado; o destaque desliza até a opção escolhida.
export default function Segmentado({ opcoes, valor, aoMudar, rotulo, className = '' }) {
  const ref = useRef(null);
  const [indicador, setIndicador] = useState(null);

  useLayoutEffect(() => {
    const grupo = ref.current;
    if (!grupo) return undefined;
    const medir = () => {
      const botao = grupo.querySelector('button[aria-pressed="true"]');
      setIndicador(botao
        ? { x: botao.offsetLeft, y: botao.offsetTop, largura: botao.offsetWidth, altura: botao.offsetHeight }
        : null);
    };
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(grupo);
    return () => observador.disconnect();
  }, [valor, opcoes.length]);

  return (
    <div ref={ref} className={`segmentado ${className}`} role="group" aria-label={rotulo}>
      {indicador && (
        <span
          className="segmentado-indicador"
          aria-hidden="true"
          style={{
            width: indicador.largura,
            height: indicador.altura,
            transform: `translate(${indicador.x}px, ${indicador.y}px)`,
          }}
        />
      )}
      {opcoes.map((o) => (
        <button key={o.valor} type="button" aria-pressed={valor === o.valor} onClick={() => aoMudar(o.valor)}>
          {o.icone}
          <span>{o.rotulo}</span>
        </button>
      ))}
    </div>
  );
}
