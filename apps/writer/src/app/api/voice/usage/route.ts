import { NextRequest, NextResponse } from "next/server";
import { getServerSession, prisma } from "@sre-monorepo/lib/server";
import { estimateVoiceCostUsd, reservedCostUsd, type VoiceTokenUsage } from "@/lib/voice/limits";

/**
 * Replaces a voice session's up-front reservation with what was really used.
 * Sent periodically while talking (token usage) and once when the session
 * ends (which also settles the time). Once ended, a row can't be changed.
 */
export async function POST(req: NextRequest) {
  const authSession = await getServerSession();
  const user = authSession?.user;
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // sendBeacon posts text/plain, so parse the body by hand.
  let body: any;
  try {
    body = JSON.parse(await req.text());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const row = await prisma.tokenUsage.findUnique({ where: { id: String(body?.usageId ?? "") } });
  if (!row || row.userId !== user.id || row.purpose !== "voice") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const meta = (row.metadata ?? {}) as Record<string, unknown>;
  if (meta.status === "ended") {
    return NextResponse.json({ ok: true });
  }
  // Time comes from the server's clock, never from the client: until the
  // final report the full reservation stays; at the end it becomes the real
  // elapsed time (capped at the reservation).
  const reservedSeconds = Number(meta.reservedSeconds) || 0;
  const elapsedSeconds = Math.round((Date.now() - new Date(String(meta.startedAt)).getTime()) / 1000);
  const seconds = body.final ? Math.min(reservedSeconds, Math.max(0, elapsedSeconds || reservedSeconds)) : reservedSeconds;

  const n = (value: unknown) => Math.max(0, Math.round(Number(value) || 0));
  const usage: VoiceTokenUsage = {
    inputText: n(body.usage?.inputText),
    inputAudio: n(body.usage?.inputAudio),
    inputCached: n(body.usage?.inputCached),
    outputText: n(body.usage?.outputText),
    outputAudio: n(body.usage?.outputAudio),
  };
  const inputTokens = usage.inputText + usage.inputAudio + usage.inputCached;
  const outputTokens = usage.outputText + usage.outputAudio;
  // Until settled keep the reserved cost; after that, the token cost but never
  // less than a cheap floor for the time actually spent.
  const estimatedUsd = body.final
    ? Math.max(estimateVoiceCostUsd(row.model, usage), reservedCostUsd(seconds) * 0.2)
    : Math.max(estimateVoiceCostUsd(row.model, usage), Number(meta.estimatedUsd) || 0);

  await prisma.tokenUsage.update({
    where: { id: row.id },
    data: {
      inputTokens,
      outputTokens,
      tokensUsed: inputTokens + outputTokens,
      metadata: {
        ...meta,
        seconds,
        estimatedUsd,
        usage: { ...usage },
        status: body.final ? "ended" : "active",
        updatedAt: new Date().toISOString(),
      },
    },
  });

  return NextResponse.json({ ok: true });
}
