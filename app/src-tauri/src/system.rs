//! Ações do sistema: energia, abrir programas e fechar jogos.

use std::process::Command;

/// Roda um comando sem piscar janela de console no Windows.
fn quiet(program: &str) -> Command {
    #[allow(unused_mut)]
    let mut c = Command::new(program);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        c.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
    }
    c
}

/// Suspender, reiniciar, desligar ou bloquear o PC.
pub fn power(action: &str) -> Result<(), String> {
    let mut cmd = match action {
        "sleep" => {
            let mut c = quiet("rundll32.exe");
            c.args(["powrprof.dll,SetSuspendState", "0,1,0"]);
            c
        }
        "restart" => {
            let mut c = quiet("shutdown");
            c.args(["/r", "/t", "0"]);
            c
        }
        "off" => {
            let mut c = quiet("shutdown");
            c.args(["/s", "/t", "0"]);
            c
        }
        "lock" => {
            let mut c = quiet("rundll32.exe");
            c.arg("user32.dll,LockWorkStation");
            c
        }
        other => return Err(format!("Ação de energia desconhecida: {other}")),
    };
    cmd.spawn().map(|_| ()).map_err(|e| format!("Não consegui executar: {e}"))
}

/// Abre um programa pelo nome ou caminho, como o "Executar" do Windows
/// (acha `firefox`, `spotify` etc. pelo registro de aplicativos).
pub fn start(target: &str) -> Result<(), String> {
    let mut c = quiet("cmd");
    c.args(["/C", "start", "", target]);
    c.spawn().map(|_| ()).map_err(|e| format!("Não consegui abrir {target}: {e}"))
}

/// Abre o Discord sem trazer a janela dele para a frente (fica na bandeja).
pub fn start_discord_hidden() -> Result<(), String> {
    let local = std::env::var("LOCALAPPDATA").map_err(|_| "Não achei a pasta do Discord.".to_string())?;
    let updater = std::path::Path::new(&local).join("Discord").join("Update.exe");
    if !updater.is_file() {
        return Err("O Discord não está instalado neste PC.".into());
    }
    quiet(&updater.to_string_lossy()).args(["--processStart", "Discord.exe", "--process-start-args", "--start-minimized"]).spawn().map(|_| ()).map_err(|e| format!("Não consegui abrir o Discord: {e}"))
}

/// Fecha um processo e os filhos dele.
pub fn kill_pid(pid: u32) -> Result<(), String> {
    quiet("taskkill").args(["/PID", &pid.to_string(), "/T", "/F"]).spawn().map(|_| ()).map_err(|e| e.to_string())
}

/// Fecha todo processo cujo executável mora dentro da pasta do jogo.
/// É assim que fechamos jogos da Steam, que não nos dão o PID.
pub fn kill_in_dir(dir: &str) -> Result<usize, String> {
    use sysinfo::System;
    let norm = |s: &str| s.replace('/', "\\").trim_end_matches('\\').to_ascii_lowercase();
    let dir = norm(dir);
    if dir.len() < 4 {
        return Err("Pasta do jogo inválida".into());
    }
    let sys = System::new_all();
    let mut n = 0;
    for p in sys.processes().values() {
        let Some(exe) = p.exe() else { continue };
        if norm(&exe.to_string_lossy()).starts_with(&format!("{dir}\\")) && p.kill() {
            n += 1;
        }
    }
    Ok(n)
}

/// Nome do arquivo do executável de um processo.
fn exe_name(p: &sysinfo::Process) -> String {
    p.exe().and_then(|e| e.file_name()).map(|n| n.to_string_lossy().into_owned()).unwrap_or_else(|| std::path::Path::new(p.name()).to_string_lossy().into_owned())
}

/// Existe algum processo com esse nome de executável?
pub fn is_running(exe: &str) -> bool {
    use sysinfo::{ProcessRefreshKind, RefreshKind, System};
    let sys = System::new_with_specifics(RefreshKind::new().with_processes(ProcessRefreshKind::everything()));
    sys.processes().values().any(|p| exe_name(p).eq_ignore_ascii_case(exe))
}

/// Fecha os processos com esse nome de executável.
pub fn kill_by_name(exe: &str) -> Result<usize, String> {
    let sys = sysinfo::System::new_all();
    Ok(sys.processes().values().filter(|p| exe_name(p).eq_ignore_ascii_case(exe) && p.kill()).count())
}

/// Roda um script do PowerShell escondido e devolve o que ele escreveu.
pub fn powershell(script: &str) -> Result<String, String> {
    let out = quiet("powershell").args(["-NoProfile", "-NonInteractive", "-Command", script]).output().map_err(|e| format!("PowerShell não respondeu: {e}"))?;
    Ok(String::from_utf8_lossy(&out.stdout).into_owned())
}

/// Abre um app da Microsoft Store pelo endereço `shell:AppsFolder\...`.
pub fn open_shell(target: &str) -> Result<(), String> {
    quiet("explorer.exe").arg(target).spawn().map(|_| ()).map_err(|e| format!("Não consegui abrir: {e}"))
}
