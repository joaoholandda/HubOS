import { useEffect, useRef, useState } from "react";
import { heroSources, type Game } from "../lib/api";
import { tint } from "../lib/format";

interface State {
  layers: [string, string];
  front: 0 | 1;
}

/**
 * Fundo que troca com cruzamento suave (só opacidade, roda na GPU).
 * A imagem nova só entra depois de carregada, para não piscar.
 */
export function Backdrop({ game }: { game: Game | null }) {
  const [state, setState] = useState<State>({ layers: ["", ""], front: 0 });
  const token = useRef(0);

  useEffect(() => {
    if (!game) return;
    const my = ++token.current;
    const [a, b] = tint(game.id);
    const fallback = `linear-gradient(135deg, ${a}, ${b})`;
    const show = (bg: string) => {
      if (my !== token.current) return;
      setState((s) => {
        const back = (1 - s.front) as 0 | 1;
        const layers: [string, string] = [...s.layers];
        layers[back] = bg;
        return { layers, front: back };
      });
    };
    // Espera um instante: se o foco passar rápido pela fileira, não carrega tudo.
    const timer = window.setTimeout(() => {
      const srcs = heroSources(game);
      const tryNext = (i: number) => {
        if (i >= srcs.length) return show(fallback);
        const img = new Image();
        img.decoding = "async";
        img.onload = () => show(`url("${srcs[i]}")`);
        img.onerror = () => tryNext(i + 1);
        img.src = srcs[i];
      };
      tryNext(0);
    }, 90);
    return () => window.clearTimeout(timer);
  }, [game]);

  return (
    <div className="backdrop" aria-hidden>
      {state.layers.map((bg, i) => (
        <div key={i} className={`bd-layer${i === state.front ? " on" : ""}`} style={{ backgroundImage: bg || undefined }} />
      ))}
      <div className="bd-scrim" />
    </div>
  );
}
