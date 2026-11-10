import { useState } from "react";

/** Imagem que tenta as fontes em ordem (arquivo local, depois internet). */
export function Img({ sources, alt, className }: { sources: string[]; alt: string; className?: string }) {
  const [i, setI] = useState(0);
  if (i >= sources.length) return null;
  return <img className={className} src={sources[i]} alt={alt} decoding="async" draggable={false} onError={() => setI(i + 1)} />;
}
