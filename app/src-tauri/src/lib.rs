//! Lado "sistema" do HubOS: acha as bibliotecas de jogos e abre os jogos.
//! A interface (React) chama os comandos abaixo com `invoke`.

mod console;
mod covers;
mod custom;
mod log;
mod media;
mod steamweb;
mod system;
mod xbox;

use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;

use hubos_core::{steam, Game};
use serde::Serialize;
use tauri::Manager;
use tauri_plugin_opener::OpenerExt;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Library {
    games: Vec<Game>,
    /// Pasta da Steam encontrada, para mostrar em Configurações.
    steam_root: Option<String>,
    /// Problemas que não impedem de mostrar o resto (ex.: Steam não instalada).
    warnings: Vec<String>,
}

/// Ctrl+Alt+H foi registrado? (Outro programa pode já estar usando.)
static SHORTCUT_OK: AtomicBool = AtomicBool::new(false);

/// Resultado da última leitura da biblioteca, para o Diagnóstico.
#[derive(Default, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct LastScan {
    steam: usize,
    xbox: usize,
    exe: usize,
    millis: u64,
    warnings: Vec<String>,
}

#[derive(Default)]
struct ScanState(Mutex<LastScan>);

/// Lê todas as origens de jogos. Roda fora da thread da interface.
#[tauri::command]
async fn get_library(app: tauri::AppHandle) -> Result<Library, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let began = std::time::Instant::now();
        let mut games = Vec::new();
        let mut warnings = Vec::new();
        let root = find_steam_root();
        match &root {
            Some(root) => {
                // Libera as capas da Steam para a interface carregar via asset://
                let cache = root.join("appcache").join("librarycache");
                if let Err(e) = app.asset_protocol_scope().allow_directory(&cache, true) {
                    warnings.push(format!("Não deu para liberar as capas da Steam: {e}"));
                }
                match steam::scan(root) {
                    Ok(found) => games.extend(found),
                    Err(e) => warnings.push(e.to_string()),
                }
            }
            None => warnings.push("Steam não encontrada neste PC.".into()),
        }
        // Jogos da conta que não estão instalados (lista guardada da última busca).
        steamweb::merge_cached(&app, &mut games);
        match xbox::scan(&app) {
            Ok(found) => games.extend(found),
            Err(e) => warnings.push(format!("Xbox: {e}")),
        }
        games.extend(custom::library_games(&app));
        custom::fill_measured_time(&app, &mut games);
        games.sort_by(|a, b| b.last_played.unwrap_or(0).cmp(&a.last_played.unwrap_or(0)).then_with(|| a.title.cmp(&b.title)));
        // Capas que você escolheu no SteamGridDB.
        if let Ok(dir) = covers::covers_dir(&app) {
            let _ = app.asset_protocol_scope().allow_directory(&dir, false);
        }
        covers::apply_overrides(&app, &mut games);
        let count = |p: &str| games.iter().filter(|g| g.id.starts_with(p)).count();
        let scan = LastScan { steam: count("steam:"), xbox: count("xbox:"), exe: count("exe:"), millis: began.elapsed().as_millis() as u64, warnings: warnings.clone() };
        log::log(format!("biblioteca lida em {} ms: {} Steam, {} Xbox, {} .exe", scan.millis, scan.steam, scan.xbox, scan.exe));
        for w in &warnings {
            log::log(format!("aviso: {w}"));
        }
        *app.state::<ScanState>().0.lock().unwrap() = scan;
        Library { games, steam_root: root.map(|p| p.to_string_lossy().into_owned()), warnings }
    })
    .await
    .map_err(|e| e.to_string())
}

/// Abre um jogo. Jogos .exe são acompanhados pelo processo; os da Steam
/// abrem pela URL `steam://` e são percebidos pelo vigia da Steam.
#[tauri::command]
fn launch_game(app: tauri::AppHandle, id: String, launch: String) -> Result<(), String> {
    let r = launch_inner(&app, &id, &launch);
    match &r {
        Ok(()) => log::log(format!("abrir jogo: {id} → {launch}")),
        Err(e) => log::log(format!("abrir jogo FALHOU: {id} → {launch}: {e}")),
    }
    r
}

fn launch_inner(app: &tauri::AppHandle, id: &str, launch: &str) -> Result<(), String> {
    if id.starts_with("exe:") && launch.to_ascii_lowercase().ends_with(".exe") {
        let args = custom::games(app).into_iter().find(|g| g.id == id).map(|g| g.args).unwrap_or_default();
        return console::spawn_exe(app, id, launch, &args);
    }
    if id.starts_with("xbox:") {
        return xbox::launch(app, id, launch);
    }
    open_target(app, launch)
}

/// Abre uma URL, pasta ou arquivo com o programa padrão.
fn open_target(app: &tauri::AppHandle, target: &str) -> Result<(), String> {
    let result = if target.contains("://") || target.ends_with(':') { app.opener().open_url(target, None::<&str>) } else { app.opener().open_path(target, None::<&str>) };
    result.map_err(|e| format!("Não consegui abrir: {e}"))
}

#[tauri::command]
fn open_external(app: tauri::AppHandle, target: String) -> Result<(), String> {
    open_target(&app, &target)
}

/// Fecha o jogo aberto. `install_dir` é a pasta do jogo (para os da Steam).
#[tauri::command]
fn close_game(app: tauri::AppHandle, state: tauri::State<console::ConsoleState>, install_dir: Option<String>) -> Result<(), String> {
    let r = close_inner(&app, &state, install_dir);
    match &r {
        Ok(()) => log::log("fechar jogo: pedido enviado"),
        Err(e) => log::log(format!("fechar jogo FALHOU: {e}")),
    }
    r
}

fn close_inner(app: &tauri::AppHandle, state: &console::ConsoleState, install_dir: Option<String>) -> Result<(), String> {
    if let Some(pid) = *state.1.lock().unwrap() {
        return system::kill_pid(pid);
    }
    // Jogos do Xbox: pelo nome do executável.
    let running = state.0.lock().unwrap().running.as_ref().map(|r| r.id.clone());
    if let Some(exe) = running.as_deref().filter(|id| id.starts_with("xbox:")).and_then(|id| xbox::exe_of(app, id)) {
        return match system::kill_by_name(&exe)? {
            0 => Err("Não achei o processo do jogo. Feche por dentro dele.".into()),
            _ => Ok(()),
        };
    }
    match install_dir {
        Some(dir) => match system::kill_in_dir(&dir)? {
            0 => Err("Não achei o processo do jogo. Feche por dentro dele.".into()),
            _ => Ok(()),
        },
        None => Err("Não sei onde este jogo está instalado para fechá-lo.".into()),
    }
}

/// Suspender, reiniciar, desligar ou bloquear.
#[tauri::command]
fn power(action: String) -> Result<(), String> {
    system::power(&action)
}

/// Escolhe um .exe pelo seletor de arquivos e adiciona à biblioteca.
#[tauri::command]
async fn add_exe_game(app: tauri::AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    let picked = app.dialog().file().set_title("Escolha o executável do jogo").add_filter("Jogos", &["exe", "lnk", "bat"]).blocking_pick_file();
    let Some(file) = picked else { return Ok(None) };
    let path = file.into_path().map_err(|e| e.to_string())?;
    Ok(Some(custom::add_game(&app, &path)?.id))
}

#[tauri::command]
fn remove_game(app: tauri::AppHandle, id: String) -> Result<(), String> {
    custom::remove_game(&app, &id)
}

#[tauri::command]
fn rename_game(app: tauri::AppHandle, id: String, title: String) -> Result<(), String> {
    custom::rename_game(&app, &id, &title)
}

#[tauri::command]
fn get_apps(app: tauri::AppHandle) -> Vec<custom::AppEntry> {
    custom::apps(&app)
}

#[tauri::command]
fn add_app(app: tauri::AppHandle, name: String, target: String) -> Result<Vec<custom::AppEntry>, String> {
    custom::add_app(&app, &name, &target)
}

#[tauri::command]
fn remove_app(app: tauri::AppHandle, id: String) -> Result<Vec<custom::AppEntry>, String> {
    custom::remove_app(&app, &id)
}

/// Abre um app ou site da tela Apps.
#[tauri::command]
fn open_app(app: tauri::AppHandle, id: String) -> Result<(), String> {
    let entry = custom::apps(&app).into_iter().find(|a| a.id == id).ok_or("App não encontrado")?;
    if entry.kind == "site" || entry.target.contains("://") || entry.target.ends_with(':') {
        open_target(&app, &entry.target)
    } else {
        system::start(&entry.target)
    }
}

/// Todas as sessões gravadas (para as estatísticas).
#[tauri::command]
fn get_all_sessions(app: tauri::AppHandle) -> Vec<hubos_core::sessions::Session> {
    custom::all_sessions(&app)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SettingsView {
    has_sgdb_key: bool,
    has_steam_key: bool,
    theme: String,
    accent: Option<String>,
    autostart: bool,
    steam_root: Option<String>,
}

#[tauri::command]
fn get_settings(app: tauri::AppHandle) -> SettingsView {
    use tauri_plugin_autostart::ManagerExt;
    let s = covers::settings(&app);
    SettingsView {
        has_sgdb_key: s.sgdb_key.is_some(),
        has_steam_key: s.steam_key.is_some(),
        theme: s.theme.unwrap_or_else(|| "auto".into()),
        accent: s.accent,
        autostart: app.autolaunch().is_enabled().unwrap_or(false),
        steam_root: find_steam_root().map(|p| p.to_string_lossy().into_owned()),
    }
}

/// Muda uma configuração: `theme`, `accent` ou `autostart`.
#[tauri::command]
fn set_setting(app: tauri::AppHandle, key: String, value: String) -> Result<(), String> {
    use tauri_plugin_autostart::ManagerExt;
    let mut s = covers::settings(&app);
    match key.as_str() {
        "theme" => s.theme = Some(value),
        "accent" => s.accent = (!value.is_empty()).then_some(value),
        "steamKey" => s.steam_key = Some(value.trim().to_string()).filter(|v| !v.is_empty()),
        "autostart" => {
            let r = if value == "true" { app.autolaunch().enable() } else { app.autolaunch().disable() };
            return r.map_err(|e| e.to_string());
        }
        other => return Err(format!("Configuração desconhecida: {other}")),
    }
    covers::save_settings(&app, &s)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Diagnostics {
    version: String,
    data_dir: Option<String>,
    steam_root: Option<String>,
    scan: LastScan,
    shortcut_ok: bool,
    guide_ok: bool,
    log: Vec<String>,
}

/// Tudo que ajuda a entender um problema: o que foi achado e as últimas linhas do diário.
#[tauri::command]
fn get_diagnostics(app: tauri::AppHandle) -> Diagnostics {
    Diagnostics {
        version: app.package_info().version.to_string(),
        data_dir: app.path().app_data_dir().ok().map(|p| p.to_string_lossy().into_owned()),
        steam_root: find_steam_root().map(|p| p.to_string_lossy().into_owned()),
        scan: app.state::<ScanState>().0.lock().unwrap().clone(),
        shortcut_ok: SHORTCUT_OK.load(Ordering::Relaxed),
        guide_ok: console::GUIDE_OK.load(Ordering::Relaxed),
        log: log::tail(120),
    }
}

/// Abre a pasta de dados do hub (diário, sessões, capas) no Explorador.
#[tauri::command]
fn open_data_dir(app: tauri::AppHandle) -> Result<(), String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    open_target(&app, &dir.to_string_lossy())
}

/// Abre o Explorador de Arquivos.
#[tauri::command]
fn open_files() -> Result<(), String> {
    system::start("explorer.exe")
}

#[tauri::command]
fn get_favorites(app: tauri::AppHandle) -> Vec<String> {
    custom::favorites(&app)
}

#[tauri::command]
fn toggle_favorite(app: tauri::AppHandle, id: String) -> Result<Vec<String>, String> {
    custom::toggle_favorite(&app, &id)
}

/// O que está tocando agora no Windows (Spotify, navegador...).
#[tauri::command]
async fn get_media() -> Option<media::Media> {
    tauri::async_runtime::spawn_blocking(media::current).await.ok().flatten()
}

/// Capa do que está tocando, como `data:` URL.
#[tauri::command]
async fn media_art() -> Option<String> {
    tauri::async_runtime::spawn_blocking(media::art).await.ok().flatten()
}

/// `toggle` (tocar/pausar), `next` ou `prev`.
#[tauri::command]
async fn media_control(action: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || media::control(&action)).await.map_err(|e| e.to_string())?
}

/// Atualiza a lista de jogos da conta Steam. Devolve quantos jogos a conta tem.
#[tauri::command]
async fn refresh_steam(app: tauri::AppHandle) -> Result<usize, String> {
    let r = steamweb::refresh(&app, find_steam_root().as_deref()).await;
    match &r {
        Ok(n) => log::log(format!("conta Steam: {n} jogos")),
        Err(e) => log::log(format!("conta Steam FALHOU: {e}")),
    }
    r
}

/// Conquistas de um jogo da Steam.
#[tauri::command]
async fn steam_achievements(app: tauri::AppHandle, appid: u32) -> Result<hubos_core::steamweb::Achievements, String> {
    steamweb::achievements(&app, find_steam_root().as_deref(), appid).await
}

/// Jogo rodando agora, para a interface saber ao (re)abrir.
#[tauri::command]
fn get_game_state(state: tauri::State<console::ConsoleState>) -> console::GameState {
    state.0.lock().unwrap().clone()
}

/// "Voltar ao jogo": tira o hub da frente.
#[tauri::command]
fn hide_hub(app: tauri::AppHandle) {
    console::hide_hub(&app);
}

/// Sessões que o hub gravou para um jogo, da mais recente para a mais antiga.
#[tauri::command]
fn get_sessions(app: tauri::AppHandle, game_id: String) -> Vec<hubos_core::sessions::Session> {
    let Ok(dir) = app.path().app_data_dir() else { return vec![] };
    let text = std::fs::read_to_string(dir.join("sessions.jsonl")).unwrap_or_default();
    hubos_core::sessions::for_game(&hubos_core::sessions::parse(&text), &game_id)
}

/// Se já existe chave do SteamGridDB salva.
#[tauri::command]
fn has_sgdb_key(app: tauri::AppHandle) -> bool {
    covers::settings(&app).sgdb_key.is_some()
}

#[tauri::command]
fn set_sgdb_key(app: tauri::AppHandle, key: String) -> Result<(), String> {
    covers::save_key(&app, key)
}

/// Opções de capa do SteamGridDB para um jogo.
#[tauri::command]
async fn cover_options(app: tauri::AppHandle, game_id: String, title: String) -> Result<Vec<hubos_core::sgdb::Grid>, String> {
    covers::grids(&app, &game_id, &title).await
}

/// Baixa e aplica a capa escolhida. Devolve o caminho local.
#[tauri::command]
async fn set_cover(app: tauri::AppHandle, game_id: String, url: String) -> Result<String, String> {
    covers::set_cover(&app, &game_id, &url).await
}

#[tauri::command]
fn reset_cover(app: tauri::AppHandle, game_id: String) -> Result<(), String> {
    covers::reset_cover(&app, &game_id)
}

/// Onde a Steam está instalada. `HUBOS_STEAM_DIR` força uma pasta (útil para testes).
fn find_steam_root() -> Option<PathBuf> {
    if let Ok(dir) = std::env::var("HUBOS_STEAM_DIR") {
        return Some(PathBuf::from(dir));
    }
    candidates().into_iter().find(|p| p.join("steamapps").is_dir())
}

#[cfg(windows)]
fn candidates() -> Vec<PathBuf> {
    use winreg::enums::{HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE};
    use winreg::RegKey;
    let mut out = Vec::new();
    if let Ok(key) = RegKey::predef(HKEY_CURRENT_USER).open_subkey(r"Software\Valve\Steam") {
        if let Ok(p) = key.get_value::<String, _>("SteamPath") {
            out.push(PathBuf::from(p.replace('/', "\\")));
        }
    }
    for sub in [r"SOFTWARE\WOW6432Node\Valve\Steam", r"SOFTWARE\Valve\Steam"] {
        if let Ok(key) = RegKey::predef(HKEY_LOCAL_MACHINE).open_subkey(sub) {
            if let Ok(p) = key.get_value::<String, _>("InstallPath") {
                out.push(PathBuf::from(p));
            }
        }
    }
    out.push(PathBuf::from(r"C:\Program Files (x86)\Steam"));
    out
}

#[cfg(not(windows))]
fn candidates() -> Vec<PathBuf> {
    let home = std::env::var("HOME").unwrap_or_default();
    [".steam/steam", ".local/share/Steam"].iter().map(|p| std::path::Path::new(&home).join(p)).collect()
}

/// Decisão 42: o hub abre junto com o Windows. Liga uma vez só; depois quem
/// manda é a opção em Configurações.
fn enable_autostart_once(app: &tauri::AppHandle) {
    use tauri_plugin_autostart::ManagerExt;
    if cfg!(debug_assertions) {
        return;
    }
    let Ok(dir) = app.path().app_data_dir() else { return };
    let marker = dir.join("autostart-configurado");
    if marker.exists() {
        return;
    }
    if app.autolaunch().enable().is_ok() {
        let _ = std::fs::create_dir_all(&dir);
        let _ = std::fs::write(marker, "1");
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

    let toggle = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::ALT), Code::KeyH);
    tauri::Builder::default()
        // Uma instância só: abrir de novo traz a que já está rodando.
        .plugin(tauri_plugin_single_instance::init(|app, _, _| console::show_hub(app)))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_autostart::init(tauri_plugin_autostart::MacosLauncher::LaunchAgent, None))
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(move |app, shortcut, event| {
                    if shortcut == &toggle && event.state() == ShortcutState::Pressed {
                        console::toggle_hub(app);
                    }
                })
                .build(),
        )
        .manage(console::ConsoleState::default())
        .manage(xbox::XboxState::default())
        .manage(ScanState::default())
        .invoke_handler(tauri::generate_handler![get_library, launch_game, open_external, close_game, power, add_exe_game, remove_game, rename_game, get_apps, add_app, remove_app, open_app, get_all_sessions, get_settings, set_setting, get_game_state, hide_hub, get_sessions, has_sgdb_key, set_sgdb_key, cover_options, set_cover, reset_cover, get_diagnostics, open_data_dir, open_files, get_favorites, toggle_favorite, get_media, media_art, media_control, refresh_steam, steam_achievements])
        .setup(move |app| {
            // Em desenvolvimento, abre em janela para não prender a tela.
            #[cfg(debug_assertions)]
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.set_fullscreen(false);
            }
            log::init(app.handle());
            log::log(format!("HubOS {} iniciou", app.package_info().version));
            match app.global_shortcut().register(toggle) {
                Ok(()) => SHORTCUT_OK.store(true, Ordering::Relaxed),
                // Ex.: outro programa (o AudioHub antigo) já usa Ctrl+Alt+H.
                Err(e) => log::log(format!("não consegui registrar Ctrl+Alt+H: {e}")),
            }
            enable_autostart_once(app.handle());
            console::start_watchers(app.handle());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("erro ao iniciar o HubOS");
}
