import { NextResponse } from "next/server";
import { getServerSession } from "@sre-monorepo/lib/server";
import { listRecordings } from "@/lib/storage/listRecordings";
import type { RecordingMode } from "@/lib/storage/recordingKeys";
import { s3Configured } from "@/lib/storage/s3";

/**
 * GET /api/projects/audio/<projectId>/<menulis|perintah>
 *
 * The signed-in user's voice recordings of one project and mode, newest first,
 * as plain JSON — easy to open in the browser (uses the session cookie).
 * Same data as GET /api/voice/recording?projectId=…&mode=…, plus a summary.
 */
const MODES: RecordingMode[] = ["menulis", "perintah"];

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; mode: string }> }) {
  const session = await getServerSession();
  const user = session?.user;
  if (!user) {
    return NextResponse.json({ error: "Unauthorized — login dulu di writer." }, { status: 401 });
  }
  if (!s3Configured()) {
    return NextResponse.json({ error: "Penyimpanan S3 belum diatur di server writer." }, { status: 500 });
  }

  const { id, mode: rawMode } = await params;
  const mode = rawMode.toLowerCase() as RecordingMode;
  if (!MODES.includes(mode)) {
    return NextResponse.json({ error: `Mode tidak dikenal: "${rawMode}". Pakai: ${MODES.join(" | ")}.` }, { status: 400 });
  }

  try {
    const items = await listRecordings(String(user.id), id, mode);
    return NextResponse.json({
      projectId: id,
      mode,
      count: items.length,
      totalBytes: items.reduce((sum, item) => sum + (item.sizeBytes ?? 0), 0),
      withAiTranscript: items.filter(item => item.aiTranscript).length,
      items,
    });
  } catch (err) {
    console.error("[projects/audio] S3 list failed:", err);
    return NextResponse.json({ error: "Gagal membaca rekaman dari penyimpanan S3." }, { status: 502 });
  }
}
