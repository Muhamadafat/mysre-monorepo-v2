import { NextResponse } from "next/server";
import { getServerSession } from "@sre-monorepo/lib/server";
import { readCommandHelp } from "@/lib/voice/voiceDb";

/**
 * GET → { commands, flows, targets, tip, source }
 *
 * The spoken-command list for the help pop-up in the voice dock, read from
 * the VoiceCommand / VoiceCommandFlow / VoiceCommandTarget tables (filled from
 * commandCatalog.ts = docs/daftar-perintah-suara.xlsx by `npm run voice:db-sync`).
 * Falls back to the catalog file if the database can't be read (source "catalog").
 */
export async function GET() {
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await readCommandHelp());
}
