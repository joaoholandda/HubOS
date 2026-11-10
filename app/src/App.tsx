import { useCallback, useEffect, useRef, useState } from "react";
import { getLibrary, launchGame, type Game, type Library } from "./lib/api";
import { totalHours } from "./lib/format";
import { focusEngine } from "./nav/focus";
import { useInput, type Action } from "./nav/input";
import { Backdrop } from "./components/Backdrop";
import { Drawer, type MenuItem } from "./components/Drawer";
import { Home } from "./components/Home";
import { TopBar } from "./components/TopBar";
import { useToast } from "./components/Toast";

export default function App() {
  const [lib, setLib] = useState<Library | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState<Game | null>(null);
  const [drawer, setDrawer] = useState(false);
  const [pad, setPad] = useState(false);
  const [toastNode, toast] = useToast();
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    getLibrary()
      .then((l) => {
        setLib(l);
        l.warnings.forEach((w) => console.warn("[HubOS]", w));
      })
      .catch((e) => setError(String(e)));
  }, []);

  // Base do foco: barra de cima + conteúdo. Depois de carregar, foca a 1ª capa.
  useEffect(() => {
    focusEngine.setBase(() => [document.getElementById("top")!, mainRef.current!].filter(Boolean));
    focusEngine.onEdge = (dir) => {
      if (dir === "left") setDrawer(true);
    };
  }, []);
  useEffect(() => {
    if (!lib) return;
    requestAnimationFrame(() => focusEngine.focus(document.querySelector<HTMLElement>("[data-nav-row] [data-nav]") ?? undefined, { scroll: false }));
  }, [lib]);

  const onAction = useCallback((a: Action) => {
    if (a === "menu") setDrawer((d) => !d);
    if (a === "back") setDrawer(false);
  }, []);
  useInput(onAction, setPad);

  const play = useCallback(
    async (g: Game) => {
      if (!g.installed) return toast(`${g.title} não está instalado. Downloads chegam na próxima etapa.`);
      try {
        await launchGame(g);
        toast(`Abrindo ${g.title}…`);
      } catch (e) {
        toast(String(e));
      }
    },
    [toast],
  );
  const details = useCallback((g: Game) => toast(`Detalhes de ${g.title}: próxima etapa`), [toast]);
  const pick = useCallback(
    (m: MenuItem) => {
      setDrawer(false);
      if (m.soon) toast(`${m.label}: chega nas próximas etapas`);
    },
    [toast],
  );
  const closeDrawer = useCallback(() => setDrawer(false), []);

  const games = lib?.games ?? [];

  return (
    <div className="app">
      <Backdrop game={focused} />
      <TopBar onMenu={() => setDrawer(true)} totalLabel={totalHours(games)} padConnected={pad} />
      <main className="main" ref={mainRef} data-nav-scroll>
        {error ? (
          <section className="home empty">
            <h1 className="h-title">Não consegui ler os jogos</h1>
            <p className="muted">{error}</p>
          </section>
        ) : !lib ? (
          <div className="loading" aria-label="Carregando jogos" />
        ) : (
          <Home games={games} onPlay={play} onDetails={details} onFocusGame={setFocused} />
        )}
      </main>
      <Drawer open={drawer} current="home" onPick={pick} onClose={closeDrawer} />
      {toastNode}
    </div>
  );
}
