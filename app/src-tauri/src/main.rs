// Sem janela de console no Windows nas versões de release.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    hubos_lib::run()
}
