//! Party: controla a chamada de voz do Discord que está aberto no PC.
//!
//! O Discord aceita comandos por um canal local (`\\.\pipe\discord-ipc-0`),
//! mas só de um "aplicativo" registrado. O dono do hub cria o dele (grátis) e
//! cola o Client ID e o Client Secret em Configurações. Na primeira vez o
//! Discord mostra uma janela pedindo autorização.

use std::fs::File;
use std::io::{Read, Write};
use std::sync::Mutex;

use hubos_core::discord::{self as rpc, Guild, VoiceChannel};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::{AppHandle, Manager};

struct Conn {
    pipe: File,
    nonce: u64,
    user: String,
}

#[derive(Default)]
pub struct DiscordState(Mutex<Option<Conn>>);

#[derive(Serialize, Deserialize, Default)]
struct Token {
    access_token: String,
    #[serde(default)]
    refresh_token: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Status {
    /// Client ID e Secret já foram colados em Configurações?
    pub configured: bool,
    pub connected: bool,
    pub user: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Party {
    pub channel: Option<VoiceChannel>,
    pub mute: bool,
    pub deaf: bool,
}

impl Conn {
    fn send(&mut self, op: u32, payload: &Value) -> Result<(), String> {
        self.pipe.write_all(&rpc::encode(op, payload)).map_err(|e| format!("O Discord fechou a conexão: {e}"))
    }

    fn read(&mut self) -> Result<(u32, Value), String> {
        let gone = |e: std::io::Error| format!("O Discord fechou a conexão: {e}");
        let mut head = [0u8; 8];
        self.pipe.read_exact(&mut head).map_err(gone)?;
        let (op, len) = rpc::decode_header(head);
        if len > 8 * 1024 * 1024 {
            return Err("Resposta grande demais do Discord.".into());
        }
        let mut body = vec![0u8; len];
        self.pipe.read_exact(&mut body).map_err(gone)?;
        Ok((op, serde_json::from_slice(&body).unwrap_or(Value::Null)))
    }

    /// Manda um comando e espera a resposta dele (ignorando avisos no meio).
    fn call(&mut self, cmd: &str, args: Value) -> Result<Value, String> {
        self.nonce += 1;
        let nonce = self.nonce.to_string();
        self.send(rpc::OP_FRAME, &rpc::command(cmd, args, self.nonce))?;
        loop {
            let (op, msg) = self.read()?;
            match op {
                rpc::OP_PING => self.send(rpc::OP_PONG, &msg)?,
                rpc::OP_CLOSE => return Err(msg["message"].as_str().unwrap_or("O Discord encerrou a conexão.").to_string()),
                _ if msg["nonce"] == nonce.as_str() => return rpc::response(&msg),
                _ => {}
            }
        }
    }
}

/// Abre o canal local do Discord (ele usa de 0 a 9).
fn open_pipe() -> Result<File, String> {
    for i in 0..10 {
        let path = if cfg!(windows) { format!(r"\\.\pipe\discord-ipc-{i}") } else { format!("/tmp/discord-ipc-{i}") };
        if let Ok(f) = std::fs::OpenOptions::new().read(true).write(true).open(path) {
            return Ok(f);
        }
    }
    Err("DISCORD_CLOSED".into())
}

fn token_file(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    Ok(app.path().app_data_dir().map_err(|e| e.to_string())?.join("discord-token.json"))
}

fn app_keys(app: &AppHandle) -> Result<(String, String), String> {
    let s = crate::covers::settings(app);
    match (s.discord_id, s.discord_secret) {
        (Some(id), Some(secret)) => Ok((id, secret)),
        _ => Err("NOT_CONFIGURED".into()),
    }
}

/// Troca o código de autorização (ou o token de renovação) por um token de acesso.
fn fetch_token(id: &str, secret: &str, grant: &[(&str, &str)]) -> Result<Token, String> {
    let mut form = vec![("client_id", id), ("client_secret", secret)];
    form.extend_from_slice(grant);
    let r = reqwest::blocking::Client::new().post("https://discord.com/api/oauth2/token").form(&form).send().map_err(|e| format!("Sem conexão com o Discord: {}", e.without_url()))?;
    if !r.status().is_success() {
        return Err(format!("O Discord recusou as chaves do aplicativo (erro {}). Confira o Client ID, o Secret e o redirect http://localhost.", r.status().as_u16()));
    }
    r.json::<Token>().map_err(|e| e.to_string())
}

/// Conecta e autentica. Na primeira vez o Discord mostra a janela de autorização.
fn connect(app: &AppHandle) -> Result<Conn, String> {
    let (id, secret) = app_keys(app)?;
    let mut c = Conn { pipe: open_pipe()?, nonce: 0, user: String::new() };
    c.send(rpc::OP_HANDSHAKE, &rpc::handshake(&id))?;
    let (op, hello) = c.read()?;
    if op == rpc::OP_CLOSE {
        return Err(format!("O Discord não aceitou o aplicativo: {}", hello["message"].as_str().unwrap_or("Client ID inválido")));
    }

    let file = token_file(app)?;
    let saved: Token = std::fs::read(&file).ok().and_then(|b| serde_json::from_slice(&b).ok()).unwrap_or_default();
    let auth = |c: &mut Conn, t: &Token| c.call("AUTHENTICATE", json!({ "access_token": t.access_token }));

    // 1) token guardado; 2) renovar; 3) pedir autorização de novo.
    let mut result = if saved.access_token.is_empty() { Err(String::new()) } else { auth(&mut c, &saved) };
    if result.is_err() && !saved.refresh_token.is_empty() {
        if let Ok(t) = fetch_token(&id, &secret, &[("grant_type", "refresh_token"), ("refresh_token", &saved.refresh_token)]) {
            result = auth(&mut c, &t);
            let _ = std::fs::write(&file, serde_json::to_vec(&t).unwrap_or_default());
        }
    }
    if result.is_err() {
        crate::log::log("Discord: pedindo autorização (janela no Discord)");
        let data = c.call("AUTHORIZE", json!({ "client_id": id, "scopes": rpc::SCOPES }))?;
        let code = data["code"].as_str().ok_or("O Discord não devolveu o código de autorização.")?;
        let t = fetch_token(&id, &secret, &[("grant_type", "authorization_code"), ("code", code), ("redirect_uri", "http://localhost")])?;
        result = auth(&mut c, &t);
        let _ = std::fs::write(&file, serde_json::to_vec(&t).unwrap_or_default());
    }
    let data = result?;
    let user = &data["user"];
    c.user = user["global_name"].as_str().or(user["username"].as_str()).unwrap_or("Discord").to_string();
    crate::log::log(format!("Discord conectado como {}", c.user));
    Ok(c)
}

/// Roda `f` com a conexão (conectando se preciso). Se a conexão cair, descarta.
fn with<T>(app: &AppHandle, f: impl FnOnce(&mut Conn) -> Result<T, String>) -> Result<T, String> {
    let state = app.state::<DiscordState>();
    let mut guard = state.0.lock().unwrap();
    if guard.is_none() {
        *guard = Some(connect(app).inspect_err(|e| crate::log::log(format!("Discord: {e}")))?);
    }
    let r = f(guard.as_mut().unwrap());
    if matches!(&r, Err(e) if e.contains("fechou a conexão") || e.contains("encerrou")) {
        *guard = None;
    }
    r
}

pub fn status(app: &AppHandle) -> Status {
    let state = app.state::<DiscordState>();
    let guard = state.0.lock().unwrap();
    Status { configured: app_keys(app).is_ok(), connected: guard.is_some(), user: guard.as_ref().map(|c| c.user.clone()) }
}

pub fn connect_now(app: &AppHandle) -> Result<String, String> {
    with(app, |c| Ok(c.user.clone()))
}

/// Esquece a conexão e a autorização (para trocar de conta ou de aplicativo).
pub fn forget(app: &AppHandle) {
    *app.state::<DiscordState>().0.lock().unwrap() = None;
    if let Ok(f) = token_file(app) {
        let _ = std::fs::remove_file(f);
    }
}

pub fn party(app: &AppHandle) -> Result<Party, String> {
    with(app, |c| {
        let channel = rpc::voice_channel(&c.call("GET_SELECTED_VOICE_CHANNEL", json!({}))?);
        let vs = c.call("GET_VOICE_SETTINGS", json!({}))?;
        Ok(Party { channel, mute: vs["mute"].as_bool().unwrap_or(false), deaf: vs["deaf"].as_bool().unwrap_or(false) })
    })
}

pub fn guilds(app: &AppHandle) -> Result<Vec<Guild>, String> {
    with(app, |c| Ok(rpc::guilds(&c.call("GET_GUILDS", json!({}))?)))
}

/// Canais de voz de um servidor, já com quem está em cada um.
pub fn channels(app: &AppHandle, guild_id: &str) -> Result<Vec<VoiceChannel>, String> {
    with(app, |c| {
        let ids = rpc::voice_channel_ids(&c.call("GET_CHANNELS", json!({ "guild_id": guild_id }))?);
        let mut out = Vec::new();
        for (id, name) in ids.into_iter().take(40) {
            let members = c.call("GET_CHANNEL", json!({ "channel_id": id })).ok().and_then(|d| rpc::voice_channel(&d)).map(|ch| ch.members).unwrap_or_default();
            out.push(VoiceChannel { id, name, guild_id: Some(guild_id.to_string()), members });
        }
        Ok(out)
    })
}

/// Entra em um canal de voz; `None` sai da chamada.
pub fn join(app: &AppHandle, channel_id: Option<&str>) -> Result<(), String> {
    with(app, |c| c.call("SELECT_VOICE_CHANNEL", json!({ "channel_id": channel_id, "force": true })).map(|_| ()))
}

/// `what` é "mute" ou "deaf".
pub fn set_voice(app: &AppHandle, what: &str, on: bool) -> Result<(), String> {
    if !matches!(what, "mute" | "deaf") {
        return Err(format!("Ajuste de voz desconhecido: {what}"));
    }
    with(app, |c| c.call("SET_VOICE_SETTINGS", json!({ what: on })).map(|_| ()))
}
