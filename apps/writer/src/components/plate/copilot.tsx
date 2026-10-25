"use client";

/**
 * AI autocomplete ("ghost text") for the writer editor, on @platejs/ai's
 * CopilotPlugin: about a second after the writer pauses at the end of a
 * block (right after a space), the continuation the AI suggests shows in
 * grey behind the cursor. Tab accepts it, Ctrl+→ accepts one word, Esc (or
 * simply typing something else) dismisses it.
 *
 * The suggestion lives in the plugin's options only, never in the document,
 * so collaborators never see each other's ghost text through Yjs; only the
 * accepted text becomes a real edit.
 *
 * Completions come from /api/copilot, which forwards to mcp-sre's
 * writer_autocomplete tool.
 */
import * as React from "react";
import { CopilotPlugin } from "@platejs/ai/react";
import { NodeApi } from "platejs";
import type { PlateEditor } from "platejs/react";
import { useElement, usePluginOption } from "platejs/react";

/** How much of the document before the cursor is sent as context. */
const MAX_CONTEXT_CHARS = 2000;

/**
 * The text of every top-level block up to and including the one holding the
 * cursor (the plugin only triggers at the end of a block, so this is exactly
 * "everything before the cursor"), trimmed to the last MAX_CONTEXT_CHARS.
 */
function getTextBeforeCursor(editor: PlateEditor): string {
  const index = editor.selection?.anchor.path[0];
  if (index === undefined) return "";

  const blocks: string[] = [];
  for (const block of editor.children.slice(0, index + 1)) {
    const text = NodeApi.string(block);
    if (text.trim()) blocks.push(text);
  }
  return blocks.join("\n\n").slice(-MAX_CONTEXT_CHARS);
}

/**
 * Accepts the suggestion (or its first word) as plain text. Plate's default
 * accept parses it as markdown, which needs MarkdownPlugin — and that plugin
 * would also change how this editor handles pasting plain text.
 *
 * Inserting through insertText keeps the plugin's own bookkeeping: its
 * insertText override sees the text matches the suggestion, consumes that
 * part, and keeps the rest showing.
 */
function acceptSuggestion(editor: PlateEditor, wordOnly: boolean): boolean {
  const { getNextWord, suggestionText } = editor.getOptions(CopilotPlugin);
  if (!suggestionText) return false;

  const text = wordOnly ? getNextWord!({ text: suggestionText }).firstWord : suggestionText;
  if (!text) return false;
  editor.tf.insertText(text);
  return true;
}

function GhostText() {
  const element = useElement();
  const isSuggested = usePluginOption(CopilotPlugin, "isSuggested", element.id as string);
  if (!isSuggested) return null;
  return <GhostTextContent />;
}

function GhostTextContent() {
  const suggestionText = usePluginOption(CopilotPlugin, "suggestionText");
  if (!suggestionText) return null;
  return (
    <span
      contentEditable={false}
      style={{ color: "#9ca3af", pointerEvents: "none", userSelect: "none" }}
    >
      {suggestionText}
    </span>
  );
}

export const WriterCopilotPlugin = CopilotPlugin.configure(({ api }) => ({
  options: {
    debounceDelay: 900,
    renderGhostText: GhostText,
    getPrompt: ({ editor }) => getTextBeforeCursor(editor),
    completeOptions: {
      api: "/api/copilot",
      // A failed suggestion (quota, server down, offline) should never
      // interrupt writing: there is simply no ghost text this time.
      onError: () => {},
      onFinish: (_, completion) => {
        if (completion.trim()) api.copilot.setBlockSuggestion({ text: completion });
      },
    },
  },
  shortcuts: {
    // Returning false lets the key do what it normally does (Tab, Ctrl+→)
    // whenever there is no suggestion on screen.
    accept: { keys: "tab", handler: ({ editor }) => acceptSuggestion(editor, false) },
    acceptNextWord: { keys: "mod+right", handler: ({ editor }) => acceptSuggestion(editor, true) },
    reject: { keys: "escape" },
  },
}));
