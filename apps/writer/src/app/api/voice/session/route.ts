import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { getServerSession, prisma } from "@sre-monorepo/lib/server";
import { VOICE_INSTRUCTIONS, VOICE_TOOLS } from "@/lib/voice/tools";
import { VOICE_LIMITS, getVoiceUsage, reservedCostUsd } from "@/lib/voice/limits";

/**
 * Mints a short-lived OpenAI Realtime client secret for the voice assistant.
 * The browser uses it to open a WebRTC call straight to OpenAI, so the real
 * API key never leaves the server. Tools and instructions are fixed here.
 *
 * Before minting, the user's daily allowance and the monthly budget are
 * checked, and the session's full allowed time is reserved as a "voice"
 * TokenUsage row. /api/voice/usage later replaces the reservation with what
 * was really used — if the browser never reports (crash, tampering), the
 * reservation stands, so mistakes round up, never down.
 */
export async function POST() {
  const authSession = await getServerSession();
  const user = authSession?.user;
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY belum diatur di server writer." }, { status: 500 });
  }

  const { usedSecondsToday, spentUsdThisMonth } = await getVoiceUsage(user.id);
  const remainingToday = Math.max(0, VOICE_LIMITS.dailySecondsPerUser - usedSecondsToday);
  if (remainingToday < 30) {
    return NextResponse.json(
      { error: `Jatah suara hari ini (${Math.round(VOICE_LIMITS.dailySecondsPerUser / 60)} menit) sudah habis. Coba lagi besok.` },
      { status: 429 }
    );
  }
  if (spentUsdThisMonth >= VOICE_LIMITS.monthlyBudgetUsd) {
    return NextResponse.json(
      { error: "Batas biaya asisten suara bulan ini sudah tercapai. Hubungi admin." },
      { status: 429 }
    );
  }

  const model = process.env.OPENAI_REALTIME_MODEL || "gpt-realtime-2.1";
  const allowedSeconds = Math.min(VOICE_LIMITS.maxSessionSeconds, remainingToday);

  const response = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      // Lets OpenAI attribute abuse to one user without us sending who it is.
      "OpenAI-Safety-Identifier": createHash("sha256").update(String(user.id)).digest("hex"),
    },
    body: JSON.stringify({
      session: {
        type: "realtime",
        model,
        instructions: VOICE_INSTRUCTIONS,
        tools: VOICE_TOOLS,
        tool_choice: "auto",
        audio: {
          input: {
            transcription: { model: "gpt-4o-mini-transcribe", language: "id" },
            noise_reduction: { type: "near_field" },
            turn_detection: { type: "semantic_vad" },
          },
          output: { voice: process.env.OPENAI_REALTIME_VOICE || "marin" },
        },
      },
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    console.error("Realtime client secret failed:", response.status, detail);
    return NextResponse.json({ error: "Gagal membuat sesi suara." }, { status: 502 });
  }

  const data = await response.json();

  const reservation = await prisma.tokenUsage.create({
    data: {
      userId: user.id,
      tokensUsed: 0,
      model,
      purpose: "voice",
      metadata: {
        seconds: allowedSeconds,
        reservedSeconds: allowedSeconds,
        estimatedUsd: reservedCostUsd(allowedSeconds),
        status: "reserved",
        startedAt: new Date().toISOString(),
      },
    },
    select: { id: true },
  });

  return NextResponse.json({
    value: data.value,
    expiresAt: data.expires_at,
    usageId: reservation.id,
    limits: {
      sessionSeconds: allowedSeconds,
      remainingTodaySeconds: remainingToday,
      idleTimeoutSeconds: VOICE_LIMITS.idleTimeoutSeconds,
    },
  });
}
