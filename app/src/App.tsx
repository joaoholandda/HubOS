import { useCallback, useEffect, useRef, useState } from "react";
import { getGameState, getLibrary, hideHub, inTauri, launchGame, onGameState, type Game, type Library, type RunningGame } from "./lib/api";
import { totalHours } from "./lib/format";
import { focusEngine } from "./nav/focus";
import { useInput, type Action } from "./nav/input";
import { Backdrop } from "./components/Backdrop";
import { Drawer, type MenuItem } from "./components/Drawer";
import { Home } from "./components/Home";
import { NowPlaying } from "./components/NowPlaying";
import { CoverPicker } from "./components/CoverPicker";
import { TopBar } from "./components/TopBar";
import { useToast } from "./components/Toast";

export default function App() {
  const [lib, setLib] = useState<Library | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState<Game | null>(null);
  const [drawer, setDrawer] = useState(false);
  const [pad, setPad] = useState(false);
  const [running, setRunning] = useState<RunningGame | null>(null);
  const [coverFor, setCoverFor] = useState<Game | null>(null);
  const coverOpen = useRef(false);
  coverOpen.current = !!coverFor;
  const [toastNode, toast] = useToast();
  const mainRef = useRef<HTMLElement>(null);
  const libRef = useRef<Library | null>(null);
  libRef.current = lib;

  useEffect(() => {
    getLibrary()
      .then((l) => {
        setLib(l);
        l.warnings.forEach((w) => console.warn("[HubOS]", w));
      })
      .catch((e) => setError(String(e)));
  }, []);

  // Jogo aberto: o lado Rust avisa quando abre e fecha.
  useEffect(() => {
    getGameState().then((s) => setRunning(s.running));
    return onGameState((s) => setRunning(s.running));
  }, []);
  // Ao voltar para o hub com jogo aberto, o foco vai para "Voltar ao jogo".
  useEffect(() => {
    if (!running) return;
    const focusResume = () => requestAnimationFrame(() => focusEngine.focus(document.querySelector<HTMLElement>(".nowbar [data-nav-default]") ?? undefined, { scroll: false }));
    focusResume();
    window.addEventListener("focus", focusResume);
    return () => window.removeEventListener("focus", focusResume);
  }, [running]);

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
    if (coverOpen.current) {
      if (a === "back") setCoverFor(null);
      return;
    }
    if (a === "menu") setDrawer((d) => !d);
    if (a === "back") setDrawer(false);
    // X no controle: trocar a capa do jogo focado.
    if (a === "x") {
      const id = focusEngine.current?.dataset.game;
      const g = id ? libRef.current?.games.find((x) => x.id === id) : undefined;
      if (g) setCoverFor(g);
    }
  }, []);
  useInput(onAction, setPad);

  const play = useCallback(
    async (g: Game) => {
      if (!g.installed) return toast(`${g.title} não está instalado. Downloads chegam na próxima etapa.`);
      try {
        if (running && running.id !== g.id) return toast("Feche o jogo aberto antes de abrir outro.");
        if (running?.id === g.id) return hideHub();
        await launchGame(g);
        toast(`Abrindo ${g.title}…`);
        // No navegador não há Steam: simula o jogo aberto para testar a interface.
        if (!inTauri) setRunning({ id: g.id, started: Math.floor(Date.now() / 1000) });
      } catch (e) {
        toast(String(e));
      }
    },
    [toast, running],
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
  const changeCover = useCallback((g: Game, path: string | null) => {
    if (path === null) {
      // Voltou à capa original: relê a biblioteca para pegar o caminho da loja.
      getLibrary().then(setLib).catch(() => {});
      return;
    }
    setLib((l) => (l ? { ...l, games: l.games.map((x) => (x.id === g.id ? { ...x, coverPath: path } : x)) } : l));
  }, []);

  const games = lib?.games ?? [];
  const runningGame = running ? games.find((g) => g.id === running.id) : undefined;
  const banner = running ? (
    <NowPlaying
      running={running}
      game={runningGame}
      onResume={() => (inTauri ? hideHub() : toast("No PC, o hub sairia da frente e o jogo voltaria."))}
      onQuit={() => toast("Fechar jogo pelo hub chega na próxima etapa. Por enquanto, feche pelo próprio jogo.")}
    />
  ) : null;

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
          <Home games={games} onPlay={play} onDetails={details} onCover={setCoverFor} onFocusGame={setFocused} banner={banner} />
        )}
      </main>
      <Drawer open={drawer} current="home" onPick={pick} onClose={closeDrawer} />
      {coverFor && <CoverPicker game={coverFor} onClose={() => setCoverFor(null)} onChanged={changeCover} toast={toast} />}
      {toastNode}
    </div>
  );
}
