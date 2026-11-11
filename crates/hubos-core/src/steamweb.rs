//! API da Steam na internet (precisa de uma chave grátis): lista TODOS os jogos
//! da conta, inclusive os não instalados, e as conquistas de cada um.

use serde::{Deserialize, Serialize};

use crate::{Game, Source};

const API: &str = "https://api.steampowered.com";

pub fn owned_url(key: &str, steam_id64: u64) -> String {
    format!("{API}/IPlayerService/GetOwnedGames/v1/?key={key}&steamid={steam_id64}&include_appinfo=1&include_played_free_games=1&format=json")
}

pub fn achievements_url(key: &str, steam_id64: u64, appid: u32) -> String {
    format!("{API}/ISteamUserStats/GetPlayerAchievements/v1/?key={key}&steamid={steam_id64}&appid={appid}&l=brazilian&format=json")
}

/// Um jogo da conta, como a Steam devolve.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Owned {
    pub appid: u32,
    #[serde(default)]
    pub name: String,
    /// Minutos jogados desde sempre.
    #[serde(default)]
    pub playtime_forever: u64,
    #[serde(default)]
    pub rtime_last_played: i64,
}

#[derive(Deserialize)]
struct OwnedEnvelope {
    response: OwnedResponse,
}

#[derive(Deserialize, Default)]
struct OwnedResponse {
    #[serde(default)]
    games: Vec<Owned>,
}

/// Lê a resposta de `GetOwnedGames`. Perfil privado devolve lista vazia.
pub fn parse_owned(json: &str) -> Result<Vec<Owned>, String> {
    let env: OwnedEnvelope = serde_json::from_str(json).map_err(|e| format!("Resposta inesperada da Steam: {e}"))?;
    Ok(env.response.games.into_iter().filter(|g| !g.name.is_empty()).collect())
}

fn to_game(o: &Owned) -> Game {
    Game {
        id: format!("steam:{}", o.appid),
        title: o.name.clone(),
        source: Source::Steam,
        installed: false,
        playtime_minutes: (o.playtime_forever > 0).then_some(o.playtime_forever),
        last_played: (o.rtime_last_played > 0).then_some(o.rtime_last_played),
        size_on_disk: None,
        install_dir: None,
        cover_path: None,
        hero_path: None,
        logo_path: None,
        cover_url: Some(format!("https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/{}/library_600x900_2x.jpg", o.appid)),
        hero_url: Some(format!("https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/{}/library_hero.jpg", o.appid)),
        launch: format!("steam://install/{}", o.appid),
    }
}

/// Junta a lista da conta com o que foi achado no disco: acrescenta os jogos
/// não instalados e completa horas/última vez dos que já estavam na lista.
pub fn merge(games: &mut Vec<Game>, owned: &[Owned]) {
    for o in owned {
        let id = format!("steam:{}", o.appid);
        match games.iter_mut().find(|g| g.id == id) {
            Some(g) => {
                if o.playtime_forever > g.playtime_minutes.unwrap_or(0) {
                    g.playtime_minutes = Some(o.playtime_forever);
                }
                if o.rtime_last_played > g.last_played.unwrap_or(0) {
                    g.last_played = Some(o.rtime_last_played);
                }
            }
            None => games.push(to_game(o)),
        }
    }
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Achievement {
    pub name: String,
    pub description: String,
    pub achieved: bool,
    /// Segundos Unix de quando foi conquistada (0 se ainda não).
    pub unlock_time: u64,
}

#[derive(Debug, Clone, Serialize, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub struct Achievements {
    pub total: usize,
    pub unlocked: usize,
    /// Conquistadas primeiro (da mais recente para a mais antiga), depois as que faltam.
    pub items: Vec<Achievement>,
}

#[derive(Deserialize)]
struct AchEnvelope {
    playerstats: AchStats,
}

#[derive(Deserialize)]
struct AchStats {
    #[serde(default)]
    achievements: Vec<AchRaw>,
}

#[derive(Deserialize)]
struct AchRaw {
    #[serde(default)]
    apiname: String,
    #[serde(default)]
    achieved: u8,
    #[serde(default)]
    unlocktime: u64,
    #[serde(default)]
    name: String,
    #[serde(default)]
    description: String,
}

/// Lê a resposta de `GetPlayerAchievements`. Jogo sem conquistas devolve lista vazia.
pub fn parse_achievements(json: &str) -> Achievements {
    let Ok(env) = serde_json::from_str::<AchEnvelope>(json) else { return Achievements::default() };
    let mut items: Vec<Achievement> = env
        .playerstats
        .achievements
        .into_iter()
        .map(|a| Achievement { name: if a.name.is_empty() { a.apiname } else { a.name }, description: a.description, achieved: a.achieved == 1, unlock_time: a.unlocktime })
        .collect();
    items.sort_by(|a, b| b.achieved.cmp(&a.achieved).then(b.unlock_time.cmp(&a.unlock_time)));
    Achievements { total: items.len(), unlocked: items.iter().filter(|a| a.achieved).count(), items }
}

#[cfg(test)]
mod tests {
    use super::*;

    const OWNED: &str = r#"{"response":{"game_count":2,"games":[
        {"appid":730,"name":"Counter-Strike 2","playtime_forever":7000,"rtime_last_played":1700000000},
        {"appid":620,"name":"Portal 2","playtime_forever":0}]}}"#;

    #[test]
    fn lista_da_conta() {
        let owned = parse_owned(OWNED).unwrap();
        assert_eq!(owned.len(), 2);
        assert_eq!(owned[1].rtime_last_played, 0);
        assert!(parse_owned(r#"{"response":{}}"#).unwrap().is_empty());
        assert!(parse_owned("<html>").is_err());
    }

    #[test]
    fn junta_com_os_instalados() {
        let owned = parse_owned(OWNED).unwrap();
        let mut games = vec![Game { installed: true, playtime_minutes: Some(100), last_played: None, launch: "steam://rungameid/730".into(), ..to_game(&owned[0]) }];
        merge(&mut games, &owned);
        assert_eq!(games.len(), 2);
        assert!(games[0].installed);
        assert_eq!(games[0].playtime_minutes, Some(7000));
        assert_eq!(games[0].last_played, Some(1700000000));
        assert_eq!(games[0].launch, "steam://rungameid/730");
        assert!(!games[1].installed);
        assert_eq!(games[1].playtime_minutes, None);
        assert_eq!(games[1].launch, "steam://install/620");
    }

    #[test]
    fn conquistas_ordenadas() {
        let json = r#"{"playerstats":{"steamID":"1","gameName":"X","achievements":[
            {"apiname":"A","achieved":0,"unlocktime":0,"name":"Falta","description":"d"},
            {"apiname":"B","achieved":1,"unlocktime":10,"name":"Antiga"},
            {"apiname":"C","achieved":1,"unlocktime":20,"name":""}],"success":true}}"#;
        let a = parse_achievements(json);
        assert_eq!((a.total, a.unlocked), (3, 2));
        assert_eq!(a.items.iter().map(|i| i.name.as_str()).collect::<Vec<_>>(), ["C", "Antiga", "Falta"]);
        assert_eq!(parse_achievements(r#"{"playerstats":{"error":"Requested app has no stats","success":false}}"#).total, 0);
    }
}
