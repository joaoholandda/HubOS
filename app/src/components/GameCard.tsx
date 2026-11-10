import { memo } from "react";
import { coverSources, type Game } from "../lib/api";
import { SOURCE_LABEL, tint } from "../lib/format";
import { Img } from "./Img";

interface Props {
  game: Game;
  onOpen: (g: Game) => void;
  /** Primeiro item da tela: recebe o foco ao entrar. */
  isDefault?: boolean;
}

/** Capa 2:3. `memo`: navegar pela fileira não re-renderiza as capas. */
export const GameCard = memo(function GameCard({ game, onOpen, isDefault }: Props) {
  const [a, b] = tint(game.id);
  return (
    <button
      className={`card cover${game.installed ? "" : " uninstalled"}`}
      data-nav
      data-game={game.id}
      {...(isDefault ? { "data-nav-default": "" } : {})}
      aria-label={game.title}
      onClick={() => onOpen(game)}
      style={{ background: `linear-gradient(160deg, ${a}, ${b})` }}
    >
      {/* Título por baixo: aparece se a imagem não existir ou não carregar. */}
      <span className="cover-fallback">{game.title}</span>
      <Img key={game.coverPath ?? ""} className="cover-img" sources={coverSources(game)} alt="" />
      <span className="src-tag">{game.installed ? SOURCE_LABEL[game.source] : `Baixar · ${SOURCE_LABEL[game.source]}`}</span>
    </button>
  );
});
