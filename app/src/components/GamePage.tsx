import { useEffect, useMemo, useState } from "react";
import { getSessions, openFolder, type Game, type Session } from "../lib/api";
import { clockTime, dayLabel, duration, hours, lastPlayed, size, SOURCE_LABEL } from "../lib/format";
import { usePageActions } from "../nav/actions";
import { focusEngine } from "../nav/focus";

interface Props {
  game: Game;
  onPlay: (g: Game) => void;
  onCover: (g: Game) => void;
  fav: boolean;
  onFav: (g: Game) => void;
}

const TABS = ["Visão geral", "Sessões"];
const DAYS = 14;

/** Página de um jogo: números, ações e as sessões que o hub gravou. */
export function GamePage({ game, onPlay, onCover, fav, onFav }: Props) {
  const [tab, setTab] = useState(0);
  const [sessions, setSessions] = useState<Session[] | null>(null);

  useEffect(() => {
    setSessions(null);
    getSessions(game.id).then(setSessions).catch(() => setSessions([]));
  }, [game.id]);

  usePageActions((a) => {
    if (a !== "prevTab" && a !== "nextTab") return;
    const next = (tab + (a === "nextTab" ? 1 : -1) + TABS.length) % TABS.length;
    setTab(next);
    requestAnimationFrame(() => focusEngine.focus(document.querySelector<HTMLElement>(`[data-tab="${next}"]`) ?? undefined));
    return true;
  });

  const measured = useMemo(() => (sessions ?? []).reduce((a, s) => a + (s.end - s.start), 0), [sessions]);

  return (
    <section className="page game-page">
      <div className="game-head">
        <span className="pill">{SOURCE_LABEL[game.source]}</span>
        <h1 className="h-title">{game.title}</h1>
        <div className="stats">
          <Stat label="Tempo jogado" value={hours(game.playtimeMinutes)} />
          <Stat label="Última sessão" value={lastPlayed(game.lastPlayed)} />
          <Stat label="Sessões no hub" value={sessions ? String(sessions.length) : "…"} />
          <Stat label="Tamanho" value={size(game.sizeOnDisk)} />
        </div>
        <div className="btns">
          <button className="btn primary" data-nav data-nav-default onClick={() => onPlay(game)}>
            <span className="g">A</span>
            {game.installed ? "Jogar" : "Instalar"}
          </button>
          <button className="btn" data-nav onClick={() => onCover(game)}>
            <span className="g">X</span>
            Trocar capa
          </button>
          <button className="btn" data-nav aria-pressed={fav} onClick={() => onFav(game)}>
            <span className="g">Y</span>
            {fav ? "★ Favorito" : "Favoritar"}
          </button>
          {game.installDir && (
            <button className="btn" data-nav onClick={() => openFolder(game.installDir!)}>
              Abrir pasta
            </button>
          )}
        </div>
      </div>

      <div className="toolbar">
        <span className="bumper">LB</span>
        <div className="tabs" role="tablist">
          {TABS.map((t, i) => (
            <button key={t} className="tab" role="tab" data-nav data-tab={i} aria-selected={i === tab} onClick={() => setTab(i)}>
              {t}
            </button>
          ))}
        </div>
        <span className="bumper">RB</span>
      </div>

      <div className="panel" data-nav-section>
        {tab === 0 ? (
          <dl className="info">
            <dt>Origem</dt>
            <dd>{SOURCE_LABEL[game.source]}</dd>
            <dt>Situação</dt>
            <dd>{game.installed ? "Instalado" : "Não instalado"}</dd>
            {game.installDir && (
              <>
                <dt>Pasta</dt>
                <dd>{game.installDir}</dd>
              </>
            )}
            <dt>Tamanho</dt>
            <dd>{size(game.sizeOnDisk)}</dd>
            <dt>Tempo pela {SOURCE_LABEL[game.source]}</dt>
            <dd>{hours(game.playtimeMinutes)}</dd>
            <dt>Tempo medido pelo hub</dt>
            <dd>{sessions ? (measured ? duration(measured) : "Ainda nada: começa a contar a partir de agora") : "…"}</dd>
          </dl>
        ) : (
          <SessionsTab sessions={sessions} />
        )}
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <small>{label}</small>
      <b>{value}</b>
    </div>
  );
}

function SessionsTab({ sessions }: { sessions: Session[] | null }) {
  // Horas por dia nos últimos 14 dias (uma sessão conta no dia em que começou).
  const bars = useMemo(() => {
    const today = new Date().setHours(0, 0, 0, 0) / 1000;
    const out = Array.from({ length: DAYS }, (_, i) => ({ day: today - (DAYS - 1 - i) * 86400, secs: 0 }));
    for (const s of sessions ?? []) {
      const i = DAYS - 1 - Math.floor((today + 86400 - s.start) / 86400);
      if (i >= 0 && i < DAYS) out[i].secs += s.end - s.start;
    }
    return out;
  }, [sessions]);

  if (!sessions) return <p className="muted">Carregando…</p>;
  if (!sessions.length) return <p className="muted">Nenhuma sessão ainda. Quando você jogar, o hub registra início, fim e duração de cada vez.</p>;

  const max = Math.max(...bars.map((b) => b.secs), 1);
  return (
    <>
      <h3 className="eyebrow">Últimos {DAYS} dias</h3>
      <div className="bars" role="img" aria-label={`Tempo jogado por dia nos últimos ${DAYS} dias`}>
        {bars.map((b) => (
          <div key={b.day} className="bar" title={`${dayLabel(b.day)} · ${b.secs ? duration(b.secs) : "não jogou"}`}>
            <i style={{ height: `${Math.round((b.secs / max) * 100)}%` }} />
            <span>{new Date(b.day * 1000).getDate()}</span>
          </div>
        ))}
      </div>
      <h3 className="eyebrow">Sessões</h3>
      <div className="rows">
        {sessions.slice(0, 30).map((s) => (
          <div key={s.start} className="rowline" data-nav tabIndex={-1}>
            <span>
              {dayLabel(s.start)} <small className="muted">· começou {clockTime(s.start)}</small>
            </span>
            <b className="tnum">{duration(s.end - s.start)}</b>
          </div>
        ))}
      </div>
    </>
  );
}
