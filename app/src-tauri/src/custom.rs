//! O que você mesmo adiciona: jogos .exe e atalhos de apps/sites.
//! Guardado em `games.json` e `apps.json` na pasta de dados do app.

use std::collections::HashMap;
use std::path::{Path, PathBuf};

use hubos_core::sessions::Session;
use hubos_core::{Game, Source};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

#[derive(Serialize, Deserialize, Clone)]
pub struct CustomGame {
    pub id: String,
    pub title: String,
    pub exe: String,
    #[serde(default)]
    pub args: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct AppEntry {
    pub id: String,
    pub name: String,
    /// "program" (abre pelo nome/caminho) ou "site" (abre no navegador).
    pub kind: String,
    pub target: String,
}

fn file(app: &AppHandle, name: &str) -> Option<PathBuf> {
    let dir = app.path().app_data_dir().ok()?;
    std::fs::create_dir_all(&dir).ok()?;
    Some(dir.join(name))
}

fn load<T: for<'de> Deserialize<'de>>(app: &AppHandle, name: &str) -> Option<T> {
    serde_json::from_slice(&std::fs::read(file(app, name)?).ok()?).ok()
}

fn save<T: Serialize>(app: &AppHandle, name: &str, v: &T) -> Result<(), String> {
    let path = file(app, name).ok_or("Sem pasta de dados")?;
    std::fs::write(path, serde_json::to_vec_pretty(v).map_err(|e| e.to_string())?).map_err(|e| e.to_string())
}

pub fn games(app: &AppHandle) -> Vec<CustomGame> {
    load(app, "games.json").unwrap_or_default()
}

pub fn all_sessions(app: &AppHandle) -> Vec<Session> {
    let text = file(app, "sessions.jsonl").and_then(|p| std::fs::read_to_string(p).ok()).unwrap_or_default();
    hubos_core::sessions::parse(&text)
}

/// Tempo medido pelo hub por jogo: (segundos, fim da última sessão).
pub fn session_times(app: &AppHandle) -> HashMap<String, (u64, u64)> {
    let mut time: HashMap<String, (u64, u64)> = HashMap::new();
    for s in all_sessions(app) {
        let e = time.entry(s.game.clone()).or_default();
        e.0 += s.seconds();
        e.1 = e.1.max(s.end);
    }
    time
}

/// Para origens que não informam horas (Xbox, .exe), usa o que o hub mediu.
pub fn fill_measured_time(app: &AppHandle, games: &mut [Game]) {
    let time = session_times(app);
    for g in games.iter_mut().filter(|g| g.playtime_minutes.is_none()) {
        if let Some((secs, last)) = time.get(&g.id) {
            g.playtime_minutes = Some(secs / 60);
            g.last_played = Some(*last as i64);
        }
    }
}

/// Jogos .exe no formato da biblioteca. As horas vêm das sessões do hub.
pub fn library_games(app: &AppHandle) -> Vec<Game> {
    let time = session_times(app);
    games(app)
        .into_iter()
        .map(|g| {
            let (secs, last) = time.get(&g.id).copied().unwrap_or((0, 0));
            Game {
                id: g.id,
                title: g.title,
                source: Source::Exe,
                installed: Path::new(&g.exe).exists(),
                playtime_minutes: Some(secs / 60),
                last_played: (last > 0).then_some(last as i64),
                size_on_disk: None,
                install_dir: Path::new(&g.exe).parent().map(|p| p.to_string_lossy().into_owned()),
                cover_path: None,
                hero_path: None,
                logo_path: None,
                cover_url: None,
                hero_url: None,
                launch: g.exe,
            }
        })
        .collect()
}

/// Nome apresentável a partir do arquivo: `hollow_knight.exe` → "Hollow Knight".
pub fn title_from_path(path: &Path) -> String {
    let stem = path.file_stem().map(|s| s.to_string_lossy().into_owned()).unwrap_or_default();
    stem.split(|c: char| c == '_' || c == '-' || c == '.')
        .filter(|w| !w.is_empty())
        .map(|w| {
            let mut c = w.chars();
            c.next().map(|f| f.to_uppercase().collect::<String>() + c.as_str()).unwrap_or_default()
        })
        .collect::<Vec<_>>()
        .join(" ")
}

pub fn add_game(app: &AppHandle, exe: &Path) -> Result<CustomGame, String> {
    let mut list = games(app);
    let exe_s = exe.to_string_lossy().into_owned();
    if let Some(g) = list.iter().find(|g| g.exe.eq_ignore_ascii_case(&exe_s)) {
        return Ok(g.clone());
    }
    let g = CustomGame { id: format!("exe:{}", crate::console::now()), title: title_from_path(exe), exe: exe_s, args: String::new() };
    list.push(g.clone());
    save(app, "games.json", &list)?;
    Ok(g)
}

pub fn remove_game(app: &AppHandle, id: &str) -> Result<(), String> {
    let mut list = games(app);
    list.retain(|g| g.id != id);
    save(app, "games.json", &list)
}

pub fn rename_game(app: &AppHandle, id: &str, title: &str) -> Result<(), String> {
    let mut list = games(app);
    if let Some(g) = list.iter_mut().find(|g| g.id == id) {
        g.title = title.trim().to_string();
    }
    save(app, "games.json", &list)
}

fn default_apps() -> Vec<AppEntry> {
    let a = |id: &str, name: &str, kind: &str, target: &str| AppEntry { id: id.into(), name: name.into(), kind: kind.into(), target: target.into() };
    vec![
        a("firefox", "Firefox", "program", "firefox"),
        a("discord", "Discord", "program", "discord://"),
        a("spotify", "Spotify", "program", "spotify:"),
        a("claude", "Claude", "site", "https://claude.ai"),
        a("youtube", "YouTube", "site", "https://www.youtube.com"),
        a("twitch", "Twitch", "site", "https://www.twitch.tv"),
        a("kick", "Kick", "site", "https://kick.com"),
    ]
}

pub fn apps(app: &AppHandle) -> Vec<AppEntry> {
    load(app, "apps.json").unwrap_or_else(default_apps)
}

pub fn add_app(app: &AppHandle, name: &str, target: &str) -> Result<Vec<AppEntry>, String> {
    let target = target.trim();
    let is_site = target.starts_with("http://") || target.starts_with("https://") || (!target.contains('\\') && !target.contains(':') && target.contains('.') && !target.to_ascii_lowercase().ends_with(".exe"));
    let target = if is_site && !target.starts_with("http") { format!("https://{target}") } else { target.to_string() };
    let mut list = apps(app);
    list.push(AppEntry { id: format!("app{}", crate::console::now()), name: name.trim().to_string(), kind: if is_site { "site" } else { "program" }.into(), target });
    save(app, "apps.json", &list)?;
    Ok(list)
}

pub fn remove_app(app: &AppHandle, id: &str) -> Result<Vec<AppEntry>, String> {
    let mut list = apps(app);
    list.retain(|a| a.id != id);
    save(app, "apps.json", &list)?;
    Ok(list)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn nome_a_partir_do_arquivo() {
        assert_eq!(title_from_path(Path::new("hollow_knight.exe")), "Hollow Knight");
        assert_eq!(title_from_path(Path::new("D:/Jogos/osu!.exe")), "Osu!");
    }
}
