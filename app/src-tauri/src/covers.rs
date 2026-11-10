//! Capas escolhidas por você (SteamGridDB) e a chave da API.
//! Tudo fica na pasta de dados do app:
//! - `settings.json`: chave do SteamGridDB
//! - `covers.json`: qual capa cada jogo usa
//! - `covers/`: as imagens baixadas

use std::collections::HashMap;
use std::path::PathBuf;

use hubos_core::sgdb::{self, Grid, Response, SearchHit};
use hubos_core::Game;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

#[derive(Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    #[serde(default)]
    pub sgdb_key: Option<String>,
}

fn data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

pub fn covers_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = data_dir(app)?.join("covers");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn read_json<T: Default + for<'de> Deserialize<'de>>(path: PathBuf) -> T {
    std::fs::read(path).ok().and_then(|b| serde_json::from_slice(&b).ok()).unwrap_or_default()
}

fn write_json<T: Serialize>(path: PathBuf, value: &T) -> Result<(), String> {
    let bytes = serde_json::to_vec_pretty(value).map_err(|e| e.to_string())?;
    std::fs::write(path, bytes).map_err(|e| e.to_string())
}

pub fn settings(app: &AppHandle) -> Settings {
    data_dir(app).map(|d| read_json(d.join("settings.json"))).unwrap_or_default()
}

pub fn save_key(app: &AppHandle, key: String) -> Result<(), String> {
    let mut s = settings(app);
    let key = key.trim().to_string();
    s.sgdb_key = (!key.is_empty()).then_some(key);
    write_json(data_dir(app)?.join("settings.json"), &s)
}

fn overrides(app: &AppHandle) -> HashMap<String, String> {
    data_dir(app).map(|d| read_json(d.join("covers.json"))).unwrap_or_default()
}

/// Troca a capa dos jogos que você personalizou.
pub fn apply_overrides(app: &AppHandle, games: &mut [Game]) {
    let map = overrides(app);
    for g in games.iter_mut() {
        if let Some(p) = map.get(&g.id) {
            if std::path::Path::new(p).is_file() {
                g.cover_path = Some(p.clone());
            }
        }
    }
}

fn client(key: &str) -> Result<(reqwest::Client, String), String> {
    let c = reqwest::Client::builder().user_agent("HubOS").build().map_err(|e| e.to_string())?;
    Ok((c, format!("Bearer {key}")))
}

/// Opções de capa para um jogo. Jogos fora da Steam são achados pelo nome.
pub async fn grids(app: &AppHandle, game_id: &str, title: &str) -> Result<Vec<Grid>, String> {
    let key = settings(app).sgdb_key.ok_or("NO_KEY")?;
    let (c, auth) = client(&key)?;
    let mut sgdb_id = None;
    if !game_id.starts_with("steam:") {
        let r: Response<SearchHit> = c.get(sgdb::search_url(title)).header("Authorization", &auth).send().await.map_err(net)?.error_for_status().map_err(status)?.json().await.map_err(net)?;
        sgdb_id = r.data.first().map(|h| h.id);
    }
    let Some(url) = sgdb::grids_url(game_id, sgdb_id) else { return Ok(vec![]) };
    let r: Response<Grid> = c.get(url).header("Authorization", &auth).send().await.map_err(net)?.error_for_status().map_err(status)?.json().await.map_err(net)?;
    Ok(sgdb::tidy(r.data))
}

/// Baixa a capa escolhida e passa a usá-la. Devolve o caminho no disco.
pub async fn set_cover(app: &AppHandle, game_id: &str, url: &str) -> Result<String, String> {
    if !url.starts_with("https://") {
        return Err("Endereço de imagem inválido".into());
    }
    let bytes = reqwest::Client::builder().user_agent("HubOS").build().map_err(|e| e.to_string())?.get(url).send().await.map_err(net)?.error_for_status().map_err(status)?.bytes().await.map_err(net)?;
    let ext = url.rsplit('.').next().filter(|e| matches!(*e, "png" | "jpg" | "jpeg" | "webp")).unwrap_or("png");
    let safe: String = game_id.chars().map(|c| if c.is_ascii_alphanumeric() { c } else { '_' }).collect();
    let path = covers_dir(app)?.join(format!("{safe}-{}.{ext}", crate::console::now()));
    std::fs::write(&path, &bytes).map_err(|e| e.to_string())?;
    let mut map = overrides(app);
    let path_s = path.to_string_lossy().into_owned();
    if let Some(old) = map.insert(game_id.to_string(), path_s.clone()) {
        let _ = std::fs::remove_file(old);
    }
    write_json(data_dir(app)?.join("covers.json"), &map)?;
    Ok(path_s)
}

/// Volta para a capa original da loja.
pub fn reset_cover(app: &AppHandle, game_id: &str) -> Result<(), String> {
    let mut map = overrides(app);
    if let Some(old) = map.remove(game_id) {
        let _ = std::fs::remove_file(old);
    }
    write_json(data_dir(app)?.join("covers.json"), &map)
}

fn net(e: reqwest::Error) -> String {
    format!("Sem conexão com o SteamGridDB: {e}")
}

fn status(e: reqwest::Error) -> String {
    match e.status().map(|s| s.as_u16()) {
        Some(401) | Some(403) => "BAD_KEY".into(),
        Some(404) => "Nenhuma capa encontrada para este jogo.".into(),
        _ => format!("O SteamGridDB respondeu com erro: {e}"),
    }
}
