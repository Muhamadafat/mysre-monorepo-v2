import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@sre-monorepo/lib";
import { createServerSupabaseClient } from "@sre-monorepo/lib";

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
        return NextResponse.json({message: 'Missing document or metadata'}, {status: 400});
    };

    try {
        // Find node by URL
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
                        sessionId: true,
                    },
                }
            }
        });

        if (!nodeWithUrl){
            return NextResponse.json({message: `Article / Node not found for URL: ${document}`}, {status: 404});
        };

        const article = nodeWithUrl.article;

        // Create annotation with position data stored in semanticTag
        const newAnnotation = await prisma.annotation.create({
            data: {
                articleId: article.id,
                page: metadata.pageNumber || 1,
                highlightedText: metadata.highlightedText || '',
                comment: metadata.contents || '',
                semanticTag: metadata.positionData || null, // ✅ Store position data in semanticTag
                userId: user.id,
            },
            include: {
                article: {
                    select: {
                        id: true,
                        title: true,
                        filePath: true,
                        sessionId: true,
                        nodes: { // ✅ Correct relation
                            select: {
                                att_url: true,
                            },
                            take: 1,
                        }
                    }
                }
            }
        });

        // ✅ Transform response to flatten att_url
        const transformedAnnotation = {
            ...newAnnotation,
            article: {
                ...newAnnotation.article,
                att_url: newAnnotation.article!.nodes?.[0]?.att_url || newAnnotation.article!.filePath,
            }
        };

        return NextResponse.json(transformedAnnotation, {status: 200});
    } catch (error) {
        console.error('[ANNOTATION_ERROR]', error);
        return NextResponse.json({message: 'Internal Server Error'}, {status: 500});
    }

};

export async function GET(req: NextRequest){
    const searchParams = req.nextUrl.searchParams;
    const sessionId = searchParams.get("sessionId"); // BrainstormingSession ID
    const projectId = searchParams.get("projectId"); // WriterSession ID
    
    const supabase = await createServerSupabaseClient();
    const { data: {user}, error} = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({message: 'Unauthorized'}, {status: 401});
    }

    try {
        let annotations;

        if (sessionId) {
            // Query langsung berdasarkan BrainstormingSession ID
            annotations = await prisma.annotation.findMany({
                where: {
                    article: {
                        sessionId: sessionId,
                    },
                    userId: user.id, // ✅ Filter by user for security
                },
                include: {
                    article: {
                        select: {
                            id: true,
                            title: true,
                            filePath: true,
                            sessionId: true,
                            nodes: { // ✅ Correct relation: Article has many Nodes
                                select: {
                                    att_url: true,
                                },
                                take: 1, // Get first node with att_url
                            }
                        }
                    }
                },
                orderBy: {
                    createdAt: 'desc'
                }
            });
        } else if (projectId) {
            // Query berdasarkan WriterSession ID
            // Pertama cari BrainstormingSession yang terkait dengan WriterSession
            const writerSession = await prisma.writerSession.findUnique({
                where: { id: projectId },
                select: { brainstormingSessionId: true }
            });

            if (!writerSession || !writerSession.brainstormingSessionId) {
                return NextResponse.json({error: 'Writer session not found or not linked to brainstorming session'}, {status: 404});
            }

            // Kemudian cari annotations berdasarkan brainstormingSessionId
            annotations = await prisma.annotation.findMany({
                where: {
                    article: {
                        sessionId: writerSession.brainstormingSessionId,
                    },
                    userId: user.id, // ✅ Filter by user for security
                },
                include: {
                    article: {
                        select: {
                            id: true,
                            title: true,
                            filePath: true,
                            sessionId: true,
                            nodes: { // ✅ Correct relation: Article has many Nodes
                                select: {
                                    att_url: true,
                                },
                                take: 1, // Get first node with att_url
                            }
                        }
                    }
                },
                orderBy: {
                    createdAt: 'desc'
                }
            });
        } else {
            return NextResponse.json({error: 'Either sessionId or projectId is required'}, {status: 400});
        }

        // ✅ Transform all annotations to flatten att_url
        const transformedAnnotations = await Promise.all(
          annotations.map(async (ann) => {
            // Get att_url from first node in the array
            let att_url = ann.article!.nodes?.[0]?.att_url;
            
            // ✅ Fallback: If no att_url from nodes, try to find it by matching filePath
            if (!att_url) {
              console.log('⚠️ No att_url from nodes relation, searching by filePath:', ann.article!.filePath);
              
              const node = await prisma.node.findFirst({
                where: {
                  articleId: ann.article!.id,
                  att_url: { not: null }
                },
                select: { att_url: true }
              });
              
              att_url = node?.att_url || '';
              console.log('🔍 Found node with att_url:', att_url);
            }
            
            return {
              ...ann,
              article: {
                id: ann.article!.id,
                title: ann.article!.title,
                filePath: ann.article!.filePath,
                sessionId: ann.article!.sessionId,
                att_url: att_url || ann.article!.filePath, // Use filePath as ultimate fallback
              }
            };
          })
        );

        return NextResponse.json(transformedAnnotations, {status: 200});
    } catch (error) {
        console.error('Error fetching annotations:', error);
        return NextResponse.json({error: 'Failed to fetch annotations'}, {status: 500});
    }
}