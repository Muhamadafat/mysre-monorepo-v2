"use client";

import type { PlateElementProps } from "platejs/react";
import { PlateElement } from "platejs/react";

const SIZES: Record<string, string> = {
  h1: "2em",
  h2: "1.5em",
  h3: "1.25em",
  h4: "1.1em",
  h5: "1em",
  h6: "0.9em",
};

export function makeHeadingElement(tag: "h1" | "h2" | "h3" | "h4" | "h5" | "h6") {
  return function HeadingElement(props: PlateElementProps) {
    return (
      <PlateElement {...props} as={tag} style={{ fontSize: SIZES[tag], fontWeight: 700, margin: "0.6em 0" }}>
        {props.children}
      </PlateElement>
    );
  };
}
