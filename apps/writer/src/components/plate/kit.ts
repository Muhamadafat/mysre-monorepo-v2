"use client";

/**
 * The full set of Plate plugins this editor needs — sized to exactly what
 * PlateEditor.tsx and draft/page.tsx actually exercise (paragraph,
 * headings 1-3, bulleted/numbered lists, a real table, a code block, images,
 * a horizontal rule, and the five basic marks), not Plate's full kitchen
 * sink (no comments, suggestions, mentions, columns, callouts, DnD, etc. —
 * none of that exists in the app this replaces).
 */
import { ParagraphPlugin } from "platejs/react";
import {
  BoldPlugin,
  CodePlugin,
  H1Plugin,
  H2Plugin,
  H3Plugin,
  H4Plugin,
  H5Plugin,
  H6Plugin,
  HorizontalRulePlugin,
  ItalicPlugin,
  StrikethroughPlugin,
  UnderlinePlugin,
} from "@platejs/basic-nodes/react";
import { FontBackgroundColorPlugin, FontColorPlugin } from "@platejs/basic-styles/react";
import {
  TableCellHeaderPlugin,
  TableCellPlugin,
  TablePlugin,
  TableRowPlugin,
} from "@platejs/table/react";
import { CodeBlockPlugin, CodeLinePlugin, CodeSyntaxPlugin } from "@platejs/code-block/react";
import { ImagePlugin } from "@platejs/media/react";
import { LinkPlugin } from "@platejs/link/react";
import { KEYS } from "platejs";

import { ParagraphElement } from "./nodes/ParagraphElement";
import { makeHeadingElement } from "./nodes/HeadingElement";
import { HrElement, LinkElement } from "./nodes/MiscElements";
import { CodeBlockElement, CodeLineElement, CodeSyntaxLeaf } from "./nodes/CodeBlockElement";
import {
  TableCellElement,
  TableCellHeaderElement,
  TableElement,
  TableRowElement,
} from "./nodes/TableElement";
import { ImageElement } from "./nodes/ImageElement";
import {
  BoldLeaf,
  CodeLeaf,
  ItalicLeaf,
  StrikethroughLeaf,
  UnderlineLeaf,
} from "./nodes/Leaf";

const uploadFile = async (file: File): Promise<string> => {
  const body = new FormData();
  body.append("file", file);
  const response = await fetch("/api/upload", { method: "POST", body });
  const json = await response.json();
  return json.url;
};

export const WriterEditorKit = [
  ParagraphPlugin.withComponent(ParagraphElement),
  H1Plugin.withComponent(makeHeadingElement("h1")),
  H2Plugin.withComponent(makeHeadingElement("h2")),
  H3Plugin.withComponent(makeHeadingElement("h3")),
  H4Plugin.withComponent(makeHeadingElement("h4")),
  H5Plugin.withComponent(makeHeadingElement("h5")),
  H6Plugin.withComponent(makeHeadingElement("h6")),
  HorizontalRulePlugin.withComponent(HrElement),

  BoldPlugin.withComponent(BoldLeaf),
  ItalicPlugin.withComponent(ItalicLeaf),
  UnderlinePlugin.withComponent(UnderlineLeaf),
  StrikethroughPlugin.withComponent(StrikethroughLeaf),
  CodePlugin.withComponent(CodeLeaf),
  FontColorPlugin.configure({ inject: { targetPlugins: [KEYS.p] } }),
  FontBackgroundColorPlugin.configure({ inject: { targetPlugins: [KEYS.p] } }),

  // Bulleted/numbered "list items" are plain paragraphs carrying
  // listStyleType/indent (see ParagraphElement + lib/plateCompat/convert.ts)
  // rendered and toggled directly rather than through @platejs/list's own
  // markdown-shortcut/toggle machinery, which this app never exercises.

  TablePlugin.withComponent(TableElement),
  TableRowPlugin.withComponent(TableRowElement),
  TableCellPlugin.withComponent(TableCellElement),
  TableCellHeaderPlugin.withComponent(TableCellHeaderElement),

  CodeBlockPlugin.withComponent(CodeBlockElement),
  CodeLinePlugin.withComponent(CodeLineElement),
  CodeSyntaxPlugin.withComponent(CodeSyntaxLeaf),

  ImagePlugin.configure({
    options: {
      uploadImage: async (dataUrl: ArrayBuffer | string) => {
        if (typeof dataUrl !== "string") return "";
        const res = await fetch(dataUrl);
        const blob = await res.blob();
        return uploadFile(new File([blob], "image", { type: blob.type }));
      },
    },
  }).withComponent(ImageElement),

  LinkPlugin.withComponent(LinkElement),
];

export { uploadFile };
