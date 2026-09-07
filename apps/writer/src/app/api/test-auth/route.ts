// apps/writer/src/app/api/test-auth/route.ts
import { NextResponse } from 'next/server'
import { getServerSession } from '@sre-monorepo/lib/server'

export async function GET() {
  try {
    const session = await getServerSession()

    return NextResponse.json({
      hasSession: !!session,
      userEmail: session?.user?.email,
      // NO DATABASE QUERY - pure auth test
    })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}