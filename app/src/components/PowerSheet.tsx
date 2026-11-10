import { useEffect, useState } from "react";
import { focusEngine } from "../nav/focus";
import { power, type PowerAction } from "../lib/api";
import { Sheet } from "./Sheet";

const ACTIONS: { id: PowerAction; label: string; hint?: string; confirm?: boolean }[] = [
  { id: "sleep", label: "Suspender", hint: "O PC dorme e volta onde parou", confirm: true },
  { id: "restart", label: "Reiniciar", confirm: true },
  { id: "off", label: "Desligar", confirm: true },
  { id: "lock", label: "Bloquear", hint: "Tela de bloqueio do Windows" },
];

/** Menu de energia. Suspender, reiniciar e desligar pedem confirmação. */
export function PowerSheet({ gameOpen, onClose, onDesktop, toast }: { gameOpen: string | null; onClose: () => void; onDesktop: () => void; toast: (m: string) => void }) {
  const [armed, setArmed] = useState<PowerAction | null>(null);
  // A opção vira caixa de confirmação (e volta): reposiciona o foco.
  useEffect(() => {
    requestAnimationFrame(() => {
      const def = document.querySelector<HTMLElement>(".sheet [data-nav-default]");
      if (def) focusEngine.focus(def, { scroll: false });
      else focusEngine.ensure();
    });
  }, [armed]);
  const run = async (a: PowerAction) => {
    try {
      await power(a);
      onClose();
    } catch (e) {
      toast(String(e));
    }
  };
  return (
    <Sheet title="Energia" sub={gameOpen ? `${gameOpen} está aberto e será fechado.` : "Nenhum jogo aberto."} onClose={onClose}>
      {ACTIONS.map((a) =>
        armed === a.id ? (
          <div key={a.id} className="confirm-box">
            <p>
              <b>{a.label} o PC?</b>
            </p>
            <div className="btns">
              <button className="btn primary" data-nav data-nav-default onClick={() => run(a.id)}>
                {a.label}
              </button>
              <button className="btn" data-nav onClick={() => setArmed(null)}>
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <button key={a.id} className="opt" data-nav onClick={() => (a.confirm ? setArmed(a.id) : run(a.id))}>
            {a.label}
            {a.hint && <small>{a.hint}</small>}
          </button>
        ),
      )}
      <button
        className="opt"
        data-nav
        onClick={() => {
          onClose();
          onDesktop();
        }}
      >
        Sair do modo console
        <small>Mostra a área de trabalho</small>
      </button>
    </Sheet>
  );
}
