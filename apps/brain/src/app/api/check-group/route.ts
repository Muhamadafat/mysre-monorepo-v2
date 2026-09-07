import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@sre-monorepo/lib/server';
import { prisma } from '@sre-monorepo/lib/server';

export async function GET(request: NextRequest){
    try {
        const session = await getServerSession();
        const user = session?.user;

        if (!user){
            return NextResponse.json(
                { error: 'Not authenticated' },
                { status: 401 }
            )
        };

        const dbUser = await prisma.user.findUnique({
            where: { id: user.id },
            select: {
                group: true,
                email: true,
            },
        });

        if (!dbUser){
            return NextResponse.json(
                { error: 'User not found in database' },
                { status: 404 }
            )
        }

        return NextResponse.json(
            { group: dbUser.group, email: dbUser.email }
        )
    } catch (error) {
        console.error("Error in /api/check-group:", error);
        return NextResponse.json(
            {error: 'Internal server error'},
            {status: 500}
        )
    }
}