import { useEffect, useState } from "react";
import { coverSources, type Game, type RunningGame } from "../lib/api";
import { tint } from "../lib/format";
import { Img } from "./Img";

interface Props {
  running: RunningGame;
  game: Game | undefined;
  onResume: () => void;
  onQuit: () => void;
}

/** Faixa "Em jogo agora": aparece na home quando você volta ao hub com um jogo aberto. */
export function NowPlaying({ running, game, onResume, onQuit }: Props) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  const secs = Math.max(0, Math.floor(now / 1000 - running.started));
  const hms = `${Math.floor(secs / 3600)}:${String(Math.floor(secs / 60) % 60).padStart(2, "0")}:${String(secs % 60).padStart(2, "0")}`;
  const [a, b] = tint(running.id);
  return (
    <div className="nowbar">
      <span className="now-art" style={{ background: `linear-gradient(135deg, ${a}, ${b})` }}>
        {game && <Img sources={coverSources(game)} alt="" className="cover-img" />}
      </span>
      <div className="now-txt">
        <small>
          <span className="livedot" />
          Em jogo agora
        </small>
        <b>{game?.title ?? running.id}</b>
        <span>Sessão de {hms}</span>
      </div>
      <button className="btn primary" data-nav data-nav-default onClick={onResume}>
        <span className="g">A</span>
        Voltar ao jogo
      </button>
      <button className="btn" data-nav onClick={onQuit}>
        Fechar jogo
      </button>
    </div>
  );
}
