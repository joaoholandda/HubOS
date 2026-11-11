//! Lê a biblioteca da Steam direto dos arquivos dela, sem login e sem internet.
//!
//! O que vem de onde (dentro da pasta da Steam):
//! - bibliotecas (outros discos): `steamapps/libraryfolders.vdf`
//! - jogos instalados: `<biblioteca>/steamapps/appmanifest_<appid>.acf`
//! - horas e última vez jogado: `userdata/<conta>/config/localconfig.vdf`
//! - capas: `appcache/librarycache/` (a própria Steam baixa)

use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};

use crate::model::{Game, Source};
use crate::vdf::{self, Vdf};

/// Diferença entre o SteamID64 e o ID da conta usado nas pastas de `userdata`.
const STEAMID64_BASE: u64 = 76_561_197_960_265_728;

/// Apps que a Steam instala mas não são jogos.
const NOT_GAMES: &[u32] = &[
    228980,  // Steamworks Common Redistributables
    1070560, // Steam Linux Runtime
    1391110, // Steam Linux Runtime - Soldier
    1628350, // Steam Linux Runtime - Sniper
    1493710, // Proton Experimental
    250820,  // SteamVR
];

#[derive(Debug)]
pub enum ScanError {
    /// A pasta informada não parece ser uma instalação da Steam.
    NotSteam(PathBuf),
}

impl std::fmt::Display for ScanError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ScanError::NotSteam(p) => write!(f, "{} não parece ser a pasta da Steam (falta steamapps)", p.display()),
        }
    }
}

impl std::error::Error for ScanError {}

/// Lista os jogos instalados da Steam, do jogado mais recentemente para o mais antigo.
pub fn scan(steam_root: &Path) -> Result<Vec<Game>, ScanError> {
    if !steam_root.join("steamapps").is_dir() {
        return Err(ScanError::NotSteam(steam_root.to_path_buf()));
    }
    let playtime = read_playtime(steam_root);
    let cache = steam_root.join("appcache").join("librarycache");

    let mut seen = HashSet::new();
    let mut games = Vec::new();
    for lib in library_paths(steam_root) {
        let Ok(entries) = fs::read_dir(lib.join("steamapps")) else { continue };
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            if !(name.starts_with("appmanifest_") && name.ends_with(".acf")) {
                continue;
            }
            let Some(app) = read_manifest(&entry.path()) else { continue };
            if NOT_GAMES.contains(&app.appid) || looks_like_tool(&app.name) || !seen.insert(app.appid) {
                continue;
            }
            let stats = playtime.get(&app.appid);
            let art = find_artwork(&cache, app.appid);
            games.push(Game {
                id: format!("steam:{}", app.appid),
                title: app.name,
                source: Source::Steam,
                installed: app.installed,
                playtime_minutes: stats.map(|s| s.minutes),
                last_played: stats.and_then(|s| s.last_played).or(app.last_played),
                size_on_disk: app.size_on_disk,
                install_dir: app.install_dir.as_ref().map(|d| lib.join("steamapps").join("common").join(d).to_string_lossy().into_owned()),
                cover_path: art.cover,
                hero_path: art.hero,
                logo_path: art.logo,
                cover_url: Some(format!("https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/{}/library_600x900_2x.jpg", app.appid)),
                hero_url: Some(format!("https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/{}/library_hero.jpg", app.appid)),
                launch: format!("steam://rungameid/{}", app.appid),
            });
        }
    }
    games.sort_by(|a, b| b.last_played.unwrap_or(0).cmp(&a.last_played.unwrap_or(0)).then_with(|| a.title.cmp(&b.title)));
    Ok(games)
}

/// Pastas de biblioteca, começando pela própria instalação.
pub fn library_paths(steam_root: &Path) -> Vec<PathBuf> {
    let mut out = vec![steam_root.to_path_buf()];
    let file = steam_root.join("steamapps").join("libraryfolders.vdf");
    if let Some(doc) = read_vdf(&file) {
        if let Some(root) = doc.get("libraryfolders") {
            for (_, folder) in root.entries() {
                // Formato novo: { "path" "..." }. Formato antigo: "1" "D:\\SteamLibrary".
                let p = match folder {
                    Vdf::Obj(_) => folder.str("path").map(PathBuf::from),
                    Vdf::Str(s) if Path::new(s).is_absolute() || s.contains(':') => Some(PathBuf::from(s)),
                    Vdf::Str(_) => None,
                };
                if let Some(p) = p {
                    if !out.iter().any(|q| same_path(q, &p)) {
                        out.push(p);
                    }
                }
            }
        }
    }
    out
}

struct Manifest {
    appid: u32,
    name: String,
    install_dir: Option<String>,
    installed: bool,
    size_on_disk: Option<u64>,
    last_played: Option<i64>,
}

fn read_manifest(path: &Path) -> Option<Manifest> {
    let doc = read_vdf(path)?;
    let app = doc.get("AppState")?;
    let appid = app.str("appid")?.parse().ok()?;
    let flags: u32 = app.str("StateFlags").and_then(|s| s.parse().ok()).unwrap_or(0);
    Some(Manifest {
        appid,
        name: app.str("name").unwrap_or("Sem nome").to_string(),
        install_dir: app.str("installdir").map(str::to_string),
        installed: flags & 4 != 0,
        size_on_disk: app.str("SizeOnDisk").and_then(|s| s.parse().ok()),
        last_played: app.str("LastPlayed").and_then(|s| s.parse().ok()).filter(|&t: &i64| t > 0),
    })
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct PlayStats {
    pub minutes: u64,
    pub last_played: Option<i64>,
}

/// Horas por appid da conta usada por último neste PC.
pub fn read_playtime(steam_root: &Path) -> HashMap<u32, PlayStats> {
    let mut out = HashMap::new();
    let Some(account) = current_account(steam_root) else { return out };
    let file = steam_root.join("userdata").join(account.to_string()).join("config").join("localconfig.vdf");
    let Some(doc) = read_vdf(&file) else { return out };
    let Some(apps) = doc.path(&["UserLocalConfigStore", "Software", "Valve", "Steam", "apps"]) else { return out };
    for (id, app) in apps.entries() {
        let Ok(appid) = id.parse::<u32>() else { continue };
        let minutes = app.str("Playtime").and_then(|s| s.parse().ok()).unwrap_or(0);
        let last_played = app.str("LastPlayed").and_then(|s| s.parse().ok()).filter(|&t: &i64| t > 0);
        if minutes > 0 || last_played.is_some() {
            out.insert(appid, PlayStats { minutes, last_played });
        }
    }
    out
}

/// ID da conta (pasta em `userdata`) do último login. Se não der para saber,
/// usa a pasta de `userdata` modificada mais recentemente.
/// SteamID64 da conta em uso (o número longo que a API da Steam pede).
pub fn steam_id64(steam_root: &Path) -> Option<u64> {
    current_account(steam_root).map(|id| id + STEAMID64_BASE)
}

pub fn current_account(steam_root: &Path) -> Option<u64> {
    if let Some(doc) = read_vdf(&steam_root.join("config").join("loginusers.vdf")) {
        if let Some(users) = doc.get("users") {
            let users = users.entries();
            let pick = users
                .iter()
                .find(|(_, u)| u.str("MostRecent") == Some("1"))
                .or_else(|| users.iter().max_by_key(|(_, u)| u.str("Timestamp").and_then(|t| t.parse::<i64>().ok()).unwrap_or(0)));
            if let Some((id64, _)) = pick {
                if let Ok(id64) = id64.parse::<u64>() {
                    if id64 > STEAMID64_BASE {
                        return Some(id64 - STEAMID64_BASE);
                    }
                }
            }
        }
    }
    fs::read_dir(steam_root.join("userdata"))
        .ok()?
        .flatten()
        .filter_map(|e| {
            let id = e.file_name().to_string_lossy().parse::<u64>().ok()?;
            let modified = e.metadata().ok()?.modified().ok()?;
            Some((modified, id))
        })
        .max()
        .map(|(_, id)| id)
}

#[derive(Debug, Default, PartialEq)]
pub struct Artwork {
    pub cover: Option<String>,
    pub hero: Option<String>,
    pub logo: Option<String>,
}

/// Procura as artes que a Steam já baixou. Ela usa dois formatos:
/// antigo `<appid>_library_600x900.jpg` e novo `<appid>/<...>/library_600x900.jpg`.
pub fn find_artwork(cache: &Path, appid: u32) -> Artwork {
    let flat = |suffix: &str| {
        let p = cache.join(format!("{appid}_{suffix}"));
        p.is_file().then(|| p.to_string_lossy().into_owned())
    };
    let mut art = Artwork {
        cover: flat("library_600x900_2x.jpg").or_else(|| flat("library_600x900.jpg")),
        hero: flat("library_hero.jpg"),
        logo: flat("logo.png"),
    };
    let dir = cache.join(appid.to_string());
    if dir.is_dir() {
        let mut files = Vec::new();
        collect_files(&dir, 2, &mut files);
        let find = |names: &[&str]| {
            names.iter().find_map(|n| files.iter().find(|f| f.file_name().is_some_and(|x| x.eq_ignore_ascii_case(n))).map(|f| f.to_string_lossy().into_owned()))
        };
        art.cover = art.cover.or_else(|| find(&["library_600x900_2x.jpg", "library_600x900.jpg", "library_capsule.jpg"]));
        art.hero = art.hero.or_else(|| find(&["library_hero.jpg", "library_hero_2x.jpg"]));
        art.logo = art.logo.or_else(|| find(&["logo.png", "logo_2x.png"]));
    }
    art
}

fn collect_files(dir: &Path, depth: u8, out: &mut Vec<PathBuf>) {
    let Ok(entries) = fs::read_dir(dir) else { return };
    for e in entries.flatten() {
        let p = e.path();
        if p.is_dir() {
            if depth > 0 {
                collect_files(&p, depth - 1, out);
            }
        } else {
            out.push(p);
        }
    }
}

fn read_vdf(path: &Path) -> Option<Vdf> {
    let bytes = fs::read(path).ok()?;
    vdf::parse(&String::from_utf8_lossy(&bytes)).ok()
}

fn looks_like_tool(name: &str) -> bool {
    let n = name.to_ascii_lowercase();
    ["redistributable", "steamworks common", "proton ", "steam linux runtime", "dedicated server", "sdk"].iter().any(|k| n.contains(k))
}

fn same_path(a: &Path, b: &Path) -> bool {
    let norm = |p: &Path| p.to_string_lossy().replace('\\', "/").trim_end_matches('/').to_ascii_lowercase();
    norm(a) == norm(b)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Monta uma "pasta da Steam" falsa com dois discos, horas e capas.
    fn fake_steam() -> PathBuf {
        let root = std::env::temp_dir().join(format!("hubos-steam-{}-{}", std::process::id(), rand_suffix()));
        let lib2 = root.join("D_SteamLibrary");
        let w = |p: PathBuf, s: &str| {
            fs::create_dir_all(p.parent().unwrap()).unwrap();
            fs::write(p, s).unwrap();
        };
        w(
            root.join("steamapps/libraryfolders.vdf"),
            &format!(
                "\"libraryfolders\" {{ \"0\" {{ \"path\" \"{}\" }} \"1\" {{ \"path\" \"{}\" }} }}",
                root.display().to_string().replace('\\', "\\\\"),
                lib2.display().to_string().replace('\\', "\\\\")
            ),
        );
        w(root.join("steamapps/appmanifest_730.acf"), r#""AppState" { "appid" "730" "name" "Counter-Strike 2" "StateFlags" "4" "SizeOnDisk" "35000000000" "installdir" "Counter-Strike Global Offensive" }"#);
        w(root.join("steamapps/appmanifest_228980.acf"), r#""AppState" { "appid" "228980" "name" "Steamworks Common Redistributables" "StateFlags" "4" }"#);
        w(lib2.join("steamapps/appmanifest_1245620.acf"), r#""AppState" { "appid" "1245620" "name" "ELDEN RING" "StateFlags" "4" "LastPlayed" "1700000000" }"#);
        w(lib2.join("steamapps/appmanifest_1091500.acf"), r#""AppState" { "appid" "1091500" "name" "Cyberpunk 2077" "StateFlags" "1026" }"#);
        w(
            root.join("config/loginusers.vdf"),
            r#""users" { "76561198000000001" { "AccountName" "joao" "MostRecent" "1" } }"#,
        );
        w(
            root.join("userdata/39734273/config/localconfig.vdf"),
            r#""UserLocalConfigStore" { "Software" { "Valve" { "Steam" { "apps" {
                "730" { "LastPlayed" "1731200000" "Playtime" "77040" }
                "1245620" { "LastPlayed" "1731100000" "Playtime" "8520" }
            } } } } }"#,
        );
        w(root.join("appcache/librarycache/730_library_600x900.jpg"), "jpg");
        w(root.join("appcache/librarycache/1245620/abc123/library_600x900.jpg"), "jpg");
        w(root.join("appcache/librarycache/1245620/library_hero.jpg"), "jpg");
        root
    }

    fn rand_suffix() -> u128 {
        std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()
    }

    #[test]
    fn encontra_jogos_em_todos_os_discos_e_ignora_ferramentas() {
        let root = fake_steam();
        let games = scan(&root).unwrap();
        let titles: Vec<_> = games.iter().map(|g| g.title.as_str()).collect();
        assert_eq!(titles, ["Counter-Strike 2", "ELDEN RING", "Cyberpunk 2077"]);
        fs::remove_dir_all(root).ok();
    }

    #[test]
    fn junta_horas_capas_e_estado_de_instalacao() {
        let root = fake_steam();
        let games = scan(&root).unwrap();
        let cs = games.iter().find(|g| g.id == "steam:730").unwrap();
        assert_eq!(cs.playtime_minutes, Some(77040));
        assert_eq!(cs.last_played, Some(1_731_200_000));
        assert!(cs.cover_path.as_deref().unwrap().ends_with("730_library_600x900.jpg"));
        assert_eq!(cs.launch, "steam://rungameid/730");
        assert!(cs.install_dir.as_deref().unwrap().replace('\\', "/").ends_with("steamapps/common/Counter-Strike Global Offensive"));

        let elden = games.iter().find(|g| g.id == "steam:1245620").unwrap();
        assert!(elden.cover_path.as_deref().unwrap().ends_with("library_600x900.jpg"));
        assert!(elden.hero_path.as_deref().unwrap().ends_with("library_hero.jpg"));

        let cyber = games.iter().find(|g| g.id == "steam:1091500").unwrap();
        assert!(!cyber.installed, "StateFlags 1026 não tem o bit 4 de instalado");
        fs::remove_dir_all(root).ok();
    }

    #[test]
    fn conta_vem_do_ultimo_login() {
        let root = fake_steam();
        assert_eq!(current_account(&root), Some(39_734_273));
        fs::remove_dir_all(root).ok();
    }

    #[test]
    fn recusa_pasta_que_nao_e_da_steam() {
        let dir = std::env::temp_dir().join(format!("hubos-nada-{}", rand_suffix()));
        fs::create_dir_all(&dir).unwrap();
        assert!(matches!(scan(&dir), Err(ScanError::NotSteam(_))));
        fs::remove_dir_all(dir).ok();
    }

    #[test]
    fn serializa_em_camel_case_para_a_interface() {
        let root = fake_steam();
        let games = scan(&root).unwrap();
        let json = serde_json::to_string(&games[0]).unwrap();
        assert!(json.contains("\"playtimeMinutes\":77040"));
        assert!(json.contains("\"source\":\"steam\""));
        fs::remove_dir_all(root).ok();
    }
}
