import type { Game } from "./api";

// Só para desenvolver no navegador. No app de verdade os jogos vêm do disco.
const now = Math.floor(Date.now() / 1000);
const day = 86400;

function g(id: string, title: string, source: Game["source"], hours: number, daysAgo: number, installed = true): Game {
  return {
    id,
    title,
    source,
    installed,
    playtimeMinutes: hours * 60,
    lastPlayed: now - daysAgo * day,
    sizeOnDisk: null,
    installDir: null,
    coverPath: null,
    heroPath: null,
    logoPath: null,
    coverUrl: null,
    heroUrl: null,
    launch: "",
  };
}

export const MOCK_GAMES: Game[] = [
  g("steam:730", "Counter-Strike 2", "steam", 1284, 0),
  g("steam:1245620", "Elden Ring", "steam", 142, 1),
  g("ra:smw", "Super Mario World", "ra", 31, 3),
  g("steam:1422450", "Deadlock", "steam", 212, 4),
  g("exe:minecraft", "Minecraft", "exe", 403, 5),
  g("xbox:fh5", "Forza Horizon 5", "xbox", 96, 8),
  g("steam:1145350", "Hades II", "steam", 61, 21),
  g("ra:pkem", "Pokémon Emerald", "ra", 58, 30),
  g("epic:rl", "Rocket League", "epic", 177, 365),
  g("steam:1030300", "Hollow Knight: Silksong", "steam", 37, 60),
];
