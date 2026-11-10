import { useEffect, useRef, type ReactNode } from "react";
import { focusEngine } from "../nav/focus";

/** Painel lateral que prende o foco enquanto aberto. */
export function Sheet({ title, sub, onClose, children, wide }: { title: string; sub?: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current!;
    focusEngine.pushLayer(el);
    return () => focusEngine.popLayer(el);
  }, []);
  return (
    <>
      <div className="veil open sheet-veil" onClick={onClose} />
      <aside ref={ref} className={`sheet open${wide ? " wide" : ""}`} aria-label={title}>
        <div className="sheet-head">
          <div>
            <h2>{title}</h2>
            {sub && <p className="muted">{sub}</p>}
          </div>
        </div>
        {children}
      </aside>
    </>
  );
}
