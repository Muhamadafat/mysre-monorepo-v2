"use client";

import type { PlateElementProps } from "platejs/react";
import { PlateElement } from "platejs/react";

export function HrElement(props: PlateElementProps) {
  return (
    <PlateElement {...props} as="div">
      <hr contentEditable={false} style={{ border: "none", borderTop: "1px solid #ddd", margin: "1em 0" }} />
      {props.children}
    </PlateElement>
  );
}

export function LinkElement(props: PlateElementProps) {
  const href = (props.element as any).url as string | undefined;
  return (
    <PlateElement {...props} as="a" attributes={{ ...props.attributes, href } as any} style={{ color: "#2563eb", textDecoration: "underline" }}>
      {props.children}
    </PlateElement>
  );
}
