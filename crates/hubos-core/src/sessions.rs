//! Sessões de jogo gravadas pelo hub (uma por linha em `sessions.jsonl`).
//! É daqui que saem as estatísticas que não dependem de loja nenhuma.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Session {
    /// Id do jogo, ex.: `steam:730`.
    pub game: String,
    /// Início e fim em segundos Unix.
    pub start: u64,
    pub end: u64,
}

impl Session {
    pub fn seconds(&self) -> u64 {
        self.end.saturating_sub(self.start)
    }
}

/// Lê o arquivo inteiro, ignorando linhas quebradas (ex.: PC desligou no meio).
pub fn parse(text: &str) -> Vec<Session> {
    text.lines().filter_map(|l| serde_json::from_str::<Session>(l.trim()).ok()).filter(|s| s.end > s.start).collect()
}

/// Sessões de um jogo, da mais recente para a mais antiga.
pub fn for_game(all: &[Session], game: &str) -> Vec<Session> {
    let mut v: Vec<Session> = all.iter().filter(|s| s.game == game).cloned().collect();
    v.sort_by(|a, b| b.start.cmp(&a.start));
    v
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn le_linhas_e_ignora_lixo() {
        let text = "{\"game\":\"steam:730\",\"start\":100,\"end\":400}\nlinha quebrada\n{\"game\":\"steam:1\",\"start\":5,\"end\":5}\n{\"game\":\"steam:730\",\"start\":900,\"end\":1000}\n";
        let all = parse(text);
        assert_eq!(all.len(), 2, "linha quebrada e sessão de duração zero ficam de fora");
        let cs = for_game(&all, "steam:730");
        assert_eq!(cs[0].start, 900);
        assert_eq!(cs.iter().map(Session::seconds).sum::<u64>(), 400);
    }
}
