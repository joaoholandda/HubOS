import { useEffect, useMemo, useState } from "react";
import { getAllSessions, type Game, type RunningGame, type Session } from "../lib/api";
import { clockTime, dayLabel, duration, hours } from "../lib/format";
import { GameCard } from "./GameCard";

interface Props {
  games: Game[];
  favorites: string[];
  running: RunningGame | null;
  onOpen: (g: Game) => void;
}

const MAX_FAVS = 5;

/** Perfil: resumo, vitrine de favoritos, recordes e atividade recente. */
export function ProfilePage({ games, favorites, running, onOpen }: Props) {
  const [sessions, setSessions] = useState<Session[] | null>(null);
  useEffect(() => {
    getAllSessions().then(setSessions).catch(() => setSessions([]));
  }, []);

  const byId = useMemo(() => new Map(games.map((g) => [g.id, g])), [games]);
  const favGames = favorites.map((id) => byId.get(id)).filter((g): g is Game => !!g).slice(0, MAX_FAVS);
  const totalMinutes = games.reduce((a, g) => a + (g.playtimeMinutes ?? 0), 0);
  const top = useMemo(() => [...games].sort((a, b) => (b.playtimeMinutes ?? 0) - (a.playtimeMinutes ?? 0))[0], [games]);
  const runningGame = running ? byId.get(running.id) : undefined;

  const stats = useMemo(() => {
    const list = [...(sessions ?? [])].sort((a, b) => b.start - a.start);
    const longest = list.reduce<Session | null>((m, s) => (!m || s.end - s.start > m.end - m.start ? s : m), null);
    // Dia com mais tempo de jogo (a sessão conta no dia em que começou).
    const perDay = new Map<number, number>();
    for (const s of list) {
      const day = new Date(s.start * 1000).setHours(0, 0, 0, 0) / 1000;
      perDay.set(day, (perDay.get(day) ?? 0) + (s.end - s.start));
    }
    const bestDay = [...perDay.entries()].sort((a, b) => b[1] - a[1])[0];
    const first = list.length ? list[list.length - 1].start : null;
    return { list, longest, bestDay, first };
  }, [sessions]);

  const title = (id: string) => byId.get(id)?.title ?? id;

  return (
    <section className="page">
      <div className="pf-head">
        <span className="avatar xl">JH</span>
        <div>
          <h1 className="page-title">João Holanda</h1>
          <p className="muted">
            {games.length} jogos · {hours(totalMinutes)} jogadas
            {stats.first ? ` · no hub desde ${new Date(stats.first * 1000).toLocaleDateString("pt-BR")}` : ""}
          </p>
        </div>
      </div>

      <div className="kpis">
        <div className="kpi hero">
          <small>Tempo total</small>
          <b>{hours(totalMinutes)}</b>
          <span>somando todas as origens</span>
        </div>
        <div className="kpi">
          <small>Jogos</small>
          <b>{games.length}</b>
          <span>{games.filter((g) => g.installed).length} instalados</span>
        </div>
        <div className="kpi">
          <small>Sessões medidas</small>
          <b>{sessions ? stats.list.length : "…"}</b>
          <span>abertas pelo hub</span>
        </div>
        <div className="kpi">
          <small>Mais jogado</small>
          <b className="clip">{top?.playtimeMinutes ? top.title : "—"}</b>
          <span>{top?.playtimeMinutes ? hours(top.playtimeMinutes) : "sem horas ainda"}</span>
        </div>
      </div>

      {runningGame && (
        <button className="rowline" data-nav onClick={() => onOpen(runningGame)}>
          <span>
            <span className="livedot" /> Jogando agora: <b>{runningGame.title}</b>
          </span>
          <span className="muted">desde {clockTime(running!.started)}</span>
        </button>
      )}

      <h2 className="sec-title">
        Favoritos <small>até {MAX_FAVS} na vitrine · Y (ou F) em qualquer capa marca e desmarca</small>
      </h2>
      {favGames.length ? (
        <div className="lib-grid fav-grid">
          {favGames.map((g, i) => (
            <GameCard key={g.id} game={g} onOpen={onOpen} isDefault={i === 0} fav />
          ))}
        </div>
      ) : (
        <p className="muted">Nenhum favorito ainda.</p>
      )}

      <div className="two">
        <div className="panel" data-nav-section>
          <h3 className="eyebrow">Recordes · medidos pelo hub</h3>
          {!sessions ? (
            <p className="muted">Carregando…</p>
          ) : !stats.longest ? (
            <p className="muted">Os recordes aparecem depois das primeiras sessões.</p>
          ) : (
            <dl className="info">
              <dt>Sessão mais longa</dt>
              <dd>
                <b>{duration(stats.longest.end - stats.longest.start)}</b> · {title(stats.longest.game)} · {dayLabel(stats.longest.start)}
              </dd>
              {stats.bestDay && (
                <>
                  <dt>Dia com mais jogo</dt>
                  <dd>
                    <b>{duration(stats.bestDay[1])}</b> · {new Date(stats.bestDay[0] * 1000).toLocaleDateString("pt-BR")}
                  </dd>
                </>
              )}
            </dl>
          )}
        </div>
        <div className="panel" data-nav-section>
          <h3 className="eyebrow">Atividade recente</h3>
          {!sessions ? (
            <p className="muted">Carregando…</p>
          ) : !stats.list.length ? (
            <p className="muted">Nada ainda. O hub registra cada jogo aberto por ele.</p>
          ) : (
            <div className="rows">
              {stats.list.slice(0, 8).map((s) => {
                const g = byId.get(s.game);
                return (
                  <button key={`${s.game}${s.start}`} className="rowline" data-nav disabled={!g} onClick={() => g && onOpen(g)}>
                    <span className="clip">
                      {title(s.game)} <small className="muted">· {dayLabel(s.start)}, {clockTime(s.start)}</small>
                    </span>
                    <b className="tnum">{duration(s.end - s.start)}</b>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
