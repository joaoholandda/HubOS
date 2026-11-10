import { useCallback, useEffect, useRef, useState } from "react";
import { addExeGame, applyAppearance, closeGame, getFavorites, getGameState, getLibrary, getSettings, hideHub, inTauri, launchGame, onGameState, openApp, openFiles, openUrl, toggleFavorite, type Game, type Library, type RunningGame } from "./lib/api";
import { totalHours } from "./lib/format";
import { focusEngine } from "./nav/focus";
import { useInput, type Action } from "./nav/input";
import { Backdrop } from "./components/Backdrop";
import { Drawer, type MenuItem } from "./components/Drawer";
import { Home } from "./components/Home";
import { NowPlaying } from "./components/NowPlaying";
import { CoverPicker } from "./components/CoverPicker";
import { GamePage } from "./components/GamePage";
import { GamesPage } from "./components/GamesPage";
import { dispatchToPage } from "./nav/actions";
import { AppsPage } from "./components/AppsPage";
import { PowerSheet } from "./components/PowerSheet";
import { SettingsPage } from "./components/SettingsPage";
import { StatsPage } from "./components/StatsPage";
import { TopBar } from "./components/TopBar";
import { MediaSheet, useMedia } from "./components/MediaSheet";
import { ProfilePage } from "./components/ProfilePage";
import { useToast } from "./components/Toast";

type Route = { page: "home" } | { page: "games" } | { page: "apps" } | { page: "stats" } | { page: "settings" } | { page: "profile" } | { page: "game"; id: string };

export default function App() {
  const [route, setRoute] = useState<Route>({ page: "home" });
  const history = useRef<Route[]>([]);
  const routeRef = useRef(route);
  routeRef.current = route;
  const [lib, setLib] = useState<Library | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState<Game | null>(null);
  const [drawer, setDrawer] = useState(false);
  const [pad, setPad] = useState(false);
  const [running, setRunning] = useState<RunningGame | null>(null);
  const [coverFor, setCoverFor] = useState<Game | null>(null);
  const [powerOpen, setPowerOpen] = useState(false);
  const [quitArmed, setQuitArmed] = useState(false);
  const [mediaOpen, setMediaOpen] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const coverOpen = useRef(false);
  coverOpen.current = !!coverFor;
  const powerRef = useRef(false);
  powerRef.current = powerOpen;
  const mediaRef = useRef(false);
  mediaRef.current = mediaOpen;

  // Tema e cor de destaque salvos.
  useEffect(() => {
    getSettings().then(applyAppearance).catch(() => {});
  }, []);
  const [toastNode, toast] = useToast();
  const mediaState = useMedia(toast);
  useEffect(() => {
    getFavorites().then(setFavorites).catch(() => {});
  }, []);
  const toggleFav = useCallback(
    async (g: Game) => {
      try {
        const next = await toggleFavorite(g.id);
        setFavorites(next);
        toast(next.includes(g.id) ? `${g.title} nos favoritos` : `${g.title} saiu dos favoritos`);
      } catch (e) {
        toast(String(e));
      }
    },
    [toast],
  );
  const rescan = useCallback(async () => {
    try {
      setLib(await getLibrary());
    } catch (e) {
      toast(String(e));
    }
  }, [toast]);
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
    if (routeRef.current.page !== "home") return;
    requestAnimationFrame(() => focusEngine.focus(document.querySelector<HTMLElement>("[data-nav-row] [data-nav]") ?? undefined, { scroll: false }));
  }, [lib === null]);

  const go = useCallback((r: Route, push = true) => {
    if (push) history.current.push(routeRef.current);
    else history.current = [];
    setRoute(r);
  }, []);
  const goBack = useCallback(() => {
    const prev = history.current.pop();
    setRoute(prev ?? { page: "home" });
  }, []);
  // Ao trocar de tela: rola para o topo e foca o item principal dela.
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
    requestAnimationFrame(() => {
      const def = mainRef.current?.querySelector<HTMLElement>("[data-nav-default]") ?? mainRef.current?.querySelector<HTMLElement>("[data-nav]");
      focusEngine.focus(def ?? undefined, { scroll: false });
    });
  }, [route]);

  const drawerOpen = useRef(false);
  drawerOpen.current = drawer;
  const onAction = useCallback((a: Action) => {
    if (coverOpen.current) {
      if (a === "back") setCoverFor(null);
      return;
    }
    if (powerRef.current) {
      if (a === "back") setPowerOpen(false);
      return;
    }
    if (mediaRef.current) {
      if (a === "back") setMediaOpen(false);
      return;
    }
    if (a === "menu") return setDrawer((d) => !d);
    if (drawerOpen.current) {
      if (a === "back") setDrawer(false);
      return;
    }
    if (dispatchToPage(a)) return;
    if (a === "back" && routeRef.current.page !== "home") return goBack();
    // X no controle: trocar a capa do jogo focado.
    if (a === "x") {
      const id = focusEngine.current?.dataset.game;
      const g = id ? libRef.current?.games.find((x) => x.id === id) : undefined;
      if (g) setCoverFor(g);
    }
    // Y no controle: favoritar o jogo focado (ou o da página aberta).
    if (a === "y") {
      const r = routeRef.current;
      const id = focusEngine.current?.dataset.game ?? (r.page === "game" ? r.id : undefined);
      const g = id ? libRef.current?.games.find((x) => x.id === id) : undefined;
      if (g) toggleFav(g);
    }
  }, [goBack, toggleFav]);
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
  const details = useCallback((g: Game) => go({ page: "game", id: g.id }), [go]);
  const pick = useCallback(
    (m: MenuItem) => {
      setDrawer(false);
      if (m.id === "home") return go({ page: "home" }, false);
      if (m.id === "games" || m.id === "apps" || m.id === "stats" || m.id === "settings") return go({ page: m.id }, false);
      if (m.id === "power") return setPowerOpen(true);
      if (m.id === "desktop") return void hideHub();
      const fail = (e: unknown) => toast(String(e));
      if (m.id === "spotify") return setMediaOpen(true);
      if (m.id === "claude") return void openApp("claude").catch(fail);
      if (m.id === "files") return void openFiles().catch(fail);
      if (m.id === "downloads") return void openUrl("steam://open/downloads").catch(fail);
      if (m.id === "party") {
        toast("Abrindo o Discord. A Party dentro do hub chega depois.");
        return void openApp("discord").catch(fail);
      }
      if (m.soon) toast(`${m.label}: chega nas próximas etapas`);
    },
    [toast, go],
  );
  const closeDrawer = useCallback(() => setDrawer(false), []);
  const addGame = useCallback(async () => {
    if (!inTauri) return toast("No PC, abre o seletor de arquivos para escolher o .exe.");
    try {
      const id = await addExeGame();
      if (!id) return;
      setLib(await getLibrary());
      go({ page: "game", id });
      toast("Jogo adicionado. Dá para trocar a capa aqui.");
    } catch (e) {
      toast(String(e));
    }
  }, [toast, go]);
  const changeCover = useCallback((g: Game, path: string | null) => {
    if (path === null) {
      // Voltou à capa original: relê a biblioteca para pegar o caminho da loja.
      getLibrary().then(setLib).catch(() => {});
      return;
    }
    setLib((l) => (l ? { ...l, games: l.games.map((x) => (x.id === g.id ? { ...x, coverPath: path } : x)) } : l));
  }, []);

  const games = lib?.games ?? [];
  const pageGame = route.page === "game" ? games.find((g) => g.id === route.id) : undefined;
  const runningGame = running ? games.find((g) => g.id === running.id) : undefined;
  const banner = running ? (
    <NowPlaying
      running={running}
      game={runningGame}
      onResume={() => (inTauri ? hideHub() : toast("No PC, o hub sairia da frente e o jogo voltaria."))}
      quitArmed={quitArmed}
      onQuit={async () => {
        // Fechar jogo pede confirmação: o progresso não salvo se perde.
        if (!quitArmed) {
          setQuitArmed(true);
          window.setTimeout(() => setQuitArmed(false), 3000);
          return;
        }
        setQuitArmed(false);
        if (!inTauri) return setRunning(null);
        try {
          await closeGame(runningGame);
        } catch (e) {
          toast(String(e));
        }
      }}
    />
  ) : null;

  return (
    <div className="app">
      {(route.page === "home" || route.page === "game") && <Backdrop game={route.page === "game" ? (pageGame ?? focused) : focused} />}
      <TopBar onMenu={() => setDrawer(true)} onBack={route.page === "home" ? undefined : goBack} totalLabel={totalHours(games)} padConnected={pad} onProfile={() => routeRef.current.page !== "profile" && go({ page: "profile" })} media={mediaState.media} art={mediaState.art} onMedia={() => setMediaOpen(true)} />
      <main className="main" ref={mainRef} data-nav-scroll>
        {error ? (
          <section className="home empty">
            <h1 className="h-title">Não consegui ler os jogos</h1>
            <p className="muted">{error}</p>
          </section>
        ) : !lib ? (
          <div className="loading" aria-label="Carregando jogos" />
        ) : route.page === "games" ? (
          <GamesPage games={games} favorites={favorites} onOpen={details} onAdd={addGame} />
        ) : route.page === "apps" ? (
          <AppsPage toast={toast} />
        ) : route.page === "stats" ? (
          <StatsPage games={games} onOpen={details} />
        ) : route.page === "settings" ? (
          <SettingsPage toast={toast} onRescan={rescan} />
        ) : route.page === "profile" ? (
          <ProfilePage games={games} favorites={favorites} running={running} onOpen={details} />
        ) : route.page === "game" && pageGame ? (
          <GamePage game={pageGame} onPlay={play} onCover={setCoverFor} fav={favorites.includes(pageGame.id)} onFav={toggleFav} />
        ) : (
          <Home games={games} onPlay={play} onDetails={details} onCover={setCoverFor} onFocusGame={setFocused} banner={banner} favorites={favorites} />
        )}
      </main>
      <Drawer open={drawer} current={route.page === "game" ? "games" : route.page} onPick={pick} onClose={closeDrawer} />
      {coverFor && <CoverPicker game={coverFor} onClose={() => setCoverFor(null)} onChanged={changeCover} toast={toast} />}
      {powerOpen && <PowerSheet gameOpen={runningGame?.title ?? (running ? "Um jogo" : null)} onClose={() => setPowerOpen(false)} onDesktop={() => void hideHub()} toast={toast} />}
      {mediaOpen && <MediaSheet state={mediaState} onClose={() => setMediaOpen(false)} toast={toast} />}
      {toastNode}
    </div>
  );
}
