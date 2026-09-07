// app/api/auth/signin/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { authenticateUser, AuthError, getServerSession } from '@sre-monorepo/lib/server'
import { prisma } from '@sre-monorepo/lib/server'

// export async function POST(request: NextRequest) {
//   try {
//     const { email, password } = await request.json()

//     // Validasi input
//     if (!email || !password) {
//       return NextResponse.json(
//         { error: 'Email and password are required' },
//         { status: 400 }
//       )
//     }

//     // Buat Supabase client
//     const supabase = await createServerSupabaseClient();

//     // Sign in dengan Supabase
//     const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
//       email,
//       password,
//     })

//     if (authError) {
//       console.error('Supabase auth error:', authError)
//       return NextResponse.json(
//         { error: authError.message },
//         { status: 401 }
//       )
//     }

//     if (!authData.user) {
//       return NextResponse.json(
//         { error: 'Authentication failed' },
//         { status: 401 }
//       )
//     }

//     // 🔥 SYNC USER KE PRISMA
//     try {
//       const prismaUser = await syncUserWithPrisma(authData.user)
//       console.log('User synced to Prisma:', prismaUser.id)
//     } catch (syncError) {
//       console.error('Failed to sync user to Prisma:', syncError)
//       // Tidak return error, karena auth sudah berhasil
//       // User tetap bisa login meskipun sync gagal
//     }

//     // Response sukses
//     return NextResponse.json({
//       message: 'Sign in successful',
//       user: {
//         id: authData.user.id,
//         email: authData.user.email,
//         name: authData.user.user_metadata?.name || authData.user.email,
//       },
//       session: {
//         access_token: authData.session?.access_token,
//         expires_at: authData.session?.expires_at,
//       }
//     })

//   } catch (error) {
//     console.error('Sign in error:', error)
//     return NextResponse.json(
//       { error: 'Internal server error' },
//       { status: 500 }
//     )
//   }
// }

// // Untuk testing bisa buat GET endpoint juga
// export async function GET() {
//   const supabase = await createServerSupabaseClient();
  
//   try {
//     const { data: { user }, error } = await supabase.auth.getUser()
    
//     if (error) {
//       return NextResponse.json({ error: error.message }, { status: 401 })
//     }
    
//     if (!user) {
//       return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
//     }
    
//     return NextResponse.json({
//       user: {
//         id: user.id,
//         email: user.email,
//         name: user.user_metadata?.name || user.email,
//       }
//     })
//   } catch (error) {
//     console.error('Get user error:', error)
//     return NextResponse.json(
//       { error: 'Internal server error' },
//       { status: 500 }
//     )
//   }
// }

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    // Validasi input
    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 })
    }

    const user = await authenticateUser({ email, password })

    return NextResponse.json({
      message: "Sign in successful",
      user: {
        id: user.id,
        email: user.email,
        name: user.name || user.email,
      },
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    console.error("Sign in error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Enhanced GET endpoint untuk fetch complete profile data
export async function GET() {
  try {
    const session = await getServerSession()

    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    // Fetch complete user profile from Prisma database
    const prismaUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        avatar_url: true,
        bio: true,
        role: true,
        group: true,
        nim: true,
        university: true,
        faculty: true,
        major: true,
        semester: true,
        address: true,
        birthDate: true,
        linkedin: true,
        github: true,
        website: true,
        createdAt: true,
        lastActive: true,
        isEmailVerified: true,
        isPhoneVerified: true,
        token_balance: true,
        settings: true,
        updateAt: true,
      },
    })

    if (!prismaUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Update last active
    await prisma.user.update({
      where: { id: session.user.id },
      data: { lastActive: new Date() },
    })

    return NextResponse.json({
      user: {
        ...prismaUser,
        lastActive: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error("Get user error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}