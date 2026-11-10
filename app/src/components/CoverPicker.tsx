import { useEffect, useRef, useState } from "react";
import { coverOptions, coverSources, openUrl, resetCover, setCover, setSgdbKey, type CoverOption, type Game } from "../lib/api";
import { focusEngine } from "../nav/focus";
import { Img } from "./Img";

const KEY_PAGE = "https://www.steamgriddb.com/profile/preferences/api";

interface Props {
  game: Game;
  onClose: () => void;
  onChanged: (g: Game, coverPath: string | null) => void;
  toast: (m: string) => void;
}

type Phase = { kind: "loading" } | { kind: "key"; bad: boolean } | { kind: "error"; msg: string } | { kind: "list"; items: CoverOption[] };

/** Painel para escolher a capa no SteamGridDB. */
export function CoverPicker({ game, onClose, onChanged, toast }: Props) {
  const ref = useRef<HTMLElement>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => {
    setPhase({ kind: "loading" });
    coverOptions(game)
      .then((items) => setPhase({ kind: "list", items }))
      .catch((e) => {
        const msg = String(e?.message ?? e);
        if (msg.includes("NO_KEY")) setPhase({ kind: "key", bad: false });
        else if (msg.includes("BAD_KEY")) setPhase({ kind: "key", bad: true });
        else setPhase({ kind: "error", msg });
      });
  };
  useEffect(load, [game]);

  // Prende o foco no painel enquanto ele estiver aberto.
  useEffect(() => {
    const el = ref.current!;
    focusEngine.pushLayer(el);
    return () => focusEngine.popLayer(el);
  }, []);
  // Quando o conteúdo muda, garante que algo dentro do painel esteja focado.
  useEffect(() => {
    requestAnimationFrame(() => {
      const def = ref.current?.querySelector<HTMLElement>("[data-nav-default]");
      if (def) focusEngine.focus(def, { scroll: false });
      else focusEngine.ensure();
    });
  }, [phase.kind]);

  const pick = async (o: CoverOption) => {
    if (busy) return;
    setBusy(true);
    try {
      const path = await setCover(game, o.url);
      onChanged(game, path);
      toast("Capa trocada");
      onClose();
    } catch (e) {
      toast(String(e));
    } finally {
      setBusy(false);
    }
  };

  const restore = async () => {
    await resetCover(game).catch(() => {});
    onChanged(game, null);
    toast("Capa original de volta");
    onClose();
  };

  const saveKey = async () => {
    await setSgdbKey(key);
    load();
  };

  return (
    <>
      <div className="veil open sheet-veil" onClick={onClose} />
      <aside ref={ref} className="sheet wide open" aria-label={`Capa de ${game.title}`}>
        <div className="sheet-head">
          <div>
            <h2>Capa</h2>
            <p className="muted">{game.title} · capas do SteamGridDB</p>
          </div>
          <button className="btn" data-nav onClick={onClose}>
            Fechar
          </button>
        </div>

        {phase.kind === "loading" && (
          <div className="cv-grid">
            {Array.from({ length: 8 }, (_, i) => (
              <span key={i} className="cv-opt skeleton" />
            ))}
          </div>
        )}

        {phase.kind === "key" && (
          <div className="keybox">
            <p>
              {phase.bad ? "O SteamGridDB recusou a chave. Confira se copiou ela inteira." : "Para buscar capas, o HubOS precisa de uma chave grátis do SteamGridDB. É uma vez só."}
            </p>
            <ol className="muted">
              <li>Entre (ou crie conta) no SteamGridDB.</li>
              <li>Em Preferências › API, gere a chave e copie.</li>
              <li>Cole aqui embaixo.</li>
            </ol>
            <button className="btn" data-nav onClick={() => openUrl(KEY_PAGE)}>
              Abrir a página da chave
            </button>
            <input className="field" data-nav data-nav-default value={key} onChange={(e) => setKey(e.target.value)} placeholder="Cole a chave aqui" spellCheck={false} />
            <button className="btn primary" data-nav onClick={saveKey} disabled={!key.trim()}>
              Salvar e buscar capas
            </button>
          </div>
        )}

        {phase.kind === "error" && (
          <div className="keybox">
            <p>{phase.msg}</p>
            <button className="btn" data-nav onClick={load}>
              Tentar de novo
            </button>
          </div>
        )}

        {phase.kind === "list" && (
          <>
            <div className="cv-grid">
              <button className="cv-opt current" data-nav data-nav-default onClick={onClose} aria-label="Manter a capa atual">
                <Img sources={coverSources(game)} alt="" className="cover-img" />
                <span className="cv-label">Atual</span>
              </button>
              {phase.items.map((o) => (
                <button key={o.id} className="cv-opt" data-nav onClick={() => pick(o)} aria-label={`Capa ${o.id}`}>
                  <img className="cover-img" src={o.thumb} alt="" loading="lazy" decoding="async" />
                </button>
              ))}
            </div>
            {phase.items.length === 0 && <p className="muted">Nenhuma capa encontrada para este jogo.</p>}
            <button className="btn" data-nav onClick={restore}>
              Restaurar capa original
            </button>
          </>
        )}
      </aside>
    </>
  );
}
