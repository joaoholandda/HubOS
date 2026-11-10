# HubOS / GameHub: diário de decisões

## Acordo de trabalho
- Construímos juntos, do zero. O doc do Gemini é só referência, não é contrato.
- A cada decisão relevante: apresentar alternativas + recomendação, e o usuário decide.
- Toda decisão tomada é registrada aqui (data, opções, escolha, motivo).

## Visão (requisitos do usuário)
- O PDF do Gemini NÃO é padrão: muita coisa dele pode ser descartada.
- Cara de console no PC, mas SEM deixar de ser PC: Firefox, Discord etc. com acesso instantâneo.
- Sobe sozinho com o PC (que quase nunca desliga) e assume a cara de console.
- Discord INTEGRADO (obrigatório), no estilo party do Xbox/PlayStation.
- Biblioteca unificada com capas: .exe avulso, Steam, Epic e emulação lado a lado.
- Fluidez é o requisito nº 1. Mouse, teclado e controle são cidadãos de primeira classe.
- Dados e estatísticas: horas, conquistas (Steam, RetroAchievements?), sessões dos .exe.
- Perfil de usuário.
- Plataforma de VÁRIOS hubs (GameHub, AudioHub, ...) com a cara do usuário.

## Decisões
| # | Tema | Status | Escolha | Data |
|---|------|--------|---------|------|
| 1 | Stack (tecnologia base) | DECIDIDO | Tauri 2 (Rust + WebView2) | 2026-11-10 |
| 2 | Como o "modo console" convive com o Windows | DECIDIDO | App em tela cheia por cima do Explorer (sem trocar o shell) | 2026-11-10 |
| 3 | Estratégia de integração do Discord | direção definida | Party do Discord DENTRO do hub (via RPC local); nada dentro do jogo. Plano B: Discord web no Firefox | 2026-11-10 |
| 4 | Arquitetura multi-hub / AudioHub | em aberto | AudioHub = Python + PySide6 (repo joaoholandda/AudioHub) | |
| 5 | Padrão de controle | DECIDIDO | Layout Xbox (A/B/X/Y, LB/RB, View/Menu, Guide) | 2026-11-10 |
| 6 | Modo de tela dos jogos | DECIDIDO | Jogos abrem em tela cheia (sem janela, por input lag) | 2026-11-10 |
| 7 | Fonte de conquistas retrô | DECIDIDO | RetroAchievements | 2026-11-10 |
| 9 | Overlay dentro do jogo | DECIDIDO | NÃO existe. O hub é "pré-jogo"; durante o jogo, Alt+Tab ou Guide volta ao hub | 2026-11-10 |
| 10 | Botão Guide | DECIDIDO | Traz o hub para frente (desligar o atalho da Game Bar no Windows) | 2026-11-10 |
| 11 | Framework da interface | DECIDIDO | React (maturidade; Steam Deck/Big Picture usam React) | 2026-11-10 |
| 12 | Atalho de teclado do hub | DECIDIDO | Configurável no hub e no AudioHub; padrão: hub Ctrl+Alt+H, AudioHub muda para Ctrl+Alt+A | 2026-11-10 |
| 15 | Comprar/baixar jogos | DECIDIDO | Loja generalista DENTRO do hub (catálogo, preços entre lojas, desejos); download via launchers com progresso no hub | 2026-11-10 |
| 13 | Perfil | DECIDIDO | Perfil único (só o usuário, PC de uma pessoa) | 2026-11-10 |
| 14 | Layout da home | DECIDIDO (com ajustes pendentes) | Conceito Fileira + menu lateral (Biblioteca, Loja, Arquivos, Configurações...) | 2026-11-10 |
| 16 | Rodapé de legenda dos botões | DECIDIDO | Removido | 2026-11-10 |
| 17 | Itens do menu | DECIDIDO | Início, Jogos, Apps, Loja, Downloads, Party, Áudio, Claude, Estatísticas, Arquivos, Configurações, Área de trabalho, Energia | 2026-11-10 |
| 18 | Apps / sites | DECIDIDO | Tela Apps: sites (YouTube, Twitch, Kick...) abrem em aba do Firefox; programas pré-abertos; dá para adicionar | 2026-11-10 |
| 19 | Claude no hub | DECIDIDO | Item do menu abre o app do Claude (ou claude.ai no Firefox) pré-aberto, em janela compacta. Sem API | 2026-11-10 |
| 20 | Estilo do menu | DECIDIDO | Gaveta escondida, aberta por botão ☰ visível no canto superior esquerdo | 2026-11-10 |
| 21 | Home (Fileira) | DECIDIDO | Aprovada como está | 2026-11-10 |
| 22 | Spotify | DECIDIDO | Chip "tocando agora" + painel. Base: controle de mídia do Windows (SMTC); usuário tem Premium, então API do Spotify para fila/playlists | 2026-11-10 |
| 23 | Próximas telas | DECIDIDO | Jogos (biblioteca) → Detalhes do jogo | 2026-11-10 |
| 24 | Botão Voltar | DECIDIDO | Botão "← Voltar" visível na barra (mouse/teclado) + B no controle + botão lateral do mouse | 2026-11-10 |
| 25 | Trocar capa | DECIDIDO | Pelo ⋯ do jogo E numa seção de Configurações (capas e artes) | 2026-11-10 |
| 26 | A na biblioteca | DECIDIDO | A abre detalhes; na home, A joga direto | 2026-11-10 |
| 27 | Não instalados | DECIDIDO | Aparecem em "Todos", apagados com "Baixar" | 2026-11-10 |
| 28 | Busca com controle | DECIDIDO (baixa prioridade) | Teclado virtual; uso principal será teclado físico | 2026-11-10 |
| 29 | Ordem das próximas telas | DECIDIDO | Estatísticas → Configurações → Perfil → Loja | 2026-11-10 |
| 30 | Estatísticas gerais | DECIDIDO | Comparação c/ período anterior, tendência 12 semanas, horário típico, tamanho de sessão, dias seguidos, abandonados, perto de completar, top 10 de sempre, gêneros, jogo do período, conquistas/mês, raras, pontos RetroAchievements, música enquanto joga, período personalizado (de/até) | 2026-11-10 |
| 31 | Estatísticas fora | DECIDIDO | Sem madrugadas, sem tempo de apps (Firefox/Discord NÃO entram), sem backlog, sem % médio, sem Discord social, sem retrospectiva anual, sem lembrete de pausa | 2026-11-10 |
| 32 | Estatísticas por jogo | DECIDIDO | Aba Estatísticas no jogo: linha do tempo, HowLongToBeat, custo por hora, economia | 2026-11-10 |
| 33 | Plataformas | DECIDIDO | Foco: Steam, Xbox (app/Game Pass), RetroAchievements e .exe. Epic quase não usa (só Rocket League) | 2026-11-10 |
| 35 | Xbox | DECIDIDO | Joga no PC, abrindo pelo hub; hub detecta/abre jogos do app Xbox e mede o tempo | 2026-11-10 |
| 36 | Configurações: layout | DECIDIDO | Lista de seções à esquerda + conteúdo à direita | 2026-11-10 |
| 37 | Configurações: seções | DECIDIDO | Aparência (tema, destaque, wallpaper), Capas e artes, Biblioteca, Contas, Apps instantâneos, Controle, Atalhos, Inicialização, Áudio (EQ do AudioHub dentro), Notificações (desativáveis), Desempenho, Dados e backup, Sobre | 2026-11-10 |
| 38 | Aparência | DECIDIDO | Claro/escuro/auto + cor de destaque + wallpaper próprio (ou arte do jogo / cor sólida) | 2026-11-10 |
| 39 | Capas | DECIDIDO | Opções SteamGridDB + imagem própria + modo revisar capas | 2026-11-10 |
| 40 | Controle | DECIDIDO | Mapeamento fixo padrão Xbox | 2026-11-10 |
| 41 | Apps instantâneos | DECIDIDO | Firefox, Discord, Spotify, Claude pré-abertos; cada um pode ser desligado/fechado; opção de liberar memória ao jogar | 2026-11-10 |
| 42 | Inicialização | DECIDIDO | Abre direto em tela cheia com o Windows | 2026-11-10 |
| 43 | Backup | DECIDIDO | Automático (nuvem ou pasta), exportar/restaurar após formatar; jogos identificados por impressão digital (inclusive .exe) para manter horas | 2026-11-10 |
| 44 | Valor da biblioteca | ADIADO | Fora por enquanto | 2026-11-10 |
| 45 | RAM / liberar memória | DECIDIDO | PC tem 16 GB; "liberar memória ao jogar" vem desligado por padrão | 2026-11-10 |
| 46 | AudioHub dentro do hub | DECIDIDO | AudioHub (Python) segue como motor invisível; o hub desenha a interface via API local | 2026-11-10 |
| 47 | Perfil | DECIDIDO | Nome "João Holanda"; avatar da Steam/Xbox; banner com imagem própria; sem XP próprio (mostra nível Steam, Gamerscore Xbox, pontos RA); sem medalhas; vitrine (jogando agora, 5 favoritos, conquistas raras, recordes, música favorita); contas com copiar/abrir; resumo + linha do tempo de atividade | 2026-11-10 |
| 48 | Loja | DECIDIDO | Comparador entre lojas (Steam, Xbox, GOG, Epic, lojas de chave); início com Recomendados + Promoções + Lista de desejos; atalho fácil para a loja da Steam; desejos Steam + hub | 2026-11-10 |
| 49 | Loja: extras | DECIDIDO | Alerta de preço, histórico de preço, imagens/trailer, Metacritic e HowLongToBeat (com custo por hora) na página do jogo | 2026-11-10 |
| 50 | Repositório | DECIDIDO | github.com/joaoholandda/HubOS (privado) | 2026-11-10 |
| 51 | Estado "em jogo" | DECIDIDO (padrão proposto) | Faixa na home + chip na barra com tempo de sessão; Voltar ao jogo / Fechar jogo (confirma 2x) | 2026-11-10 |
| 52 | Downloads | DECIDIDO (padrão proposto) | Tela com baixando/fila/concluídos; pausar, priorizar, cancelar; chip de % na barra; Instalar coloca na fila | 2026-11-10 |
| 53 | Notificações | DECIDIDO (padrão proposto) | Cartões no canto superior direito + central (sino com contador) | 2026-11-10 |
| 54 | Energia | DECIDIDO (padrão proposto) | Suspender, reiniciar, desligar (com confirmação), bloquear, sair do modo console | 2026-11-10 |
| 55 | Adicionar .exe | DECIDIDO (padrão proposto) | Escolher arquivo, nome automático, capa entre opções, argumentos | 2026-11-10 |
| 56 | Primeira configuração | DECIDIDO (padrão proposto) | 6 passos: boas-vindas, restaurar backup, contas, pastas, aparência, pronto | 2026-11-10 |
| 57 | Abertura, erros, emuladores | DECIDIDO (padrão proposto) | Splash curto; avisos de offline/Steam fora/jogo não abriu; emulador por console em Biblioteca | 2026-11-10 |
| 58 | Busca de capas | DECIDIDO | SteamGridDB dentro do hub (grade de opções, chave grátis do usuário). Sem Google Imagens | 2026-11-10 |
| 59 | Escala de cantos | DECIDIDO | Só 4 raios: 8px (tags, badges, botões secundários), 14px (capas, menu, botões, campos), 22px (painéis, modais, menu lateral, chips), redondo (avatares, busca, indicadores) | 2026-11-10 |
| 60 | Fontes | DECIDIDO | Sora (títulos) + Plus Jakarta Sans (texto) | 2026-11-10 |
| 61 | Cores | DECIDIDO | NADA de verde. Botão principal monocromático (tinta do tema); ícones do controle só em contorno; capas provisórias em grafite neutro | 2026-11-10 |
| 62 | Direção visual | DECIDIDO | O mais profissional possível: foco em anel duplo, tipografia ajustada, poucas cores | 2026-11-10 |
| 63 | Alfa: o que entra | DECIDIDO | Steam, Xbox e .exe na biblioteca; home, Jogos, Detalhes, Apps, Estatísticas, Configurações, Energia; Ctrl+Alt+H e Guide; sessões medidas; capas SteamGridDB. Ficam para depois: Party/Discord, Spotify, AudioHub, Loja, Downloads, Perfil, Notificações, RetroAchievements | 2026-11-10 |
| 8 | Firefox / apps instantâneos | DECIDIDO | Mantém o app aberto e escondido; ao clicar, só traz a janela para frente | 2026-11-10 |
| 64 | Tocando agora | DECIDIDO | Chip na barra de cima + painel com capa e anterior/tocar/próxima, lendo a mídia do Windows (vale para Spotify, Firefox etc.). Fila e playlists (API do Spotify) ficam para depois | 2026-11-10 |
| 65 | Favoritos | DECIDIDO | Y no controle (F no teclado) em qualquer capa; estrela na capa; filtro "Favoritos" em Jogos; até 5 na vitrine do Perfil | 2026-11-10 |
| 66 | Perfil (1ª versão) | DECIDIDO | Só dados locais: resumo, favoritos, recordes e atividade recente. Avatar/banner e níveis Steam/Xbox/RA entram com as contas | 2026-11-10 |
| 67 | Diagnóstico | DECIDIDO | Configurações › Diagnóstico mostra o que foi achado, se o atalho e o Guide funcionam e o diário (`hubos.log`), com botão de copiar | 2026-11-10 |
| 68 | Menu: itens provisórios | DECIDIDO | Party abre o Discord, Downloads abre os downloads da Steam, Claude e Arquivos abrem os programas. Loja e Áudio seguem como "em breve" | 2026-11-10 |
