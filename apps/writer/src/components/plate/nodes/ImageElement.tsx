"use client";

import * as React from "react";
import type { PlateElementProps } from "platejs/react";
import { PlateElement, useFocused, useSelected } from "platejs/react";

/** Caption may be a plain string (old drafts) or Plate's rich-text array. */
function captionText(caption: unknown): string {
  if (typeof caption === "string") return caption;
  if (Array.isArray(caption)) return caption.map((node: any) => node?.text ?? "").join("");
  return "";
}

export function ImageElement(props: PlateElementProps) {
  const { element } = props;
  const url = (element as any).url as string | undefined;
  const caption = captionText((element as any).caption);
  const width = (element as any).width as number | undefined;
  const selected = useSelected();
  const focused = useFocused();
  // Remember WHICH url failed, so a new url gets a fresh try without an effect.
  const [failedUrl, setFailedUrl] = React.useState<string | null>(null);
  const failed = Boolean(url) && failedUrl === url;

  return (
    <PlateElement {...props} as="figure" className="writer-figure" style={{ margin: "1.2em 0", textAlign: "center" }}>
      <div contentEditable={false} style={{ display: "inline-block", maxWidth: "100%" }}>
        {url && !failed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={caption || "Gambar"}
            loading="lazy"
            onError={() => setFailedUrl(url ?? null)}
            style={{
              display: "block",
              maxWidth: width || "100%",
              maxHeight: 520,
              borderRadius: 10,
              boxShadow: selected && focused ? "0 0 0 3px rgba(59,130,246,.55)" : "0 1px 6px rgba(0,0,0,.08)",
              transition: "box-shadow .15s ease",
            }}
          />
        ) : (
          <div
            style={{
              padding: "28px 36px",
              border: "1.5px dashed rgba(127,127,127,.45)",
              borderRadius: 10,
              fontSize: 14,
              opacity: 0.75,
            }}
          >
            {url ? "Gambar gagal dimuat" : "Gambar tanpa URL"}
          </div>
        )}
        {caption && (
          <figcaption style={{ fontSize: "0.85em", opacity: 0.7, marginTop: 6, fontStyle: "italic" }}>{caption}</figcaption>
        )}
      </div>
      {props.children}
    </PlateElement>
  );
}
