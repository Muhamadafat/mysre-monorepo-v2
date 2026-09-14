"use client";

import type { PlateElementProps } from "platejs/react";
import { PlateElement } from "platejs/react";

export function ImageElement(props: PlateElementProps) {
  const { element } = props;
  const url = (element as any).url as string | undefined;
  const caption = (element as any).caption as string | undefined;
  const width = (element as any).width as number | undefined;

  return (
    <PlateElement {...props} as="figure" style={{ margin: "0.5em 0" }}>
      <div contentEditable={false}>
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={caption || ""} style={{ maxWidth: width || "100%", borderRadius: 4 }} />
        ) : (
          <div style={{ padding: 24, textAlign: "center", background: "#f2f2f2", borderRadius: 4 }}>
            Gambar tanpa URL
          </div>
        )}
        {caption && <figcaption style={{ fontSize: "0.85em", opacity: 0.7 }}>{caption}</figcaption>}
      </div>
      {props.children}
    </PlateElement>
  );
}
