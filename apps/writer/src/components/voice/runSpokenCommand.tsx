import { Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import type { VoiceCommandResult } from "@/components/PlateEditor";
import { voiceToolLabel } from "@/hooks/useRealtimeVoice";

/** One step of running a spoken command, for a progress display. */
export type CommandProgress =
  | { stage: "interpreting" }
  | { stage: "running"; label: string; index: number; total: number }
  | { stage: "done"; ok: boolean; message: string };

/**
 * What a command returned for reading (nothing is spoken any more): the
 * reference answer, or the document's headings and word count.
 */
export function resultDetail(result: VoiceCommandResult): string | null {
  const data = (result.data ?? {}) as { answer?: unknown; headings?: unknown; wordCount?: unknown };
  if (typeof data.answer === "string" && data.answer.trim()) return data.answer.trim();
  if (Array.isArray(data.headings) && data.headings.length) {
    const words = typeof data.wordCount === "number" ? `\n\n${data.wordCount} kata` : "";
    return `${data.headings.join("\n")}${words}`;
  }
  return null;
}

/** What one run did: the tool calls with their results (stored with the recording). */
export interface SpokenCommandRun {
  ok: boolean;
  message: string;
  text: string;
  calls: { tool: string; args: Record<string, unknown>; ok: boolean; message: string }[];
  reply: string | null;
}

/**
 * Logs one run in the recording's .json (PATCH /api/voice/recording), so the
 * recordings API can show its intent, actions and targets. Best effort.
 */
export async function logCommandRun(recordingUuid: string, run: SpokenCommandRun, source: "langsung" | "riwayat") {
  try {
    const res = await fetch(`/api/voice/recording?uuid=${encodeURIComponent(recordingUuid)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ run: { source, text: run.text, calls: run.calls, reply: run.reply } }),
    });
    if (!res.ok) console.error("[perintah] hasil gagal dicatat:", res.status, await res.text().catch(() => ""));
  } catch (err) {
    console.error("[perintah] hasil gagal dicatat:", err);
  }
}

/**
 * Spoken command text → tool calls (/api/voice/command) → run one by one in
 * the editor. Each call gets a notification (answers and outlines stay until
 * closed, they are meant to be read); `onProgress` reports each stage for an
 * inline display. Stops at the first failed call: the next usually depends on it.
 */
export async function runSpokenCommand(
  text: string,
  run: (name: string, args: Record<string, unknown>) => Promise<VoiceCommandResult>,
  onProgress?: (progress: CommandProgress) => void
): Promise<SpokenCommandRun> {
  const done: SpokenCommandRun["calls"] = [];
  let reply: string | null = null;
  const finish = (ok: boolean, message: string): SpokenCommandRun => {
    onProgress?.({ stage: "done", ok, message });
    return { ok, message, text, calls: done, reply };
  };
  try {
    onProgress?.({ stage: "interpreting" });
    const res = await fetch("/api/voice/command", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    const calls: { name: string; args: Record<string, unknown> }[] = data.calls ?? [];
    if (!calls.length) {
      const message = data.reply || "Perintah tidak dikenali.";
      reply = message;
      notifications.show({ title: "Perintah tidak dijalankan", message, color: "yellow", autoClose: 8000 });
      return finish(false, message);
    }
    let last: VoiceCommandResult = { ok: true, message: "Selesai." };
    for (const [index, call] of calls.entries()) {
      const label = voiceToolLabel(call.name);
      onProgress?.({ stage: "running", label, index: index + 1, total: calls.length });
      const id = notifications.show({ title: label, message: "Sedang dijalankan…", loading: true, autoClose: false });
      try {
        last = await run(call.name, call.args);
      } catch (err) {
        last = { ok: false, message: (err as Error)?.message || "Perintah gagal dijalankan." };
      }
      done.push({ tool: call.name, args: call.args ?? {}, ok: last.ok, message: last.message });
      const detail = resultDetail(last);
      notifications.update({
        id,
        title: label,
        message: detail ? (
          <>
            {last.message}
            <Text size="xs" mt={4} style={{ whiteSpace: "pre-wrap", maxHeight: 240, overflowY: "auto" }}>
              {detail}
            </Text>
          </>
        ) : (
          last.message
        ),
        color: last.ok ? "teal" : "red",
        loading: false,
        autoClose: detail ? false : last.ok ? 8000 : 12000,
        withCloseButton: true,
      });
      if (!last.ok) break;
    }
    return finish(last.ok, last.message);
  } catch (err) {
    const message = (err as Error).message;
    notifications.show({ title: "Gagal memproses perintah", message, color: "red", autoClose: 10000 });
    return finish(false, message);
  }
}
