# HubOS

Meu console dentro do PC: uma interface em tela cheia, com cara de console, por cima do Windows. O PC continua sendo PC: Firefox, Discord, Spotify e Claude abrem na hora.

## O que tem aqui hoje

- `DECISOES.md`: todas as decisões de UX/UI e de arquitetura, uma por linha, com data.
- `prototipos/home-v2.html`: protótipo navegável de todas as telas (abre direto no navegador; funciona com mouse, teclado e controle Xbox).
- `prototipos/home-conceitos.html`: os 3 conceitos de home comparados no início (escolhido: Fileira).

## Stack decidida

- **Tauri 2** (Rust + WebView2) com **React** na interface.
- **AudioHub** (Python, repositório próprio) continua sendo o motor de áudio; o HubOS desenha a interface dele por uma API local.

## Fontes de dados planejadas

Steam (arquivos locais + Web API), app Xbox no PC, RetroAchievements, jogos `.exe` (sessões medidas pelo próprio hub), SteamGridDB (capas), HowLongToBeat, comparador de preços para a Loja, Spotify (controle de mídia do Windows + API), Discord (RPC local).
