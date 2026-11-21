"use client";

import type { PlateElementProps } from "platejs/react";
import { PlateElement } from "platejs/react";

const SIZES: Record<string, string> = {
  h1: "1.95em",
  h2: "1.5em",
  h3: "1.22em",
  h4: "1.1em",
  h5: "1em",
  h6: "0.9em",
};

export function makeHeadingElement(tag: "h1" | "h2" | "h3" | "h4" | "h5" | "h6") {
  return function HeadingElement(props: PlateElementProps) {
    return (
      <PlateElement {...props} as={tag} style={{
          fontSize: SIZES[tag],
          fontWeight: tag === "h1" ? 750 : 700,
          // More air above a heading than below, so it belongs to the text that follows.
          margin: tag === "h1" ? "1.1em 0 0.45em" : "1.2em 0 0.4em",
          lineHeight: 1.3,
        }}>
        {props.children}
      </PlateElement>
    );
  };
}
