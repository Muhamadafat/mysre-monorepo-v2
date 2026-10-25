"use client";

/**
 * Inline comments ("Komentar") for the writer editor.
 *
 * Two halves, kept deliberately separate:
 * - WHERE a comment is anchored lives in the document itself, as
 *   @platejs/comment's leaf marks (`comment: true` + `comment_<threadId>:
 *   true` on every text leaf the comment covers). Being ordinary leaf props,
 *   they sync through Yjs, move with the text when it's edited or a block is
 *   dragged, and disappear with it when it's deleted.
 * - WHAT was said (the thread: quote, replies, resolved flag) lives in a
 *   shared `commentThreads` Y.Map on the same Y.Doc (see useCommentThreads in
 *   PlateEditor.tsx), so every collaborator sees and replies to the same
 *   threads live, persisted with the room by PartyKit.
 *
 * The UI talks to both through CommentUIContext, provided by PlateEditor.
 */
import * as React from "react";
import { getCommentKeys, getCommentKeyId } from "@platejs/comment";
import type { PlateLeafProps } from "platejs/react";
import { PlateLeaf } from "platejs/react";

export interface CommentReply {
  id: string;
  authorId: string;
  authorName: string;
  authorColor: string;
  text: string;
  createdAt: number;
}

export interface CommentThread {
  id: string;
  /** The commented text at the time the thread was opened. */
  quote: string;
  authorId: string;
  authorName: string;
  authorColor: string;
  createdAt: number;
  resolved: boolean;
  /** replies[0] is the opening comment. */
  replies: CommentReply[];
}

export interface CommentUIContextValue {
  threads: Record<string, CommentThread>;
  activeId: string | null;
  hoverId: string | null;
  setHoverId: (id: string | null) => void;
  /** Open the comments panel focused on one thread (or just the panel). */
  openThread: (id: string | null) => void;
}

export const CommentUIContext = React.createContext<CommentUIContextValue | null>(null);

export function useCommentUI() {
  return React.useContext(CommentUIContext);
}

/** Ids of every thread anchored on a text leaf. */
export function leafCommentIds(leaf: Record<string, unknown>): string[] {
  return getCommentKeys(leaf as any).map((key) => getCommentKeyId(key));
}

/** Distinct, still-existing, unresolved thread ids anchored anywhere in an element. */
export function elementCommentIds(element: any, threads: Record<string, CommentThread>): string[] {
  const ids = new Set<string>();
  const walk = (node: any) => {
    if (!node || typeof node !== "object") return;
    if (typeof node.text === "string") {
      for (const id of leafCommentIds(node)) {
        if (threads[id] && !threads[id].resolved) ids.add(id);
      }
      return;
    }
    if (Array.isArray(node.children)) node.children.forEach(walk);
  };
  walk(element);
  return [...ids];
}

/**
 * Highlights commented text. Overlapping comments get a stronger tint, the
 * active/hovered thread stronger still. Marks whose thread no longer exists
 * (e.g. a draft restored from a Postgres snapshot after the thread was
 * deleted) render as plain text rather than as a dead highlight.
 */
export function CommentLeaf(props: PlateLeafProps) {
  const ui = useCommentUI();
  const ids = ui
    ? leafCommentIds(props.leaf as any).filter((id) => ui.threads[id] && !ui.threads[id].resolved)
    : [];

  if (!ui || ids.length === 0) {
    return <PlateLeaf {...props}>{props.children}</PlateLeaf>;
  }

  const isActive = ids.includes(ui.activeId ?? "") || ids.includes(ui.hoverId ?? "");
  const background = isActive
    ? "rgba(250, 176, 5, 0.55)"
    : ids.length > 1
      ? "rgba(250, 176, 5, 0.38)"
      : "rgba(250, 176, 5, 0.2)";

  return (
    <PlateLeaf
      {...props}
      attributes={{
        ...props.attributes,
        onClick: () => ui.openThread(ids[ids.length - 1]),
        onMouseEnter: () => ui.setHoverId(ids[ids.length - 1]),
        onMouseLeave: () => ui.setHoverId(null),
      } as any}
      style={{
        background,
        borderBottom: "2px solid rgba(250, 176, 5, 0.9)",
        cursor: "pointer",
        transition: "background 0.15s ease",
      }}
    >
      {props.children}
    </PlateLeaf>
  );
}
