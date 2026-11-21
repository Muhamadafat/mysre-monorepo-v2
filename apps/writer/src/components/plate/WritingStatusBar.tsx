"use client";

import * as React from "react";
import { Group, Text, Tooltip } from "@mantine/core";
import type { BlockNoteCompatEditor } from "@/lib/plateCompat/editor";

interface Stats {
  words: number;
  chars: number;
  paragraphs: number;
  citations: number;
}

function inlineText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.map((item: any) => (typeof item === "string" ? item : item?.text ?? inlineText(item?.content))).join("");
}

function computeStats(editor: BlockNoteCompatEditor): Stats {
  let words = 0;
  let chars = 0;
  let paragraphs = 0;
  const cited = new Set<string>();
  for (const block of editor.document as any[]) {
    const text = inlineText(block?.content).trim();
    if (!text) continue;
    if (block.type !== "heading") paragraphs++;
    words += text.split(/\s+/).filter(Boolean).length;
    chars += text.length;
    for (const match of text.matchAll(/\[(\d+)\]/g)) cited.add(match[1]);
  }
  return { words, chars, paragraphs, citations: cited.size };
}

/**
 * Quiet footer under the editor: words, characters, paragraphs, distinct
 * citations and reading time. Recomputed at most every 400 ms while typing.
 */
export function WritingStatusBar({ editor, extra }: { editor: BlockNoteCompatEditor; extra?: React.ReactNode }) {
  const [stats, setStats] = React.useState<Stats>(() => ({ words: 0, chars: 0, paragraphs: 0, citations: 0 }));

  React.useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const update = () => {
      clearTimeout(timer);
      timer = setTimeout(() => setStats(computeStats(editor)), 400);
    };
    update();
    const unsubscribe = editor.onChange(update);
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [editor]);

  const minutes = Math.max(1, Math.round(stats.words / 200));
  const item = (label: string, value: React.ReactNode, hint: string) => (
    <Tooltip label={hint} openDelay={300} withArrow>
      <Text size="xs" c="dimmed" style={{ whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
        <b style={{ fontWeight: 600 }}>{value}</b> {label}
      </Text>
    </Tooltip>
  );

  return (
    <Group className="writer-status-bar" gap="md" justify="space-between" wrap="nowrap" px="md" py={6}>
      <Group gap="md" wrap="nowrap" style={{ overflow: "hidden" }}>
        {item("kata", stats.words.toLocaleString("id-ID"), "Jumlah kata")}
        {item("karakter", stats.chars.toLocaleString("id-ID"), "Jumlah karakter tanpa spasi di awal/akhir paragraf")}
        {item("paragraf", stats.paragraphs, "Paragraf berisi teks (tanpa judul)")}
        {item("sitasi", stats.citations, "Nomor sitasi berbeda, mis. [1], [2]")}
        {item("mnt baca", `±${stats.words ? minutes : 0}`, "Perkiraan waktu baca (200 kata/menit)")}
      </Group>
      {extra}
    </Group>
  );
}
