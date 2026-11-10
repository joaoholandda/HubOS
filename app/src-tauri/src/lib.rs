//! Lado "sistema" do HubOS: acha as bibliotecas de jogos e abre os jogos.
//! A interface (React) chama os comandos abaixo com `invoke`.

mod console;

use std::path::PathBuf;

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

/// Lê todas as origens de jogos. Roda fora da thread da interface.
#[tauri::command]
async fn get_library(app: tauri::AppHandle) -> Result<Library, String> {
    tauri::async_runtime::spawn_blocking(move || {
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
        Library { games, steam_root: root.map(|p| p.to_string_lossy().into_owned()), warnings }
    })
    .await
    .map_err(|e| e.to_string())
}

/// Abre um jogo. `launch` vem do próprio `Game` (URL `steam://` ou caminho de .exe).
#[tauri::command]
fn launch_game(app: tauri::AppHandle, launch: String) -> Result<(), String> {
    let is_url = launch.contains("://");
    let result = if is_url {
        app.opener().open_url(&launch, None::<&str>)
    } else {
        app.opener().open_path(&launch, None::<&str>)
    };
    result.map_err(|e| format!("Não consegui abrir: {e}"))
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
        .invoke_handler(tauri::generate_handler![get_library, launch_game, get_game_state, hide_hub])
        .setup(move |app| {
            // Em desenvolvimento, abre em janela para não prender a tela.
            #[cfg(debug_assertions)]
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.set_fullscreen(false);
            }
            if let Err(e) = app.global_shortcut().register(toggle) {
                // Ex.: outro programa (o AudioHub antigo) já usa Ctrl+Alt+H.
                eprintln!("[HubOS] não consegui registrar Ctrl+Alt+H: {e}");
            }
            enable_autostart_once(app.handle());
            console::start_watchers(app.handle());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("erro ao iniciar o HubOS");
}
