//! Nomes amigáveis para o programa que está tocando mídia.
//! O Windows identifica o programa por um código como `Spotify.exe`,
//! `SpotifyAB.SpotifyMusic_zpdnekdrzrea0!Spotify` ou `308046B0AF4A39CB` (Firefox).

const KNOWN: &[(&str, &str)] = &[
    ("spotify", "Spotify"),
    ("firefox", "Firefox"),
    ("308046b0af4a39cb", "Firefox"),
    ("chrome", "Chrome"),
    ("msedge", "Edge"),
    ("opera", "Opera"),
    ("brave", "Brave"),
    ("vlc", "VLC"),
    ("discord", "Discord"),
    ("zunemusic", "Reprodutor de Mídia"),
    ("zunevideo", "Filmes e TV"),
];

pub fn app_name(id: &str) -> String {
    let lower = id.to_ascii_lowercase();
    if let Some((_, name)) = KNOWN.iter().find(|(k, _)| lower.contains(k)) {
        return name.to_string();
    }
    // Sem nome conhecido: tira a pasta, o ".exe" e o sufixo de app da Store.
    let base = id.rsplit(['\\', '/']).next().unwrap_or(id);
    let base = base.split('!').next().unwrap_or(base);
    let base = base.strip_suffix(".exe").or_else(|| base.strip_suffix(".EXE")).unwrap_or(base);
    if base.is_empty() { "Mídia".into() } else { base.to_string() }
}

#[cfg(test)]
mod tests {
    use super::app_name;

    #[test]
    fn nomes_conhecidos() {
        assert_eq!(app_name("Spotify.exe"), "Spotify");
        assert_eq!(app_name("SpotifyAB.SpotifyMusic_zpdnekdrzrea0!Spotify"), "Spotify");
        assert_eq!(app_name("308046B0AF4A39CB"), "Firefox");
        assert_eq!(app_name("firefox.exe"), "Firefox");
    }

    #[test]
    fn nome_desconhecido_fica_limpo() {
        assert_eq!(app_name(r"C:\Apps\foobar2000.exe"), "foobar2000");
        assert_eq!(app_name(""), "Mídia");
    }
}
