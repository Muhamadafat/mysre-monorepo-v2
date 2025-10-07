import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@sre-monorepo/lib";
import { createServerSupabaseClient } from "@sre-monorepo/lib";

// api/annotation/route.ts - POST method
export async function POST(req: NextRequest) {
    
    const supabase = await createServerSupabaseClient();
    const { data: {user}, error} = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({message: 'Unauthorized'}, {status: 401});
    }

    const body = await req.json();
    const metadata = body?.metadata;
    const document = body?.document;

    if (!metadata || !document){
        return NextResponse.json({message: 'Missing document in metadata'}, {status: 400});
    };

    try {
        const nodeWithUrl = await prisma.node.findFirst({
            where: { att_url: document},
            select: {
                id: true,
                title: true,
                att_url: true,
                article: {
                    select: {
                        id: true,
                        title: true,
                        filePath: true,
                        sessionId: true, // ✅ Pastikan sessionId ikut
                    },
                }
            }
        });

        if (!nodeWithUrl){
            return NextResponse.json({message: `Article / Node not found for URL: ${document}`}, {status: 404});
        };

        const article = nodeWithUrl.article;

        // ✅ Simpan positionData di semanticTag sebagai JSON string
        const newAnnotation = await prisma.annotation.create({
            data: {
                articleId: article.id,
                page: metadata.pageNumber,
                highlightedText: metadata.highlightedText || '',
                comment: metadata.contents || '',
                semanticTag: metadata.positionData || null, // ✅ Simpan position data di sini
                userId: user.id,
            },
            include: {
                article: {
                    select: {
                        id: true,
                        title: true,
                        filePath: true,
                        sessionId: true,
                    }
                }
            }
        });

        console.log('✅ Annotation saved:', {
            id: newAnnotation.id,
            articleId: article.id,
            sessionId: article.sessionId,
            hasPositionData: !!newAnnotation.semanticTag
        });

        return NextResponse.json(newAnnotation, {status: 200});
    } catch (error) {
        console.error('[ANNOTATION_ERROR]', error);
        return NextResponse.json({message: 'Internal Server Error'}, {status: 500});
    }
};

// api/annotation/route.ts - GET method
export async function GET(req: NextRequest){

    const searchParams = req.nextUrl.searchParams;
    const sessionId = searchParams.get("sessionId");
    
    console.log('🔍 GET /api/annotation called');
    console.log('📋 Request details:', {
        sessionId,
        url: req.url,
        searchParams: Object.fromEntries(searchParams)
    });
    
    const supabase = await createServerSupabaseClient();
    const { data: {user}, error} = await supabase.auth.getUser();
    
    console.log('👤 User from Supabase:', {
        userId: user?.id,
        email: user?.email,
        hasUser: !!user
    });
    
    if (!user) {
        return NextResponse.json({message: 'Unauthorized'}, {status: 401});
    }

    if (!sessionId) {
        console.log('❌ No sessionId provided');
        return NextResponse.json({message: 'sessionId is required'}, {status: 400});
    }

    try {
        // ✅ STEP 1: Cek dulu semua articles di session ini
        const articlesInSession = await prisma.article.findMany({
            where: {
                sessionId: sessionId
            },
            select: {
                id: true,
                title: true,
                filePath: true,
                sessionId: true,
            }
        });
        
        console.log('📚 Articles in session:', articlesInSession.length, articlesInSession);

        // ✅ STEP 2: Cek semua annotations untuk user ini (tanpa filter session dulu)
        const allUserAnnotations = await prisma.annotation.findMany({
            where: {
                userId: user.id,
            },
            include: {
                article: {
                    select: {
                        id: true,
                        title: true,
                        filePath: true,
                        sessionId: true,
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
        
        console.log('📝 All user annotations:', allUserAnnotations.length, 
            allUserAnnotations.map(a => ({
                id: a.id,
                articleId: a.articleId,
                articleSessionId: a.article?.sessionId,
                targetSessionId: sessionId,
                match: a.article?.sessionId === sessionId
            }))
        );

        // ✅ STEP 3: Filter annotations untuk session ini
        const annotations = await prisma.annotation.findMany({
            where: {
                userId: user.id,
                article: {
                    sessionId: sessionId,
                }
            },
            include: {
                article: {
                    select: {
                        id: true,
                        title: true,
                        filePath: true,
                        sessionId: true,
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        console.log('✅ Filtered annotations for session:', annotations.length, annotations);

        return NextResponse.json(annotations, {status: 200});
    } catch (error) {
        console.error('❌ Error fetching annotations:', error);
        return NextResponse.json({error: 'Failed to fetch annotations'}, {status: 500});
    }
}