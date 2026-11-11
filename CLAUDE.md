# HubOS

Interface de console em tela cheia para Windows (Tauri 2 + React + TypeScript). Dono: uma pessoa só, PC único.

## Regras
- Responder sempre em português do Brasil, tom direto.
- Toda decisão de UX/arquitetura vai para `DECISOES.md` (uma linha por decisão). Ler antes de propor algo já decidido.
- Design: sem verde em lugar nenhum; botão principal monocromático; raios só `--r-sm/md/lg/pill`; fontes Sora (títulos) e Plus Jakarta Sans (texto). Visual profissional e sóbrio.
- Tudo navegável por controle (layout Xbox), teclado e mouse: elementos focáveis levam `data-nav`; foco é o atributo `data-focused`.
- Só animar `transform` e `opacity`.
- `prototipos/` é referência histórica; o visual que vale é o do app.

## Estrutura
- `crates/hubos-core`: lógica pura, testável no Linux (`cargo test -p hubos-core`).
- `app/src-tauri/src`: comandos Tauri (`lib.rs`), console/sessões, capas, apps, Xbox, mídia, diário (`log.rs`).
- `app/src`: React. `lib/api.ts` é a ponte (com dados de exemplo fora do Tauri), `nav/` é foco e entrada, `components/` são as telas.

## Conferir antes de enviar
```bash
cargo test -p hubos-core
cargo check -p hubos --target x86_64-pc-windows-msvc
cd app && npx tsc --noEmit -p . && npm run build
```
O app não roda no Linux (só a interface, com `npm run dev`). O instalador sai do GitHub Actions (artifact `HubOS-windows`) a cada envio para a `main`.

## Estado
O dono já testou a primeira alfa no Windows (base funciona). Ainda sem teste real: conta Steam (chave), Party do Discord (RPC local), navegador do hub (janela filha), mídia do Windows. Uso principal é teclado e mouse; controle é secundário. Nunca colocar chaves no repositório: elas ficam em `settings.json` na pasta de dados. Pendente: HowLongToBeat, API do Spotify, AudioHub (adiado), Loja, Notificações, RetroAchievements.
