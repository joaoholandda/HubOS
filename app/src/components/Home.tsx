import { memo, useEffect, useState, type ReactNode } from "react";
import type { Game } from "../lib/api";
import { hours, lastPlayed, SOURCE_LABEL } from "../lib/format";
import { focusEngine } from "../nav/focus";
import { GameCard } from "./GameCard";

interface Props {
  games: Game[];
  onPlay: (g: Game) => void;
  onDetails: (g: Game) => void;
  onCover: (g: Game) => void;
  onFocusGame: (g: Game) => void;
  /** Faixa "Em jogo agora", quando houver jogo aberto. */
  banner?: ReactNode;
  favorites: string[];
}

/** Tela inicial no conceito "Fileira": jogo em destaque + uma linha de capas. */
export function Home({ games, onPlay, onDetails, onCover, onFocusGame, banner, favorites }: Props) {
  const [heroId, setHeroId] = useState<string | null>(games[0]?.id ?? null);
  const hero = games.find((g) => g.id === heroId) ?? games[0] ?? null;

  // O destaque acompanha a capa focada na fileira.
  useEffect(() => {
    const byId = new Map(games.map((g) => [g.id, g]));
    return focusEngine.subscribe((el) => {
      const id = el.dataset.game;
      const g = id && el.closest("[data-nav-row]") ? byId.get(id) : undefined;
      if (g) {
        setHeroId(g.id);
        onFocusGame(g);
      }
    });
  }, [games, onFocusGame]);

  useEffect(() => {
    if (games[0]) onFocusGame(games[0]);
  }, [games, onFocusGame]);

  if (!games.length) {
    return (
      <section className="home empty">
        <h1 className="h-title">Nenhum jogo encontrado</h1>
        <p className="muted">Quando a Steam estiver instalada, os jogos aparecem aqui sozinhos.</p>
      </section>
    );
  }

  return (
    <section className="home">
      <div className="hero-col">
        {banner}
        {hero && <HeroInfo game={hero} onPlay={onPlay} onDetails={onDetails} onCover={onCover} />}
      </div>
      <Row games={games} onOpen={onPlay} favorites={favorites} />
    </section>
  );
}

function HeroInfo({ game, onPlay, onDetails, onCover }: { game: Game; onPlay: (g: Game) => void; onDetails: (g: Game) => void; onCover: (g: Game) => void }) {
  return (
    <div className="hero-info">
      <span className="pill">{SOURCE_LABEL[game.source]}</span>
      <h1 className="h-title">{game.title}</h1>
      <p className="h-meta">
        <span>
          <b>{hours(game.playtimeMinutes)}</b> jogadas
        </span>
        <span>
          Última sessão: <b>{lastPlayed(game.lastPlayed)}</b>
        </span>
      </p>
      <div className="btns">
        <button className="btn primary" data-nav onClick={() => onPlay(game)}>
          <span className="g">A</span>
          {game.installed ? "Jogar" : "Instalar"}
        </button>
        <button className="btn" data-nav onClick={() => onDetails(game)}>
          Detalhes
        </button>
        <button className="btn" data-nav onClick={() => onCover(game)}>
          <span className="g">X</span>
          Trocar capa
        </button>
      </div>
    </div>
  );
}

/** A fileira não depende do jogo em destaque: não re-renderiza ao navegar. */
const Row = memo(function Row({ games, onOpen, favorites }: { games: Game[]; onOpen: (g: Game) => void; favorites: string[] }) {
  return (
    <div className="row" data-nav-row>
      {games.map((g) => (
        <GameCard key={g.id} game={g} onOpen={onOpen} fav={favorites.includes(g.id)} />
      ))}
    </div>
  );
});
