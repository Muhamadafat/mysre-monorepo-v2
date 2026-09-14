"use client";

import type { PlateElementProps, PlateLeafProps } from "platejs/react";
import { PlateElement, PlateLeaf } from "platejs/react";

export function CodeBlockElement(props: PlateElementProps) {
  return (
    <PlateElement
      {...props}
      as="pre"
      style={{
        background: "#1e1e1e",
        color: "#e6e6e6",
        borderRadius: 6,
        padding: "12px 14px",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        fontSize: "0.9em",
        overflowX: "auto",
      }}
    >
      {props.children}
    </PlateElement>
  );
}

export function CodeLineElement(props: PlateElementProps) {
  return <PlateElement {...props} as="div">{props.children}</PlateElement>;
}

export function CodeSyntaxLeaf(props: PlateLeafProps) {
  return <PlateLeaf {...props}>{props.children}</PlateLeaf>;
}
