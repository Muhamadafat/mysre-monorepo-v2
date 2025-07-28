import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@sre-monorepo/lib";

/*
export async function GET(req: NextRequest){
    try {
        const nodes = await prisma.node.findMany();
        return NextResponse.json(nodes);
    } catch (error) {
        console.error("Error fetching nodes: ", error);
        return NextResponse.json({error : 'Failed to fetch node'}, {status: 500});
    };
}
*/

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");
    
    console.log('=== DEBUGGING START ===');
    console.log('1. Raw sessionId dari URL:', sessionId);
    console.log('2. Type of sessionId:', typeof sessionId);
    console.log('3. SessionId length:', sessionId?.length);

    if (!sessionId) {
        return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
    }

    // Kemungkinan sessionId perlu diparsing jika ada format khusus
    let cleanSessionId = sessionId;
    
    // Jika sessionId mengandung underscore, ambil bagian sebelum underscore
    if (sessionId.includes('_')) {
      cleanSessionId = sessionId.split('_')[0];
      console.log('4. Cleaned sessionId (before underscore):', cleanSessionId);
    }

    // Debug: Cek semua artikel dan sessionId yang ada
    const allArticles = await prisma.article.findMany({
      select: { 
        id: true, 
        sessionId: true, 
        userId: true,
        title: true 
      }
    });
    console.log('5. All articles in database:');
    allArticles.forEach((article, index) => {
      console.log(`   Article ${index + 1}:`, {
        id: article.id,
        sessionId: article.sessionId,
        userId: article.userId,
        title: article.title
      });
    });

    // Coba berbagai variasi query
    console.log('6. Trying different query variations...');

    // Variasi 1: sessionId original
    const nodes1 = await prisma.node.findMany({
      where: {
        article: {
          sessionId: sessionId
        },
      },
    });
    console.log('   Query 1 (original sessionId):', nodes1.length, 'nodes found');

    // Variasi 2: sessionId yang sudah dibersihkan
    const nodes2 = await prisma.node.findMany({
      where: {
        article: {
          sessionId: cleanSessionId
        },
      },
    });
    console.log('   Query 2 (cleaned sessionId):', nodes2.length, 'nodes found');

    // Variasi 3: userId
    const nodes3 = await prisma.node.findMany({
      where: {
        article: {
          userId: sessionId
        },
      },
    });
    console.log('   Query 3 (as userId):', nodes3.length, 'nodes found');

    // Variasi 4: userId cleaned
    const nodes4 = await prisma.node.findMany({
      where: {
        article: {
          userId: cleanSessionId
        },
      },
    });
    console.log('   Query 4 (as cleaned userId):', nodes4.length, 'nodes found');

    // Variasi 5: Contains/partial match jika diperlukan
    const nodes5 = await prisma.node.findMany({
      where: {
        article: {
          OR: [
            { sessionId: { contains: cleanSessionId } },
            { userId: { contains: cleanSessionId } }
          ]
        },
      },
    });
    console.log('   Query 5 (contains match):', nodes5.length, 'nodes found');

    console.log('=== DEBUGGING END ===');

    // Return hasil yang paling cocok
    if (nodes1.length > 0) return NextResponse.json(nodes1);
    if (nodes2.length > 0) return NextResponse.json(nodes2);
    if (nodes3.length > 0) return NextResponse.json(nodes3);
    if (nodes4.length > 0) return NextResponse.json(nodes4);
    if (nodes5.length > 0) return NextResponse.json(nodes5);

    // Jika tidak ada yang cocok, return empty array
    return NextResponse.json([]);

  } catch (error: any) {
    console.error("Error fetching nodes: ", error);
    return NextResponse.json({ error: 'Failed to fetch node', details: error.message }, { status: 500 });
  }
}
