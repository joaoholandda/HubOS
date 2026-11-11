//! Navegador dentro do hub: uma janela sem bordas, "filha" da janela do hub,
//! encaixada na área de conteúdo (a barra de cima do hub continua visível).
//! As páginas não têm acesso a nenhum comando do hub.

use serde::Deserialize;
use tauri::{AppHandle, LogicalPosition, LogicalSize, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

const LABEL: &str = "browser";

/// Retângulo da área de conteúdo, em pixels da página do hub.
#[derive(Deserialize, Clone, Copy)]
pub struct Rect {
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
}

fn window(app: &AppHandle) -> Option<WebviewWindow> {
    app.get_webview_window(LABEL)
}

/// Aceita só endereços http(s). Texto solto vira busca.
pub fn to_url(input: &str) -> Result<tauri::Url, String> {
    let t = input.trim();
    let text = if t.starts_with("http://") || t.starts_with("https://") {
        t.to_string()
    } else if t.contains('.') && !t.contains(' ') {
        format!("https://{t}")
    } else {
        format!("https://www.google.com/search?q={}", t.replace('%', "%25").replace('&', "%26").replace('#', "%23").replace('+', "%2B").replace(' ', "+"))
    };
    text.parse().map_err(|_| "Endereço inválido".to_string())
}

/// Posição na tela: canto da janela do hub + o retângulo do conteúdo.
fn place(app: &AppHandle, win: &WebviewWindow, r: Rect) -> Result<(), String> {
    let main = app.get_webview_window("main").ok_or("Janela do hub não encontrada")?;
    let scale = main.scale_factor().unwrap_or(1.0);
    let origin = main.inner_position().map(|p| p.to_logical::<f64>(scale)).unwrap_or(LogicalPosition::new(0.0, 0.0));
    win.set_position(LogicalPosition::new(origin.x + r.x, origin.y + r.y)).map_err(|e| e.to_string())?;
    win.set_size(LogicalSize::new(r.w.max(200.0), r.h.max(200.0))).map_err(|e| e.to_string())
}

pub fn open(app: &AppHandle, url: &str, rect: Rect) -> Result<(), String> {
    let url = to_url(url)?;
    crate::log::log(format!("navegador: {}", url.host_str().unwrap_or("?")));
    if let Some(win) = window(app) {
        win.navigate(url).map_err(|e| e.to_string())?;
        place(app, &win, rect)?;
        let _ = win.show();
        let _ = win.set_focus();
        return Ok(());
    }
    let main = app.get_webview_window("main").ok_or("Janela do hub não encontrada")?;
    let win = WebviewWindowBuilder::new(app, LABEL, WebviewUrl::External(url))
        .title("HubOS · Navegador")
        .decorations(false)
        .resizable(false)
        .skip_taskbar(true)
        .visible(false)
        .parent(&main)
        .map_err(|e| e.to_string())?
        .build()
        .map_err(|e| format!("Não consegui abrir o navegador: {e}"))?;
    place(app, &win, rect)?;
    let _ = win.show();
    let _ = win.set_focus();
    Ok(())
}

pub fn set_bounds(app: &AppHandle, rect: Rect) -> Result<(), String> {
    match window(app) {
        Some(win) => place(app, &win, rect),
        None => Ok(()),
    }
}

/// Mostra ou esconde (a página continua carregada, para voltar na hora).
pub fn show(app: &AppHandle, on: bool) {
    if let Some(win) = window(app) {
        let _ = if on { win.show() } else { win.hide() };
    }
}

/// `back`, `forward` ou `reload`.
pub fn action(app: &AppHandle, what: &str) -> Result<(), String> {
    let js = match what {
        "back" => "history.back()",
        "forward" => "history.forward()",
        "reload" => "location.reload()",
        other => return Err(format!("Ação desconhecida: {other}")),
    };
    window(app).ok_or("Navegador fechado")?.eval(js).map_err(|e| e.to_string())
}

pub fn current_url(app: &AppHandle) -> Option<String> {
    window(app).and_then(|w| w.url().ok()).map(|u| u.to_string())
}

/// Fecha de vez (para a mídia que estiver tocando).
pub fn close(app: &AppHandle) {
    if let Some(win) = window(app) {
        let _ = win.destroy();
    }
}
