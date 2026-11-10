use serde::Serialize;

/// De onde o jogo vem. Cada origem tem seu jeito de abrir e de medir horas.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Source {
    Steam,
    Xbox,
    Epic,
    Exe,
    Ra,
}

/// Um jogo da biblioteca, no formato que a interface recebe.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Game {
    /// Identificador estável entre origens, ex.: `steam:730`.
    pub id: String,
    pub title: String,
    pub source: Source,
    pub installed: bool,
    /// Minutos jogados segundo a própria loja (a Steam guarda isso localmente).
    pub playtime_minutes: Option<u64>,
    /// Última vez que jogou, em segundos Unix.
    pub last_played: Option<i64>,
    pub size_on_disk: Option<u64>,
    /// Pasta do jogo no disco (quando instalado).
    pub install_dir: Option<String>,
    /// Capa vertical (2:3) no disco, quando a loja já baixou.
    pub cover_path: Option<String>,
    /// Arte larga para o fundo, no disco.
    pub hero_path: Option<String>,
    /// Logo com fundo transparente, no disco.
    pub logo_path: Option<String>,
    /// Plano B na internet quando não há arquivo local.
    pub cover_url: Option<String>,
    pub hero_url: Option<String>,
    /// Como abrir: uma URL (`steam://...`) ou um caminho de executável.
    pub launch: String,
}
