import { useEffect, useState } from "react";

interface Props {
  onMenu: () => void;
  totalLabel: string;
  padConnected: boolean;
}

export function TopBar({ onMenu, totalLabel, padConnected }: Props) {
  return (
    <header className="top" id="top">
      <button className="chip round" data-nav onClick={onMenu} aria-label="Abrir menu">
        <svg className="svg" viewBox="0 0 24 24">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>
      <div className="chip profile">
        <span className="avatar">JH</span>
        <span className="who">
          <b>João Holanda</b>
          <small>{totalLabel}</small>
        </span>
      </div>
      <div className="spacer" />
      {padConnected && (
        <span className="chip pad" title="Controle conectado">
          <svg className="svg" viewBox="0 0 24 24">
            <rect x="2.5" y="7" width="19" height="11" rx="5.5" />
            <path d="M7 10.5v4M5 12.5h4M15.5 11.5h.01M17.5 13.5h.01" />
          </svg>
        </span>
      )}
      <Clock />
    </header>
  );
}

function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 15000);
    return () => window.clearInterval(t);
  }, []);
  return <span className="clock">{now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>;
}
