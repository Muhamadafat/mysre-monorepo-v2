"use client";

import * as React from "react";
import {
  ActionIcon,
  Alert,
  Anchor,
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  Center,
  Group,
  Loader,
  Menu,
  Modal,
  Paper,
  PasswordInput,
  Progress,
  ScrollArea,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Tabs,
  Text,
  TextInput,
  Title,
  Tooltip,
  UnstyledButton,
  useComputedColorScheme,
  useMantineColorScheme,
} from "@mantine/core";
import {
  IconAlertCircle,
  IconArrowLeft,
  IconBook2,
  IconDownload,
  IconEye,
  IconFileText,
  IconFileZip,
  IconHistory,
  IconLogout,
  IconMicrophone,
  IconMoon,
  IconQuote,
  IconRefresh,
  IconSchool,
  IconSearch,
  IconSun,
  IconUsers,
} from "@tabler/icons-react";
import { DocView, citedNumbers, countWords } from "./DocView";
import "./admin.css";

// ── Types (match /api/admin/*) ─────────────────────────────────────────────
interface StudentRow {
  id: string;
  name: string | null;
  email: string;
  nim: string | null;
  group: string | null;
  university: string | null;
  major: string | null;
  role: string;
  avatarUrl: string | null;
  lastActivity: string | null;
  counts: {
    projects: number;
    collaborations: number;
    drafts: number;
    articles: number;
    annotations: number;
    recordings: number;
    recordingsMenulis: number;
    recordingsPerintah: number;
  };
  recordingBytes: number;
}

interface Bib {
  number: number;
  author?: string;
  title?: string;
  year?: string;
  journal?: string;
  publisher?: string;
  url?: string;
  doi?: string;
}

interface Project {
  id: string;
  title: string;
  description: string | null;
  coverColor: string;
  relation: "pemilik" | "kolaborator";
  owner: { id: string; name: string | null; email: string };
  collaborators: {
    id: string;
    name: string | null;
    email: string;
    role: string;
  }[];
  lastActivity: string;
  brainstorming: { id: string; title: string } | null;
  references: {
    id: string;
    title: string;
    author: string | null;
    year: string | null;
    doi: string | null;
  }[];
  bibliography: Bib[];
  drafts: {
    id: string;
    title: string;
    createdAt: string;
    byStudent: boolean;
    blocks: number;
    bibliographyCount: number;
  }[];
  recordingCount: number;
}

interface Recording {
  id: string;
  mode: "menulis" | "perintah";
  projectId: string | null;
  projectTitle: string | null;
  startedAt: string | null;
  durationSeconds: number | null;
  sizeBytes: number;
  wavSizeBytes: number | null;
  transcript: { at: string; role: string; text: string }[];
  aiTranscript: string | null;
  command: {
    status: string;
    intent: string | null;
    text: string | null;
    runs: number;
    actions: { command: string; ok: boolean; message: string }[];
  } | null;
  url: string;
  downloadUrl: string;
  wavUrl: string | null;
  wavDownloadUrl: string | null;
}

interface CommentReply {
  id: string;
  authorId: string;
  authorName: string;
  authorColor: string;
  text: string;
  createdAt: number;
}

interface CommentThread {
  id: string;
  quote: string;
  authorId: string;
  authorName: string;
  authorColor: string;
  createdAt: number;
  resolved: boolean;
  replies: CommentReply[];
}

/** GET /api/admin/projects/<id>: the live doc + who wrote what + comments. */
interface LiveProject {
  live: DocNodes;
  contributorNames: Record<string, string>;
  contributions: Record<string, { typed: number; ai: number }>;
  passages: { author: string; ai: boolean; text: string }[];
  comments: CommentThread[] | null;
}

interface Portfolio {
  user: {
    id: string;
    name: string | null;
    email: string;
    nim: string | null;
    group: string | null;
    university: string | null;
    faculty: string | null;
    major: string | null;
    semester: number | null;
    avatar_url: string | null;
  };
  stats: {
    projects: number;
    collaborations: number;
    drafts: number;
    references: number;
    bibliography: number;
    annotations: number;
    recordings: number;
    recordingSeconds: number;
    aiUsage: { purpose: string; calls: number; tokens: number }[];
  };
  projects: Project[];
  recordings: Recording[];
}

// ── Helpers ───────────────────────────────────────────────────────────────
const fmtDate = (value: string | null | undefined, withTime = true) =>
  value
    ? new Date(value).toLocaleString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
        ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
      })
    : "—";

const fmtBytes = (n: number | null | undefined) =>
  !n
    ? "—"
    : n < 1024 * 1024
      ? `${Math.round(n / 1024)} KB`
      : `${(n / 1024 / 1024).toFixed(1)} MB`;

const fmtDuration = (s: number | null | undefined) =>
  s == null
    ? "—"
    : s < 60
      ? `${s} dtk`
      : s < 3600
        ? `${Math.floor(s / 60)} mnt ${s % 60} dtk`
        : `${Math.floor(s / 3600)} j ${Math.floor((s % 3600) / 60)} mnt`;

const relative = (value: string | null) => {
  if (!value) return "belum ada aktivitas";
  const diff = (Date.now() - new Date(value).getTime()) / 1000;
  if (diff < 60) return "baru saja";
  if (diff < 3600) return `${Math.floor(diff / 60)} menit lalu`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} jam lalu`;
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)} hari lalu`;
  return fmtDate(value, false);
};

const initials = (name: string | null, email: string) =>
  (name || email)
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

const STATUS: Record<string, { label: string; color: string }> = {
  berhasil: { label: "Berhasil", color: "teal" },
  gagal: { label: "Gagal", color: "red" },
  tidak_dikenali: { label: "Tidak dikenali", color: "orange" },
  belum_dijalankan: { label: "Belum dijalankan", color: "gray" },
};

function formatBib(b: Bib): string {
  const parts = [
    b.author || "Tanpa nama",
    b.year ? `(${b.year})` : "(t.t.)",
    b.title ? `${b.title}.` : "",
  ];
  if (b.journal) parts.push(`${b.journal}.`);
  else if (b.publisher) parts.push(`${b.publisher}.`);
  return parts.filter(Boolean).join(" ");
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  const json = await res.json().catch(() => ({}));
  if (!res.ok)
    throw Object.assign(new Error(json.error || `Gagal (${res.status})`), {
      status: res.status,
    });
  return json as T;
}

// Live data per project, shared by the bubbles and their pop-ups (one
// PartyKit read per project per minute instead of one per pop-up).
const liveCache = new Map<
  string,
  { at: number; promise: Promise<LiveProject> }
>();
function fetchLive(projectId: string): Promise<LiveProject> {
  const hit = liveCache.get(projectId);
  if (hit && Date.now() - hit.at < 60_000) return hit.promise;
  const promise = getJson<LiveProject>(`/api/admin/projects/${projectId}`);
  liveCache.set(projectId, { at: Date.now(), promise });
  promise.catch(() => liveCache.delete(projectId));
  return promise;
}

function useLiveProject(projectId: string) {
  const [state, setState] = React.useState<{
    data?: LiveProject;
    error?: string;
  }>({});
  React.useEffect(() => {
    let cancelled = false;
    fetchLive(projectId)
      .then((data) => !cancelled && setState({ data }))
      .catch((err) => !cancelled && setState({ error: err.message }));
    return () => {
      cancelled = true;
    };
  }, [projectId]);
  return {
    ...state,
    loading: !state.data && !state.error,
    offline: !!state.data && state.data.live === null,
  };
}

// ── Login ─────────────────────────────────────────────────────────────────
function LoginCard({ onDone }: { onDone: () => void }) {
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    setBusy(false);
    if (res.ok) onDone();
    else setError((await res.json().catch(() => ({}))).error || "Login gagal.");
  };

  return (
    <Center mih="100vh" p="md" className="adm-login-bg">
      <Paper
        component="form"
        onSubmit={submit}
        w="100%"
        maw={380}
        p="xl"
        radius="lg"
        shadow="xl"
        withBorder
      >
        <Stack gap="md">
          <Group gap="sm">
            <Box className="adm-logo">
              <IconSchool size={22} />
            </Box>
            <div>
              <Title order={3}>Peneliti SRE Writer</Title>
              <Text size="sm" c="dimmed">
                Masuk sebagai peneliti
              </Text>
            </div>
          </Group>
          {error && (
            <Alert
              color="red"
              variant="light"
              icon={<IconAlertCircle size={16} />}
            >
              {error}
            </Alert>
          )}
          <TextInput
            label="Username"
            value={username}
            onChange={(e) => setUsername(e.currentTarget.value)}
            autoFocus
            autoComplete="username"
            required
          />
          <PasswordInput
            label="Password"
            value={password}
            onChange={(e) => setPassword(e.currentTarget.value)}
            autoComplete="current-password"
            required
          />
          <Button type="submit" loading={busy} fullWidth size="md">
            Masuk
          </Button>
          <Text size="xs" c="dimmed" ta="center">
            Halaman ini hanya membaca data — tidak ada yang diubah.
          </Text>
        </Stack>
      </Paper>
    </Center>
  );
}

// ── Small pieces ──────────────────────────────────────────────────────────
function Stat({
  label,
  value,
  icon,
  color = "blue",
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  color?: string;
}) {
  return (
    <Paper p="sm" radius="md" withBorder className="adm-stat">
      <Group gap="sm" wrap="nowrap">
        <Box className="adm-stat-icon" data-color={color}>
          {icon}
        </Box>
        <div style={{ minWidth: 0 }}>
          <Text
            fw={700}
            size="lg"
            lh={1.1}
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {value}
          </Text>
          <Text size="xs" c="dimmed" truncate>
            {label}
          </Text>
        </div>
      </Group>
    </Paper>
  );
}

function ZipMenu({
  userId,
  label,
  disabled,
}: {
  userId: string;
  label: string;
  disabled?: boolean;
}) {
  const href = (format: string) =>
    `/api/admin/zip?userId=${encodeURIComponent(userId)}&format=${format}`;
  return (
    <Menu position="bottom-end" shadow="md" withinPortal>
      <Menu.Target>
        <Button
          leftSection={<IconFileZip size={16} />}
          variant="light"
          disabled={disabled}
          size="sm"
        >
          {label}
        </Button>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>
          Satu file ZIP, rapi per mahasiswa / proyek / mode
        </Menu.Label>
        <Menu.Item
          component="a"
          href={href("mp3")}
          leftSection={<IconDownload size={14} />}
        >
          MP3 + transkrip (kecil)
        </Menu.Item>
        <Menu.Item
          component="a"
          href={href("wav")}
          leftSection={<IconDownload size={14} />}
        >
          WAV 16 kHz + transkrip (asli)
        </Menu.Item>
        <Menu.Item
          component="a"
          href={href("both")}
          leftSection={<IconDownload size={14} />}
        >
          MP3 + WAV + transkrip
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}

// ── Reading a document (live or a saved version) ─────────────────────────
type Reading =
  | { kind: "live"; project: Project }
  | {
      kind: "draft";
      project: Project;
      draftId: string;
      title: string;
      createdAt: string;
    };

type DocNodes = Parameters<typeof DocView>[0]["live"];
type DocBlocks = Parameters<typeof DocView>[0]["blocks"];
interface ReaderState {
  loading: boolean;
  error?: string;
  live?: DocNodes;
  blocks?: DocBlocks;
  bibliography?: Bib[];
}

function ReaderModal({
  reading,
  onClose,
}: {
  reading: Reading | null;
  onClose: () => void;
}) {
  // One body per opened document (keyed), so its loading state starts fresh.
  const key = reading
    ? reading.kind === "live"
      ? `live:${reading.project.id}`
      : `draft:${reading.draftId}`
    : "none";
  return (
    <Modal
      opened={!!reading}
      onClose={onClose}
      size="min(960px, 100%)"
      radius="lg"
      title={
        reading && (
          <Stack gap={2}>
            <Text fw={700}>{reading.project.title}</Text>
            <Text size="xs" c="dimmed">
              {reading.kind === "live"
                ? "Isi terkini (langsung dari editor kolaborasi)"
                : `Versi "${reading.title}" · ${fmtDate(reading.createdAt)}`}
            </Text>
          </Stack>
        )
      }
      scrollAreaComponent={ScrollArea.Autosize}
    >
      {reading && <ReaderBody key={key} reading={reading} />}
    </Modal>
  );
}

function ReaderBody({ reading }: { reading: Reading }) {
  const [state, setState] = React.useState<ReaderState>({ loading: true });

  React.useEffect(() => {
    let cancelled = false;
    const url =
      reading.kind === "live"
        ? `/api/admin/projects/${reading.project.id}`
        : `/api/admin/drafts/${reading.draftId}`;
    getJson<{ live?: DocNodes; blocks?: DocBlocks; bibliography?: Bib[] }>(url)
      .then((data) => {
        if (cancelled) return;
        if (reading.kind === "live")
          setState({
            loading: false,
            live: data.live ?? null,
            bibliography: reading.project.bibliography,
          });
        else
          setState({
            loading: false,
            blocks: data.blocks,
            bibliography: data.bibliography,
          });
      })
      .catch(
        (err) => !cancelled && setState({ loading: false, error: err.message }),
      );
    return () => {
      cancelled = true;
    };
  }, [reading]);

  const liveMissing =
    reading.kind === "live" &&
    !state.loading &&
    !state.error &&
    state.live === null;
  const words = countWords(state.live, state.blocks);
  const cited = citedNumbers(state.live, state.blocks);
  const bib = state.bibliography ?? [];

  return (
    <>
      {state.loading && (
        <Center py="xl">
          <Loader />
        </Center>
      )}
      {state.error && <Alert color="red">{state.error}</Alert>}
      {liveMissing && (
        <Alert color="yellow" icon={<IconAlertCircle size={16} />}>
          Server kolaborasi (PartyKit) tidak terhubung, jadi isi terkini tidak
          bisa dibaca. Buka salah satu <b>versi tersimpan</b> di bawah judul
          proyek.
        </Alert>
      )}
      {!state.loading && !state.error && !liveMissing && (
        <Stack gap="md">
          <Group gap="xs">
            <Badge variant="light">{words.toLocaleString("id-ID")} kata</Badge>
            <Badge variant="light" color="grape">
              {cited.length} sitasi dipakai
            </Badge>
            <Badge variant="light" color="teal">
              {bib.length} entri daftar pustaka
            </Badge>
          </Group>
          <Paper
            withBorder
            radius="md"
            p={{ base: "md", sm: "xl" }}
            className="adm-paper"
          >
            <DocView live={state.live} blocks={state.blocks} />
          </Paper>
          <BibliographyList bib={bib} cited={cited} />
        </Stack>
      )}
    </>
  );
}

function BibliographyList({ bib, cited }: { bib: Bib[]; cited?: number[] }) {
  if (!bib.length) {
    return (
      <Text size="sm" c="dimmed">
        Belum ada daftar pustaka tersimpan.
        {cited?.length
          ? ` Teks memakai sitasi ${cited.map((n) => `[${n}]`).join(", ")} tapi entrinya belum tersimpan di versi mana pun.`
          : ""}
      </Text>
    );
  }
  const numbers = new Set(bib.map((b) => b.number));
  const orphan = (cited ?? []).filter((n) => !numbers.has(n));
  return (
    <Stack gap={6}>
      <Text fw={600} size="sm">
        Daftar Pustaka
      </Text>
      {[...bib]
        .sort((a, b) => a.number - b.number)
        .map((b) => {
          const link = b.doi
            ? `https://doi.org/${b.doi.replace(/^https?:\/\/(dx\.)?doi\.org\//, "")}`
            : b.url;
          const used = !cited || cited.includes(b.number);
          return (
            <Group
              key={b.number}
              gap="xs"
              wrap="nowrap"
              align="flex-start"
              opacity={used ? 1 : 0.55}
            >
              <span className="adm-cite">[{b.number}]</span>
              <Text size="sm" style={{ flex: 1 }}>
                {formatBib(b)}{" "}
                {link && (
                  <Anchor
                    href={link}
                    target="_blank"
                    rel="noreferrer"
                    size="sm"
                  >
                    {b.doi ? `doi:${b.doi}` : "tautan"}
                  </Anchor>
                )}
                {!used && (
                  <Text span size="xs" c="dimmed">
                    {" "}
                    (tidak dikutip di teks)
                  </Text>
                )}
              </Text>
            </Group>
          );
        })}
      {orphan.length > 0 && (
        <Text size="xs" c="orange">
          Sitasi tanpa entri: {orphan.map((n) => `[${n}]`).join(", ")}
        </Text>
      )}
    </Stack>
  );
}

// ── Tabs of a student ─────────────────────────────────────────────────────
function ProjectsTab({
  portfolio,
  onRead,
}: {
  portfolio: Portfolio;
  onRead: (r: Reading) => void;
}) {
  const [popup, setPopup] = React.useState<{
    kind: PopupKind;
    project: Project;
  } | null>(null);
  if (!portfolio.projects.length)
    return <Empty text="Belum punya proyek tulisan." />;
  return (
    <Stack gap="md">
      <ProjectPopup
        popup={popup}
        portfolio={portfolio}
        onClose={() => setPopup(null)}
        onRead={(r) => {
          setPopup(null);
          onRead(r);
        }}
      />
      {portfolio.projects.map((project) => (
        <Card
          key={project.id}
          withBorder
          radius="md"
          padding="md"
          className="adm-project"
          style={{ borderLeftColor: project.coverColor }}
        >
          <Group
            justify="space-between"
            align="flex-start"
            wrap="wrap"
            gap="sm"
          >
            <div style={{ minWidth: 0, flex: 1 }}>
              <Group gap="xs" mb={4}>
                <Text fw={700} size="md">
                  {project.title}
                </Text>
                <Badge
                  size="xs"
                  variant="light"
                  color={project.relation === "pemilik" ? "blue" : "grape"}
                >
                  {project.relation}
                </Badge>
              </Group>
              <Text size="xs" c="dimmed">
                Aktif {relative(project.lastActivity)}
                {project.relation === "kolaborator" &&
                  ` · milik ${project.owner.name || project.owner.email}`}
                {project.collaborators.length > 0 &&
                  ` · kolaborator: ${project.collaborators.map((c) => c.name || c.email).join(", ")}`}
              </Text>
            </div>
            <Button
              size="xs"
              leftSection={<IconEye size={14} />}
              onClick={() => onRead({ kind: "live", project })}
            >
              Baca tulisan
            </Button>
          </Group>

          <ProjectBubbles
            project={project}
            onOpen={(kind) => setPopup({ kind, project })}
          />

          {project.drafts.length > 0 && (
            <ScrollArea.Autosize mah={180} mt="sm">
              <Table verticalSpacing={4} fz="sm" highlightOnHover>
                <Table.Tbody>
                  {project.drafts.map((draft, i) => (
                    <Table.Tr key={draft.id}>
                      <Table.Td w={70}>
                        <Text size="xs" c="dimmed">
                          v{project.drafts.length - i}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" lineClamp={1}>
                          {draft.title}
                        </Text>
                      </Table.Td>
                      <Table.Td visibleFrom="sm">
                        <Text size="xs" c="dimmed">
                          {fmtDate(draft.createdAt)}
                        </Text>
                      </Table.Td>
                      <Table.Td w={40}>
                        <Tooltip label="Buka versi ini">
                          <ActionIcon
                            variant="subtle"
                            onClick={() =>
                              onRead({
                                kind: "draft",
                                project,
                                draftId: draft.id,
                                title: draft.title,
                                createdAt: draft.createdAt,
                              })
                            }
                            aria-label="Buka versi"
                          >
                            <IconHistory size={16} />
                          </ActionIcon>
                        </Tooltip>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </ScrollArea.Autosize>
          )}
        </Card>
      ))}
    </Stack>
  );
}

function RecordingsTab({ portfolio }: { portfolio: Portfolio }) {
  const [mode, setMode] = React.useState("semua");
  const [project, setProject] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");

  const projects = [
    ...new Map(
      portfolio.recordings.map((r) => [
        r.projectId ?? "",
        r.projectTitle ?? "Tanpa proyek",
      ]),
    ).entries(),
  ];
  const rows = portfolio.recordings.filter(
    (r) =>
      (mode === "semua" || r.mode === mode) &&
      (!project || (r.projectId ?? "") === project) &&
      (!query ||
        [
          ...r.transcript.map((t) => t.text),
          r.aiTranscript ?? "",
          r.command?.intent ?? "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(query.toLowerCase())),
  );

  if (!portfolio.recordings.length)
    return <Empty text="Belum ada rekaman suara." />;

  return (
    <Stack gap="sm">
      <Group gap="sm" wrap="wrap" justify="space-between">
        <Group gap="sm" wrap="wrap">
          <SegmentedControl
            size="xs"
            value={mode}
            onChange={setMode}
            data={[
              {
                label: `Semua (${portfolio.recordings.length})`,
                value: "semua",
              },
              { label: "Menulis", value: "menulis" },
              { label: "Perintah", value: "perintah" },
            ]}
          />
          <Select
            size="xs"
            placeholder="Semua proyek"
            clearable
            value={project}
            onChange={setProject}
            data={projects.map(([value, label]) => ({ value, label }))}
            w={200}
          />
          <TextInput
            size="xs"
            placeholder="Cari di transkrip…"
            leftSection={<IconSearch size={14} />}
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
            w={200}
          />
        </Group>
        <ZipMenu userId={portfolio.user.id} label="Unduh semua (ZIP)" />
      </Group>

      <Text size="xs" c="dimmed">
        {rows.length} rekaman ditampilkan
      </Text>

      <Stack gap="xs">
        {rows.map((r) => (
          <RecordingCard key={r.id} r={r} />
        ))}
      </Stack>
    </Stack>
  );
}

function RecordingCard({ r }: { r: Recording }) {
  const said = r.transcript
    .filter((t) => t.role === "user")
    .map((t) => t.text)
    .join(" ");
  const status = r.command
    ? (STATUS[r.command.status] ?? { label: r.command.status, color: "gray" })
    : null;
  return (
    <Paper withBorder radius="md" p="sm" className="adm-rec">
      <Group justify="space-between" align="flex-start" wrap="wrap" gap="xs">
        <Group gap="xs" wrap="wrap">
          <Badge
            color={r.mode === "menulis" ? "blue" : "violet"}
            variant="light"
          >
            {r.mode}
          </Badge>
          <Text size="sm" fw={600}>
            {fmtDate(r.startedAt)}
          </Text>
          <Text size="xs" c="dimmed">
            {fmtDuration(r.durationSeconds)} ·{" "}
            {r.projectTitle ?? "Tanpa proyek"}
          </Text>
          {status && (
            <Badge size="sm" color={status.color} variant="outline">
              {status.label}
              {r.command?.intent
                ? ` · ${r.command.intent.replace(/_/g, " ")}`
                : ""}
            </Badge>
          )}
        </Group>
        <Group gap={6}>
          <Button
            component="a"
            href={r.downloadUrl}
            size="compact-xs"
            variant="light"
            leftSection={<IconDownload size={12} />}
          >
            MP3 · {fmtBytes(r.sizeBytes)}
          </Button>
          {r.wavDownloadUrl && (
            <Button
              component="a"
              href={r.wavDownloadUrl}
              size="compact-xs"
              variant="default"
              leftSection={<IconDownload size={12} />}
            >
              WAV · {fmtBytes(r.wavSizeBytes)}
            </Button>
          )}
        </Group>
      </Group>
      <audio controls preload="none" src={r.url} className="adm-audio" />
      {said ? (
        <Text size="sm" mt={4} className="adm-quote">
          “{said}”
        </Text>
      ) : (
        <Text size="xs" c="dimmed" mt={4}>
          Tidak ada transkrip langsung.
        </Text>
      )}
      {r.aiTranscript && (
        <Text size="xs" c="dimmed" mt={4}>
          <b>Transkrip AI:</b> {r.aiTranscript}
        </Text>
      )}
      {r.command && r.command.actions.length > 0 && (
        <Text size="xs" c="dimmed" mt={4}>
          <b>Aksi:</b>{" "}
          {r.command.actions
            .map((a) => `${a.command}${a.ok ? " ✓" : " ✗"}`)
            .join(" → ")}
          {r.command.runs > 1 && ` (dijalankan ${r.command.runs}×)`}
        </Text>
      )}
    </Paper>
  );
}

// ── Bubbles under each project + their pop-ups ────────────────────────────
type PopupKind =
  "versi" | "artikel" | "pustaka" | "rekaman" | "kolaborator" | "diskusi";
type Person = {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
};

/**
 * Owner + collaborators (deduplicated, owner first), plus anyone who has
 * words in the live document but is no longer in the collaborator table.
 */
function projectPeople(project: Project, live?: LiveProject) {
  const people = new Map<string, Person>();
  people.set(project.owner.id, { ...project.owner, role: "pemilik" });
  for (const c of project.collaborators) {
    if (!people.has(c.id))
      people.set(c.id, { ...c, role: c.role === "owner" ? "pemilik" : c.role });
  }
  for (const id of Object.keys(live?.contributions ?? {})) {
    if (!people.has(id))
      people.set(id, {
        id,
        name: live?.contributorNames[id] ?? null,
        email: null,
        role: "mantan",
      });
  }
  return people;
}

function Bubble({
  color,
  children,
  onClick,
  title,
}: {
  color: string;
  children: React.ReactNode;
  onClick: () => void;
  title: string;
}) {
  return (
    <Tooltip label={title} openDelay={400}>
      <Badge
        component="button"
        type="button"
        variant="dot"
        color={color}
        onClick={onClick}
        className="adm-bubble"
      >
        {children}
      </Badge>
    </Tooltip>
  );
}

function ProjectBubbles({
  project,
  onOpen,
}: {
  project: Project;
  onOpen: (kind: PopupKind) => void;
}) {
  const live = useLiveProject(project.id);
  const people = projectPeople(project, live.data);
  const comments = live.data?.comments;
  const open = comments?.filter((t) => !t.resolved).length ?? 0;
  return (
    <Group gap="xs" mt="sm">
      <Bubble
        color="blue"
        onClick={() => onOpen("versi")}
        title="Lihat semua versi tersimpan"
      >
        {project.drafts.length} versi
      </Bubble>
      <Bubble
        color="teal"
        onClick={() => onOpen("artikel")}
        title="Lihat artikel referensi"
      >
        {project.references.length} artikel referensi
      </Bubble>
      <Bubble
        color="grape"
        onClick={() => onOpen("pustaka")}
        title="Lihat daftar pustaka"
      >
        {project.bibliography.length} daftar pustaka
      </Bubble>
      <Bubble
        color="orange"
        onClick={() => onOpen("rekaman")}
        title="Lihat rekaman (menulis & perintah)"
      >
        {project.recordingCount} rekaman
      </Bubble>
      <Bubble
        color="cyan"
        onClick={() => onOpen("kolaborator")}
        title="Siapa kolaboratornya dan apa yang mereka tulis"
      >
        {people.size} kolaborator
      </Bubble>
      <Bubble
        color="pink"
        onClick={() => onOpen("diskusi")}
        title="Komentar / diskusi di tulisan"
      >
        {live.loading ? "…" : comments ? comments.length : "?"} diskusi
        {open > 0 ? ` · ${open} terbuka` : ""}
      </Bubble>
    </Group>
  );
}

const POPUP_TITLE: Record<PopupKind, string> = {
  versi: "Versi tersimpan",
  artikel: "Artikel referensi",
  pustaka: "Daftar pustaka",
  rekaman: "Rekaman suara",
  kolaborator: "Kolaborator",
  diskusi: "Diskusi & komentar",
};

function ProjectPopup({
  popup,
  portfolio,
  onClose,
  onRead,
}: {
  popup: { kind: PopupKind; project: Project } | null;
  portfolio: Portfolio;
  onClose: () => void;
  onRead: (r: Reading) => void;
}) {
  const wide = popup?.kind === "kolaborator" || popup?.kind === "rekaman";
  return (
    <Modal
      opened={!!popup}
      onClose={onClose}
      size={wide ? "min(900px, 100%)" : "min(720px, 100%)"}
      radius="lg"
      scrollAreaComponent={ScrollArea.Autosize}
      title={
        popup && (
          <Stack gap={2}>
            <Text fw={700}>{POPUP_TITLE[popup.kind]}</Text>
            <Text size="xs" c="dimmed">
              {popup.project.title}
            </Text>
          </Stack>
        )
      }
    >
      {popup?.kind === "versi" && (
        <VersionsPopup project={popup.project} onRead={onRead} />
      )}
      {popup?.kind === "artikel" &&
        (popup.project.references.length ? (
          <Stack gap="xs">
            {popup.project.brainstorming && (
              <Text size="xs" c="dimmed">
                Dari sesi brainstorming “{popup.project.brainstorming.title}”
              </Text>
            )}
            <ReferenceList refs={popup.project.references} />
          </Stack>
        ) : (
          <Empty text="Belum ada artikel referensi di proyek ini." />
        ))}
      {popup?.kind === "pustaka" && (
        <BibliographyList bib={popup.project.bibliography} />
      )}
      {popup?.kind === "rekaman" && (
        <ProjectRecordingsPopup
          recordings={portfolio.recordings.filter(
            (r) => r.projectId === popup.project.id,
          )}
        />
      )}
      {popup?.kind === "kolaborator" && (
        <CollaboratorsPopup project={popup.project} />
      )}
      {popup?.kind === "diskusi" && <DiscussionPopup project={popup.project} />}
    </Modal>
  );
}

function VersionsPopup({
  project,
  onRead,
}: {
  project: Project;
  onRead: (r: Reading) => void;
}) {
  if (!project.drafts.length)
    return <Empty text="Belum ada versi yang disimpan." />;
  return (
    <Table verticalSpacing={6} fz="sm" highlightOnHover>
      <Table.Thead>
        <Table.Tr>
          <Table.Th w={60}>Versi</Table.Th>
          <Table.Th>Judul</Table.Th>
          <Table.Th visibleFrom="sm">Disimpan</Table.Th>
          <Table.Th visibleFrom="sm">Isi</Table.Th>
          <Table.Th w={90} />
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {project.drafts.map((draft, i) => (
          <Table.Tr key={draft.id}>
            <Table.Td>
              <Badge size="sm" variant="light">
                v{project.drafts.length - i}
              </Badge>
            </Table.Td>
            <Table.Td>
              <Text size="sm" lineClamp={2}>
                {draft.title}
              </Text>
              {!draft.byStudent && (
                <Text size="xs" c="dimmed">
                  disimpan kolaborator lain
                </Text>
              )}
            </Table.Td>
            <Table.Td visibleFrom="sm">
              <Text size="xs" c="dimmed">
                {fmtDate(draft.createdAt)}
              </Text>
            </Table.Td>
            <Table.Td visibleFrom="sm">
              <Text size="xs" c="dimmed">
                {draft.blocks} blok · {draft.bibliographyCount} pustaka
              </Text>
            </Table.Td>
            <Table.Td>
              <Button
                size="compact-xs"
                variant="light"
                leftSection={<IconEye size={12} />}
                onClick={() =>
                  onRead({
                    kind: "draft",
                    project,
                    draftId: draft.id,
                    title: draft.title,
                    createdAt: draft.createdAt,
                  })
                }
              >
                Buka
              </Button>
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}

function ProjectRecordingsPopup({ recordings }: { recordings: Recording[] }) {
  const menulis = recordings.filter((r) => r.mode === "menulis");
  const perintah = recordings.filter((r) => r.mode === "perintah");
  const [mode, setMode] = React.useState<string>(
    menulis.length || !perintah.length ? "menulis" : "perintah",
  );
  if (!recordings.length)
    return <Empty text="Belum ada rekaman di proyek ini." />;
  const rows = mode === "menulis" ? menulis : perintah;
  return (
    <Stack gap="sm">
      <SegmentedControl
        value={mode}
        onChange={setMode}
        fullWidth
        data={[
          { label: `Menulis (${menulis.length})`, value: "menulis" },
          { label: `Perintah (${perintah.length})`, value: "perintah" },
        ]}
      />
      <Text size="xs" c="dimmed">
        {mode === "menulis"
          ? "Suara yang didiktekan menjadi tulisan di editor."
          : "Perintah suara yang dijalankan di editor, beserta hasilnya."}
      </Text>
      {rows.length ? (
        rows.map((r) => <RecordingCard key={r.id} r={r} />)
      ) : (
        <Empty text={`Belum ada rekaman mode ${mode}.`} />
      )}
    </Stack>
  );
}

/** Loading / error / PartyKit-off notice for pop-ups that read the live doc. */
function LiveStatus({ live }: { live: ReturnType<typeof useLiveProject> }) {
  if (live.loading)
    return (
      <Center py="xl">
        <Loader />
      </Center>
    );
  if (live.error) return <Alert color="red">{live.error}</Alert>;
  if (live.offline)
    return (
      <Alert color="yellow" icon={<IconAlertCircle size={16} />}>
        Server kolaborasi (PartyKit) tidak terhubung, jadi data dari editor
        (tulisan tiap kolaborator & komentar) tidak bisa dibaca sekarang.
      </Alert>
    );
  return null;
}

function CollaboratorsPopup({ project }: { project: Project }) {
  const live = useLiveProject(project.id);
  const data = live.data;
  const [active, setActive] = React.useState<string | null>(null);
  const rows = [...projectPeople(project, data).values()]
    .map((p) => {
      const c = data?.contributions[p.id] ?? { typed: 0, ai: 0 };
      return {
        ...p,
        name: p.name || data?.contributorNames[p.id] || null,
        typed: c.typed,
        ai: c.ai,
        total: c.typed + c.ai,
      };
    })
    .sort((a, b) => b.total - a.total);
  const allWords = rows.reduce((n, r) => n + r.total, 0);
  const shown = active ?? rows[0]?.id ?? null;
  const current = rows.find((r) => r.id === shown);
  const passages = (data?.passages ?? []).filter((p) => p.author === shown);
  const hasLive = !!data && !live.offline;

  return (
    <Stack gap="md">
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
        {rows.map((p) => (
          <UnstyledButton
            key={p.id}
            onClick={() => setActive(p.id)}
            className="adm-student"
            data-active={shown === p.id || undefined}
          >
            <Group gap="sm" wrap="nowrap">
              <Avatar radius="xl" color="blue" size={36}>
                {initials(p.name, p.email ?? p.id)}
              </Avatar>
              <div style={{ minWidth: 0, flex: 1 }}>
                <Group gap={6} wrap="nowrap">
                  <Text size="sm" fw={600} truncate>
                    {p.name || p.email || "Kolaborator"}
                  </Text>
                  <Badge
                    size="xs"
                    variant="light"
                    color={
                      p.role === "pemilik"
                        ? "blue"
                        : p.role === "mantan"
                          ? "gray"
                          : "grape"
                    }
                  >
                    {p.role}
                  </Badge>
                </Group>
                {p.email && (
                  <Text size="xs" c="dimmed" truncate>
                    {p.email}
                  </Text>
                )}
              </div>
            </Group>
            {hasLive && (
              <>
                <Progress.Root size="sm" mt={8}>
                  <Progress.Section
                    value={allWords ? (p.typed / allWords) * 100 : 0}
                    color="blue"
                  />
                  <Progress.Section
                    value={allWords ? (p.ai / allWords) * 100 : 0}
                    color="violet"
                  />
                </Progress.Root>
                <Text size="xs" c="dimmed" mt={4}>
                  {p.typed.toLocaleString("id-ID")} kata diketik ·{" "}
                  {p.ai.toLocaleString("id-ID")} kata AI
                  {allWords
                    ? ` · ${Math.round((p.total / allWords) * 100)}%`
                    : ""}
                </Text>
              </>
            )}
          </UnstyledButton>
        ))}
      </SimpleGrid>

      <LiveStatus live={live} />

      {hasLive && current && (
        <Stack gap="xs">
          <Group justify="space-between">
            <Text fw={600} size="sm">
              Hasil tulisan {current.name || current.email || "kolaborator"}
            </Text>
            <Group gap={6}>
              <Badge size="xs" variant="light" color="blue">
                diketik
              </Badge>
              <Badge size="xs" variant="light" color="violet">
                dari AI
              </Badge>
            </Group>
          </Group>
          {passages.length ? (
            <Paper withBorder radius="md" p="md" className="adm-paper">
              <Stack gap={8}>
                {passages.map((p, i) => (
                  <Text
                    key={i}
                    size="sm"
                    className="adm-passage"
                    data-ai={p.ai || undefined}
                  >
                    {p.text}
                  </Text>
                ))}
              </Stack>
            </Paper>
          ) : (
            <Text size="sm" c="dimmed">
              Belum ada teks di dokumen yang ditulis orang ini (atau tulisannya
              dibuat sebelum pencatatan kontribusi ada).
            </Text>
          )}
        </Stack>
      )}
    </Stack>
  );
}

function DiscussionPopup({ project }: { project: Project }) {
  const live = useLiveProject(project.id);
  const [filter, setFilter] = React.useState("semua");
  if (live.loading || live.error || live.offline)
    return <LiveStatus live={live} />;
  const threads = live.data?.comments ?? [];
  if (!threads.length)
    return <Empty text="Belum ada komentar atau diskusi di tulisan ini." />;
  const open = threads.filter((t) => !t.resolved);
  const shown =
    filter === "terbuka"
      ? open
      : filter === "selesai"
        ? threads.filter((t) => t.resolved)
        : threads;
  const when = (ms: number) => fmtDate(new Date(ms).toISOString());
  return (
    <Stack gap="sm">
      <SegmentedControl
        value={filter}
        onChange={setFilter}
        fullWidth
        data={[
          { label: `Semua (${threads.length})`, value: "semua" },
          { label: `Terbuka (${open.length})`, value: "terbuka" },
          {
            label: `Selesai (${threads.length - open.length})`,
            value: "selesai",
          },
        ]}
      />
      {shown.map((t) => (
        <Paper key={t.id} withBorder radius="md" p="sm">
          <Group justify="space-between" mb={6} wrap="nowrap">
            <Text size="xs" c="dimmed">
              {t.replies.length} pesan · dibuka {when(t.createdAt)}
            </Text>
            <Badge
              size="sm"
              variant="light"
              color={t.resolved ? "teal" : "orange"}
            >
              {t.resolved ? "Selesai" : "Terbuka"}
            </Badge>
          </Group>
          {t.quote && (
            <Text size="sm" className="adm-quote" mb={8}>
              “{t.quote}”
            </Text>
          )}
          <Stack gap={8}>
            {t.replies.map((r) => (
              <Group key={r.id} gap="sm" wrap="nowrap" align="flex-start">
                <Avatar
                  size={28}
                  radius="xl"
                  styles={{
                    placeholder: {
                      background: r.authorColor || "#228be6",
                      color: "#fff",
                    },
                  }}
                >
                  {initials(r.authorName, r.authorId)}
                </Avatar>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <Group gap={6}>
                    <Text size="sm" fw={600}>
                      {r.authorName}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {when(r.createdAt)}
                    </Text>
                  </Group>
                  <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>
                    {r.text}
                  </Text>
                </div>
              </Group>
            ))}
          </Stack>
        </Paper>
      ))}
      {!shown.length && <Empty text="Tidak ada diskusi di filter ini." />}
    </Stack>
  );
}

function CitationsTab({ portfolio }: { portfolio: Portfolio }) {
  const projects = portfolio.projects.filter(
    (p) => p.bibliography.length || p.references.length,
  );
  if (!projects.length)
    return <Empty text="Belum ada sitasi atau artikel referensi." />;
  return (
    <Stack gap="md">
      {projects.map((p) => (
        <Card key={p.id} withBorder radius="md" padding="md">
          <Text fw={700} mb="xs">
            {p.title}
          </Text>
          <BibliographyList bib={p.bibliography} />
          {p.references.length > 0 && (
            <>
              <Text fw={600} size="sm" mt="md" mb={6}>
                Artikel referensi di proyek{" "}
                {p.brainstorming ? `(dari "${p.brainstorming.title}")` : ""}
              </Text>
              <ReferenceList refs={p.references} />
            </>
          )}
        </Card>
      ))}
    </Stack>
  );
}

function ReferenceList({ refs }: { refs: Project["references"] }) {
  return (
    <Stack gap={4}>
      {refs.map((a) => (
        <Group key={a.id} gap="xs" wrap="nowrap" align="flex-start">
          <IconBook2
            size={14}
            style={{ marginTop: 3, flexShrink: 0, opacity: 0.6 }}
          />
          <Text size="sm">
            {a.author ? `${a.author} ` : ""}
            {a.year ? `(${a.year}) ` : ""}
            <i>{a.title}</i>
            {a.doi && (
              <>
                {" "}
                <Anchor
                  size="sm"
                  href={`https://doi.org/${a.doi}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  doi:{a.doi}
                </Anchor>
              </>
            )}
          </Text>
        </Group>
      ))}
    </Stack>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <Paper withBorder radius="md" p="xl" ta="center">
      <Text c="dimmed" size="sm">
        {text}
      </Text>
    </Paper>
  );
}

function StudentDetail({
  studentId,
  onBack,
}: {
  studentId: string;
  onBack: () => void;
}) {
  const [portfolio, setPortfolio] = React.useState<Portfolio | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [reading, setReading] = React.useState<Reading | null>(null);
  const [tab, setTab] = React.useState<string | null>("tulisan");

  // Keyed by studentId in the parent, so state starts empty for each student.
  React.useEffect(() => {
    let cancelled = false;
    getJson<Portfolio>(`/api/admin/students/${studentId}`)
      .then((data) => !cancelled && setPortfolio(data))
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  if (error) return <Alert color="red">{error}</Alert>;
  if (!portfolio)
    return (
      <Center py={80}>
        <Loader />
      </Center>
    );

  const { user, stats } = portfolio;
  return (
    <Stack gap="md">
      <Group gap="md" wrap="nowrap" align="center">
        <ActionIcon
          variant="subtle"
          onClick={onBack}
          hiddenFrom="md"
          aria-label="Kembali"
        >
          <IconArrowLeft size={18} />
        </ActionIcon>
        <Avatar src={user.avatar_url} size={56} radius="xl" color="blue">
          {initials(user.name, user.email)}
        </Avatar>
        <div style={{ minWidth: 0 }}>
          <Title order={3} lh={1.2}>
            {user.name || user.email}
          </Title>
          <Text size="sm" c="dimmed" truncate>
            {[
              user.nim && `NIM ${user.nim}`,
              user.email,
              user.group && `Kelas ${user.group}`,
              user.major,
              user.university,
            ]
              .filter(Boolean)
              .join(" · ")}
          </Text>
        </div>
      </Group>

      <SimpleGrid cols={{ base: 2, sm: 3, lg: 6 }} spacing="xs">
        <Stat
          label="Proyek"
          value={stats.projects + stats.collaborations}
          icon={<IconFileText size={18} />}
        />
        <Stat
          label="Versi disimpan"
          value={stats.drafts}
          icon={<IconHistory size={18} />}
          color="cyan"
        />
        <Stat
          label="Artikel referensi"
          value={stats.references}
          icon={<IconBook2 size={18} />}
          color="teal"
        />
        <Stat
          label="Daftar pustaka"
          value={stats.bibliography}
          icon={<IconQuote size={18} />}
          color="grape"
        />
        <Stat
          label="Rekaman"
          value={stats.recordings}
          icon={<IconMicrophone size={18} />}
          color="orange"
        />
        <Stat
          label="Total durasi"
          value={fmtDuration(stats.recordingSeconds)}
          icon={<IconMicrophone size={18} />}
          color="pink"
        />
      </SimpleGrid>

      <Tabs value={tab} onChange={setTab} keepMounted={false}>
        <Tabs.List>
          <Tabs.Tab value="tulisan" leftSection={<IconFileText size={15} />}>
            Tulisan
          </Tabs.Tab>
          <Tabs.Tab value="rekaman" leftSection={<IconMicrophone size={15} />}>
            Rekaman ({stats.recordings})
          </Tabs.Tab>
          <Tabs.Tab value="sitasi" leftSection={<IconQuote size={15} />}>
            Sitasi & Referensi
          </Tabs.Tab>
        </Tabs.List>
        <Box pt="md">
          {tab === "tulisan" && (
            <ProjectsTab portfolio={portfolio} onRead={setReading} />
          )}
          {tab === "rekaman" && <RecordingsTab portfolio={portfolio} />}
          {tab === "sitasi" && <CitationsTab portfolio={portfolio} />}
        </Box>
      </Tabs>

      <ReaderModal reading={reading} onClose={() => setReading(null)} />
    </Stack>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────
function Dashboard({ onLogout }: { onLogout: () => void }) {
  const [students, setStudents] = React.useState<StudentRow[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const [sort, setSort] = React.useState<string>("aktif");
  const [onlyActive, setOnlyActive] = React.useState(true);
  // The open student is kept in the URL hash (#<userId>), so refresh keeps it.
  const [selected, setSelected] = React.useState<string | null>(() =>
    typeof window === "undefined"
      ? null
      : window.location.hash.slice(1) || null,
  );
  const { setColorScheme } = useMantineColorScheme();
  const scheme = useComputedColorScheme("light");

  const load = React.useCallback(
    () =>
      getJson<{ students: StudentRow[] }>("/api/admin/students")
        .then((data) => {
          setError(null);
          setStudents(data.students);
        })
        .catch((err) =>
          err.status === 401 ? onLogout() : setError(err.message),
        ),
    [onLogout],
  );

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    window.history.replaceState(
      null,
      "",
      selected ? `#${selected}` : window.location.pathname,
    );
  }, [selected]);

  const hasWork = (s: StudentRow) =>
    s.counts.projects +
      s.counts.collaborations +
      s.counts.recordings +
      s.counts.drafts >
    0;
  const list = (students ?? [])
    .filter((s) => !onlyActive || hasWork(s))
    .filter(
      (s) =>
        !query ||
        [s.name, s.email, s.nim, s.group]
          .join(" ")
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .sort((a, b) =>
      sort === "nama"
        ? (a.name || a.email).localeCompare(b.name || b.email, "id")
        : sort === "rekaman"
          ? b.counts.recordings - a.counts.recordings
          : (b.lastActivity ? Date.parse(b.lastActivity) : 0) -
            (a.lastActivity ? Date.parse(a.lastActivity) : 0),
    );

  const totals = (students ?? []).reduce(
    (t, s) => ({
      projects: t.projects + s.counts.projects,
      drafts: t.drafts + s.counts.drafts,
      recordings: t.recordings + s.counts.recordings,
      active: t.active + (hasWork(s) ? 1 : 0),
    }),
    { projects: 0, drafts: 0, recordings: 0, active: 0 },
  );

  const logout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    onLogout();
  };

  return (
    <Box className="adm-shell">
      <header className="adm-header">
        <Group justify="space-between" wrap="nowrap" gap="sm">
          <Group gap="sm" wrap="nowrap">
            <Box className="adm-logo">
              <IconSchool size={20} />
            </Box>
            <div>
              <Text fw={700} lh={1.1}>
                Peneliti SRE Writer
              </Text>
              <Text size="xs" c="dimmed" visibleFrom="sm">
                Tulisan, sitasi, dan rekaman suara semua penulis
              </Text>
            </div>
          </Group>
          <Group gap="xs" wrap="nowrap">
            <Box visibleFrom="sm">
              <ZipMenu
                userId="all"
                label="Unduh semua rekaman"
                disabled={!totals.recordings}
              />
            </Box>
            <Tooltip label="Muat ulang">
              <ActionIcon
                variant="default"
                size="lg"
                onClick={() => void load()}
                aria-label="Muat ulang"
              >
                <IconRefresh size={16} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label={scheme === "dark" ? "Mode terang" : "Mode gelap"}>
              <ActionIcon
                variant="default"
                size="lg"
                onClick={() =>
                  setColorScheme(scheme === "dark" ? "light" : "dark")
                }
                aria-label="Ganti tema"
              >
                {scheme === "dark" ? (
                  <IconSun size={16} />
                ) : (
                  <IconMoon size={16} />
                )}
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Keluar">
              <ActionIcon
                variant="default"
                size="lg"
                onClick={logout}
                aria-label="Keluar"
              >
                <IconLogout size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>
      </header>

      <Box className="adm-body">
        <aside
          className="adm-sidebar"
          data-hidden-mobile={selected ? "true" : "false"}
        >
          <SimpleGrid cols={2} spacing="xs" mb="sm">
            <Stat
              label={`Mahasiswa aktif / ${students?.length ?? 0}`}
              value={totals.active}
              icon={<IconUsers size={18} />}
            />
            <Stat
              label="Rekaman"
              value={totals.recordings}
              icon={<IconMicrophone size={18} />}
              color="orange"
            />
            <Stat
              label="Proyek"
              value={totals.projects}
              icon={<IconFileText size={18} />}
              color="teal"
            />
            <Stat
              label="Versi"
              value={totals.drafts}
              icon={<IconHistory size={18} />}
              color="cyan"
            />
          </SimpleGrid>
          <TextInput
            placeholder="Cari nama, email, NIM…"
            leftSection={<IconSearch size={15} />}
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
            mb="xs"
          />
          <Group gap="xs" mb="sm" justify="space-between" wrap="nowrap">
            <SegmentedControl
              size="xs"
              value={sort}
              onChange={setSort}
              data={[
                { label: "Terbaru", value: "aktif" },
                { label: "Nama", value: "nama" },
                { label: "Rekaman", value: "rekaman" },
              ]}
            />
            <Button
              size="compact-xs"
              variant={onlyActive ? "light" : "subtle"}
              onClick={() => setOnlyActive((v) => !v)}
            >
              {onlyActive ? "Yang punya karya" : "Semua akun"}
            </Button>
          </Group>

          {error && <Alert color="red">{error}</Alert>}
          {!students && !error && (
            <Center py="xl">
              <Loader size="sm" />
            </Center>
          )}
          <Stack gap={6}>
            {list.map((s) => (
              <UnstyledButton
                key={s.id}
                onClick={() => setSelected(s.id)}
                className="adm-student"
                data-active={selected === s.id || undefined}
              >
                <Group gap="sm" wrap="nowrap">
                  <Avatar src={s.avatarUrl} radius="xl" color="blue" size={38}>
                    {initials(s.name, s.email)}
                  </Avatar>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <Text size="sm" fw={600} truncate>
                      {s.name || s.email}
                    </Text>
                    <Text size="xs" c="dimmed" truncate>
                      {s.nim ? `${s.nim} · ` : ""}
                      {relative(s.lastActivity)}
                    </Text>
                  </div>
                </Group>
                <Group gap={4} mt={6} wrap="wrap">
                  <Badge size="xs" variant="light" color="teal">
                    {s.counts.projects + s.counts.collaborations} proyek
                  </Badge>
                  <Badge size="xs" variant="light" color="cyan">
                    {s.counts.drafts} versi
                  </Badge>
                  <Badge size="xs" variant="light" color="orange">
                    {s.counts.recordings} rekaman
                  </Badge>
                </Group>
              </UnstyledButton>
            ))}
            {students && !list.length && <Empty text="Tidak ada yang cocok." />}
          </Stack>
        </aside>

        <main
          className="adm-main"
          data-hidden-mobile={selected ? "false" : "true"}
        >
          {selected ? (
            <StudentDetail
              key={selected}
              studentId={selected}
              onBack={() => setSelected(null)}
            />
          ) : (
            <Center h="60vh">
              <Stack align="center" gap="xs">
                <IconUsers size={42} opacity={0.35} />
                <Text c="dimmed">
                  Pilih mahasiswa di kiri untuk melihat tulisan, sitasi, dan
                  rekamannya.
                </Text>
              </Stack>
            </Center>
          )}
        </main>
      </Box>
    </Box>
  );
}

export default function PenelitiPage() {
  const [loggedIn, setLoggedIn] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    document.title = "Peneliti · SRE Writer";
    getJson<{ loggedIn: boolean }>("/api/admin/me")
      .then((data) => setLoggedIn(data.loggedIn))
      .catch(() => setLoggedIn(false));
  }, []);

  const onLogout = React.useCallback(() => setLoggedIn(false), []);

  if (loggedIn === null)
    return (
      <Center mih="100vh">
        <Loader />
      </Center>
    );
  return loggedIn ? (
    <Dashboard onLogout={onLogout} />
  ) : (
    <LoginCard onDone={() => setLoggedIn(true)} />
  );
}
