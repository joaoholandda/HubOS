import { useEffect, useState } from "react";
import { Diagnostics } from "./Diagnostics";
import { applyAppearance, getSettings, refreshSteam, setSetting, setSgdbKey, type Settings } from "../lib/api";

const THEMES: { id: Settings["theme"]; label: string }[] = [
  { id: "light", label: "Claro" },
  { id: "dark", label: "Escuro" },
  { id: "auto", label: "Automático" },
];
// Sem verde, por decisão do dono do hub.
const ACCENTS = [
  ["Cobalto", "#2f5be0"],
  ["Roxo", "#7a4de0"],
  ["Laranja", "#d9622b"],
  ["Rosa", "#d23f78"],
  ["Vermelho", "#d2453b"],
  ["Grafite", "#4a5160"],
];

/** Configurações que já funcionam de verdade nesta versão. */
export function SettingsPage({ toast, onRescan }: { toast: (m: string) => void; onRescan: () => Promise<void> }) {
  const [s, setS] = useState<Settings | null>(null);
  const [key, setKey] = useState("");
  const [steamKey, setSteamKey] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    getSettings().then(setS);
  }, []);
  if (!s) return <section className="page" />;

  const update = async (k: "theme" | "accent" | "autostart", v: string) => {
    try {
      await setSetting(k, v);
      const next = await getSettings();
      setS(next);
      applyAppearance(next);
    } catch (e) {
      toast(String(e));
    }
  };

  return (
    <section className="page">
      <h1 className="page-title">Configurações</h1>

      <div className="group">
        <h3 className="eyebrow">Aparência</h3>
        <div className="srow">
          <div className="lb">
            <b>Tema</b>
            <small>Automático segue o Windows.</small>
          </div>
          <div className="ctl">
            {THEMES.map((t, i) => (
              <button key={t.id} className="tab" data-nav {...(i === 0 ? { "data-nav-default": "" } : {})} aria-selected={s.theme === t.id} onClick={() => update("theme", t.id)}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div className="srow">
          <div className="lb">
            <b>Cor de destaque</b>
            <small>Usada em gráficos e seleções.</small>
          </div>
          <div className="ctl">
            {ACCENTS.map(([n, c]) => (
              <button key={c} className="swatch" data-nav style={{ background: c }} aria-label={n} aria-pressed={(s.accent ?? "#2f5be0") === c} onClick={() => update("accent", c)} />
            ))}
          </div>
        </div>
      </div>

      <div className="group">
        <h3 className="eyebrow">Sistema</h3>
        <div className="srow">
          <div className="lb">
            <b>Abrir com o Windows</b>
            <small>O hub aparece sozinho quando o PC liga.</small>
          </div>
          <div className="ctl">
            <button className="toggle" role="switch" data-nav aria-checked={s.autostart} aria-label="Abrir com o Windows" onClick={() => update("autostart", String(!s.autostart))} />
          </div>
        </div>
        <div className="srow">
          <div className="lb">
            <b>Atalhos</b>
            <small>Ctrl + Alt + H mostra ou esconde o hub. O botão Guide do controle traz o hub de volta. No teclado: M abre o menu, Q e E trocam de aba, C troca a capa, F favorita.</small>
          </div>
        </div>
      </div>

      <div className="group">
        <h3 className="eyebrow">Capas (SteamGridDB)</h3>
        <div className="srow">
          <div className="lb">
            <b>Chave da API</b>
            <small>{s.hasSgdbKey ? "Chave salva. Cole outra para trocar." : "Sem chave ainda. É grátis: steamgriddb.com › Preferências › API."}</small>
          </div>
          <div className="ctl">
            <input className="field" data-nav value={key} onChange={(e) => setKey(e.target.value)} placeholder="Cole a chave" spellCheck={false} />
            <button
              className="btn"
              data-nav
              disabled={!key.trim()}
              onClick={async () => {
                await setSgdbKey(key);
                setKey("");
                setS(await getSettings());
                toast("Chave salva");
              }}
            >
              Salvar
            </button>
          </div>
        </div>
      </div>

      <div className="group">
        <h3 className="eyebrow">Biblioteca</h3>
        <div className="srow">
          <div className="lb">
            <b>Steam</b>
            <small>{s.steamRoot ?? "Não encontrada neste PC."}</small>
          </div>
        </div>
        <div className="srow">
          <div className="lb">
            <b>Chave da Steam</b>
            <small>{s.hasSteamKey ? "Chave salva: a biblioteca mostra todos os jogos da conta e as conquistas." : "Sem chave, só aparecem os jogos instalados. É grátis: steamcommunity.com/dev/apikey (domínio: localhost)."}</small>
          </div>
          <div className="ctl">
            <input className="field" data-nav value={steamKey} onChange={(e) => setSteamKey(e.target.value)} placeholder="Cole a chave" spellCheck={false} />
            <button
              className="btn"
              data-nav
              disabled={busy || (!steamKey.trim() && !s.hasSteamKey)}
              onClick={async () => {
                setBusy(true);
                try {
                  if (steamKey.trim()) await setSetting("steamKey", steamKey);
                  setSteamKey("");
                  setS(await getSettings());
                  const n = await refreshSteam();
                  await onRescan();
                  toast(`Conta Steam: ${n} jogos`);
                } catch (e) {
                  toast(String(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "Buscando…" : steamKey.trim() ? "Salvar" : "Atualizar"}
            </button>
          </div>
        </div>
      </div>

      <Diagnostics toast={toast} onRescan={onRescan} />
    </section>
  );
}
