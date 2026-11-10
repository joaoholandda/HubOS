import { useEffect, useState } from "react";
import { getDiagnostics, openDataDir, type Diagnostics as Diag } from "../lib/api";

/** Diagnóstico: o que o hub achou neste PC e as últimas linhas do diário. */
export function Diagnostics({ toast, onRescan }: { toast: (m: string) => void; onRescan: () => Promise<void> }) {
  const [d, setD] = useState<Diag | null>(null);
  const load = () => getDiagnostics().then(setD).catch((e) => toast(String(e)));
  useEffect(() => {
    load();
  }, []);
  if (!d) return null;

  const report = [
    `HubOS ${d.version}`,
    `Steam: ${d.steamRoot ?? "não encontrada"}`,
    `Biblioteca: ${d.scan.steam} Steam, ${d.scan.xbox} Xbox, ${d.scan.exe} .exe (${d.scan.millis} ms)`,
    `Ctrl+Alt+H: ${d.shortcutOk ? "ok" : "NÃO registrado"}`,
    `Botão Guide: ${d.guideOk ? "ok" : "NÃO disponível"}`,
    ...d.scan.warnings.map((w) => `Aviso: ${w}`),
    "--- diário ---",
    ...d.log,
  ].join("\n");

  const Check = ({ ok, label, bad }: { ok: boolean; label: string; bad: string }) => (
    <div className="srow">
      <div className="lb">
        <b>{label}</b>
        {!ok && <small>{bad}</small>}
      </div>
      <span className={`state${ok ? "" : " bad"}`}>{ok ? "Funcionando" : "Com problema"}</span>
    </div>
  );

  return (
    <div className="group">
      <h3 className="eyebrow">Diagnóstico · versão {d.version}</h3>
      <div className="srow">
        <div className="lb">
          <b>Biblioteca</b>
          <small>
            {d.scan.steam} da Steam · {d.scan.xbox} do Xbox · {d.scan.exe} .exe · lida em {d.scan.millis} ms
          </small>
        </div>
        <div className="ctl">
          <button
            className="btn"
            data-nav
            onClick={async () => {
              await onRescan();
              await load();
              toast("Biblioteca relida");
            }}
          >
            Reler agora
          </button>
        </div>
      </div>
      {d.scan.warnings.map((w) => (
        <div key={w} className="srow">
          <div className="lb">
            <b>Aviso</b>
            <small>{w}</small>
          </div>
        </div>
      ))}
      <Check ok={d.shortcutOk} label="Atalho Ctrl + Alt + H" bad="Outro programa já usa este atalho (o AudioHub, por exemplo)." />
      <Check ok={d.guideOk} label="Botão Guide do controle" bad="O Windows não deixou ler o botão Guide." />
      <div className="srow">
        <div className="lb">
          <b>Diário do hub</b>
          <small>Se algo não funcionar, copie e mande: mostra o que aconteceu.</small>
        </div>
        <div className="ctl">
          <button className="btn" data-nav onClick={() => navigator.clipboard.writeText(report).then(() => toast("Diagnóstico copiado"), () => toast("Não consegui copiar"))}>
            Copiar diagnóstico
          </button>
          <button className="btn" data-nav onClick={() => openDataDir().catch((e) => toast(String(e)))}>
            Abrir pasta de dados
          </button>
          <button className="btn" data-nav onClick={load}>
            Atualizar
          </button>
        </div>
      </div>
      <pre className="logbox" data-nav tabIndex={-1}>
        {d.log.length ? d.log.slice(-40).join("\n") : "Diário vazio."}
      </pre>
    </div>
  );
}
