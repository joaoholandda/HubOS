//! Jogos do app Xbox: pergunta ao Windows quais pacotes são jogos, abre pelo
//! endereço da loja e acompanha o processo para medir a sessão.

use std::collections::HashMap;
use std::sync::Mutex;
use std::time::Duration;

use hubos_core::{xbox, Game};
use tauri::{AppHandle, Manager};

use crate::{console, system};

/// id do jogo → nome do executável (para saber quando está rodando).
#[derive(Default)]
pub struct XboxState(pub Mutex<HashMap<String, String>>);

const LIST_GAMES: &str = "$ErrorActionPreference='SilentlyContinue'; [Console]::OutputEncoding=[Text.Encoding]::UTF8; Get-AppxPackage | Where-Object { -not $_.IsFramework -and $_.InstallLocation -and (Test-Path (Join-Path $_.InstallLocation 'MicrosoftGame.config')) } | ForEach-Object { [pscustomobject]@{ Name=$_.Name; Pfn=$_.PackageFamilyName; Dir=$_.InstallLocation } } | ConvertTo-Json -Compress";

pub fn scan(app: &AppHandle) -> Result<Vec<Game>, String> {
    let json = system::powershell(LIST_GAMES)?;
    let mut games = Vec::new();
    let mut exes = HashMap::new();
    for pkg in xbox::parse_packages(&json) {
        let Ok(xml) = std::fs::read_to_string(std::path::Path::new(&pkg.dir).join("MicrosoftGame.config")) else { continue };
        let cfg = xbox::parse_config(&xml);
        let game = xbox::to_game(&pkg, &cfg);
        if let Some(exe) = cfg.exe {
            exes.insert(game.id.clone(), exe);
        }
        games.push(game);
    }
    *app.state::<XboxState>().0.lock().unwrap() = exes;
    Ok(games)
}

pub fn exe_of(app: &AppHandle, id: &str) -> Option<String> {
    app.state::<XboxState>().0.lock().unwrap().get(id).cloned()
}

/// Abre o jogo e mede a sessão: espera o processo aparecer e depois sumir.
pub fn launch(app: &AppHandle, id: &str, target: &str) -> Result<(), String> {
    system::open_shell(target)?;
    let Some(exe) = exe_of(app, id) else { return Ok(()) };
    let (app, id) = (app.clone(), id.to_string());
    std::thread::spawn(move || {
        // Até 2 minutos para o jogo aparecer (alguns passam por um launcher).
        let appeared = (0..60).any(|_| {
            std::thread::sleep(Duration::from_secs(2));
            system::is_running(&exe)
        });
        if !appeared {
            return;
        }
        console::set_running(&app, Some(id));
        while system::is_running(&exe) {
            std::thread::sleep(Duration::from_secs(3));
        }
        console::set_running(&app, None);
    });
    Ok(())
}
