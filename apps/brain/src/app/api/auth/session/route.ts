import { NextResponse } from "next/server"
import { getServerSession } from "@sre-monorepo/lib/server"

export async function GET() {
  const session = await getServerSession()
  return NextResponse.json({ user: session?.user ?? null })
}
