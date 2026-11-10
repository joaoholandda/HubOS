import { useCallback, useEffect, useRef, useState } from "react";
import { getMedia, mediaArt, mediaControl, openApp, type Media } from "../lib/api";
import { Sheet } from "./Sheet";

export interface MediaState {
  media: Media | null;
  art: string | null;
  control: (a: "toggle" | "next" | "prev") => Promise<void>;
}

/** Acompanha o que está tocando no Windows. Só olha enquanto o hub está visível. */
export function useMedia(toast: (m: string) => void): MediaState {
  const [media, setMedia] = useState<Media | null>(null);
  const [art, setArt] = useState<string | null>(null);
  const last = useRef("");

  const refresh = useCallback(async () => {
    const m = await getMedia().catch(() => null);
    const sig = JSON.stringify(m);
    if (sig === last.current) return; // nada mudou: não redesenha
    last.current = sig;
    setMedia(m);
  }, []);

  useEffect(() => {
    refresh();
    const t = window.setInterval(() => {
      if (!document.hidden) refresh();
    }, 2500);
    return () => window.clearInterval(t);
  }, [refresh]);

  // A capa só é buscada quando a faixa muda.
  const track = media ? `${media.title}|${media.artist}` : "";
  useEffect(() => {
    setArt(null);
    if (!track) return;
    let alive = true;
    mediaArt().then((a) => alive && setArt(a)).catch(() => {});
    return () => {
      alive = false;
    };
  }, [track]);

  const control = useCallback(
    async (a: "toggle" | "next" | "prev") => {
      try {
        await mediaControl(a);
        window.setTimeout(refresh, 350);
      } catch (e) {
        toast(String(e));
      }
    },
    [refresh, toast],
  );
  return { media, art, control };
}

const ICON = {
  prev: "M6 5v14M19 5l-10 7 10 7z",
  next: "M18 5v14M5 5l10 7-10 7z",
  play: "M7 4l13 8-13 8z",
  pause: "M7 5h2.5v14H7zM14.5 5H17v14h-2.5z",
};

/** Painel "Tocando agora": capa, faixa e os três controles. */
export function MediaSheet({ state, onClose, toast }: { state: MediaState; onClose: () => void; toast: (m: string) => void }) {
  const { media, art, control } = state;
  const open = (id: string) => openApp(id).catch((e) => toast(String(e)));
  return (
    <Sheet title="Tocando agora" sub={media ? media.app : "Nada tocando no momento."} onClose={onClose}>
      {media && (
        <>
          <div className="media-art">{art ? <img src={art} alt="" /> : <span>♪</span>}</div>
          <div className="media-txt">
            <b>{media.title}</b>
            <span>{media.artist || media.app}</span>
          </div>
          <div className="media-ctl">
            <button className="mbtn" data-nav aria-label="Faixa anterior" onClick={() => control("prev")}>
              <svg viewBox="0 0 24 24">
                <path d={ICON.prev} />
              </svg>
            </button>
            <button className="mbtn big" data-nav data-nav-default aria-label={media.playing ? "Pausar" : "Tocar"} onClick={() => control("toggle")}>
              <svg viewBox="0 0 24 24">
                <path d={media.playing ? ICON.pause : ICON.play} />
              </svg>
            </button>
            <button className="mbtn" data-nav aria-label="Próxima faixa" onClick={() => control("next")}>
              <svg viewBox="0 0 24 24">
                <path d={ICON.next} />
              </svg>
            </button>
          </div>
        </>
      )}
      <button className="opt" data-nav {...(media ? {} : { "data-nav-default": "" })} onClick={() => open("spotify")}>
        Abrir o Spotify
        <small>fila e playlists ficam no app</small>
      </button>
    </Sheet>
  );
}
