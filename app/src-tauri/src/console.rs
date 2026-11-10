//! Comportamento de console: o hub sai da frente quando um jogo abre, volta
//! quando ele fecha, e aparece com Ctrl+Alt+H ou com o botão Guide do controle.
//! Também cronometra as sessões de jogo e salva no disco.

use std::fs::OpenOptions;
use std::io::Write;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};

/// Jogo rodando agora (se houver).
#[derive(Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct GameState {
    pub running: Option<RunningGame>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RunningGame {
    pub id: String,
    pub started: u64,
}

#[derive(Serialize)]
struct Session<'a> {
    game: &'a str,
    start: u64,
    end: u64,
}

#[derive(Default)]
pub struct ConsoleState(pub Mutex<GameState>, pub Mutex<Option<u32>>);

/// Abre um jogo .exe e acompanha o processo: a sessão vai do início ao fim dele.
pub fn spawn_exe(app: &AppHandle, id: &str, exe: &str, args: &str) -> Result<(), String> {
    let path = std::path::Path::new(exe);
    let mut cmd = std::process::Command::new(path);
    cmd.args(args.split_whitespace());
    if let Some(dir) = path.parent() {
        cmd.current_dir(dir);
    }
    let mut child = cmd.spawn().map_err(|e| format!("Não consegui abrir o jogo: {e}"))?;
    *app.state::<ConsoleState>().1.lock().unwrap() = Some(child.id());
    set_running(app, Some(id.to_string()));
    let app = app.clone();
    std::thread::spawn(move || {
        let _ = child.wait();
        *app.state::<ConsoleState>().1.lock().unwrap() = None;
        set_running(&app, None);
    });
    Ok(())
}

pub fn now() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0)
}

/// Traz o hub para a frente (Guide, fim de jogo).
pub fn show_hub(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.unminimize();
        let _ = w.show();
        let _ = w.set_focus();
    }
}

/// Ctrl+Alt+H: se o hub está na frente, esconde; senão, traz.
pub fn toggle_hub(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let in_front = w.is_visible().unwrap_or(false) && w.is_focused().unwrap_or(false) && !w.is_minimized().unwrap_or(false);
        if in_front {
            let _ = w.minimize();
        } else {
            show_hub(app);
        }
    }
}

pub fn hide_hub(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.minimize();
    }
}

/// Atualiza o estado, avisa a interface e grava a sessão quando o jogo fecha.
pub fn set_running(app: &AppHandle, id: Option<String>) {
    let state = app.state::<ConsoleState>();
    let mut cur = state.0.lock().unwrap();
    let before = cur.running.clone();
    match (&before, &id) {
        (Some(b), Some(n)) if &b.id == n => return,
        (None, None) => return,
        _ => {}
    }
    if let Some(b) = &before {
        save_session(app, &b.id, b.started, now());
    }
    cur.running = id.map(|id| RunningGame { id, started: now() });
    let snapshot = cur.clone();
    drop(cur);
    let _ = app.emit("game-state", &snapshot);
    if snapshot.running.is_some() {
        hide_hub(app);
    } else {
        show_hub(app);
    }
}

fn save_session(app: &AppHandle, game: &str, start: u64, end: u64) {
    // Sessões muito curtas costumam ser o jogo abrindo e fechando por erro.
    if end.saturating_sub(start) < 30 {
        return;
    }
    let Ok(dir) = app.path().app_data_dir() else { return };
    let _ = std::fs::create_dir_all(&dir);
    let line = serde_json::to_string(&Session { game, start, end }).unwrap_or_default();
    if let Ok(mut f) = OpenOptions::new().create(true).append(true).open(dir.join("sessions.jsonl")) {
        let _ = writeln!(f, "{line}");
    }
}

/// Liga os vigias em segundo plano (só fazem algo no Windows).
pub fn start_watchers(app: &AppHandle) {
    #[cfg(windows)]
    {
        let a = app.clone();
        std::thread::spawn(move || windows::watch_steam(a));
        let a = app.clone();
        std::thread::spawn(move || windows::watch_guide(a));
    }
    #[cfg(not(windows))]
    let _ = app;
}

#[cfg(windows)]
mod windows {
    use std::ffi::c_void;
    use std::time::Duration;

    use tauri::AppHandle;
    use winreg::enums::HKEY_CURRENT_USER;
    use winreg::RegKey;

    /// A Steam escreve no registro o appid do jogo que está rodando.
    pub fn watch_steam(app: AppHandle) {
        let mut last: u32 = 0;
        loop {
            let id: u32 = RegKey::predef(HKEY_CURRENT_USER)
                .open_subkey(r"Software\Valve\Steam")
                .and_then(|k| k.get_value("RunningAppID"))
                .unwrap_or(0);
            if id != last {
                last = id;
                super::set_running(&app, (id != 0).then(|| format!("steam:{id}")));
            }
            std::thread::sleep(Duration::from_secs(2));
        }
    }

    #[repr(C)]
    #[derive(Default)]
    struct XInputGamepad {
        buttons: u16,
        left_trigger: u8,
        right_trigger: u8,
        thumb_lx: i16,
        thumb_ly: i16,
        thumb_rx: i16,
        thumb_ry: i16,
    }

    #[repr(C)]
    #[derive(Default)]
    struct XInputState {
        packet: u32,
        pad: XInputGamepad,
    }

    type GetStateEx = unsafe extern "system" fn(u32, *mut XInputState) -> u32;

    #[link(name = "kernel32")]
    extern "system" {
        fn LoadLibraryW(name: *const u16) -> *mut c_void;
        fn GetProcAddress(module: *mut c_void, name: *const u8) -> *mut c_void;
    }

    const GUIDE: u16 = 0x0400;

    /// O botão Guide não aparece para a interface (Gamepad API), só pelo XInput.
    /// A função que lê ele é a "XInputGetStateEx", exportada só pelo número 100.
    pub fn watch_guide(app: AppHandle) {
        let dll: Vec<u16> = "xinput1_4.dll\0".encode_utf16().collect();
        let get: GetStateEx = unsafe {
            let module = LoadLibraryW(dll.as_ptr());
            if module.is_null() {
                return;
            }
            let f = GetProcAddress(module, 100 as *const u8);
            if f.is_null() {
                return;
            }
            std::mem::transmute::<*mut c_void, GetStateEx>(f)
        };
        let mut was = [false; 4];
        loop {
            let mut any = false;
            for (user, was) in was.iter_mut().enumerate() {
                let mut st = XInputState::default();
                let ok = unsafe { get(user as u32, &mut st) } == 0;
                any |= ok;
                let down = ok && st.pad.buttons & GUIDE != 0;
                if down && !*was {
                    super::show_hub(&app);
                }
                *was = down;
            }
            // Sem controle conectado, olha bem menos vezes.
            std::thread::sleep(Duration::from_millis(if any { 50 } else { 1000 }));
        }
    }
}
