# HubOS

Meu console dentro do PC: uma interface em tela cheia, com cara de console, por cima do Windows. O PC continua sendo PC: Firefox, Discord, Spotify e Claude abrem na hora.

## Baixar e testar no Windows

Cada envio para a `main` gera o instalador automaticamente:
GitHub → aba **Actions** → último "Build" verde → em **Artifacts**, baixe **HubOS-windows**.
Dentro tem o instalador (`HubOS_..._x64-setup.exe`) e o `hubos.exe` solto.

Atalhos nesta versão: setas / controle navegam, Enter / A abre, Esc / B volta, M ou botão ☰ do controle abre o menu. Alt+F4 fecha.

## Rodar a partir do código (no Windows)

Precisa de [Node 22](https://nodejs.org) e [Rust](https://rustup.rs).

```bash
cd app
npm install
npm run tauri dev
```

`npm run dev` sozinho abre só a interface no navegador, com jogos de exemplo.

## Estrutura

- `crates/hubos-core`: lógica sem interface (leitor de `.vdf`, biblioteca da Steam). Testes: `cargo test -p hubos-core`.
- `app/src-tauri`: lado Rust do app (comandos chamados pela interface).
- `app/src`: interface em React. `nav/` tem o motor de foco e a entrada (teclado, mouse, controle).

## O que tem aqui hoje

- `DECISOES.md`: todas as decisões de UX/UI e de arquitetura, uma por linha, com data.
- `prototipos/home-v2.html`: protótipo navegável de todas as telas (abre direto no navegador; funciona com mouse, teclado e controle Xbox).
- `prototipos/home-conceitos.html`: os 3 conceitos de home comparados no início (escolhido: Fileira).

## Stack decidida

- **Tauri 2** (Rust + WebView2) com **React** na interface.
- **AudioHub** (Python, repositório próprio) continua sendo o motor de áudio; o HubOS desenha a interface dele por uma API local.

## Fontes de dados planejadas

Steam (arquivos locais + Web API), app Xbox no PC, RetroAchievements, jogos `.exe` (sessões medidas pelo próprio hub), SteamGridDB (capas), HowLongToBeat, comparador de preços para a Loja, Spotify (controle de mídia do Windows + API), Discord (RPC local).
