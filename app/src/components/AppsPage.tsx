import { useEffect, useState } from "react";
import { addApp, getApps, openApp, removeApp, type AppEntry } from "../lib/api";
import { usePageActions } from "../nav/actions";
import { focusEngine } from "../nav/focus";

/** Apps e sites de acesso rápido. X no controle remove o item focado. */
export function AppsPage({ toast }: { toast: (m: string) => void }) {
  const [apps, setApps] = useState<AppEntry[]>([]);
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [armed, setArmed] = useState<string | null>(null);

  useEffect(() => {
    getApps().then(setApps);
  }, []);

  const open = (a: AppEntry) => openApp(a.id).then(() => toast(`Abrindo ${a.name}…`)).catch((e) => toast(String(e)));
  const remove = async (id: string) => {
    if (armed !== id) {
      setArmed(id);
      toast("Aperte de novo para remover");
      window.setTimeout(() => setArmed(null), 3000);
      return;
    }
    setApps(await removeApp(id));
    setArmed(null);
    requestAnimationFrame(() => focusEngine.ensure());
  };
  usePageActions((a) => {
    const id = focusEngine.current?.dataset.app;
    if (a === "x" && id) {
      remove(id);
      return true;
    }
  });

  const add = async () => {
    if (!name.trim() || !target.trim()) return;
    setApps(await addApp(name, target));
    setName("");
    setTarget("");
    toast("Adicionado");
  };

  const group = (kind: AppEntry["kind"], title: string, hint: string) => (
    <>
      <h2 className="sec-title">
        {title} <small>{hint}</small>
      </h2>
      <div className="app-grid">
        {apps.filter((a) => a.kind === kind).map((a, i) => (
          <button key={a.id} className="app-tile" data-nav data-app={a.id} {...(kind === "program" && i === 0 ? { "data-nav-default": "" } : {})} onClick={() => open(a)} onContextMenu={(e) => (e.preventDefault(), remove(a.id))}>
            <span className="mono">{a.name.slice(0, 1).toUpperCase()}</span>
            <span>
              <b>{a.name}</b>
              <small>{armed === a.id ? "Aperte de novo para remover" : kind === "site" ? "abre no navegador" : "programa"}</small>
            </span>
          </button>
        ))}
      </div>
    </>
  );

  return (
    <section className="page">
      <div className="page-head">
        <h1 className="page-title">Apps</h1>
        <span className="muted">X (ou botão direito) remove</span>
      </div>
      {group("program", "Programas", "abrem direto, sem sair do hub")}
      {group("site", "Sites", "abrem no seu navegador padrão")}
      <h2 className="sec-title">Adicionar</h2>
      <div className="add-row">
        <input className="field" data-nav value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome (ex.: Netflix)" spellCheck={false} />
        <input className="field grow" data-nav value={target} onChange={(e) => setTarget(e.target.value)} placeholder="Endereço do site ou nome/caminho do programa" spellCheck={false} />
        <button className="btn primary" data-nav onClick={add} disabled={!name.trim() || !target.trim()}>
          Adicionar
        </button>
      </div>
    </section>
  );
}
