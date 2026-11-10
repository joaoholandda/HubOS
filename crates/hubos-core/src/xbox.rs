//! Jogos do app Xbox no PC (Game Pass / Microsoft Store).
//!
//! O Windows lista os pacotes instalados; os que são jogos têm um arquivo
//! `MicrosoftGame.config` com o nome, o executável e o id para abrir.
//! Aqui fica só a leitura desses dois formatos; quem pergunta ao Windows é o app.

use serde::Deserialize;

use crate::model::{Game, Source};

#[derive(Debug, Deserialize, Clone, PartialEq)]
pub struct Package {
    #[serde(rename = "Name")]
    pub name: String,
    #[serde(rename = "Pfn")]
    pub family_name: String,
    #[serde(rename = "Dir")]
    pub dir: String,
}

/// O PowerShell devolve um objeto quando há um só pacote e uma lista quando há vários.
pub fn parse_packages(json: &str) -> Vec<Package> {
    let json = json.trim();
    if json.is_empty() {
        return vec![];
    }
    serde_json::from_str::<Vec<Package>>(json).or_else(|_| serde_json::from_str::<Package>(json).map(|p| vec![p])).unwrap_or_default()
}

#[derive(Debug, PartialEq)]
pub struct GameConfig {
    pub display_name: Option<String>,
    /// Nome do arquivo do executável, ex.: `ForzaHorizon5.exe`.
    pub exe: Option<String>,
    /// Id do aplicativo dentro do pacote (quase sempre "Game").
    pub app_id: String,
}

pub fn parse_config(xml: &str) -> GameConfig {
    let exe_tag = tag(xml, "Executable");
    GameConfig {
        display_name: tag(xml, "ShellVisuals").and_then(|t| attr(t, "DefaultDisplayName")).filter(|n| !n.starts_with("ms-resource:")),
        exe: exe_tag.and_then(|t| attr(t, "Name")).map(|n| n.rsplit(['\\', '/']).next().unwrap_or(&n).to_string()),
        app_id: exe_tag.and_then(|t| attr(t, "Id")).unwrap_or_else(|| "Game".into()),
    }
}

/// Texto da primeira tag `<nome ...>`.
fn tag<'a>(xml: &'a str, name: &str) -> Option<&'a str> {
    let start = xml.find(&format!("<{name} ")).or_else(|| xml.find(&format!("<{name}\n")))?;
    let end = xml[start..].find('>')?;
    Some(&xml[start..start + end])
}

fn attr(tag: &str, name: &str) -> Option<String> {
    let key = format!("{name}=\"");
    let start = tag.find(&key)? + key.len();
    let end = tag[start..].find('"')?;
    Some(tag[start..start + end].replace("&amp;", "&").replace("&apos;", "'"))
}

/// Nome apresentável a partir do nome do pacote: `Microsoft.ForzaHorizon5` → "Forza Horizon 5".
pub fn pretty_name(package: &str) -> String {
    let last = package.rsplit('.').next().unwrap_or(package);
    let mut out = String::new();
    let chars: Vec<char> = last.chars().collect();
    for (i, &c) in chars.iter().enumerate() {
        let prev = i.checked_sub(1).map(|j| chars[j]);
        let boundary = prev.is_some_and(|p| (c.is_uppercase() && p.is_lowercase()) || (c.is_ascii_digit() && p.is_alphabetic()));
        if boundary {
            out.push(' ');
        }
        out.push(c);
    }
    out
}

pub fn to_game(pkg: &Package, cfg: &GameConfig) -> Game {
    Game {
        id: format!("xbox:{}", pkg.name),
        title: cfg.display_name.clone().unwrap_or_else(|| pretty_name(&pkg.name)),
        source: Source::Xbox,
        installed: true,
        playtime_minutes: None,
        last_played: None,
        size_on_disk: None,
        install_dir: Some(pkg.dir.clone()),
        cover_path: None,
        hero_path: None,
        logo_path: None,
        cover_url: None,
        hero_url: None,
        launch: format!("shell:AppsFolder\\{}!{}", pkg.family_name, cfg.app_id),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const CONFIG: &str = r#"<?xml version="1.0" encoding="utf-8"?>
<Game configVersion="1">
  <Identity Name="Microsoft.624F8B84B80" Publisher="CN=Microsoft" Version="3.0.0.0"/>
  <ExecutableList>
    <Executable Name="ForzaHorizon5.exe" Id="Game" TargetDeviceFamily="PC"/>
  </ExecutableList>
  <ShellVisuals DefaultDisplayName="Forza Horizon 5" PublisherDisplayName="Xbox Game Studios" Square150x150Logo="GraphicsLogo.png"/>
</Game>"#;

    #[test]
    fn le_config_do_jogo() {
        let c = parse_config(CONFIG);
        assert_eq!(c.display_name.as_deref(), Some("Forza Horizon 5"));
        assert_eq!(c.exe.as_deref(), Some("ForzaHorizon5.exe"));
        assert_eq!(c.app_id, "Game");
    }

    #[test]
    fn pacotes_um_ou_varios() {
        let one = r#"{"Name":"Microsoft.HaloInfinite","Pfn":"Microsoft.HaloInfinite_8wekyb3d8bbwe","Dir":"C:\\XboxGames\\Halo Infinite\\Content"}"#;
        assert_eq!(parse_packages(one).len(), 1);
        assert_eq!(parse_packages(&format!("[{one},{one}]")).len(), 2);
        assert!(parse_packages("").is_empty());
    }

    #[test]
    fn monta_o_jogo_e_o_comando_de_abrir() {
        let pkg = parse_packages(r#"{"Name":"Microsoft.624F8B84B80","Pfn":"Microsoft.624F8B84B80_8wekyb3d8bbwe","Dir":"C:\\XboxGames\\FH5\\Content"}"#).remove(0);
        let g = to_game(&pkg, &parse_config(CONFIG));
        assert_eq!(g.title, "Forza Horizon 5");
        assert_eq!(g.launch, "shell:AppsFolder\\Microsoft.624F8B84B80_8wekyb3d8bbwe!Game");
    }

    #[test]
    fn nome_reserva_quando_o_config_nao_tem() {
        let c = parse_config(r#"<Game><ShellVisuals DefaultDisplayName="ms-resource:AppName"/></Game>"#);
        assert_eq!(c.display_name, None);
        assert_eq!(pretty_name("Microsoft.HaloInfinite"), "Halo Infinite");
        assert_eq!(pretty_name("Microsoft.ForzaHorizon5"), "Forza Horizon 5");
    }
}
