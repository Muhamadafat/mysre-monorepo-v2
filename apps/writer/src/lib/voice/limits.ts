import { prisma } from "@sre-monorepo/lib/server";

/**
 * Spending limits for the realtime voice assistant. Usage is stored in
 * TokenUsage rows with purpose "voice"; metadata holds the seconds used and
 * the estimated cost. All limits can be changed through env vars.
 */
const num = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

export const VOICE_LIMITS = {
  /** Talk time per user per day (server's local day). */
  dailySecondsPerUser: num(process.env.VOICE_DAILY_MINUTES_PER_USER, 15) * 60,
  /** One session is cut off after this long. */
  maxSessionSeconds: num(process.env.VOICE_MAX_SESSION_MINUTES, 10) * 60,
  /** Mic switches off after this long without anyone speaking. */
  idleTimeoutSeconds: num(process.env.VOICE_IDLE_TIMEOUT_SECONDS, 60),
  /** Estimated spend for ALL users this calendar month. */
  monthlyBudgetUsd: num(process.env.VOICE_MONTHLY_BUDGET_USD, 10),
};

/** Worst-case cost per minute, used for the up-front reservation. */
const RESERVE_USD_PER_MINUTE = 0.1;

/** USD per 1M tokens (OpenAI pricing page, 2026-10). */
const PRICES: Record<string, { audioIn: number; cachedIn: number; audioOut: number; textIn: number; textOut: number }> = {
  "gpt-realtime-2.1": { audioIn: 32, cachedIn: 0.4, audioOut: 64, textIn: 4, textOut: 24 },
  "gpt-realtime": { audioIn: 32, cachedIn: 0.4, audioOut: 64, textIn: 4, textOut: 16 },
  "gpt-realtime-mini": { audioIn: 10, cachedIn: 0.3, audioOut: 20, textIn: 0.6, textOut: 2.4 },
};

export interface VoiceTokenUsage {
  inputText: number;
  inputAudio: number;
  inputCached: number;
  outputText: number;
  outputAudio: number;
}

export function estimateVoiceCostUsd(model: string, usage: VoiceTokenUsage): number {
  const price = PRICES[model] ?? PRICES["gpt-realtime-2.1"];
  return (
    (usage.inputAudio * price.audioIn +
      usage.inputText * price.textIn +
      usage.inputCached * price.cachedIn +
      usage.outputAudio * price.audioOut +
      usage.outputText * price.textOut) /
    1_000_000
  );
}

export function reservedCostUsd(seconds: number): number {
  return (seconds / 60) * RESERVE_USD_PER_MINUTE;
}

interface VoiceUsageMeta {
  seconds?: number;
  estimatedUsd?: number;
}

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const startOfMonth = () => {
  const d = startOfToday();
  d.setDate(1);
  return d;
};

/** Seconds this user has used today, and USD spent by everyone this month. */
export async function getVoiceUsage(userId: string) {
  const [todayRows, monthRows] = await Promise.all([
    prisma.tokenUsage.findMany({
      where: { userId, purpose: "voice", createdAt: { gte: startOfToday() } },
      select: { metadata: true },
    }),
    prisma.tokenUsage.findMany({
      where: { purpose: "voice", createdAt: { gte: startOfMonth() } },
      select: { metadata: true },
    }),
  ]);
  const meta = (row: { metadata: unknown }) => (row.metadata ?? {}) as VoiceUsageMeta;
  return {
    usedSecondsToday: todayRows.reduce((sum, row) => sum + (meta(row).seconds ?? 0), 0),
    spentUsdThisMonth: monthRows.reduce((sum, row) => sum + (meta(row).estimatedUsd ?? 0), 0),
  };
}
