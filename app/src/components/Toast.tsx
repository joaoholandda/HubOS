import { useCallback, useRef, useState } from "react";

export function useToast() {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef(0);
  const show = useCallback((m: string) => {
    setMsg(m);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMsg(null), 2600);
  }, []);
  const node = (
    <div className={`toast${msg ? " show" : ""}`} role="status" aria-live="polite">
      {msg}
    </div>
  );
  return [node, show] as const;
}
