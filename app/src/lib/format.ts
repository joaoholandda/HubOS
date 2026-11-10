import type { Game, Source } from "./api";

export const SOURCE_LABEL: Record<Source, string> = {
  steam: "Steam",
  xbox: "Xbox",
  epic: "Epic",
  exe: ".exe",
  ra: "RetroAchievements",
};

export function hours(minutes: number | null): string {
  if (!minutes) return "0 h";
  if (minutes < 60) return `${minutes} min`;
  return `${Math.round(minutes / 60).toLocaleString("pt-BR")} h`;
}

/** "Hoje, 01:12", "Ontem", "Há 3 dias", "12/03". */
export function lastPlayed(unix: number | null): string {
  if (!unix) return "Nunca";
  const d = new Date(unix * 1000);
  const today = new Date();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOf(today) - startOf(d)) / 86400000);
  if (days <= 0) return `Hoje, ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
  if (days === 1) return "Ontem";
  if (days < 7) return `Há ${days} dias`;
  if (days < 365) return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  return d.toLocaleDateString("pt-BR", { month: "2-digit", year: "numeric" });
}

export function totalHours(games: Game[]): string {
  const m = games.reduce((a, g) => a + (g.playtimeMinutes ?? 0), 0);
  return `${Math.round(m / 60).toLocaleString("pt-BR")} h jogadas`;
}

/** Capa provisória (sem imagem): grafite neutro, variando só o tom, nunca verde. */
export function tint(id: string): [string, string] {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const hue = 215 + (h % 40); // azul-acinzentado → índigo
  const light = 16 + (h % 7);
  return [`hsl(${hue} 10% ${light}%)`, `hsl(${hue + 8} 14% ${light + 16}%)`];
}

export function size(bytes: number | null): string {
  if (!bytes) return "—";
  const gb = bytes / 1024 ** 3;
  return gb >= 1 ? `${gb.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} GB` : `${Math.round(bytes / 1024 ** 2)} MB`;
}

/** "1 h 05 min", "42 min". */
export function duration(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.round((secs % 3600) / 60);
  return h ? `${h} h ${String(m).padStart(2, "0")} min` : `${m} min`;
}

export function dayLabel(unix: number): string {
  const d = new Date(unix * 1000);
  const days = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 86400000);
  if (days === 0) return "Hoje";
  if (days === 1) return "Ontem";
  return d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" }).replace(".", "");
}

export function clockTime(unix: number): string {
  return new Date(unix * 1000).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}
