"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ActionIcon,
  Box,
  Button,
  Card,
  CopyButton,
  Group,
  Loader,
  Popover,
  Stack,
  Text,
  Tooltip,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { Audio } from "@gfazioli/mantine-audio";
import type { VoiceCommandResult } from "@/components/PlateEditor";
import { logCommandRun, runSpokenCommand } from "./runSpokenCommand";
import {
  IconCheck,
  IconCopy,
  IconDownload,
  IconMessageCircle,
  IconMicrophone,
  IconPlayerPlay,
  IconPencil,
  IconRefresh,
  IconRobot,
  IconTerminal2,
  IconTrash,
  IconUser,
} from "@tabler/icons-react";

export type RecordingMode = "menulis" | "perintah";

interface TranscriptLine {
  at: string;
  role: string;
  text: string;
}

interface RecordingItem {
  /** UUID of the recording (delete / command log / audio take this). */
  uuid: string;
  mode: RecordingMode;
  startedAt: string | null;
  endedAt: string | null;
  sizeBytes: number;
  mimeType?: string;
  transcript: TranscriptLine[];
  /** Full transcript of the audio by OpenAI, once requested. */
  aiTranscript?: { text: string; model: string; createdAt: string } | null;
  /** Main audio (the MP3 for WAV recordings): plays here and goes to AI. */
  url: string;
  /** The WAV 16 kHz original, when there is one. */
  wavUrl?: string | null;
  wavSizeBytes?: number | null;
}

interface RecordingHistoryProps {
  mode: RecordingMode;
  /** Text from the modal's search box (matches the transcript). */
  search: string;
  /**
   * Runs one editor command (PlateEditor's runVoiceCommand). When given, the
   * perintah history shows "Jalankan" on each saved command, to run it
   * again (the dock already runs it once when the recording stops).
   */
  onRunCommand?: (
    name: string,
    args: Record<string, unknown>,
  ) => Promise<VoiceCommandResult>;
}

const MODE_INFO: Record<
  RecordingMode,
  { label: string; color: string; icon: typeof IconPencil }
> = {
  menulis: { label: "Mode Menulis", color: "cyan", icon: IconPencil },
  perintah: { label: "Mode Perintah", color: "indigo", icon: IconTerminal2 },
};

/** Lines shown before "Lihat semua". */
const PREVIEW_LINES = 3;

const formatDay = (date: Date) =>
  date.toLocaleDateString("id-ID", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
const formatTime = (date: Date) =>
  date.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

function formatDuration(item: RecordingItem): string | null {
  if (!item.startedAt || !item.endedAt) return null;
  const seconds = Math.max(
    0,
    Math.round((Date.parse(item.endedAt) - Date.parse(item.startedAt)) / 1000),
  );
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

const formatSize = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

const FORMAT_LABEL: Record<string, string> = {
  "audio/mpeg": "MP3",
  "audio/webm": "WEBM",
  "audio/ogg": "OGG",
  "audio/mp4": "M4A",
  "audio/wav": "WAV",
};

/** The draft page's project, so only this project's recordings are listed. */
const currentProjectId = () =>
  typeof window === "undefined"
    ? null
    : (window.location.pathname.match(/\/project\/([^/]+)/)?.[1] ?? null);

/**
 * What was said, in order. Mode Menulis stores each typed sentence as a
 * "Menulis: <text>" tool line: shown as the user's words.
 */
function spokenLines(lines: TranscriptLine[]): TranscriptLine[] {
  return lines.flatMap((line) => {
    if (line.role === "user" || line.role === "assistant") return [line];
    const dictated =
      line.role === "tool" ? line.text.match(/^Menulis: ([\s\S]+)/) : null;
    return dictated ? [{ ...line, role: "user", text: dictated[1] }] : [];
  });
}

/**
 * Saved voice-session recordings of one mode (menulis / perintah), newest
 * first, grouped by day. Each card: time, format, duration and size; download
 * and delete; a compact mantine-audio player; and the live transcript (with
 * "Jalankan" on each command in Mode Perintah).
 *
 * Each player shows a waveform (the MP3 is fetched once to draw it, small
 * files) above the controls; starting one recording pauses the others.
 */
export default function RecordingHistory({
  mode,
  search,
  onRunCommand,
}: RecordingHistoryProps) {
  const [items, setItems] = useState<RecordingItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  /** The saved command being run ("<recording id>:<line>"). */
  const [running, setRunning] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setItems(null);
    setError(null);
    setPlayingId(null);
    const params = new URLSearchParams({ mode });
    const projectId = currentProjectId();
    if (projectId) params.set("projectId", projectId);
    fetch(`/api/voice/recording?${params}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok)
          throw new Error(
            `${data.error || "Gagal memuat rekaman."} (HTTP ${res.status})`,
          );
        if (!cancelled) setItems(data.items ?? []);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [mode, reload]);

  const groups = useMemo(() => {
    const query = search.trim().toLowerCase();
    const visible = (items ?? []).filter(
      (item) =>
        !query ||
        item.transcript.some((line) =>
          line.text.toLowerCase().includes(query),
        ) ||
        Boolean(item.aiTranscript?.text.toLowerCase().includes(query)),
    );
    const byDay = new Map<string, RecordingItem[]>();
    for (const item of visible) {
      const day = formatDay(
        new Date(item.startedAt ?? item.endedAt ?? Date.now()),
      );
      byDay.set(day, [...(byDay.get(day) ?? []), item]);
    }
    return [...byDay.entries()];
  }, [items, search]);

  const info = MODE_INFO[mode];
  const ModeIcon = info.icon;
  const refresh = () => setReload((n) => n + 1);

  const remove = async (item: RecordingItem) => {
    setDeleting(item.uuid);
    try {
      const res = await fetch(
        `/api/voice/recording?uuid=${encodeURIComponent(item.uuid)}`,
        { method: "DELETE" },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setItems((prev) => prev?.filter((other) => other.uuid !== item.uuid) ?? prev);
      notifications.show({ message: "Rekaman dihapus.", color: "teal" });
    } catch (err) {
      notifications.show({
        title: "Gagal menghapus",
        message: (err as Error).message,
        color: "red",
      });
    } finally {
      setDeleting(null);
      setConfirmDelete(null);
    }
  };

  /**
   * "Jalankan": the saved command text → tool calls (/api/voice/command) →
   * run one by one in the editor. The modal closes first (onRunCommand does
   * that) so the result is visible.
   */
  const runCommand = async (runKey: string, text: string, recordingKey: string) => {
    if (!onRunCommand || running) return;
    setRunning(runKey);
    try {
      const result = await runSpokenCommand(text, onRunCommand);
      void logCommandRun(recordingKey, result, "riwayat");
    } finally {
      setRunning(null);
    }
  };

  const runButton = (runKey: string, text: string, recordingKey: string) =>
    mode === "perintah" && onRunCommand ? (
      <Tooltip label="Jalankan perintah ini di dokumen">
        <Button
          size="compact-xs"
          variant="light"
          color="indigo"
          leftSection={<IconPlayerPlay size={11} />}
          loading={running === runKey}
          disabled={running !== null && running !== runKey}
          onClick={() => void runCommand(runKey, text, recordingKey)}
          style={{ flexShrink: 0 }}
        >
          Jalankan
        </Button>
      </Tooltip>
    ) : null;

  if (error) {
    return (
      <Box p="xl" ta="center">
        <Text c="red" size="sm">
          {error}
        </Text>
        <Button
          mt="sm"
          size="xs"
          variant="light"
          leftSection={<IconRefresh size={14} />}
          onClick={refresh}
        >
          Coba lagi
        </Button>
      </Box>
    );
  }
  if (!items) {
    return (
      <Group justify="center" p="xl">
        <Loader size="sm" />
        <Text size="sm" c="dimmed">
          Memuat rekaman…
        </Text>
      </Group>
    );
  }
  if (groups.length === 0) {
    return (
      <Box p="xl" ta="center">
        <IconMicrophone size={48} color="#ccc" />
        <Text size="lg" c="dimmed" mt="md">
          {search.trim()
            ? "Tidak ada rekaman yang cocok"
            : `Belum ada rekaman ${info.label.toLowerCase()}`}
        </Text>
        <Text size="sm" c="dimmed">
          {search.trim()
            ? "Pencarian mencocokkan isi transkrip"
            : "Rekaman suara akan muncul di sini setelah sesi selesai"}
        </Text>
        {!search.trim() && (
          <Button
            mt="sm"
            size="xs"
            variant="subtle"
            leftSection={<IconRefresh size={14} />}
            onClick={refresh}
          >
            Muat ulang
          </Button>
        )}
      </Box>
    );
  }

  const totalBytes = items.reduce(
    (sum, item) => sum + (item.sizeBytes || 0) + (item.wavSizeBytes || 0),
    0,
  );

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Text size="xs" c="dimmed">
          {items.length} rekaman · {formatSize(totalBytes)} · tersimpan di S3
        </Text>
        <Tooltip label="Muat ulang">
          <ActionIcon
            variant="subtle"
            size="sm"
            onClick={refresh}
            aria-label="Muat ulang rekaman"
          >
            <IconRefresh size={14} />
          </ActionIcon>
        </Tooltip>
      </Group>

      {groups.map(([day, dayItems]) => (
        <Box key={day}>
          <Text fw={600} size="sm" c="dimmed" mb="sm">
            {day}
          </Text>
          <Stack gap="sm">
            {dayItems.map((item) => {
              const started = new Date(
                item.startedAt ?? item.endedAt ?? Date.now(),
              );
              const duration = formatDuration(item);
              const mainFormat =
                FORMAT_LABEL[item.mimeType ?? ""] ??
                "Audio";
              // One download button per stored file (MP3 + WAV for new recordings).
              const downloads = [
                {
                  label: mainFormat ?? "Audio",
                  href: `${item.url}&download=1`,
                  size: item.sizeBytes,
                },
                ...(item.wavUrl
                  ? [
                      {
                        label: "WAV",
                        href: `${item.wavUrl}&download=1`,
                        size: item.wavSizeBytes ?? 0,
                      },
                    ]
                  : []),
              ];
              const spoken = spokenLines(item.transcript);
              const showAll = expanded === item.uuid;
              const shownLines = showAll
                ? spoken
                : spoken.slice(0, PREVIEW_LINES);
              const transcriptText = spoken
                .map(
                  (line) =>
                    `${line.role === "user" ? "Saya" : "AI"}: ${line.text}`,
                )
                .join("\n");
              return (
                <Card key={item.uuid} withBorder radius="md" p="sm" shadow="xs">
                  {/* Header: what, when, how big + actions */}
                  <Group gap="sm" wrap="nowrap" mb="xs">
                    <Box
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: "50%",
                        display: "grid",
                        placeItems: "center",
                        flexShrink: 0,
                        color: "white",
                        background: `linear-gradient(135deg, var(--mantine-color-${info.color}-4), var(--mantine-color-${info.color}-7))`,
                        boxShadow: `0 3px 8px color-mix(in srgb, var(--mantine-color-${info.color}-6) 35%, transparent)`,
                      }}
                    >
                      <ModeIcon size={16} />
                    </Box>
                    <Box style={{ minWidth: 0, flex: 1 }}>
                      <Text fw={600} size="sm">
                        {formatTime(started)}
                      </Text>
                      {duration && (
                        <Text size="xs" c="dimmed">
                          Durasi {duration}
                        </Text>
                      )}
                    </Box>
                    <Group gap={4} wrap="nowrap">
                      {downloads.map((file) => (
                        <Tooltip
                          key={file.label}
                          label={`Unduh ${file.label}${file.label === "WAV" ? " 16 kHz" : ""} (${formatSize(file.size)})`}
                        >
                          <Button
                            component="a"
                            href={file.href}
                            size="compact-xs"
                            variant="light"
                            color={info.color}
                            radius="xl"
                            leftSection={<IconDownload size={12} />}
                            aria-label={`Unduh ${file.label}`}
                          >
                            {file.label}
                          </Button>
                        </Tooltip>
                      ))}
                      <Popover
                        opened={confirmDelete === item.uuid}
                        onChange={(open) =>
                          setConfirmDelete(open ? item.uuid : null)
                        }
                        position="bottom-end"
                        withArrow
                        shadow="md"
                      >
                        <Popover.Target>
                          <Tooltip
                            label="Hapus rekaman"
                            disabled={confirmDelete === item.uuid}
                          >
                            <ActionIcon
                              variant="subtle"
                              color="red"
                              aria-label="Hapus rekaman"
                              onClick={() =>
                                setConfirmDelete(
                                  confirmDelete === item.uuid ? null : item.uuid,
                                )
                              }
                            >
                              <IconTrash size={16} />
                            </ActionIcon>
                          </Tooltip>
                        </Popover.Target>
                        <Popover.Dropdown>
                          <Text size="sm" fw={500}>
                            Hapus rekaman ini?
                          </Text>
                          <Text size="xs" c="dimmed" mb="xs">
                            Audio dan transkripnya dihapus permanen dari S3.
                          </Text>
                          <Group gap="xs" justify="flex-end">
                            <Button
                              size="compact-xs"
                              variant="default"
                              onClick={() => setConfirmDelete(null)}
                            >
                              Batal
                            </Button>
                            <Button
                              size="compact-xs"
                              color="red"
                              loading={deleting === item.uuid}
                              onClick={() => void remove(item)}
                            >
                              Hapus
                            </Button>
                          </Group>
                        </Popover.Dropdown>
                      </Popover>
                    </Group>
                  </Group>

                  {/* Two rows: waveform (click to seek) on top, the default controls below. */}
                  <Audio
                    src={item.url}
                    color={info.color}
                    radius="md"
                    preload="metadata"
                    waveformSamples={160}
                    controls={false}
                    playing={playingId === item.uuid}
                    onPlayChange={(playing) =>
                      setPlayingId((current) =>
                        playing
                          ? item.uuid
                          : current === item.uuid
                            ? null
                            : current,
                      )
                    }
                  >
                    <Audio.Waveform height={44} barWidth={2} barGap={2} />
                    <Audio.Controls />
                  </Audio>

                  {/* Conversation transcript */}
                  <Box
                    mt="sm"
                    p="xs"
                    style={{
                      borderRadius: "var(--mantine-radius-md)",
                      background: "var(--mantine-color-gray-0)",
                    }}
                  >
                    <Group justify="space-between" mb={spoken.length ? 6 : 0}>
                      <Group gap={6}>
                        <IconMessageCircle
                          size={14}
                          color="var(--mantine-color-dimmed)"
                        />
                        <Text size="xs" fw={600} c="dimmed">
                          Transkrip langsung
                        </Text>
                      </Group>
                      {spoken.length > 0 && (
                        <CopyButton value={transcriptText}>
                          {({ copied, copy }) => (
                            <Tooltip
                              label={copied ? "Tersalin" : "Salin transkrip"}
                            >
                              <ActionIcon
                                size="sm"
                                variant="subtle"
                                color={copied ? "teal" : "gray"}
                                onClick={copy}
                                aria-label="Salin transkrip"
                              >
                                {copied ? (
                                  <IconCheck size={14} />
                                ) : (
                                  <IconCopy size={14} />
                                )}
                              </ActionIcon>
                            </Tooltip>
                          )}
                        </CopyButton>
                      )}
                    </Group>
                    {spoken.length === 0 ? (
                      <Text size="xs" c="dimmed" fs="italic" mt={4}>
                        Tidak ada transkrip langsung untuk sesi ini.
                      </Text>
                    ) : (
                      <Stack gap={6}>
                        {shownLines.map((line, index) => (
                          <Group
                            key={index}
                            gap={8}
                            wrap="nowrap"
                            align="flex-start"
                          >
                            <Box
                              style={{
                                width: 20,
                                height: 20,
                                borderRadius: "50%",
                                display: "grid",
                                placeItems: "center",
                                flexShrink: 0,
                                color: "white",
                                background:
                                  line.role === "user"
                                    ? "var(--mantine-color-gray-6)"
                                    : `var(--mantine-color-${info.color}-6)`,
                              }}
                            >
                              {line.role === "user" ? (
                                <IconUser size={12} />
                              ) : (
                                <IconRobot size={12} />
                              )}
                            </Box>
                            <Text
                              size="xs"
                              style={{ lineHeight: 1.5, flex: 1 }}
                            >
                              {line.text}
                            </Text>
                            {line.role === "user" &&
                              runButton(`${item.uuid}:${index}`, line.text, item.uuid)}
                          </Group>
                        ))}
                        {spoken.length > PREVIEW_LINES && (
                          <Button
                            size="compact-xs"
                            variant="subtle"
                            color={info.color}
                            onClick={() =>
                              setExpanded(showAll ? null : item.uuid)
                            }
                            style={{ alignSelf: "flex-start" }}
                          >
                            {showAll
                              ? "Tampilkan lebih sedikit"
                              : `Lihat semua (${spoken.length})`}
                          </Button>
                        )}
                      </Stack>
                    )}
                  </Box>
                </Card>
              );
            })}
          </Stack>
        </Box>
      ))}
    </Stack>
  );
}
