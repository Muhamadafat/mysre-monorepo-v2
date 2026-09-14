"use client";

import type * as React from "react";
import type { PlateElementProps } from "platejs/react";
import { PlateElement } from "platejs/react";

export function TableElement(props: PlateElementProps) {
  return (
    <PlateElement {...props} as="table" style={{ borderCollapse: "collapse", width: "100%", margin: "0.5em 0" }}>
      <tbody>{props.children}</tbody>
    </PlateElement>
  );
}

export function TableRowElement(props: PlateElementProps) {
  return (
    <PlateElement {...props} as="tr">
      {props.children}
    </PlateElement>
  );
}

const cellStyle: React.CSSProperties = {
  border: "1px solid #d0d0d0",
  padding: "6px 10px",
  verticalAlign: "top",
  minWidth: 80,
};

export function TableCellElement(props: PlateElementProps) {
  return (
    <PlateElement {...props} as="td" style={cellStyle}>
      {props.children}
    </PlateElement>
  );
}

export function TableCellHeaderElement(props: PlateElementProps) {
  return (
    <PlateElement {...props} as="th" style={{ ...cellStyle, background: "rgba(0,0,0,0.04)", fontWeight: 600 }}>
      {props.children}
    </PlateElement>
  );
}
