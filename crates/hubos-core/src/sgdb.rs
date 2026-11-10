//! SteamGridDB: banco de capas de jogos feito pela comunidade.
//! Aqui ficam só os formatos e os endereços. A parte de rede fica no app.
//! Documentação: https://www.steamgriddb.com/api/v2

use serde::{Deserialize, Serialize};

pub const API: &str = "https://www.steamgriddb.com/api/v2";

/// Capa vertical no formato que a Steam usa na biblioteca.
pub const COVER_DIMENSIONS: &str = "600x900,342x482,660x930";

#[derive(Debug, Deserialize)]
pub struct Response<T> {
    pub success: bool,
    #[serde(default = "Vec::new")]
    pub data: Vec<T>,
}

#[derive(Debug, Deserialize)]
pub struct SearchHit {
    pub id: u64,
    pub name: String,
}

#[derive(Debug, Deserialize, Serialize, Clone, PartialEq)]
pub struct Grid {
    pub id: u64,
    pub url: String,
    pub thumb: String,
    #[serde(default)]
    pub width: u32,
    #[serde(default)]
    pub height: u32,
    #[serde(default)]
    pub style: String,
    #[serde(default)]
    pub nsfw: bool,
    #[serde(default)]
    pub humor: bool,
}

/// Endereço das capas de um jogo. Jogos da Steam vão direto pelo appid;
/// os outros precisam do id do SteamGridDB (vem da busca por nome).
pub fn grids_url(game_id: &str, sgdb_id: Option<u64>) -> Option<String> {
    let q = format!("dimensions={COVER_DIMENSIONS}&types=static&nsfw=false&humor=false");
    if let Some(appid) = game_id.strip_prefix("steam:") {
        return Some(format!("{API}/grids/steam/{appid}?{q}"));
    }
    sgdb_id.map(|id| format!("{API}/grids/game/{id}?{q}"))
}

pub fn search_url(title: &str) -> String {
    format!("{API}/search/autocomplete/{}", encode(title))
}

/// Tira capas impróprias ou de piada e põe as verticais primeiro.
pub fn tidy(mut grids: Vec<Grid>) -> Vec<Grid> {
    grids.retain(|g| !g.nsfw && !g.humor);
    grids.sort_by_key(|g| (g.height < g.width, g.style != "alternate"));
    grids
}

/// Codifica um texto para ir no caminho da URL.
fn encode(s: &str) -> String {
    let mut out = String::new();
    for b in s.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => out.push(b as char),
            _ => out.push_str(&format!("%{b:02X}")),
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn steam_usa_appid_direto() {
        let u = grids_url("steam:730", None).unwrap();
        assert!(u.starts_with("https://www.steamgriddb.com/api/v2/grids/steam/730?"));
    }

    #[test]
    fn outros_precisam_da_busca() {
        assert_eq!(grids_url("exe:minecraft", None), None);
        assert!(grids_url("exe:minecraft", Some(42)).unwrap().contains("/grids/game/42?"));
    }

    #[test]
    fn busca_codifica_o_nome() {
        assert_eq!(search_url("Pokémon Emerald"), format!("{API}/search/autocomplete/Pok%C3%A9mon%20Emerald"));
    }

    #[test]
    fn le_resposta_e_filtra() {
        let json = r#"{"success":true,"data":[
            {"id":1,"url":"https://cdn2.steamgriddb.com/grid/a.png","thumb":"https://cdn2.steamgriddb.com/thumb/a.jpg","width":920,"height":430,"style":"alternate","nsfw":false,"humor":false},
            {"id":2,"url":"https://cdn2.steamgriddb.com/grid/b.png","thumb":"https://cdn2.steamgriddb.com/thumb/b.jpg","width":600,"height":900,"style":"alternate","nsfw":false,"humor":false},
            {"id":3,"url":"x","thumb":"x","width":600,"height":900,"style":"alternate","nsfw":true,"humor":false}
        ]}"#;
        let r: Response<Grid> = serde_json::from_str(json).unwrap();
        let ids: Vec<u64> = tidy(r.data).iter().map(|g| g.id).collect();
        assert_eq!(ids, [2, 1]);
    }
}
