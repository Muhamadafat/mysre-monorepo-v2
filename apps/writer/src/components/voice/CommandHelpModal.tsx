"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader, Modal, Tabs, TextInput } from "@mantine/core";
import { IconArrowRight, IconBook2, IconListDetails, IconPencil, IconRoute, IconSearch, IconTerminal2 } from "@tabler/icons-react";
import type { CommandHelp, HelpCommand } from "@/lib/voice/commandCatalog";
import classes from "./CommandHelpModal.module.css";

/** Loaded once per page; the list only changes with a deploy + `voice:db-sync`. */
let cached: Promise<CommandHelp> | null = null;
function loadHelp(): Promise<CommandHelp> {
  cached ??= fetch("/api/voice/commands")
    .then(res => (res.ok ? (res.json() as Promise<CommandHelp>) : Promise.reject(new Error(`HTTP ${res.status}`))))
    .catch(err => {
      cached = null;
      throw err;
    });
  return cached;
}

const GROUP_TITLE: Record<HelpCommand["group"], string> = {
  utama: "Perintah utama",
  pendukung: "Perintah pendukung",
};

function CommandCard({ item }: { item: HelpCommand }) {
  return (
    <div className={`${classes.card} ${item.group === "utama" ? classes.cardMain : ""}`}>
      <div className={classes.cardHead}>
        <span className={classes.no}>{item.no}</span>
        <span className={classes.name}>{item.command}</span>
      </div>
      <span className={classes.example}>&ldquo;{item.example}&rdquo;</span>
      {item.keywords && item.keywords !== "-" && (
        <span className={classes.keywords}>
          <b>Bisa juga:</b> {item.keywords}
        </span>
      )}
      <span className={classes.action}>{item.action}</span>
      <span className={classes.target} title="Tujuan hasil">
        <IconArrowRight size={12} /> {item.targetLabel}
      </span>
    </div>
  );
}

function CommandList({ help }: { help: CommandHelp }) {
  const [query, setQuery] = useState("");
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return help.commands;
    return help.commands.filter(item =>
      [item.command, item.example, item.keywords, item.action, item.targetLabel].some(text => text.toLowerCase().includes(q))
    );
  }, [help.commands, query]);

  return (
    <div className={classes.section}>
      <TextInput
        placeholder="Cari perintah, mis. parafrase, judul, terjemah…"
        leftSection={<IconSearch size={15} />}
        value={query}
        onChange={event => setQuery(event.currentTarget.value)}
        radius="xl"
        size="sm"
        data-autofocus
      />
      {(["utama", "pendukung"] as const).map(group => {
        const items = shown.filter(item => item.group === group);
        if (!items.length) return null;
        return (
          <div key={group} className={classes.group}>
            <span className={classes.groupTitle}>
              {GROUP_TITLE[group]} <span className={classes.count}>{items.length}</span>
            </span>
            <div className={classes.grid}>
              {items.map(item => (
                <CommandCard key={item.intent} item={item} />
              ))}
            </div>
          </div>
        );
      })}
      {!shown.length && <span className={classes.empty}>Tidak ada perintah yang cocok dengan &ldquo;{query}&rdquo;.</span>}
    </div>
  );
}

const FLOW_STEPS = [
  { key: "say", label: "Ucapkan" },
  { key: "result", label: "Hasil" },
  { key: "thenSay", label: "Lalu ucapkan" },
  { key: "outcome", label: "Akhirnya" },
] as const;

function FlowList({ help }: { help: CommandHelp }) {
  return (
    <div className={classes.section}>
      {help.flows.map(flow => (
        <div key={flow.intent} className={classes.flow}>
          <span className={classes.flowTitle}>{flow.command}</span>
          <ol className={classes.steps}>
            {FLOW_STEPS.map((step, i) => (
              <li key={step.key} className={classes.step}>
                <span className={classes.stepNo}>{i + 1}</span>
                <span className={classes.stepLabel}>{step.label}</span>
                <span className={classes.stepText}>{flow[step.key]}</span>
              </li>
            ))}
          </ol>
        </div>
      ))}
      <span className={classes.tip}>Tips: {help.tip}</span>

      <span className={classes.groupTitle}>Ke mana hasilnya?</span>
      <div className={classes.targets}>
        {help.targets.map(target => (
          <span key={target.id} className={classes.targetChip}>
            {target.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function UsageGuide() {
  return (
    <div className={`${classes.section} ${classes.guide}`}>
      <ol className={classes.guideList}>
        <li>
          Klik tombol mode, pilih <b>Menulis</b> atau <b>Perintah</b>.
        </li>
        <li>Taruh kursor di tempat tujuan, lalu klik tombol mikrofon untuk mulai merekam.</li>
        <li>Klik tombol yang sama (■) untuk berhenti. Hasilnya langsung diproses.</li>
      </ol>
      <span className={classes.guideHead}>
        <IconPencil size={14} /> Mode Menulis
      </span>
      <span className={classes.guideText}>Setiap kalimat yang Anda ucapkan langsung diketik di posisi kursor.</span>
      <span className={classes.guideHead}>
        <IconTerminal2 size={14} /> Mode Perintah
      </span>
      <span className={classes.guideText}>
        Ucapkan perintah (lihat tab Daftar Perintah), lalu berhenti: perintah dipahami AI dan dijalankan di dokumen.
      </span>
      <span className={classes.guideText}>
        Batas: 10 menit per sesi, berhenti sendiri setelah 60 detik tanpa suara. Semua rekaman tersimpan di Riwayat Aktivitas → Rekaman, dan
        perintah bisa dijalankan ulang dari sana.
      </span>
    </div>
  );
}

/**
 * Help pop-up of the voice dock ("?"): the spoken-command list from the
 * database (GET /api/voice/commands = docs/daftar-perintah-suara.xlsx),
 * the main-command flows and how to use the dock.
 */
export default function CommandHelpModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const [help, setHelp] = useState<CommandHelp | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!opened || help) return;
    loadHelp()
      .then(loaded => {
        setError("");
        setHelp(loaded);
      })
      .catch(() => setError("Daftar perintah gagal dimuat. Coba buka lagi."));
  }, [opened, help]);

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <span className={classes.title}>
          <IconBook2 size={18} /> Panduan asisten suara
        </span>
      }
      size="xl"
      radius="lg"
      centered
      // The "?" button is hidden while this is open; the dock comes back once the cursor is in the editor again.
      returnFocus={false}
      classNames={{ content: classes.content, header: classes.header, body: classes.body }}
      overlayProps={{ backgroundOpacity: 0.25, blur: 3 }}
    >
      <Tabs defaultValue="perintah" radius="xl" variant="pills" classNames={{ list: classes.tabs }}>
        <Tabs.List>
          <Tabs.Tab value="perintah" leftSection={<IconListDetails size={15} />}>
            Daftar Perintah
          </Tabs.Tab>
          <Tabs.Tab value="alur" leftSection={<IconRoute size={15} />}>
            Alur Pakai
          </Tabs.Tab>
          <Tabs.Tab value="cara" leftSection={<IconBook2 size={15} />}>
            Cara Pakai
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="cara">
          <UsageGuide />
        </Tabs.Panel>
        {(["perintah", "alur"] as const).map(tab => (
          <Tabs.Panel key={tab} value={tab}>
            {help ? (
              tab === "perintah" ? (
                <CommandList help={help} />
              ) : (
                <FlowList help={help} />
              )
            ) : (
              <div className={classes.loading}>{error || <Loader size="sm" />}</div>
            )}
          </Tabs.Panel>
        ))}
      </Tabs>
    </Modal>
  );
}
