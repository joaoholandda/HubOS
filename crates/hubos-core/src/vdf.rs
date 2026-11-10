//! Leitor do formato KeyValues em texto da Valve (`.vdf` / `.acf`).
//!
//! Exemplo:
//! ```text
//! "AppState"
//! {
//!     "appid"   "730"
//!     "name"    "Counter-Strike 2"
//! }
//! ```
//! Chaves são comparadas sem diferenciar maiúsculas, como a própria Steam faz.

#[derive(Debug, Clone, PartialEq)]
pub enum Vdf {
    Str(String),
    Obj(Vec<(String, Vdf)>),
}

impl Vdf {
    /// Filho pela chave, sem diferenciar maiúsculas.
    pub fn get(&self, key: &str) -> Option<&Vdf> {
        match self {
            Vdf::Obj(items) => items
                .iter()
                .find(|(k, _)| k.eq_ignore_ascii_case(key))
                .map(|(_, v)| v),
            Vdf::Str(_) => None,
        }
    }

    /// Caminho de chaves, ex.: `["Software", "Valve", "Steam", "apps"]`.
    pub fn path(&self, keys: &[&str]) -> Option<&Vdf> {
        keys.iter().try_fold(self, |node, k| node.get(k))
    }

    pub fn str(&self, key: &str) -> Option<&str> {
        match self.get(key)? {
            Vdf::Str(s) => Some(s.as_str()),
            Vdf::Obj(_) => None,
        }
    }

    pub fn entries(&self) -> &[(String, Vdf)] {
        match self {
            Vdf::Obj(items) => items,
            Vdf::Str(_) => &[],
        }
    }
}

#[derive(Debug, PartialEq)]
pub struct ParseError {
    pub message: String,
    pub offset: usize,
}

impl std::fmt::Display for ParseError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{} (posição {})", self.message, self.offset)
    }
}

impl std::error::Error for ParseError {}

/// Lê o documento inteiro. O resultado é sempre um objeto com as chaves de topo.
pub fn parse(input: &str) -> Result<Vdf, ParseError> {
    let mut p = Parser { s: input.as_bytes(), i: 0 };
    let items = p.object_body(false)?;
    Ok(Vdf::Obj(items))
}

struct Parser<'a> {
    s: &'a [u8],
    i: usize,
}

enum Tok {
    Str(String),
    Open,
    Close,
    Eof,
}

impl Parser<'_> {
    fn err<T>(&self, message: &str) -> Result<T, ParseError> {
        Err(ParseError { message: message.to_string(), offset: self.i })
    }

    fn skip_ws(&mut self) {
        loop {
            while self.i < self.s.len() && self.s[self.i].is_ascii_whitespace() {
                self.i += 1;
            }
            if self.s[self.i..].starts_with(b"//") {
                while self.i < self.s.len() && self.s[self.i] != b'\n' {
                    self.i += 1;
                }
                continue;
            }
            // Condicionais como [$WIN32] aparecem em alguns arquivos; ignoramos.
            if self.i < self.s.len() && self.s[self.i] == b'[' {
                while self.i < self.s.len() && self.s[self.i] != b']' {
                    self.i += 1;
                }
                self.i = (self.i + 1).min(self.s.len());
                continue;
            }
            break;
        }
    }

    fn token(&mut self) -> Result<Tok, ParseError> {
        self.skip_ws();
        let Some(&c) = self.s.get(self.i) else { return Ok(Tok::Eof) };
        match c {
            b'{' => {
                self.i += 1;
                Ok(Tok::Open)
            }
            b'}' => {
                self.i += 1;
                Ok(Tok::Close)
            }
            b'"' => {
                self.i += 1;
                let mut out = Vec::new();
                loop {
                    let Some(&c) = self.s.get(self.i) else { return self.err("texto sem aspas de fechamento") };
                    self.i += 1;
                    match c {
                        b'"' => break,
                        b'\\' => {
                            let Some(&e) = self.s.get(self.i) else { return self.err("escape no fim do arquivo") };
                            self.i += 1;
                            match e {
                                b'n' => out.push(b'\n'),
                                b't' => out.push(b'\t'),
                                b'\\' => out.push(b'\\'),
                                b'"' => out.push(b'"'),
                                other => {
                                    out.push(b'\\');
                                    out.push(other);
                                }
                            }
                        }
                        other => out.push(other),
                    }
                }
                Ok(Tok::Str(String::from_utf8_lossy(&out).into_owned()))
            }
            _ => {
                // Texto sem aspas (raro, mas válido).
                let start = self.i;
                while self.i < self.s.len() && !self.s[self.i].is_ascii_whitespace() && !matches!(self.s[self.i], b'{' | b'}' | b'"') {
                    self.i += 1;
                }
                Ok(Tok::Str(String::from_utf8_lossy(&self.s[start..self.i]).into_owned()))
            }
        }
    }

    fn object_body(&mut self, nested: bool) -> Result<Vec<(String, Vdf)>, ParseError> {
        let mut items = Vec::new();
        loop {
            match self.token()? {
                Tok::Eof if nested => return self.err("faltou fechar um bloco com }"),
                Tok::Eof => return Ok(items),
                Tok::Close if nested => return Ok(items),
                Tok::Close => return self.err("} sobrando"),
                Tok::Open => return self.err("{ sem chave antes"),
                Tok::Str(key) => match self.token()? {
                    Tok::Str(v) => items.push((key, Vdf::Str(v))),
                    Tok::Open => {
                        let child = self.object_body(true)?;
                        items.push((key, Vdf::Obj(child)));
                    }
                    _ => return self.err("chave sem valor"),
                },
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn le_manifesto_da_steam() {
        let doc = parse(
            r#"
            "AppState"
            {
                "appid"		"730"
                "name"		"Counter-Strike 2"
                "StateFlags"		"4"
                // comentário
                "UserConfig" { "language" "brazilian" }
            }"#,
        )
        .unwrap();
        let app = doc.get("appstate").unwrap();
        assert_eq!(app.str("APPID"), Some("730"));
        assert_eq!(app.str("name"), Some("Counter-Strike 2"));
        assert_eq!(app.path(&["UserConfig"]).unwrap().str("language"), Some("brazilian"));
    }

    #[test]
    fn trata_barras_de_caminho_do_windows() {
        let doc = parse(r#""libraryfolders" { "0" { "path" "C:\\Program Files (x86)\\Steam" } }"#).unwrap();
        let path = doc.path(&["libraryfolders", "0"]).unwrap().str("path");
        assert_eq!(path, Some(r"C:\Program Files (x86)\Steam"));
    }

    #[test]
    fn aponta_erro_em_bloco_aberto() {
        assert!(parse(r#""a" { "b" "c" "#).is_err());
    }
}
