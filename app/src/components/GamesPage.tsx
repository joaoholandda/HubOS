import { useMemo, useState } from "react";
import type { Game, Source } from "../lib/api";
import { SOURCE_LABEL } from "../lib/format";
import { usePageActions } from "../nav/actions";
import { focusEngine } from "../nav/focus";
import { GameCard } from "./GameCard";

interface Filter {
  id: string;
  label: string;
  test: (g: Game) => boolean;
}

const SORTS: { label: string; cmp: (a: Game, b: Game) => number }[] = [
  { label: "Recentes", cmp: (a, b) => (b.lastPlayed ?? 0) - (a.lastPlayed ?? 0) },
  { label: "A–Z", cmp: (a, b) => a.title.localeCompare(b.title, "pt-BR") },
  { label: "Mais jogados", cmp: (a, b) => (b.playtimeMinutes ?? 0) - (a.playtimeMinutes ?? 0) },
];

const SOURCE_ORDER: Source[] = ["steam", "xbox", "ra", "exe", "epic"];

/** Biblioteca completa: todas as origens juntas, com filtros, ordem e busca. */
export function GamesPage({ games, favorites, onOpen, onAdd }: { games: Game[]; favorites: string[]; onOpen: (g: Game) => void; onAdd: () => void }) {
  const [filter, setFilter] = useState(0);
  const [sort, setSort] = useState(0);
  const [query, setQuery] = useState("");

  // Só mostra filtros de origens que existem na biblioteca.
  const filters = useMemo<Filter[]>(() => {
    const present = SOURCE_ORDER.filter((s) => games.some((g) => g.source === s));
    return [
      { id: "all", label: "Todos", test: () => true },
      { id: "installed", label: "Instalados", test: (g) => g.installed },
      ...(favorites.length ? [{ id: "fav", label: "Favoritos", test: (g: Game) => favorites.includes(g.id) }] : []),
      ...present.map((s) => ({ id: s, label: s === "ra" ? "Emuladores" : SOURCE_LABEL[s], test: (g: Game) => g.source === s })),
    ];
  }, [games, favorites]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const f = filters[Math.min(filter, filters.length - 1)];
    return games.filter(f.test).filter((g) => !q || g.title.toLowerCase().includes(q)).sort(SORTS[sort].cmp);
  }, [games, filters, filter, sort, query]);

  // LB / RB trocam o filtro.
  usePageActions((a) => {
    if (a !== "prevTab" && a !== "nextTab") return;
    const next = (filter + (a === "nextTab" ? 1 : -1) + filters.length) % filters.length;
    setFilter(next);
    requestAnimationFrame(() => focusEngine.focus(document.querySelector<HTMLElement>(`[data-filter="${next}"]`) ?? undefined));
    return true;
  });

  return (
    <section className="page">
      <div className="page-head">
        <h1 className="page-title">Jogos</h1>
        <span className="muted tnum">
          {list.length} de {games.length}
        </span>
        <div className="spacer" />
        <button className="chip" data-nav onClick={onAdd}>
          + Adicionar jogo (.exe)
        </button>
      </div>
      <div className="toolbar">
        <span className="bumper">LB</span>
        <div className="tabs" role="tablist">
          {filters.map((f, i) => (
            <button key={f.id} className="tab" role="tab" data-nav data-filter={i} aria-selected={i === filter} onClick={() => setFilter(i)}>
              {f.label}
              <small>{games.filter(f.test).length}</small>
            </button>
          ))}
        </div>
        <span className="bumper">RB</span>
        <div className="spacer" />
        <button className="chip" data-nav onClick={() => setSort((sort + 1) % SORTS.length)}>
          Ordenar: {SORTS[sort].label}
        </button>
        <input className="field search" data-nav value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar jogo" aria-label="Buscar jogo" spellCheck={false} />
      </div>
      {list.length ? (
        <div className="lib-grid">
          {list.map((g, i) => (
            <GameCard key={g.id} game={g} onOpen={onOpen} isDefault={i === 0} fav={favorites.includes(g.id)} />
          ))}
        </div>
      ) : (
        <p className="muted empty-note">Nenhum jogo encontrado. Tente outro filtro ou outra busca.</p>
      )}
    </section>
  );
}
