//! Conta da Steam pela internet: biblioteca completa e conquistas.
//! A lista da conta fica guardada em `steam-owned.json` para o hub abrir
//! na hora mesmo sem internet; ela é atualizada em segundo plano.

use std::path::Path;

use hubos_core::steamweb::{self, Achievements, Owned};
use hubos_core::{steam, Game};
use tauri::{AppHandle, Manager};

fn cache_file(app: &AppHandle) -> Option<std::path::PathBuf> {
    app.path().app_data_dir().ok().map(|d| d.join("steam-owned.json"))
}

/// Acrescenta à biblioteca os jogos da conta que não estão instalados.
pub fn merge_cached(app: &AppHandle, games: &mut Vec<Game>) {
    let owned: Vec<Owned> = cache_file(app).and_then(|p| std::fs::read(p).ok()).and_then(|b| serde_json::from_slice(&b).ok()).unwrap_or_default();
    steamweb::merge(games, &owned);
}

fn credentials(app: &AppHandle, root: Option<&Path>) -> Result<(String, u64), String> {
    let key = crate::covers::settings(app).steam_key.ok_or("Falta a chave da Steam (Configurações › Steam).")?;
    let id = root.and_then(steam::steam_id64).ok_or("Não achei a conta da Steam neste PC.")?;
    Ok((key, id))
}

async fn get(url: String) -> Result<String, String> {
    let c = reqwest::Client::builder().user_agent("HubOS").timeout(std::time::Duration::from_secs(20)).build().map_err(|e| e.to_string())?;
    let r = c.get(url).send().await.map_err(|e| format!("Sem conexão com a Steam: {}", e.without_url()))?;
    match r.status().as_u16() {
        200 => r.text().await.map_err(|e| e.without_url().to_string()),
        401 | 403 => Err("A Steam recusou a chave. Confira em Configurações › Steam.".into()),
        code => Err(format!("A Steam respondeu com erro {code}.")),
    }
}

/// Busca a lista de jogos da conta e guarda. Devolve quantos jogos a conta tem.
pub async fn refresh(app: &AppHandle, root: Option<&Path>) -> Result<usize, String> {
    let (key, id) = credentials(app, root)?;
    let owned = steamweb::parse_owned(&get(steamweb::owned_url(&key, id)).await?)?;
    if owned.is_empty() {
        return Err("A Steam não devolveu nenhum jogo. No perfil da Steam, deixe \"Detalhes dos jogos\" como Público.".into());
    }
    let file = cache_file(app).ok_or("Sem pasta de dados")?;
    std::fs::write(file, serde_json::to_vec(&owned).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
    Ok(owned.len())
}

pub async fn achievements(app: &AppHandle, root: Option<&Path>, appid: u32) -> Result<Achievements, String> {
    let (key, id) = credentials(app, root)?;
    // Jogo sem conquistas responde com erro 400: tratamos como lista vazia.
    match get(steamweb::achievements_url(&key, id, appid)).await {
        Ok(text) => Ok(steamweb::parse_achievements(&text)),
        Err(e) if e.contains("erro 400") => Ok(Achievements::default()),
        Err(e) => Err(e),
    }
}
