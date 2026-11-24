"use client";

import * as React from "react";
import { ActionIcon, Alert, Badge, Box, Button, Divider, Group, Modal, Progress, Select, SimpleGrid, Stack, Text, TextInput, Textarea, ThemeIcon, Tooltip } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconAlertCircle, IconCloudUpload, IconFileImport, IconFileTypePdf, IconTrash, IconUpload, IconX } from "@tabler/icons-react";
import { parseRis, type RisRecord } from "@/lib/ris";

/**
 * Pop-up behind the "+" on "Referensi Pustaka": pick a PDF (click or drag),
 * optionally fill in its details, and upload it through
 * /api/references/upload (which hands it to brain, like uploading there).
 * The details can be filled from a .ris file (Zotero / Mendeley / EndNote /
 * Google Scholar export): "Impor RIS", or drop the .ris on the drop zone.
 */

const MAX_MB = 30;
const emptyMeta = { title: "", author: "", year: "", doi: "", abstract: "", keywords: "" };

const isRisFile = (f: File) => /\.ris$/i.test(f.name) || f.type === "application/x-research-info-systems";

function risToMeta(rec: RisRecord): typeof emptyMeta {
  return {
    title: rec.title,
    author: rec.authors.join("; "),
    year: rec.year,
    doi: rec.doi,
    abstract: rec.abstract,
    keywords: rec.keywords.join(", "),
  };
}

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
  const risInputRef = React.useRef<HTMLInputElement>(null);
  // Records read from the last .ris file (one is applied to the form).
  const [ris, setRis] = React.useState<{ name: string; records: RisRecord[]; index: number } | null>(null);

  const applyRis = (records: RisRecord[], index: number) => {
    const next = risToMeta(records[index]);
    // Keep what the user typed in fields the RIS file leaves empty.
    setMeta((m) => {
      const merged = { ...m };
      (Object.keys(next) as (keyof typeof emptyMeta)[]).forEach((k) => {
        if (next[k]) merged[k] = next[k];
      });
      return merged;
    });
  };

  const importRis = async (picked: File | null | undefined) => {
    setError(null);
    if (!picked) return;
    if (picked.size > 2 * 1024 * 1024) {
      setError("File RIS terlalu besar (maks 2 MB).");
      return;
    }
    let records: RisRecord[] = [];
    try {
      records = parseRis(await picked.text());
    } catch {
      records = [];
    }
    if (!records.length) {
      setError("File ini bukan RIS yang valid (tidak ada entri TY - … ER -).");
      return;
    }
    setRis({ name: picked.name, records, index: 0 });
    applyRis(records, 0);
    notifications.show({
      title: "Data RIS dimuat",
      message:
        records.length > 1
          ? `${records.length} entri ditemukan — pilih entri yang sesuai dengan PDF-nya.`
          : `Detail "${records[0].title || picked.name}" sudah terisi.`,
      color: "teal",
    });
  };

  const reset = () => {
    setFile(null);
    setMeta(emptyMeta);
    setRis(null);
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
    if (isRisFile(picked)) {
      void importRis(picked);
      return;
    }
    if (picked.type !== "application/pdf" && !picked.name.toLowerCase().endsWith(".pdf")) {
      setError("Hanya file PDF (atau .ris untuk mengisi detail) yang bisa dipilih.");
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

  // Read the value now: e.currentTarget is null by the time React runs the updater.
  const set = (key: keyof typeof emptyMeta) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = e.currentTarget.value;
    setMeta((m) => ({ ...m, [key]: value }));
  };

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
        <input
          ref={risInputRef}
          type="file"
          accept=".ris,application/x-research-info-systems"
          hidden
          onChange={(e) => {
            void importRis(e.currentTarget.files?.[0]);
            e.currentTarget.value = "";
          }}
        />
        {file ? (
          <Group
            gap="sm"
            wrap="nowrap"
            p="sm"
            style={{
              border: "1px solid var(--mantine-color-default-border)",
              borderRadius: 12,
              background: "var(--mantine-color-default-hover)",
            }}
          >
            <ThemeIcon size={44} radius="md" color="red" variant="light">
              <IconFileTypePdf size={26} />
            </ThemeIcon>
            <Box style={{ flex: 1, minWidth: 0 }}>
              <Text fw={600} size="sm" truncate title={file.name}>
                {file.name}
              </Text>
              <Text size="xs" c="dimmed">
                PDF · {(file.size / 1024 / 1024).toFixed(1)} MB
              </Text>
            </Box>
            <Button variant="subtle" size="xs" onClick={() => inputRef.current?.click()} disabled={busy}>
              Ganti
            </Button>
            <Tooltip label="Hapus file" withArrow>
              <ActionIcon variant="subtle" color="gray" onClick={() => setFile(null)} disabled={busy} aria-label="Hapus file">
                <IconTrash size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>
        ) : (
          <Box
            role="button"
            tabIndex={0}
            onClick={() => !busy && inputRef.current?.click()}
            onKeyDown={(e) => {
              if ((e.key === "Enter" || e.key === " ") && !busy) {
                e.preventDefault();
                inputRef.current?.click();
              }
            }}
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
              borderRadius: 14,
              padding: "28px 20px",
              textAlign: "center",
              cursor: busy ? "not-allowed" : "pointer",
              background: dragging ? "rgba(0,123,255,0.08)" : "rgba(0,123,255,0.025)",
              transition: "all 0.15s ease",
            }}
          >
            <Stack gap={8} align="center">
              <ThemeIcon size={56} radius="xl" variant="light" color="blue">
                <IconCloudUpload size={30} />
              </ThemeIcon>
              <Text fw={600} size="sm">
                {dragging ? "Lepaskan file di sini" : "Seret & lepas file PDF di sini"}
              </Text>
              <Text size="xs" c="dimmed">
                atau
              </Text>
              <Button size="xs" variant="light" radius="xl" leftSection={<IconFileTypePdf size={14} />} style={{ pointerEvents: "none" }}>
                Pilih file PDF
              </Button>
              <Text size="xs" c="dimmed">
                PDF · maks {MAX_MB} MB — file .ris juga boleh di-drop untuk mengisi detail
              </Text>
            </Stack>
          </Box>
        )}

        <Group gap="sm" wrap="nowrap" align="center">
          <Divider label="Detail artikel" labelPosition="left" style={{ flex: 1 }} />
          <Tooltip label="Isi otomatis dari file .ris (ekspor Zotero, Mendeley, EndNote, Google Scholar)" withArrow multiline w={240}>
            <Button
              size="xs"
              variant="light"
              color="teal"
              radius="xl"
              leftSection={<IconFileImport size={14} />}
              onClick={() => risInputRef.current?.click()}
              disabled={busy}
            >
              Impor RIS
            </Button>
          </Tooltip>
        </Group>

        {ris && (
          <Stack gap={6}>
            <Group gap={6} wrap="nowrap">
              <Badge color="teal" variant="light" style={{ textTransform: "none", minWidth: 0 }}>
                <Text span size="xs" truncate>
                  Dari {ris.name}
                </Text>
              </Badge>
              <ActionIcon size="sm" variant="subtle" color="gray" aria-label="Lepas data RIS" onClick={() => setRis(null)} disabled={busy}>
                <IconX size={12} />
              </ActionIcon>
            </Group>
            {ris.records.length > 1 && (
              <Select
                label={`Pilih entri (${ris.records.length} di file ini)`}
                value={String(ris.index)}
                allowDeselect={false}
                searchable
                disabled={busy}
                data={ris.records.map((r, i) => ({
                  value: String(i),
                  label: `${i + 1}. ${r.title || "(tanpa judul)"}${r.year ? ` (${r.year})` : ""}`,
                }))}
                onChange={(v) => {
                  if (v == null) return;
                  const index = Number(v);
                  setRis({ ...ris, index });
                  applyRis(ris.records, index);
                }}
                comboboxProps={{ withinPortal: true }}
              />
            )}
          </Stack>
        )}

        <TextInput label="Judul" placeholder="Judul artikel" value={meta.title} onChange={set("title")} disabled={busy} />
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
          <TextInput label="Penulis" placeholder="mis. Rahman, A." value={meta.author} onChange={set("author")} disabled={busy} />
          <TextInput label="Tahun" placeholder="2024" value={meta.year} onChange={set("year")} disabled={busy} />
          <TextInput label="DOI" placeholder="10.xxxx/xxxx" value={meta.doi} onChange={set("doi")} disabled={busy} />
        </SimpleGrid>
        <TextInput label="Kata kunci (opsional)" placeholder="mis. energi surya, desa" value={meta.keywords} onChange={set("keywords")} disabled={busy} />
        <Textarea label="Abstrak (opsional)" placeholder="Ringkasan singkat artikel" autosize minRows={2} maxRows={5} value={meta.abstract} onChange={set("abstract")} disabled={busy} />

        {error && (
          <Alert color="red" variant="light" icon={<IconAlertCircle size={16} />}>
            {error}
          </Alert>
        )}
        {busy && (
          <Stack gap={6}>
            <Progress value={100} animated striped size="sm" radius="xl" />
            <Text size="xs" c="dimmed">
              Mengunggah dan menganalisis PDF dengan AI… biasanya 30 detik – 2 menit. Jangan tutup halaman ini.
            </Text>
          </Stack>
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
