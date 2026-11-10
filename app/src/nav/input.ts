// Entrada unificada: teclado, mouse e controle no padrão Xbox.
// Tudo vira as mesmas ações, então as telas não precisam saber de onde veio.
import { useEffect } from "react";
import { focusEngine, type Dir } from "./focus";

export type Action = "back" | "menu" | "prevTab" | "nextTab" | "x" | "y";

/** Botões no layout padrão do Gamepad API (o controle Xbox segue esse layout). */
const PAD = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, VIEW: 8, MENU: 9, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 } as const;

const KEYS: Record<string, Dir> = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" };

/** Primeira repetição depois de segurar, depois acelera. Em ms. */
const REPEAT_DELAY = 360;
const REPEAT_FAST = 95;
const REPEAT_FASTER = 55;
const STICK = 0.55;

export function useInput(onAction: (a: Action) => void, onPadChange?: (connected: boolean) => void) {
  useEffect(() => {
    const isTyping = (t: EventTarget | null) => (t instanceof HTMLInputElement && t.type !== "range") || t instanceof HTMLTextAreaElement;

    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target)) {
        if (e.key === "Escape") onAction("back");
        if (e.key === "ArrowUp" || e.key === "ArrowDown") {
          e.preventDefault();
          focusEngine.move(KEYS[e.key]);
        }
        return;
      }
      const dir = KEYS[e.key];
      if (dir) {
        e.preventDefault();
        return focusEngine.move(dir);
      }
      switch (e.key) {
        case "Enter":
        case " ":
          e.preventDefault();
          return focusEngine.activate();
        case "Escape":
        case "Backspace":
          e.preventDefault();
          return onAction("back");
        case "m":
        case "M":
          return onAction("menu");
        case "q":
        case "Q":
          return onAction("prevTab");
        case "e":
        case "E":
          return onAction("nextTab");
      }
    };

    // Mouse: passar por cima foca (sem rolar a tela), como num console.
    let lastX = -1;
    let lastY = -1;
    const onPointer = (e: PointerEvent) => {
      if (e.clientX === lastX && e.clientY === lastY) return;
      lastX = e.clientX;
      lastY = e.clientY;
      const el = (e.target as HTMLElement | null)?.closest<HTMLElement>("[data-nav]");
      if (el && el !== focusEngine.current && focusEngine.candidates().includes(el)) focusEngine.focus(el, { scroll: false });
    };
    // Botão "voltar" lateral do mouse.
    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 3) {
        e.preventDefault();
        onAction("back");
      }
    };

    // Controle: só lê enquanto houver um conectado (zero custo sem controle).
    let raf = 0;
    const held = new Map<Dir, { t0: number; next: number }>();
    const prev: boolean[] = [];
    const dirInput = (dir: Dir, on: boolean, t: number) => {
      const h = held.get(dir);
      if (!on) return void held.delete(dir);
      if (!h) {
        held.set(dir, { t0: t, next: t + REPEAT_DELAY });
        return focusEngine.move(dir);
      }
      if (t >= h.next) {
        focusEngine.move(dir);
        h.next = t + (t - h.t0 > 1400 ? REPEAT_FASTER : REPEAT_FAST);
      }
    };
    const poll = (t: number) => {
      const pad = Array.from(navigator.getGamepads?.() ?? []).find(Boolean);
      if (!pad) {
        raf = 0;
        onPadChange?.(false);
        return;
      }
      if (!document.hidden) {
        const b = (i: number) => !!pad.buttons[i]?.pressed;
        const ax = (i: number) => pad.axes[i] ?? 0;
        dirInput("up", b(PAD.UP) || ax(1) < -STICK, t);
        dirInput("down", b(PAD.DOWN) || ax(1) > STICK, t);
        dirInput("left", b(PAD.LEFT) || ax(0) < -STICK, t);
        dirInput("right", b(PAD.RIGHT) || ax(0) > STICK, t);
        const pressed = (i: number) => {
          const now = b(i);
          const was = prev[i];
          prev[i] = now;
          return now && !was;
        };
        if (pressed(PAD.A)) focusEngine.activate();
        if (pressed(PAD.B)) onAction("back");
        if (pressed(PAD.X)) onAction("x");
        if (pressed(PAD.Y)) onAction("y");
        if (pressed(PAD.LB)) onAction("prevTab");
        if (pressed(PAD.RB)) onAction("nextTab");
        if (pressed(PAD.VIEW) || pressed(PAD.MENU)) onAction("menu");
      }
      raf = requestAnimationFrame(poll);
    };
    const start = () => {
      onPadChange?.(true);
      if (!raf) raf = requestAnimationFrame(poll);
    };

    window.addEventListener("keydown", onKey);
    document.addEventListener("pointermove", onPointer);
    document.addEventListener("mouseup", onMouseUp);
    window.addEventListener("gamepadconnected", start);
    if (Array.from(navigator.getGamepads?.() ?? []).some(Boolean)) start();
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointermove", onPointer);
      document.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("gamepadconnected", start);
      cancelAnimationFrame(raf);
    };
  }, [onAction, onPadChange]);
}
