import { useEffect, useRef, useState } from "react";
import { browserAction, browserBounds, browserOpen, browserShow, browserUrl, inTauri } from "../lib/api";

const rectOf = (el: HTMLElement) => {
  const r = el.getBoundingClientRect();
  return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) };
};

/**
 * Área onde o navegador do hub é encaixado. A página em si é uma janela à
 * parte por cima deste espaço; aqui só medimos o lugar e mandamos o endereço.
 */
export function BrowserPage({ url, covered, toast }: { url: string; covered: boolean; toast: (m: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current!;
    browserOpen(url, rectOf(el)).catch((e) => toast(String(e)));
    const ro = new ResizeObserver(() => browserBounds(rectOf(el)).catch(() => {}));
    ro.observe(el);
    return () => ro.disconnect();
  }, [url, toast]);
  // Sai da tela: esconde (a página continua carregada para voltar na hora).
  useEffect(() => () => void browserShow(false), []);
  // Menu ou painel aberto por cima: esconde enquanto isso.
  useEffect(() => {
    browserShow(!covered);
  }, [covered]);

  return (
    <div ref={ref} className="browser-slot">
      <p className="muted">{inTauri ? "Carregando a página…" : `No PC, ${url} abre aqui dentro.`}</p>
    </div>
  );
}

const ICONS = { back: "M15 5l-7 7 7 7", forward: "M9 5l7 7-7 7", reload: "M20 12a8 8 0 1 1-2.6-5.9M20 4v5h-5" };

/** Controles do navegador na barra de cima: voltar, avançar, recarregar e endereço. */
export function BrowserBar({ url, onGo }: { url: string; onGo: (url: string) => void }) {
  const [text, setText] = useState(url);
  const editing = useRef(false);
  // Acompanha o endereço real (links clicados dentro da página).
  useEffect(() => {
    setText(url);
    const t = window.setInterval(() => {
      if (!editing.current) browserUrl().then((u) => u && setText(u)).catch(() => {});
    }, 1500);
    return () => window.clearInterval(t);
  }, [url]);
  const btn = (what: keyof typeof ICONS, label: string) => (
    <button className="chip round" data-nav aria-label={label} onClick={() => browserAction(what).catch(() => {})}>
      <svg className="svg" viewBox="0 0 24 24">
        <path d={ICONS[what]} />
      </svg>
    </button>
  );
  return (
    <>
      {btn("back", "Página anterior")}
      {btn("forward", "Próxima página")}
      {btn("reload", "Recarregar")}
      <form
        className="addr"
        onSubmit={(e) => {
          e.preventDefault();
          editing.current = false;
          if (text.trim()) onGo(text.trim());
          (document.activeElement as HTMLElement | null)?.blur();
        }}
      >
        <input className="field" data-nav value={text} onFocus={(e) => ((editing.current = true), e.currentTarget.select())} onBlur={() => (editing.current = false)} onChange={(e) => setText(e.target.value)} placeholder="Endereço ou busca" aria-label="Endereço ou busca" spellCheck={false} />
      </form>
    </>
  );
}
