# HubOS

Meu console dentro do PC: uma interface em tela cheia, com cara de console, por cima do Windows. O PC continua sendo PC: Firefox, Discord, Spotify e Claude abrem na hora.

## Baixar e testar no Windows

Cada envio para a `main` gera o instalador automaticamente:
GitHub → aba **Actions** → último "Build" verde → em **Artifacts**, baixe **HubOS-windows**.
Dentro tem o instalador (`HubOS_..._x64-setup.exe`) e o `hubos.exe` solto.

Atalhos nesta versão: setas / controle navegam, Enter / A abre, Esc / B volta, M ou botão ☰ do controle abre o menu, Q/E (LB/RB) trocam de aba, C (X) troca a capa, F (Y) favorita. Alt+F4 fecha.

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

## O que já funciona (alfa)

- **Biblioteca unificada**: Steam (lida do disco, todos os discos), app Xbox no PC e jogos `.exe` que você adiciona.
- **Início** (fileira de capas com fundo do jogo), **Jogos** (filtros, ordem, busca) e **Detalhes** (números, sessões).
- **Comportamento de console**: abre com o Windows em tela cheia, Ctrl+Alt+H mostra/esconde, botão Guide traz o hub, o hub sai da frente quando o jogo abre e volta quando fecha.
- **Sessões medidas pelo hub** (início, fim, duração) e **Estatísticas** por período.
- **Voltar ao jogo / Fechar jogo**, **Energia** (suspender, reiniciar, desligar, bloquear) e **Área de trabalho**.
- **Apps**: programas e sites de acesso rápido.
- **Capas** pelo SteamGridDB (chave grátis, colada uma vez).
- **Configurações**: tema, cor de destaque, abrir com o Windows.
- **Tocando agora**: mostra a música do Windows (Spotify, navegador) com anterior, tocar/pausar e próxima.
- **Favoritos** (Y no controle, F no teclado) e **Perfil** (resumo, favoritos, recordes, atividade).
- **Diagnóstico** em Configurações: o que o hub achou no PC e o diário (`hubos.log`), com botão de copiar.

- **Conta Steam** (chave grátis em Configurações): jogos não instalados e conquistas.
- **Party**: entrar, sair, mutar e ver quem está nas chamadas do Discord, sem sair do hub (Client ID e Secret de um aplicativo seu, em Configurações).
- **Navegador do hub**: sites (YouTube, Twitch, Kick, Claude) abrem numa tela do próprio hub.

Ainda não: fila/playlists do Spotify, AudioHub, Loja, HowLongToBeat, Notificações e RetroAchievements.

## Outros arquivos

- `DECISOES.md`: todas as decisões de UX/UI e de arquitetura, uma por linha, com data.
- `prototipos/home-v2.html`: protótipo navegável de todas as telas (referência de desenho; o visual final é o do app).

## Stack decidida

- **Tauri 2** (Rust + WebView2) com **React** na interface.
- **AudioHub** (Python, repositório próprio) continua sendo o motor de áudio; o HubOS desenha a interface dele por uma API local.

## Fontes de dados planejadas

Steam (arquivos locais + Web API), app Xbox no PC, RetroAchievements, jogos `.exe` (sessões medidas pelo próprio hub), SteamGridDB (capas), HowLongToBeat, comparador de preços para a Loja, Spotify (controle de mídia do Windows + API), Discord (RPC local).
