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
  hasSteamKey: boolean;
  theme: "auto" | "light" | "dark";
  accent: string | null;
  autostart: boolean;
  steamRoot: string | null;
}

let mockSettings: Settings = { hasSgdbKey: false, hasSteamKey: false, theme: "auto", accent: null, autostart: true, steamRoot: null };
export const getSettings = () => (inTauri ? invoke<Settings>("get_settings") : Promise.resolve(mockSettings));
export async function setSetting(key: "theme" | "accent" | "autostart" | "steamKey" | "discordId" | "discordSecret", value: string): Promise<void> {
  if (inTauri) return invoke<void>("set_setting", { key, value });
  if (key === "discordId" || key === "discordSecret") return;
  if (key === "steamKey") return void (mockSettings = { ...mockSettings, hasSteamKey: !!value });
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

export interface Diagnostics {
  version: string;
  dataDir: string | null;
  steamRoot: string | null;
  scan: { steam: number; xbox: number; exe: number; millis: number; warnings: string[] };
  shortcutOk: boolean;
  guideOk: boolean;
  log: string[];
}

export async function getDiagnostics(): Promise<Diagnostics> {
  if (inTauri) return invoke<Diagnostics>("get_diagnostics");
  return { version: "navegador", dataDir: null, steamRoot: null, scan: { steam: MOCK_GAMES.length, xbox: 0, exe: 0, millis: 3, warnings: ["Modo navegador: dados de exemplo."] }, shortcutOk: false, guideOk: false, log: ["[exemplo] HubOS iniciou", "[exemplo] biblioteca lida em 3 ms"] };
}
export const openDataDir = () => (inTauri ? invoke<void>("open_data_dir") : Promise.resolve());
export const openFiles = () => (inTauri ? invoke<void>("open_files") : Promise.resolve());

let mockFavs: string[] = MOCK_GAMES.slice(0, 3).map((g) => g.id);
export const getFavorites = () => (inTauri ? invoke<string[]>("get_favorites") : Promise.resolve(mockFavs));
export async function toggleFavorite(id: string): Promise<string[]> {
  if (inTauri) return invoke<string[]>("toggle_favorite", { id });
  mockFavs = mockFavs.includes(id) ? mockFavs.filter((x) => x !== id) : [...mockFavs, id];
  return mockFavs;
}

export interface Media {
  title: string;
  artist: string;
  app: string;
  playing: boolean;
}

let mockMedia: Media | null = { title: "Música de exemplo", artist: "Artista", app: "Spotify", playing: true };
export const getMedia = () => (inTauri ? invoke<Media | null>("get_media") : Promise.resolve(mockMedia));
export const mediaArt = () => (inTauri ? invoke<string | null>("media_art") : Promise.resolve(null));
export async function mediaControl(action: "toggle" | "next" | "prev"): Promise<void> {
  if (inTauri) return invoke<void>("media_control", { action });
  if (mockMedia && action === "toggle") mockMedia = { ...mockMedia, playing: !mockMedia.playing };
}

/** Busca na Steam a lista completa de jogos da conta. Devolve quantos são. */
export const refreshSteam = () => (inTauri ? invoke<number>("refresh_steam") : Promise.resolve(MOCK_GAMES.length));

export interface Achievement {
  name: string;
  description: string;
  achieved: boolean;
  unlockTime: number;
}
export interface Achievements {
  total: number;
  unlocked: number;
  items: Achievement[];
}

export async function steamAchievements(g: Game): Promise<Achievements> {
  const appid = Number(g.id.split(":")[1]);
  if (inTauri) return invoke<Achievements>("steam_achievements", { appid });
  const now = Math.floor(Date.now() / 1000);
  const items = Array.from({ length: 12 }, (_, i) => ({ name: `Conquista ${i + 1}`, description: "Descrição de exemplo da conquista.", achieved: i < 5, unlockTime: i < 5 ? now - i * 86400 * 3 : 0 }));
  return { total: 12, unlocked: 5, items };
}

// ---------- Party (Discord) ----------
export interface DiscordStatus {
  configured: boolean;
  connected: boolean;
  user: string | null;
}
export interface Member {
  id: string;
  name: string;
  avatarUrl: string | null;
  muted: boolean;
  deafened: boolean;
}
export interface VoiceChannel {
  id: string;
  name: string;
  guildId: string | null;
  members: Member[];
}
export interface Guild {
  id: string;
  name: string;
  iconUrl: string | null;
}
export interface Party {
  channel: VoiceChannel | null;
  mute: boolean;
  deaf: boolean;
}

// Dados de exemplo para desenhar a Party no navegador.
const m = (id: string, name: string, muted = false): Member => ({ id, name, avatarUrl: null, muted, deafened: false });
const MOCK_CHANNELS: VoiceChannel[] = [
  { id: "c1", name: "Geral", guildId: "g1", members: [m("2", "Ana"), m("3", "Pedro", true)] },
  { id: "c2", name: "Jogando", guildId: "g1", members: [] },
];
let mockParty: Party = { channel: null, mute: false, deaf: false };
let mockConnected = false;

export const discordStatus = () => (inTauri ? invoke<DiscordStatus>("discord_status") : Promise.resolve({ configured: true, connected: mockConnected, user: mockConnected ? "João" : null }));
export async function discordConnect(): Promise<string> {
  if (inTauri) return invoke<string>("discord_connect");
  mockConnected = true;
  return "João";
}
export const discordOpen = () => (inTauri ? invoke<void>("discord_open") : Promise.resolve());
export const discordForget = () => (inTauri ? invoke<void>("discord_forget") : Promise.resolve());
export const discordParty = () => (inTauri ? invoke<Party>("discord_party") : Promise.resolve(mockParty));
export const discordGuilds = () => (inTauri ? invoke<Guild[]>("discord_guilds") : Promise.resolve([{ id: "g1", name: "Amigos", iconUrl: null }, { id: "g2", name: "Servidor de exemplo", iconUrl: null }]));
export const discordChannels = (guildId: string) => (inTauri ? invoke<VoiceChannel[]>("discord_channels", { guildId }) : Promise.resolve(MOCK_CHANNELS));
export async function discordJoin(channelId: string | null): Promise<void> {
  if (inTauri) return invoke<void>("discord_join", { channelId });
  const ch = MOCK_CHANNELS.find((c) => c.id === channelId);
  mockParty = { ...mockParty, channel: ch ? { ...ch, members: [m("1", "João", mockParty.mute), ...ch.members] } : null };
}
export async function discordSetVoice(what: "mute" | "deaf", on: boolean): Promise<void> {
  if (inTauri) return invoke<void>("discord_set_voice", { what, on });
  mockParty = { ...mockParty, [what]: on };
}
