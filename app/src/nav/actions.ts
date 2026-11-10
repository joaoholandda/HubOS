// Ações do controle que cada tela pode tratar do seu jeito (ex.: LB/RB trocam
// filtros na biblioteca e abas nos detalhes). A tela ativa se inscreve aqui.
import { useEffect, useRef } from "react";
import type { Action } from "./input";

type Handler = (a: Action) => boolean | void;
const handlers: Handler[] = [];

/** Entrega a ação para a tela ativa. Devolve true se alguém tratou. */
export function dispatchToPage(a: Action): boolean {
  const h = handlers[handlers.length - 1];
  return h ? h(a) === true : false;
}

export function usePageActions(fn: Handler) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    const h: Handler = (a) => ref.current(a);
    handlers.push(h);
    return () => {
      const i = handlers.indexOf(h);
      if (i >= 0) handlers.splice(i, 1);
    };
  }, []);
}
