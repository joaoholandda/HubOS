// Motor de foco espacial: decide para onde o foco vai com ←↑→↓ olhando a
// posição real dos elementos na tela. Funciona igual para teclado e controle.
//
// Regras:
// - Elementos navegáveis têm o atributo `data-nav`.
// - Fileiras roláveis têm `data-nav-row`: ao voltar para uma fileira, o foco
//   retorna ao último item que estava focado nela (se ainda estiver visível).
// - Camadas (menu lateral, painéis) prendem o foco até serem fechadas.
// - Nada aqui causa re-render do React: só classes e scroll no DOM.

export type Dir = "up" | "down" | "left" | "right";

type Listener = (el: HTMLElement) => void;

export class FocusEngine {
  current: HTMLElement | null = null;
  private layers: HTMLElement[] = [];
  private base: () => HTMLElement[] = () => [document.body];
  private rowMemory = new WeakMap<HTMLElement, HTMLElement>();
  private layerReturn = new WeakMap<HTMLElement, HTMLElement | null>();
  private listeners = new Set<Listener>();
  /** Chamado quando não há para onde ir naquela direção (ex.: ← na borda abre o menu). */
  onEdge: (dir: Dir) => void = () => {};

  setBase(fn: () => HTMLElement[]) {
    this.base = fn;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  /** Elementos que podem receber foco agora. */
  candidates(): HTMLElement[] {
    const roots = this.layers.length ? [this.layers[this.layers.length - 1]] : this.base();
    return roots.flatMap((r) => Array.from(r.querySelectorAll<HTMLElement>("[data-nav]"))).filter((e) => e.offsetParent !== null && !e.hasAttribute("disabled"));
  }

  focus(el: HTMLElement | null | undefined, opts: { scroll?: boolean } = {}) {
    if (!el) return;
    if (this.current && this.current !== el) this.current.classList.remove("is-focus");
    this.current = el;
    el.classList.add("is-focus");
    el.focus({ preventScroll: true });
    const row = el.closest<HTMLElement>("[data-nav-row]");
    if (row) this.rowMemory.set(row, el);
    if (opts.scroll !== false) reveal(el);
    this.listeners.forEach((fn) => fn(el));
  }

  /** Foca o primeiro elemento disponível (ou o que já estava, se ainda existir). */
  ensure() {
    const c = this.candidates();
    if (this.current && c.includes(this.current)) return;
    this.focus(c[0], { scroll: false });
  }

  move(dir: Dir) {
    const els = this.candidates();
    const cur = this.current;
    if (!cur || !els.includes(cur)) return this.focus(els[0]);
    const best = pickNext(cur, els, dir);
    if (!best) return this.onEdge(dir);
    const toRow = best.closest<HTMLElement>("[data-nav-row]");
    if ((dir === "up" || dir === "down") && toRow && toRow !== cur.closest("[data-nav-row]")) {
      const remembered = this.rowMemory.get(toRow);
      if (remembered && remembered.isConnected && fullyInside(remembered, toRow)) return this.focus(remembered);
    }
    this.focus(best);
  }

  activate() {
    this.current?.click();
  }

  pushLayer(layer: HTMLElement) {
    this.layerReturn.set(layer, this.current);
    this.layers.push(layer);
    const first = layer.querySelector<HTMLElement>("[data-nav-default]") ?? this.candidates()[0];
    this.focus(first, { scroll: false });
  }

  popLayer(layer?: HTMLElement) {
    const top = layer ?? this.layers[this.layers.length - 1];
    if (!top || !this.layers.includes(top)) return;
    this.layers = this.layers.filter((l) => l !== top);
    const back = this.layerReturn.get(top);
    if (back && back.isConnected) this.focus(back, { scroll: false });
    else this.ensure();
  }

  get inLayer() {
    return this.layers.length > 0;
  }
}

/** Escolhe o vizinho mais natural na direção pedida. */
function pickNext(cur: HTMLElement, els: HTMLElement[], dir: Dir): HTMLElement | null {
  const c = cur.getBoundingClientRect();
  const ccx = c.left + c.width / 2;
  const ccy = c.top + c.height / 2;
  let best: HTMLElement | null = null;
  let bestScore = Infinity;
  for (const el of els) {
    if (el === cur) continue;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    let primary: number, ortho: number, overlap: number;
    if (dir === "right" || dir === "left") {
      const forward = dir === "right" ? cx > ccx + 2 && r.left >= c.left + 2 : cx < ccx - 2 && r.right <= c.right - 2;
      if (!forward) continue;
      overlap = Math.min(c.bottom, r.bottom) - Math.max(c.top, r.top);
      // Andar para os lados só vale na mesma "linha" visual.
      if (overlap <= 0) continue;
      primary = dir === "right" ? Math.max(0, r.left - c.right) : Math.max(0, c.left - r.right);
      ortho = Math.abs(cy - ccy);
    } else {
      const forward = dir === "down" ? cy > ccy + 2 && r.top >= c.top + 2 : cy < ccy - 2 && r.bottom <= c.bottom - 2;
      if (!forward) continue;
      overlap = Math.min(c.right, r.right) - Math.max(c.left, r.left);
      primary = dir === "down" ? Math.max(0, r.top - c.bottom) : Math.max(0, c.top - r.bottom);
      ortho = Math.abs(cx - ccx);
    }
    const score = primary + (overlap > 0 ? ortho * 0.3 : ortho * 1.2 + 4000);
    if (score < bestScore) {
      bestScore = score;
      best = el;
    }
  }
  return best;
}

function fullyInside(el: HTMLElement, box: HTMLElement) {
  const r = el.getBoundingClientRect();
  const b = box.getBoundingClientRect();
  return r.left >= b.left - 4 && r.right <= b.right + 4;
}

const smooth = () => (matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth") as ScrollBehavior;

/** Mantém o item focado visível: rola a fileira na horizontal e a página na vertical. */
function reveal(el: HTMLElement) {
  const row = el.closest<HTMLElement>("[data-nav-row]");
  if (row) {
    const pad = Math.min(120, row.clientWidth * 0.1);
    const a = el.offsetLeft;
    const b = a + el.offsetWidth;
    let left = row.scrollLeft;
    if (a < left + pad) left = a - pad;
    else if (b > left + row.clientWidth - pad) left = b - row.clientWidth + pad;
    if (left !== row.scrollLeft) row.scrollTo({ left: Math.max(0, left), behavior: smooth() });
  }
  const scroller = el.closest<HTMLElement>("[data-nav-scroll]");
  if (scroller) {
    const box = (el.closest<HTMLElement>("[data-nav-section]") ?? el).getBoundingClientRect();
    const s = scroller.getBoundingClientRect();
    const pad = 28;
    if (box.top < s.top + pad) scroller.scrollBy({ top: box.top - s.top - pad, behavior: smooth() });
    else if (box.bottom > s.bottom - pad) scroller.scrollBy({ top: box.bottom - s.bottom + pad, behavior: smooth() });
  }
}

export const focusEngine = new FocusEngine();
