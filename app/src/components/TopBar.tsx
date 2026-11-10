import { useEffect, useState } from "react";
import type { Media } from "../lib/api";

interface Props {
  onMenu: () => void;
  /** Quando existe, mostra o botão Voltar (telas que não são a inicial). */
  onBack?: () => void;
  totalLabel: string;
  padConnected: boolean;
  onProfile: () => void;
  media: Media | null;
  art: string | null;
  onMedia: () => void;
}

export function TopBar({ onMenu, onBack, totalLabel, padConnected, onProfile, media, art, onMedia }: Props) {
  return (
    <header className="top" id="top">
      <button className="chip round" data-nav onClick={onMenu} aria-label="Abrir menu">
        <svg className="svg" viewBox="0 0 24 24">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>
      {onBack && (
        <button className="chip" data-nav onClick={onBack}>
          <svg className="svg" viewBox="0 0 24 24">
            <path d="M15 5l-7 7 7 7" />
          </svg>
          Voltar
        </button>
      )}
      <button className="chip profile" data-nav onClick={onProfile} aria-label="Abrir perfil">
        <span className="avatar">JH</span>
        <span className="who">
          <b>João Holanda</b>
          <small>{totalLabel}</small>
        </span>
      </button>
      <div className="spacer" />
      {media && (
        <button className="chip media" data-nav onClick={onMedia} aria-label={`Tocando agora: ${media.title}`}>
          <span className="media-thumb">{art ? <img src={art} alt="" /> : "♪"}</span>
          <span className="who">
            <b>{media.title}</b>
            <small>{media.playing ? media.artist || media.app : "Pausado"}</small>
          </span>
        </button>
      )}
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
