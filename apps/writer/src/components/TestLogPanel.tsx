"use client";

/**
 * "Log Uji" panel for manual use-case testing in the draft editor: a live,
 * downloadable list of what the tester just triggered (AI suggestions and
 * writing modes, voice, saves, collaboration status) with durations and a
 * per-feature summary against the reliability targets. See lib/testLog.ts.
 */
import * as React from "react";
import { Badge, Button, Group, Paper, ScrollArea, Table, Text, Tooltip } from "@mantine/core";
import {
  clearTestLog,
  getTestLog,
  installFetchLogger,
  percentile,
  subscribeTestLog,
  testLogToCsv,
  type TestLogEntry,
  type TestLogStatus,
} from "@/lib/testLog";

/** p95 targets from the automated reliability tests (tests/ai). */
const TARGET_MS: Record<string, number> = { Autocomplete: 1500 };
const WRITING_TARGET_MS = 15000;
const targetFor = (feature: string) =>
  TARGET_MS[feature] ?? (feature.startsWith("AI: ") ? WRITING_TARGET_MS : undefined);

const STATUS_COLOR: Record<TestLogStatus, string> = {
  ok: "green",
  kosong: "yellow",
  gagal: "red",
  dibatalkan: "gray",
  info: "blue",
};

const NO_ENTRIES: TestLogEntry[] = [];

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

function summarize(list: TestLogEntry[]) {
  const byFeature = new Map<string, TestLogEntry[]>();
  for (const entry of list) {
    if (entry.durationMs === undefined) continue;
    byFeature.set(entry.feature, [...(byFeature.get(entry.feature) ?? []), entry]);
  }
  return [...byFeature].map(([feature, rows]) => {
    // Cancelled copilot requests never reached the user, so they don't
    // count towards latency.
    const measured = rows.filter((r) => r.status !== "dibatalkan").map((r) => r.durationMs!);
    const avg = measured.length ? Math.round(measured.reduce((a, b) => a + b, 0) / measured.length) : undefined;
    return {
      feature,
      total: rows.length,
      ok: rows.filter((r) => r.status === "ok").length,
      failed: rows.filter((r) => r.status === "gagal").length,
      avg,
      p95: percentile(measured, 95),
      target: targetFor(feature),
    };
  });
}

export function TestLogPanel() {
  const [open, setOpen] = React.useState(false);
  const entries = React.useSyncExternalStore(subscribeTestLog, getTestLog, () => NO_ENTRIES);

  React.useEffect(() => installFetchLogger(), []);

  const summary = React.useMemo(() => summarize(entries), [entries]);
  const failures = entries.filter((e) => e.status === "gagal").length;

  const download = () => {
    const blob = new Blob(["﻿" + testLogToCsv(entries)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `log-uji-manual-${new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (!open) {
    return (
      <Button
        size="compact-sm"
        variant="filled"
        color={failures ? "red" : "dark"}
        style={{ position: "fixed", left: 16, bottom: 16, zIndex: 400 }}
        onClick={() => setOpen(true)}
      >
        Log Uji ({entries.length}
        {failures ? `, ${failures} gagal` : ""})
      </Button>
    );
  }

  return (
    <Paper
      shadow="lg"
      withBorder
      radius="md"
      p="sm"
      style={{
        position: "fixed",
        left: 16,
        bottom: 16,
        zIndex: 400,
        width: "min(640px, calc(100vw - 32px))",
        maxHeight: "60vh",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <Group justify="space-between" wrap="nowrap">
        <Text fw={700} size="sm">
          Log Uji Manual
        </Text>
        <Group gap={6} wrap="nowrap">
          <Button size="compact-xs" variant="light" onClick={download} disabled={!entries.length}>
            Unduh CSV
          </Button>
          <Button size="compact-xs" variant="light" color="red" onClick={clearTestLog} disabled={!entries.length}>
            Bersihkan
          </Button>
          <Button size="compact-xs" variant="subtle" color="gray" onClick={() => setOpen(false)}>
            Tutup
          </Button>
        </Group>
      </Group>

      {summary.length > 0 && (
        <Table withTableBorder fz="xs" verticalSpacing={2} horizontalSpacing={6}>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Fitur</Table.Th>
              <Table.Th>Jumlah</Table.Th>
              <Table.Th>Berhasil</Table.Th>
              <Table.Th>Gagal</Table.Th>
              <Table.Th>Rata-rata</Table.Th>
              <Table.Th>p95</Table.Th>
              <Table.Th>Target</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {summary.map((s) => {
              const meets = s.target === undefined || s.p95 === undefined ? undefined : s.p95 <= s.target;
              return (
                <Table.Tr key={s.feature}>
                  <Table.Td>{s.feature}</Table.Td>
                  <Table.Td>{s.total}</Table.Td>
                  <Table.Td>{s.ok}</Table.Td>
                  <Table.Td c={s.failed ? "red" : undefined}>{s.failed}</Table.Td>
                  <Table.Td>{s.avg !== undefined ? `${s.avg} ms` : "–"}</Table.Td>
                  <Table.Td>{s.p95 !== undefined ? `${s.p95} ms` : "–"}</Table.Td>
                  <Table.Td>
                    {s.target === undefined ? (
                      "–"
                    ) : (
                      <Badge size="xs" color={meets === false ? "red" : "green"} variant="light">
                        ≤ {s.target} ms {meets === undefined ? "" : meets ? "✓" : "✗"}
                      </Badge>
                    )}
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      )}

      <ScrollArea.Autosize mah="35vh" type="auto">
        {entries.length === 0 ? (
          <Text size="xs" c="dimmed">
            Belum ada aktivitas. Ketik di editor, pakai menu AI, mikrofon, atau simpan draft — setiap aksi akan muncul
            di sini.
          </Text>
        ) : (
          <Table fz="xs" verticalSpacing={2} horizontalSpacing={6} striped>
            <Table.Tbody>
              {[...entries].reverse().map((e) => (
                <Table.Tr key={e.id}>
                  <Table.Td style={{ whiteSpace: "nowrap" }}>{time(e.ts)}</Table.Td>
                  <Table.Td style={{ whiteSpace: "nowrap" }}>{e.feature}</Table.Td>
                  <Table.Td>
                    <Badge size="xs" color={STATUS_COLOR[e.status]} variant="light">
                      {e.status}
                    </Badge>
                  </Table.Td>
                  <Table.Td style={{ whiteSpace: "nowrap" }}>
                    {e.durationMs !== undefined ? `${e.durationMs} ms` : ""}
                  </Table.Td>
                  <Table.Td>
                    <Tooltip label={e.detail} disabled={!e.detail} multiline w={320} openDelay={300}>
                      <Text size="xs" lineClamp={1}>
                        {e.httpStatus && e.status === "gagal" ? `HTTP ${e.httpStatus} · ` : ""}
                        {e.detail}
                      </Text>
                    </Tooltip>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </ScrollArea.Autosize>
    </Paper>
  );
}
