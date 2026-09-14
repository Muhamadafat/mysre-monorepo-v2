"use client";

import type { PlateLeafProps } from "platejs/react";
import { PlateLeaf } from "platejs/react";

// Each mark plugin gets its own tiny leaf component (Plate nests them for a
// leaf carrying several marks at once, so these must NOT each re-check every
// other mark — that would double-wrap).

export function BoldLeaf(props: PlateLeafProps) {
  return (
    <PlateLeaf {...props} as="strong">
      {props.children}
    </PlateLeaf>
  );
}

export function ItalicLeaf(props: PlateLeafProps) {
  return (
    <PlateLeaf {...props} as="em">
      {props.children}
    </PlateLeaf>
  );
}

export function UnderlineLeaf(props: PlateLeafProps) {
  return (
    <PlateLeaf {...props} as="u">
      {props.children}
    </PlateLeaf>
  );
}

export function StrikethroughLeaf(props: PlateLeafProps) {
  return (
    <PlateLeaf {...props} as="s">
      {props.children}
    </PlateLeaf>
  );
}

export function CodeLeaf(props: PlateLeafProps) {
  return (
    <PlateLeaf
      {...props}
      as="code"
      style={{ background: "rgba(0,0,0,0.06)", borderRadius: 3, padding: "0.1em 0.3em", fontSize: "0.9em" }}
    >
      {props.children}
    </PlateLeaf>
  );
}

/** BlockNote's textColor style — set programmatically (AI insert / citation), not toggled from a color picker. */
export function ColorLeaf(props: PlateLeafProps) {
  const color = (props.leaf as any).color as string | undefined;
  return (
    <PlateLeaf {...props} style={color ? { color } : undefined}>
      {props.children}
    </PlateLeaf>
  );
}

/** BlockNote's backgroundColor style. */
export function BackgroundColorLeaf(props: PlateLeafProps) {
  const backgroundColor = (props.leaf as any).backgroundColor as string | undefined;
  return (
    <PlateLeaf {...props} style={backgroundColor ? { backgroundColor } : undefined}>
      {props.children}
    </PlateLeaf>
  );
}
