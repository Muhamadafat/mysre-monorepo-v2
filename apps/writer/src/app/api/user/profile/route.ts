import { type NextRequest, NextResponse } from "next/server"
import { getServerSession } from "@sre-monorepo/lib/server"
import { prisma } from "@sre-monorepo/lib/server"

export async function GET(request: NextRequest) {
  try {
    console.log("=== API PROFILE START ===")

    const session = await getServerSession()
    const user = session?.user

    console.log("Session user:", !!user)

    if (!user) {
      console.log("❌ Not authenticated")
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    console.log("Looking for user ID:", user.id)

    // Ambil dari database
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        name: true,
        group: true,
        nim: true,
      },
    })

    console.log("Database user found:", !!dbUser)
    console.log("Database user data:", dbUser)

    if (dbUser) {
      const result = {
        user: {
          id: dbUser.id,
          email: dbUser.email,
          name: dbUser.name,
          group: dbUser.group,
          nim: dbUser.nim,
        },
      }

      console.log("✅ Returning user data:", result)
      console.log("=== API PROFILE END ===")

      return NextResponse.json(result)
    }

    // Jika tidak ada di database (seharusnya tidak terjadi berdasarkan debug)
    console.log("❌ User not found in database")
    return NextResponse.json({ error: "User not found in database" }, { status: 404 })
  } catch (error) {
    console.error("💥 API Profile error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}