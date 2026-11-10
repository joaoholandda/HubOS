import { useEffect, useRef } from "react";
import { focusEngine } from "../nav/focus";

export interface MenuItem {
  id: string;
  label: string;
  icon: string;
  /** Itens que ainda não existem no app real: mostram aviso. */
  soon?: boolean;
  bottom?: boolean;
}

const I = (d: string) => d;
export const MENU: MenuItem[] = [
  { id: "home", label: "Início", icon: I('<path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z"/>') },
  { id: "games", label: "Jogos", icon: I('<rect x="2.5" y="7" width="19" height="11" rx="5.5"/><path d="M7 10.5v4M5 12.5h4M15.5 11.5h.01M17.5 13.5h.01"/>') },
  { id: "apps", label: "Apps", icon: I('<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/>') },
  { id: "store", label: "Loja", icon: I('<path d="M5 8h14l-1 12H6zM9 8a3 3 0 0 1 6 0"/>'), soon: true },
  { id: "downloads", label: "Downloads", icon: I('<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>'), soon: true },
  { id: "party", label: "Party", icon: I('<path d="M4 5h16v11H9l-5 4z"/>'), soon: true },
  { id: "audio", label: "Áudio", icon: I('<path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3" y="14" width="4" height="6" rx="1.5"/><rect x="17" y="14" width="4" height="6" rx="1.5"/>'), soon: true },
  { id: "spotify", label: "Spotify", icon: I('<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>'), soon: true },
  { id: "claude", label: "Claude", icon: I('<path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/>'), soon: true },
  { id: "stats", label: "Estatísticas", icon: I('<path d="M5 20V10M12 20V4M19 20v-7"/>') },
  { id: "files", label: "Arquivos", icon: I('<path d="M3 6h6l2 2h10v11H3z"/>'), soon: true },
  { id: "settings", label: "Configurações", icon: I('<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>') },
  { id: "desktop", label: "Área de trabalho", icon: I('<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M9 20h6M12 16v4"/>'), bottom: true },
  { id: "power", label: "Energia", icon: I('<path d="M12 3v9M6.3 6.3a8 8 0 1 0 11.4 0"/>'), bottom: true },
];

interface Props {
  open: boolean;
  current: string;
  onPick: (item: MenuItem) => void;
  onClose: () => void;
}

/** Menu lateral escondido (gaveta). Enquanto aberto, prende o foco. */
export function Drawer({ open, current, onPick, onClose }: Props) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open) focusEngine.pushLayer(el);
    else focusEngine.popLayer(el);
  }, [open]);

  // Mouse saindo do menu fecha.
  useEffect(() => {
    if (!open) return;
    const onMove = (e: PointerEvent) => {
      const r = ref.current?.getBoundingClientRect();
      if (r && e.clientX > r.right + 10) onClose();
    };
    document.addEventListener("pointermove", onMove);
    return () => document.removeEventListener("pointermove", onMove);
  }, [open, onClose]);

  const item = (m: MenuItem) => (
    <button key={m.id} className={`ri${m.id === current ? " here" : ""}`} data-nav {...(m.id === current ? { "data-nav-default": "" } : {})} onClick={() => onPick(m)}>
      <svg className="svg" viewBox="0 0 24 24" dangerouslySetInnerHTML={{ __html: m.icon }} />
      <span>{m.label}</span>
    </button>
  );

  return (
    <>
      <div className={`veil${open ? " open" : ""}`} onClick={onClose} />
      <nav ref={ref} className={`drawer${open ? " open" : ""}`} aria-label="Menu" aria-hidden={!open}>
        {MENU.filter((m) => !m.bottom).map(item)}
        <div className="drawer-gap" />
        {MENU.filter((m) => m.bottom).map(item)}
      </nav>
    </>
  );
}
