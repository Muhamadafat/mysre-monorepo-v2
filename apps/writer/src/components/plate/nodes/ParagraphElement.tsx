"use client";

import * as React from "react";
import type { PlateElementProps } from "platejs/react";
import { PlateElement } from "platejs/react";

function computeOrderedIndex(editor: { children: any[] }, path: number[], indent: number): number {
  let count = 1;
  for (let i = path[0] - 1; i >= 0; i--) {
    const sib = editor.children[i] as any;
    if (sib?.listStyleType === "decimal" && (sib.indent || 1) === indent) count++;
    else break;
  }
  return count;
}

/**
 * Renders both plain paragraphs and BlockNote's flat bulletListItem /
 * numberedListItem blocks (which this app — like Plate's own list plugin —
 * represents as a paragraph carrying `listStyleType`/`indent`, not a
 * dedicated list-item element). See lib/plateCompat/convert.ts.
 */
export function ParagraphElement(props: PlateElementProps) {
  const { element, editor, path } = props;
  const listStyleType = (element as any).listStyleType as string | undefined;
  const indent = (element as any).indent || 1;
  const bnProps = (element as any).bnProps || {};

  const style: React.CSSProperties = {
    marginLeft: listStyleType ? indent * 24 : undefined,
    backgroundColor: bnProps.backgroundColor && bnProps.backgroundColor !== "default" ? bnProps.backgroundColor : undefined,
    color: bnProps.textColor && bnProps.textColor !== "default" ? bnProps.textColor : undefined,
  };

  if (!listStyleType) {
    return (
      <PlateElement {...props} as="p" style={style}>
        {props.children}
      </PlateElement>
    );
  }

  const marker =
    listStyleType === "decimal" ? `${computeOrderedIndex(editor, path as number[], indent)}.` : "•";

  return (
    <PlateElement {...props} as="div" style={{ ...style, display: "flex", gap: 8 }}>
      <span contentEditable={false} style={{ userSelect: "none", opacity: 0.75 }}>
        {marker}
      </span>
      <span style={{ flex: 1 }}>{props.children}</span>
    </PlateElement>
  );
}
