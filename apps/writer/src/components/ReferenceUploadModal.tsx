"use client";

import * as React from "react";
import { Alert, Box, Button, Group, Modal, SimpleGrid, Stack, Text, TextInput, Textarea, UnstyledButton } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconAlertCircle, IconFileTypePdf, IconUpload, IconX } from "@tabler/icons-react";

/**
 * Pop-up behind the "+" on "Referensi Pustaka": pick a PDF (click or drag),
 * optionally fill in its details, and upload it through
 * /api/references/upload (which hands it to brain, like uploading there).
 */

const MAX_MB = 30;
const emptyMeta = { title: "", author: "", year: "", doi: "", abstract: "" };

export default function ReferenceUploadModal({
  opened,
  onClose,
  projectId,
  onUploaded,
}: {
  opened: boolean;
  onClose: () => void;
  projectId: string | null | undefined;
  onUploaded: () => void;
}) {
  const [file, setFile] = React.useState<File | null>(null);
  const [meta, setMeta] = React.useState(emptyMeta);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [dragging, setDragging] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const reset = () => {
    setFile(null);
    setMeta(emptyMeta);
    setError(null);
    setDragging(false);
  };

  const close = () => {
    if (busy) return; // keep it open while brain is still processing
    reset();
    onClose();
  };

  const pick = (picked: File | null | undefined) => {
    setError(null);
    if (!picked) return;
    if (picked.type !== "application/pdf" && !picked.name.toLowerCase().endsWith(".pdf")) {
      setError("Hanya file PDF yang bisa diunggah.");
      return;
    }
    if (picked.size > MAX_MB * 1024 * 1024) {
      setError(`File terlalu besar (maks ${MAX_MB} MB).`);
      return;
    }
    setFile(picked);
    setMeta((m) => (m.title ? m : { ...m, title: picked.name.replace(/\.pdf$/i, "") }));
  };

  const upload = async () => {
    if (!file || !projectId) return;
    setBusy(true);
    setError(null);
    const form = new FormData();
    form.append("file", file);
    form.append("projectId", projectId);
    Object.entries(meta).forEach(([key, value]) => value.trim() && form.append(key, value.trim()));
    try {
      const res = await fetch("/api/references/upload", { method: "POST", body: form });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `Unggah gagal (${res.status}).`);
      notifications.show({
        title: body.warning ? "Artikel tersimpan" : "Referensi ditambahkan",
        message: body.warning || `"${body.article?.title ?? file.name}" sudah masuk ke Referensi Pustaka.`,
        color: body.warning ? "yellow" : "green",
      });
      onUploaded();
      setBusy(false);
      reset();
      onClose();
    } catch (err) {
      setBusy(false);
      setError(err instanceof Error ? err.message : "Unggah gagal.");
    }
  };

  const set = (key: keyof typeof emptyMeta) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setMeta((m) => ({ ...m, [key]: e.currentTarget.value }));

  return (
    <Modal opened={opened} onClose={close} title={<Text fw={700}>Unggah Referensi Pustaka</Text>} radius="lg" size="lg" closeOnClickOutside={!busy} withCloseButton={!busy}>
      <Stack gap="md">
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          hidden
          onChange={(e) => {
            pick(e.currentTarget.files?.[0]);
            e.currentTarget.value = "";
          }}
        />
        <UnstyledButton
          onClick={() => !busy && inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            if (!busy) pick(e.dataTransfer.files?.[0]);
          }}
          style={{
            border: `2px dashed ${dragging ? "#007BFF" : "var(--mantine-color-default-border)"}`,
            borderRadius: 12,
            padding: "28px 16px",
            textAlign: "center",
            background: dragging ? "rgba(0,123,255,0.06)" : undefined,
            transition: "all 0.15s ease",
          }}
        >
          {file ? (
            <Group justify="center" gap="sm" wrap="nowrap">
              <IconFileTypePdf size={32} color="#e03131" />
              <Box style={{ minWidth: 0, textAlign: "left" }}>
                <Text fw={600} size="sm" truncate>
                  {file.name}
                </Text>
                <Text size="xs" c="dimmed">
                  {(file.size / 1024 / 1024).toFixed(1)} MB · klik untuk ganti
                </Text>
              </Box>
            </Group>
          ) : (
            <Stack gap={4} align="center">
              <IconUpload size={30} color="#007BFF" />
              <Text fw={600} size="sm">
                Klik atau seret file PDF ke sini
              </Text>
              <Text size="xs" c="dimmed">
                Maks {MAX_MB} MB
              </Text>
            </Stack>
          )}
        </UnstyledButton>

        <TextInput label="Judul" placeholder="Judul artikel" value={meta.title} onChange={set("title")} disabled={busy} />
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
          <TextInput label="Penulis" placeholder="mis. Rahman, A." value={meta.author} onChange={set("author")} disabled={busy} />
          <TextInput label="Tahun" placeholder="2024" value={meta.year} onChange={set("year")} disabled={busy} />
          <TextInput label="DOI" placeholder="10.xxxx/xxxx" value={meta.doi} onChange={set("doi")} disabled={busy} />
        </SimpleGrid>
        <Textarea label="Abstrak (opsional)" autosize minRows={2} maxRows={5} value={meta.abstract} onChange={set("abstract")} disabled={busy} />

        {error && (
          <Alert color="red" variant="light" icon={<IconAlertCircle size={16} />}>
            {error}
          </Alert>
        )}
        {busy && (
          <Text size="xs" c="dimmed">
            Mengunggah dan menganalisis PDF dengan AI… biasanya 30 detik – 2 menit. Jangan tutup halaman ini.
          </Text>
        )}

        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={close} disabled={busy} leftSection={<IconX size={14} />}>
            Batal
          </Button>
          <Button onClick={upload} loading={busy} disabled={!file || !projectId} leftSection={<IconUpload size={14} />}>
            Unggah
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
