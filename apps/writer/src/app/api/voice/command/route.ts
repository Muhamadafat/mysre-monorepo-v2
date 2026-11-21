import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { getServerSession, prisma } from "@sre-monorepo/lib/server";
import { InterpretError, commandModel, interpretCommand } from "@/lib/voice/interpretCommand";

/**
 * POST { text } → { calls: [{ name, args }], reply }
 *
 * Interprets one saved voice command (from the Rekaman Mode Perintah history) into
 * editor tool calls. The browser then runs them with the editor's
 * runVoiceCommand. Lecturer's key, like the rest of voice; each call is
 * logged as TokenUsage purpose "voice-command" (VOICE_COMMAND_DAILY_PER_USER,
 * default 100 per user per day).
 */
const DAILY_LIMIT = Number(process.env.VOICE_COMMAND_DAILY_PER_USER) || 100;
const MAX_CHARS = 2000;

export async function POST(request: Request) {
  const session = await getServerSession();
  const user = session?.user;
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const apiKey = process.env.VOICE_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "VOICE_OPENAI_API_KEY belum diatur di server writer." }, { status: 500 });
  }

  const body = await request.json().catch(() => ({}));
  const text = typeof body?.text === "string" ? body.text.trim().slice(0, MAX_CHARS) : "";
  if (!text) {
    return NextResponse.json({ error: "Perintahnya kosong." }, { status: 400 });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const used = await prisma.tokenUsage.count({ where: { userId: user.id, purpose: "voice-command", createdAt: { gte: today } } });
  if (used >= DAILY_LIMIT) {
    return NextResponse.json({ error: `Jatah menjalankan perintah hari ini (${DAILY_LIMIT}) sudah habis.` }, { status: 429 });
  }

  const model = commandModel();
  try {
    const result = await interpretCommand({
      text,
      apiKey,
      model,
      safetyIdentifier: createHash("sha256").update(String(user.id)).digest("hex"),
    });
    await prisma.tokenUsage
      .create({
        data: {
          userId: user.id,
          model,
          purpose: "voice-command",
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          tokensUsed: result.inputTokens + result.outputTokens,
          metadata: { text, calls: result.calls.map(call => call.name) },
        },
      })
      .catch(err => console.error("[voice/command] usage log failed:", err));
    return NextResponse.json({ calls: result.calls, reply: result.reply });
  } catch (err) {
    if (err instanceof InterpretError) {
      console.error("[voice/command]", err.message);
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[voice/command] unexpected:", err);
    return NextResponse.json({ error: "Perintah gagal diproses." }, { status: 500 });
  }
}
