// Ponte com o lado Rust. Fora do Tauri (rodando `npm run dev` no navegador),
// usa dados de exemplo para dar para trabalhar na interface em qualquer PC.
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
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
  await invoke("launch_game", { launch: game.launch });
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
