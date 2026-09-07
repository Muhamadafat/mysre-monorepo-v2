import { type NextRequest, NextResponse } from "next/server"
import { getServerSession } from "@sre-monorepo/lib/server"
import { prisma } from "@sre-monorepo/lib/server"

export async function GET(request: NextRequest) {
  try {
    console.log("=== DEBUG SESSION API ===")

    const session = await getServerSession()
    const user = session?.user ?? null
    console.log("Session exists:", !!session)
    console.log("User exists:", !!user)
    console.log("User email:", user?.email)

    // Cek database
    const dbUser =
      user?.id != null
      ? await prisma.user.findUnique({
        where: { id: user.id },
        select: {
          id: true,
          name: true,
          email: true,
          group: true,
          nim: true,
        },
      })
    : null;

    return NextResponse.json({
      session: !!session,
      user: !!user,
      userEmail: user?.email,
      dbUser: dbUser,
    })
  } catch (error: any) {
    console.error("Debug session error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
