//! Diário do hub: um arquivo de texto (`hubos.log`) na pasta de dados.
//! Serve para descobrir o que aconteceu quando algo não funciona no PC:
//! a tela Configurações › Diagnóstico mostra as últimas linhas.

use std::fs::OpenOptions;
use std::io::Write;
use std::path::PathBuf;
use std::sync::OnceLock;

use tauri::{AppHandle, Manager};

static PATH: OnceLock<PathBuf> = OnceLock::new();
const MAX_BYTES: u64 = 512 * 1024;

/// Define onde o diário fica. Se ele já está grande, guarda o antigo em `.1`.
pub fn init(app: &AppHandle) {
    let Ok(dir) = app.path().app_data_dir() else { return };
    let _ = std::fs::create_dir_all(&dir);
    let path = dir.join("hubos.log");
    if std::fs::metadata(&path).map(|m| m.len() > MAX_BYTES).unwrap_or(false) {
        let _ = std::fs::rename(&path, dir.join("hubos.log.1"));
    }
    let _ = PATH.set(path);
}

/// Escreve uma linha com data e hora (UTC).
pub fn log(msg: impl AsRef<str>) {
    let line = format!("[{}] {}", stamp(crate::console::now()), msg.as_ref());
    eprintln!("[HubOS] {}", msg.as_ref());
    let Some(path) = PATH.get() else { return };
    if let Ok(mut f) = OpenOptions::new().create(true).append(true).open(path) {
        let _ = writeln!(f, "{line}");
    }
}

/// Últimas `n` linhas do diário.
pub fn tail(n: usize) -> Vec<String> {
    let text = PATH.get().and_then(|p| std::fs::read_to_string(p).ok()).unwrap_or_default();
    let lines: Vec<&str> = text.lines().collect();
    lines[lines.len().saturating_sub(n)..].iter().map(|s| s.to_string()).collect()
}

/// "2026-11-10 14:03:22" a partir de segundos Unix, sem depender de bibliotecas de data.
fn stamp(unix: u64) -> String {
    let (days, rem) = ((unix / 86400) as i64, unix % 86400);
    // Algoritmo de Howard Hinnant (dias desde 1970 → ano/mês/dia).
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z.rem_euclid(146_097);
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = yoe + era * 400 + i64::from(m <= 2);
    format!("{y:04}-{m:02}-{d:02} {:02}:{:02}:{:02}", rem / 3600, rem % 3600 / 60, rem % 60)
}

#[cfg(test)]
mod tests {
    #[test]
    fn data_e_hora() {
        assert_eq!(super::stamp(0), "1970-01-01 00:00:00");
        assert_eq!(super::stamp(1_794_319_402), "2026-11-10 14:03:22");
        assert_eq!(super::stamp(951_782_400), "2000-02-29 00:00:00");
    }
}
