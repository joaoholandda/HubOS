import { useCallback, useEffect, useRef, useState } from "react";
import { discordChannels, discordConnect, discordGuilds, discordJoin, discordOpen, discordParty, discordSetVoice, discordStatus, type DiscordStatus, type Guild, type Member, type Party, type VoiceChannel } from "../lib/api";
import { focusEngine } from "../nav/focus";
import { Sheet } from "./Sheet";

/** Traduz os erros internos para uma frase que diz o que fazer. */
function explain(e: unknown): string {
  const s = String(e);
  if (s.includes("DISCORD_CLOSED")) return "O Discord não está aberto neste PC.";
  if (s.includes("NOT_CONFIGURED")) return "Falta colar o Client ID e o Secret em Configurações › Discord.";
  if (s.includes("access_denied")) return "A autorização foi recusada na janela do Discord.";
  return s;
}

function Avatar({ m }: { m: Member }) {
  return <span className="p-avatar">{m.avatarUrl ? <img src={m.avatarUrl} alt="" /> : m.name.slice(0, 1).toUpperCase()}</span>;
}

/** Party: entrar e sair de chamadas do Discord sem sair do hub. */
export function PartySheet({ onClose, onSettings, toast }: { onClose: () => void; onSettings: () => void; toast: (m: string) => void }) {
  const [status, setStatus] = useState<DiscordStatus | null>(null);
  const [party, setParty] = useState<Party | null>(null);
  const [guilds, setGuilds] = useState<Guild[] | null>(null);
  const [guild, setGuild] = useState<Guild | null>(null);
  const [channels, setChannels] = useState<VoiceChannel[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const closedHint = error?.includes("não está aberto");

  const refresh = useCallback(async () => {
    try {
      setParty(await discordParty());
      setError(null);
    } catch (e) {
      setError(explain(e));
      setParty(null);
      setStatus(await discordStatus());
    }
  }, []);

  useEffect(() => {
    discordStatus().then(setStatus);
  }, []);
  // Conectado: acompanha a chamada enquanto o painel estiver aberto.
  const live = !!status?.connected;
  useEffect(() => {
    if (!live) return;
    refresh();
    const t = window.setInterval(refresh, 2500);
    return () => window.clearInterval(t);
  }, [live, refresh]);
  useEffect(() => {
    if (live && !party?.channel && !guilds) discordGuilds().then(setGuilds).catch((e) => setError(explain(e)));
  }, [live, party?.channel, guilds]);

  // O conteúdo troca bastante (lista ↔ chamada): mantém o foco em algo válido.
  const view = !status ? "load" : !status.configured ? "setup" : !live ? "connect" : party?.channel ? "call" : guild ? "channels" : "guilds";
  const lastView = useRef(view);
  useEffect(() => {
    if (lastView.current === view) return;
    lastView.current = view;
    requestAnimationFrame(() => {
      const def = document.querySelector<HTMLElement>(".sheet [data-nav-default]") ?? document.querySelector<HTMLElement>(".sheet [data-nav]");
      if (def) focusEngine.focus(def, { scroll: false });
    });
  }, [view]);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      setError(null);
    } catch (e) {
      const msg = explain(e);
      setError(msg);
      toast(msg);
    } finally {
      setBusy(false);
    }
  };
  const connect = () =>
    run(async () => {
      await discordConnect();
      setStatus(await discordStatus());
    });
  const openGuild = (g: Guild) => {
    setGuild(g);
    setChannels(null);
    run(async () => setChannels(await discordChannels(g.id)));
  };
  const join = (id: string | null) =>
    run(async () => {
      await discordJoin(id);
      await refresh();
    });
  const voice = (what: "mute" | "deaf", on: boolean) =>
    run(async () => {
      await discordSetVoice(what, on);
      await refresh();
    });

  const sub = view === "call" ? `Em chamada · ${party!.channel!.name}` : status?.user ? `Conectado como ${status.user}` : "Chamadas de voz do Discord";

  return (
    <Sheet title="Party" sub={sub} onClose={onClose}>
      {view === "load" && <p className="muted">Carregando…</p>}

      {view === "setup" && (
        <div className="keybox">
          <p>Para o hub controlar as chamadas, o Discord pede um aplicativo seu (grátis, uma vez só):</p>
          <ol>
            <li>discord.com/developers/applications › New Application</li>
            <li>OAuth2 › Redirects: adicione http://localhost</li>
            <li>Copie o Client ID e o Client Secret</li>
            <li>Cole os dois em Configurações › Discord</li>
          </ol>
          <button className="btn primary" data-nav data-nav-default onClick={onSettings}>
            Abrir Configurações
          </button>
        </div>
      )}

      {view === "connect" && (
        <div className="keybox">
          <p>{closedHint ? "O Discord precisa estar aberto no PC. O hub abre ele escondido, sem sair daqui." : "Na primeira vez, o Discord mostra uma janela pedindo autorização. Aceite lá e volte para o hub (Ctrl + Alt + H)."}</p>
          {error && <p className="muted">{error}</p>}
          <div className="btns">
            <button className="btn primary" data-nav data-nav-default disabled={busy} onClick={connect}>
              {busy ? "Conectando…" : "Conectar ao Discord"}
            </button>
            {closedHint && (
              <button className="btn" data-nav onClick={() => run(discordOpen).then(() => toast("Abrindo o Discord. Espere uns segundos e conecte."))}>
                Abrir o Discord
              </button>
            )}
          </div>
        </div>
      )}

      {view === "call" && (
        <>
          <div className="rows">
            {party!.channel!.members.map((m) => (
              <div key={m.id} className="rowline p-member" data-nav tabIndex={-1}>
                <span>
                  <Avatar m={m} />
                  {m.name}
                </span>
                {(m.muted || m.deafened) && <small className="muted">{m.deafened ? "sem som" : "mutado"}</small>}
              </div>
            ))}
          </div>
          <div className="btns">
            <button className="btn" data-nav data-nav-default aria-pressed={party!.mute} disabled={busy} onClick={() => voice("mute", !party!.mute)}>
              {party!.mute ? "Desmutar" : "Mutar"}
            </button>
            <button className="btn" data-nav aria-pressed={party!.deaf} disabled={busy} onClick={() => voice("deaf", !party!.deaf)}>
              {party!.deaf ? "Voltar o som" : "Ensurdecer"}
            </button>
            <button className="btn danger" data-nav disabled={busy} onClick={() => join(null)}>
              Sair da chamada
            </button>
          </div>
        </>
      )}

      {view === "guilds" &&
        (!guilds ? (
          <p className="muted">{error ?? "Carregando servidores…"}</p>
        ) : (
          <>
            <h3 className="eyebrow">Escolha um servidor</h3>
            {guilds.map((g, i) => (
              <button key={g.id} className="opt" data-nav {...(i === 0 ? { "data-nav-default": "" } : {})} onClick={() => openGuild(g)}>
                <span className="p-avatar sq">{g.iconUrl ? <img src={g.iconUrl} alt="" /> : g.name.slice(0, 1).toUpperCase()}</span>
                {g.name}
              </button>
            ))}
          </>
        ))}

      {view === "channels" && (
        <>
          <button className="opt" data-nav onClick={() => setGuild(null)}>
            ‹ Servidores
            <small>{guild!.name}</small>
          </button>
          {!channels ? (
            <p className="muted">{error ?? "Carregando canais…"}</p>
          ) : !channels.length ? (
            <p className="muted">Este servidor não tem canais de voz que você possa ver.</p>
          ) : (
            channels.map((c, i) => (
              <button key={c.id} className="opt p-channel" data-nav {...(i === 0 ? { "data-nav-default": "" } : {})} disabled={busy} onClick={() => join(c.id)}>
                <span>
                  <b>{c.name}</b>
                  <small>{c.members.length ? c.members.map((x) => x.name).join(", ") : "vazio"}</small>
                </span>
                <span className="p-join">Entrar</span>
              </button>
            ))
          )}
        </>
      )}
    </Sheet>
  );
}
