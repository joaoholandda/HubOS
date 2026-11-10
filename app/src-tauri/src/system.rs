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
