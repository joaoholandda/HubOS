import { useEffect, useMemo, useState } from "react";
import { getAllSessions, type Game, type Session } from "../lib/api";
import { duration, hours, SOURCE_LABEL } from "../lib/format";
import { usePageActions } from "../nav/actions";
import { focusEngine } from "../nav/focus";

const PERIODS = [
  { label: "7 dias", days: 7 },
  { label: "30 dias", days: 30 },
  { label: "90 dias", days: 90 },
];

/**
 * Estatísticas. Duas fontes, sempre identificadas:
 * - "medido pelo hub": sessões que o hub gravou (tem dia e hora)
 * - "pela loja": total de horas que a Steam informa (não tem dia a dia)
 */
export function StatsPage({ games, onOpen }: { games: Game[]; onOpen: (g: Game) => void }) {
  const [period, setPeriod] = useState(1);
  const [sessions, setSessions] = useState<Session[] | null>(null);
  useEffect(() => {
    getAllSessions().then(setSessions).catch(() => setSessions([]));
  }, []);

  usePageActions((a) => {
    if (a !== "prevTab" && a !== "nextTab") return;
    const next = (period + (a === "nextTab" ? 1 : -1) + PERIODS.length) % PERIODS.length;
    setPeriod(next);
    requestAnimationFrame(() => focusEngine.focus(document.querySelector<HTMLElement>(`[data-period="${next}"]`) ?? undefined));
    return true;
  });

  const days = PERIODS[period].days;
  const data = useMemo(() => {
    const today = new Date().setHours(0, 0, 0, 0) / 1000;
    const from = today - (days - 1) * 86400;
    const inRange = (s: Session) => s.start >= from;
    const cur = (sessions ?? []).filter(inRange);
    const prev = (sessions ?? []).filter((s) => s.start >= from - days * 86400 && s.start < from);
    const sum = (l: Session[]) => l.reduce((a, s) => a + (s.end - s.start), 0);
    const bars = Array.from({ length: days }, (_, i) => ({ day: from + i * 86400, secs: 0 }));
    const perGame = new Map<string, number>();
    for (const s of cur) {
      const i = Math.floor((s.start - from) / 86400);
      if (bars[i]) bars[i].secs += s.end - s.start;
      perGame.set(s.game, (perGame.get(s.game) ?? 0) + (s.end - s.start));
    }
    const top = [...perGame.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
    return { total: sum(cur), prevTotal: sum(prev), count: cur.length, bars, top };
  }, [sessions, days]);

  const byId = useMemo(() => new Map(games.map((g) => [g.id, g])), [games]);
  const allTime = useMemo(() => [...games].filter((g) => g.playtimeMinutes).sort((a, b) => (b.playtimeMinutes ?? 0) - (a.playtimeMinutes ?? 0)).slice(0, 10), [games]);
  const bySource = useMemo(() => {
    const m = new Map<string, number>();
    for (const g of games) m.set(g.source, (m.get(g.source) ?? 0) + (g.playtimeMinutes ?? 0));
    return [...m.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  }, [games]);
  const totalMin = games.reduce((a, g) => a + (g.playtimeMinutes ?? 0), 0);

  const delta = data.prevTotal ? Math.round(((data.total - data.prevTotal) / data.prevTotal) * 100) : null;
  const max = Math.max(...data.bars.map((b) => b.secs), 1);
  const every = days > 40 ? 10 : days > 14 ? 5 : 1;

  return (
    <section className="page">
      <div className="page-head">
        <h1 className="page-title">Estatísticas</h1>
        <span className="muted">só jogos · apps não entram</span>
      </div>
      <div className="toolbar">
        <span className="bumper">LB</span>
        <div className="tabs" role="tablist">
          {PERIODS.map((p, i) => (
            <button key={p.label} className="tab" role="tab" data-nav data-period={i} {...(i === period ? { "data-nav-default": "" } : {})} aria-selected={i === period} onClick={() => setPeriod(i)}>
              {p.label}
            </button>
          ))}
        </div>
        <span className="bumper">RB</span>
      </div>

      <div className="kpis">
        <div className="kpi hero">
          <small>Tempo medido pelo hub</small>
          <b>{sessions ? duration(data.total) : "…"}</b>
          <span>{delta === null ? "sem período anterior para comparar" : delta === 0 ? "igual ao período anterior" : `${delta > 0 ? "↑" : "↓"} ${Math.abs(delta)}% vs. período anterior`}</span>
        </div>
        <div className="kpi">
          <small>Sessões</small>
          <b>{data.count}</b>
          <span>{data.count ? `média de ${duration(data.total / data.count)}` : "nenhuma no período"}</span>
        </div>
        <div className="kpi">
          <small>Média por dia</small>
          <b>{duration(data.total / days)}</b>
          <span>contando dias sem jogar</span>
        </div>
        <div className="kpi">
          <small>Total de sempre</small>
          <b>{hours(totalMin)}</b>
          <span>somando o que as lojas informam</span>
        </div>
      </div>

      <div className="panel" data-nav-section>
        <h3 className="eyebrow">Horas por dia · últimos {days} dias · medido pelo hub</h3>
        {data.total === 0 ? (
          <p className="muted">Ainda não há sessões neste período. O hub começa a medir a partir do primeiro jogo aberto por ele.</p>
        ) : (
          <div className="bars tall" role="img" aria-label="Tempo jogado por dia">
            {data.bars.map((b, i) => (
              <div key={b.day} className="bar" title={`${new Date(b.day * 1000).toLocaleDateString("pt-BR")} · ${b.secs ? duration(b.secs) : "não jogou"}`}>
                <i style={{ height: `${Math.round((b.secs / max) * 100)}%` }} />
                <span>{i % every === 0 ? new Date(b.day * 1000).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : ""}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="two">
        <div className="panel" data-nav-section>
          <h3 className="eyebrow">Mais jogados no período · medido pelo hub</h3>
          {data.top.length === 0 ? (
            <p className="muted">Nada ainda.</p>
          ) : (
            <div className="rank">
              {data.top.map(([id, secs]) => (
                <RankRow key={id} label={byId.get(id)?.title ?? id} value={duration(secs)} frac={secs / data.top[0][1]} onClick={byId.get(id) ? () => onOpen(byId.get(id)!) : undefined} />
              ))}
            </div>
          )}
        </div>
        <div className="panel" data-nav-section>
          <h3 className="eyebrow">Top 10 de todos os tempos · pela loja</h3>
          {allTime.length === 0 ? (
            <p className="muted">Sem horas registradas pelas lojas.</p>
          ) : (
            <div className="rank">
              {allTime.map((g) => (
                <RankRow key={g.id} label={g.title} value={hours(g.playtimeMinutes)} frac={(g.playtimeMinutes ?? 0) / (allTime[0].playtimeMinutes ?? 1)} onClick={() => onOpen(g)} />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="panel" data-nav-section>
        <h3 className="eyebrow">Por origem · total de sempre</h3>
        <div className="rank">
          {bySource.map(([src, min]) => (
            <RankRow key={src} label={SOURCE_LABEL[src as Game["source"]]} value={hours(min)} frac={min / bySource[0][1]} />
          ))}
        </div>
      </div>
    </section>
  );
}

function RankRow({ label, value, frac, onClick }: { label: string; value: string; frac: number; onClick?: () => void }) {
  const inner = (
    <>
      <span className="rk-label">{label}</span>
      <span className="rk-track">
        <i style={{ width: `${Math.max(1, Math.round(frac * 100))}%` }} />
      </span>
      <span className="rk-value tnum">{value}</span>
    </>
  );
  return onClick ? (
    <button className="rk" data-nav onClick={onClick}>
      {inner}
    </button>
  ) : (
    <div className="rk">{inner}</div>
  );
}
