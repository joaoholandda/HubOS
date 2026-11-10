// Ponte com o lado Rust. Fora do Tauri (rodando `npm run dev` no navegador),
// usa dados de exemplo para dar para trabalhar na interface em qualquer PC.
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { MOCK_GAMES } from "./mock";

export type Source = "steam" | "xbox" | "epic" | "exe" | "ra";

export interface Game {
  id: string;
  title: string;
  source: Source;
  installed: boolean;
  playtimeMinutes: number | null;
  lastPlayed: number | null;
  sizeOnDisk: number | null;
  installDir: string | null;
  coverPath: string | null;
  heroPath: string | null;
  logoPath: string | null;
  coverUrl: string | null;
  heroUrl: string | null;
  launch: string;
}

export interface Library {
  games: Game[];
  steamRoot: string | null;
  warnings: string[];
}

export const inTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export async function getLibrary(): Promise<Library> {
  if (!inTauri) return { games: MOCK_GAMES, steamRoot: null, warnings: ["Modo navegador: dados de exemplo."] };
  return invoke<Library>("get_library");
}

export async function launchGame(game: Game): Promise<void> {
  if (!inTauri) return;
  await invoke("launch_game", { id: game.id, launch: game.launch });
}

export interface RunningGame {
  id: string;
  /** Segundos Unix de quando o jogo abriu. */
  started: number;
}

export interface GameState {
  running: RunningGame | null;
}

export async function getGameState(): Promise<GameState> {
  if (!inTauri) return { running: null };
  return invoke<GameState>("get_game_state");
}

/** Avisa quando um jogo abre ou fecha (o lado Rust vigia a Steam). */
export function onGameState(cb: (s: GameState) => void): () => void {
  if (!inTauri) return () => {};
  const off = listen<GameState>("game-state", (e) => cb(e.payload));
  return () => void off.then((f) => f());
}

/** "Voltar ao jogo": tira o hub da frente. */
export async function hideHub(): Promise<void> {
  if (inTauri) await invoke("hide_hub");
}

export interface Session {
  game: string;
  start: number;
  end: number;
}

/** Sessões gravadas pelo hub para um jogo (mais recente primeiro). */
export async function getSessions(gameId: string): Promise<Session[]> {
  if (!inTauri) return mockSessions(gameId);
  return invoke<Session[]>("get_sessions", { gameId });
}

function mockSessions(gameId: string): Session[] {
  let h = 0;
  for (const c of gameId) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const now = Math.floor(Date.now() / 1000);
  return Array.from({ length: 9 }, (_, i) => {
    const start = now - i * 86400 * (1 + ((h >> i) & 1)) - 3600 * 3;
    return { game: gameId, start, end: start + 1800 + ((h >>> (i + 2)) % 8) * 1200 };
  });
}

/** Abre uma pasta no Explorador. */
export async function openFolder(path: string): Promise<void> {
  if (inTauri) await invoke("open_external", { target: path });
}

export interface CoverOption {
  id: number;
  url: string;
  thumb: string;
  width: number;
  height: number;
  style: string;
}

export const hasSgdbKey = async () => (inTauri ? invoke<boolean>("has_sgdb_key") : false);
export const setSgdbKey = (key: string) => (inTauri ? invoke<void>("set_sgdb_key", { key }) : Promise.resolve());

/** Opções do SteamGridDB. Erros especiais: "NO_KEY" (falta chave) e "BAD_KEY" (chave recusada). */
export async function coverOptions(g: Game): Promise<CoverOption[]> {
  if (!inTauri) throw new Error("NO_KEY");
  return invoke<CoverOption[]>("cover_options", { gameId: g.id, title: g.title });
}

export const setCover = (g: Game, url: string) => invoke<string>("set_cover", { gameId: g.id, url });
export const resetCover = (g: Game) => invoke<void>("reset_cover", { gameId: g.id });

/** Abre um site no navegador padrão (Firefox). */
export async function openUrl(url: string): Promise<void> {
  if (!inTauri) return void window.open(url, "_blank");
  await invoke("open_external", { target: url });
}

/** Imagens em ordem de preferência: arquivo local (rápido, offline) e depois internet. */
export function coverSources(g: Game): string[] {
  return [g.coverPath && local(g.coverPath), g.coverUrl].filter(Boolean) as string[];
}

export function heroSources(g: Game): string[] {
  return [g.heroPath && local(g.heroPath), g.heroUrl, g.coverPath && local(g.coverPath)].filter(Boolean) as string[];
}

function local(path: string): string {
  return inTauri ? convertFileSrc(path) : path;
}

/** Fecha o jogo aberto (pelo processo, ou pela pasta nos jogos da Steam). */
export const closeGame = (g: Game | undefined) => (inTauri ? invoke<void>("close_game", { installDir: g?.installDir ?? null }) : Promise.resolve());

export type PowerAction = "sleep" | "restart" | "off" | "lock";
export const power = (action: PowerAction) => (inTauri ? invoke<void>("power", { action }) : Promise.resolve());

/** Abre o seletor de arquivos e adiciona um .exe. Devolve o id do jogo novo. */
export const addExeGame = () => (inTauri ? invoke<string | null>("add_exe_game") : Promise.resolve(null));
export const removeGame = (id: string) => invoke<void>("remove_game", { id });

export interface AppEntry {
  id: string;
  name: string;
  kind: "program" | "site";
  target: string;
}

const MOCK_APPS: AppEntry[] = [
  { id: "firefox", name: "Firefox", kind: "program", target: "firefox" },
  { id: "discord", name: "Discord", kind: "program", target: "discord://" },
  { id: "spotify", name: "Spotify", kind: "program", target: "spotify:" },
  { id: "claude", name: "Claude", kind: "site", target: "https://claude.ai" },
  { id: "youtube", name: "YouTube", kind: "site", target: "https://www.youtube.com" },
  { id: "twitch", name: "Twitch", kind: "site", target: "https://www.twitch.tv" },
  { id: "kick", name: "Kick", kind: "site", target: "https://kick.com" },
];
let mockApps = MOCK_APPS;

export const getApps = () => (inTauri ? invoke<AppEntry[]>("get_apps") : Promise.resolve(mockApps));
export async function addApp(name: string, target: string): Promise<AppEntry[]> {
  if (inTauri) return invoke<AppEntry[]>("add_app", { name, target });
  mockApps = [...mockApps, { id: "app" + Date.now(), name, kind: target.includes(".") ? "site" : "program", target }];
  return mockApps;
}
export async function removeApp(id: string): Promise<AppEntry[]> {
  if (inTauri) return invoke<AppEntry[]>("remove_app", { id });
  mockApps = mockApps.filter((a) => a.id !== id);
  return mockApps;
}
export const openApp = (id: string) => (inTauri ? invoke<void>("open_app", { id }) : Promise.resolve());

export async function getAllSessions(): Promise<Session[]> {
  if (!inTauri) return MOCK_GAMES.slice(0, 6).flatMap((g) => mockSessions(g.id));
  return invoke<Session[]>("get_all_sessions");
}

export interface Settings {
  hasSgdbKey: boolean;
  theme: "auto" | "light" | "dark";
  accent: string | null;
  autostart: boolean;
  steamRoot: string | null;
}

let mockSettings: Settings = { hasSgdbKey: false, theme: "auto", accent: null, autostart: true, steamRoot: null };
export const getSettings = () => (inTauri ? invoke<Settings>("get_settings") : Promise.resolve(mockSettings));
export async function setSetting(key: "theme" | "accent" | "autostart", value: string): Promise<void> {
  if (inTauri) return invoke<void>("set_setting", { key, value });
  mockSettings = { ...mockSettings, [key]: key === "autostart" ? value === "true" : value || null } as Settings;
}

/** Aplica tema e cor de destaque na página. */
export function applyAppearance(s: Pick<Settings, "theme" | "accent">) {
  const root = document.documentElement;
  if (s.theme === "auto") delete root.dataset.theme;
  else root.dataset.theme = s.theme;
  if (s.accent) root.style.setProperty("--accent", s.accent);
  else root.style.removeProperty("--accent");
}
