"use client";

import * as React from "react";
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Drawer,
  Group,
  Paper,
  ScrollArea,
  SegmentedControl,
  Stack,
  Text,
  Textarea,
  Tooltip,
} from "@mantine/core";
import { IconCheck, IconArrowBackUp, IconSend, IconTrash, IconMessageCircle } from "@tabler/icons-react";
import type { CommentThread } from "./comments";

export interface CommentUser {
  id: string;
  name: string;
  color: string;
}

interface CommentsPanelProps {
  opened: boolean;
  onClose: () => void;
  threads: Record<string, CommentThread>;
  activeId: string | null;
  currentUser: CommentUser;
  /** Text selected for a new comment, while the composer is open. */
  pendingQuote: string | null;
  onCreate: (text: string) => void;
  onCancelCreate: () => void;
  onReply: (threadId: string, text: string) => void;
  onResolve: (threadId: string, resolved: boolean) => void;
  onDelete: (threadId: string) => void;
  onDeleteReply: (threadId: string, replyId: string) => void;
  onFocusThread: (threadId: string) => void;
}

function formatTime(ts: number) {
  const date = new Date(ts);
  const sameDay = date.toDateString() === new Date().toDateString();
  return sameDay
    ? date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function Avatar({ name, color }: { name: string; color: string }) {
  return (
    <Box
      style={{
        width: 24,
        height: 24,
        borderRadius: "50%",
        background: color,
        color: "white",
        fontSize: 11,
        fontWeight: 700,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      {name.trim().charAt(0).toUpperCase() || "?"}
    </Box>
  );
}

/** Submit on Ctrl/Cmd+Enter, like most comment boxes. */
function useSubmitOnModEnter(submit: () => void) {
  return (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      submit();
    }
  };
}

function Composer({
  placeholder,
  submitLabel,
  autoFocus,
  onSubmit,
  onCancel,
}: {
  placeholder: string;
  submitLabel: string;
  autoFocus?: boolean;
  onSubmit: (text: string) => void;
  onCancel?: () => void;
}) {
  const [value, setValue] = React.useState("");
  const submit = () => {
    const text = value.trim();
    if (!text) return;
    onSubmit(text);
    setValue("");
  };
  const onKeyDown = useSubmitOnModEnter(submit);

  return (
    <Stack gap={6}>
      <Textarea
        value={value}
        onChange={(e) => setValue(e.currentTarget.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autosize
        minRows={2}
        maxRows={6}
        autoFocus={autoFocus}
        size="sm"
      />
      <Group justify="flex-end" gap={6}>
        {onCancel && (
          <Button variant="subtle" color="gray" size="xs" onClick={onCancel}>
            Batal
          </Button>
        )}
        <Button size="xs" leftSection={<IconSend size={14} />} onClick={submit} disabled={!value.trim()}>
          {submitLabel}
        </Button>
      </Group>
    </Stack>
  );
}

function ThreadCard({
  thread,
  active,
  currentUser,
  onReply,
  onResolve,
  onDelete,
  onDeleteReply,
  onFocus,
}: {
  thread: CommentThread;
  active: boolean;
  currentUser: CommentUser;
  onReply: (text: string) => void;
  onResolve: (resolved: boolean) => void;
  onDelete: () => void;
  onDeleteReply: (replyId: string) => void;
  onFocus: () => void;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (active) ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [active]);

  return (
    <Paper
      ref={ref}
      withBorder
      radius="md"
      p="sm"
      style={{
        borderColor: active ? "var(--mantine-color-yellow-5)" : undefined,
        boxShadow: active ? "0 0 0 2px rgba(250, 176, 5, 0.25)" : undefined,
        opacity: thread.resolved ? 0.75 : 1,
      }}
    >
      <Stack gap="xs">
        <Group justify="space-between" wrap="nowrap" gap={6}>
          <Text
            size="xs"
            c="dimmed"
            fs="italic"
            lineClamp={2}
            style={{ borderLeft: "3px solid var(--mantine-color-yellow-5)", paddingLeft: 8, cursor: "pointer", flex: 1 }}
            onClick={onFocus}
          >
            “{thread.quote}”
          </Text>
          <Group gap={2} wrap="nowrap">
            <Tooltip label={thread.resolved ? "Buka lagi" : "Tandai selesai"} withArrow>
              <ActionIcon
                variant="subtle"
                color={thread.resolved ? "gray" : "green"}
                size="sm"
                onClick={() => onResolve(!thread.resolved)}
              >
                {thread.resolved ? <IconArrowBackUp size={15} /> : <IconCheck size={15} />}
              </ActionIcon>
            </Tooltip>
            {thread.authorId === currentUser.id && (
              <Tooltip label="Hapus diskusi" withArrow>
                <ActionIcon variant="subtle" color="red" size="sm" onClick={onDelete}>
                  <IconTrash size={15} />
                </ActionIcon>
              </Tooltip>
            )}
          </Group>
        </Group>

        {thread.replies.map((reply, index) => (
          <Group key={reply.id} align="flex-start" gap={8} wrap="nowrap">
            <Avatar name={reply.authorName} color={reply.authorColor} />
            <Box style={{ flex: 1, minWidth: 0 }}>
              <Group gap={6} justify="space-between" wrap="nowrap">
                <Group gap={6} wrap="nowrap">
                  <Text size="sm" fw={600} truncate>
                    {reply.authorName}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {formatTime(reply.createdAt)}
                  </Text>
                </Group>
                {index > 0 && reply.authorId === currentUser.id && (
                  <ActionIcon variant="subtle" color="gray" size="xs" onClick={() => onDeleteReply(reply.id)}>
                    <IconTrash size={12} />
                  </ActionIcon>
                )}
              </Group>
              <Text size="sm" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                {reply.text}
              </Text>
            </Box>
          </Group>
        ))}

        {!thread.resolved && <Composer placeholder="Balas…" submitLabel="Balas" onSubmit={onReply} />}
      </Stack>
    </Paper>
  );
}

export function CommentsPanel(props: CommentsPanelProps) {
  const { threads, activeId, currentUser } = props;
  const [filter, setFilter] = React.useState<"open" | "resolved">("open");

  // Jump to the right tab when a resolved thread is focused from elsewhere.
  React.useEffect(() => {
    if (activeId && threads[activeId]) setFilter(threads[activeId].resolved ? "resolved" : "open");
  }, [activeId, threads]);

  const all = Object.values(threads).sort((a, b) => b.createdAt - a.createdAt);
  const open = all.filter((t) => !t.resolved);
  const resolved = all.filter((t) => t.resolved);
  const shown = filter === "open" ? open : resolved;

  return (
    <Drawer
      opened={props.opened}
      onClose={props.onClose}
      position="right"
      size="min(380px, 100vw)"
      withOverlay={false}
      lockScroll={false}
      trapFocus={false}
      title={
        <Group gap={8}>
          <IconMessageCircle size={18} />
          <Text fw={600}>Komentar</Text>
          <Badge size="sm" variant="light">
            {open.length}
          </Badge>
        </Group>
      }
      styles={{ body: { paddingTop: 0 } }}
    >
      <Stack gap="sm">
        {props.pendingQuote !== null && (
          <Paper withBorder radius="md" p="sm" style={{ borderColor: "var(--mantine-color-blue-4)" }}>
            <Stack gap="xs">
              <Group gap={8} wrap="nowrap">
                <Avatar name={currentUser.name} color={currentUser.color} />
                <Text size="sm" fw={600}>
                  {currentUser.name}
                </Text>
              </Group>
              <Text
                size="xs"
                c="dimmed"
                fs="italic"
                lineClamp={3}
                style={{ borderLeft: "3px solid var(--mantine-color-blue-4)", paddingLeft: 8 }}
              >
                “{props.pendingQuote}”
              </Text>
              <Composer
                placeholder="Tulis komentar… (Ctrl+Enter untuk kirim)"
                submitLabel="Kirim"
                autoFocus
                onSubmit={props.onCreate}
                onCancel={props.onCancelCreate}
              />
            </Stack>
          </Paper>
        )}

        <SegmentedControl
          size="xs"
          value={filter}
          onChange={(v) => setFilter(v as "open" | "resolved")}
          data={[
            { value: "open", label: `Aktif (${open.length})` },
            { value: "resolved", label: `Selesai (${resolved.length})` },
          ]}
        />

        <ScrollArea.Autosize mah="calc(100vh - 220px)" offsetScrollbars>
          <Stack gap="sm">
            {shown.length === 0 ? (
              <Text size="sm" c="dimmed" ta="center" py="lg">
                {filter === "open"
                  ? "Belum ada komentar. Blok teks di editor lalu klik “Komentar”."
                  : "Belum ada diskusi yang diselesaikan."}
              </Text>
            ) : (
              shown.map((thread) => (
                <ThreadCard
                  key={thread.id}
                  thread={thread}
                  active={thread.id === activeId}
                  currentUser={currentUser}
                  onReply={(text) => props.onReply(thread.id, text)}
                  onResolve={(resolved) => props.onResolve(thread.id, resolved)}
                  onDelete={() => props.onDelete(thread.id)}
                  onDeleteReply={(replyId) => props.onDeleteReply(thread.id, replyId)}
                  onFocus={() => props.onFocusThread(thread.id)}
                />
              ))
            )}
          </Stack>
        </ScrollArea.Autosize>
      </Stack>
    </Drawer>
  );
}
