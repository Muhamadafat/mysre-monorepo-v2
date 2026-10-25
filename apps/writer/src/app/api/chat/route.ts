// apps/brain/src/app/api/chat/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@sre-monorepo/lib/server";

const WRITER_MODES = ["continue", "rewrite", "structure", "content", "summarize"];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const {
      sessionId,
      question,
      contextNodeIds = [],
      contextEdgeIds = [],
      forceWeb = false,
      mode = "general",
      nodeId,
      nodeIds,
      // Set by the editor's writing actions: routes to mcp-sre's
      // writer_generate (follows the task) instead of pral_chat (Q&A).
      writer,
    } = body;

    // Validate required fields
    if (!sessionId || !question) {
      return NextResponse.json(
        { error: "sessionId and question are required" },
        { status: 400 }
      );
    }

    // Limit the vector search to the project's own articles (the nodes the
    // editor sends), otherwise chunks from unrelated articles leak in.
    let contextArticleIds: string[] = [];
    if (Array.isArray(contextNodeIds) && contextNodeIds.length > 0) {
      const nodes = await prisma.node.findMany({
        where: { id: { in: contextNodeIds } },
        select: { articleId: true },
      });
      contextArticleIds = [...new Set(nodes.map((n) => n.articleId).filter(Boolean))];
    }

    const writerMode = writer && WRITER_MODES.includes(writer.mode) ? writer.mode : null;

    // Prepare MCP request payload
    const mcpPayload = writerMode
      ? {
          jsonrpc: "2.0",
          method: "tools/call",
          params: {
            name: "writer_generate",
            arguments: {
              task: question,
              retrieval_query: String(writer.retrievalQuery || "").slice(0, 500),
              session_id: sessionId,
              mode: writerMode,
              context_node_ids: contextNodeIds,
              context_article_ids: contextArticleIds,
            },
          },
          id: 1,
        }
      : {
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "pral_chat",
        arguments: {
          question: question,
          session_id: sessionId,
          mode: mode === 'single node' ? 'single_node' : 
                (mode === 'multiple node' ? 'multi_nodes' : 'general'),
          node_id: nodeId,
          node_ids: nodeIds,
          context_node_ids: contextNodeIds,
          context_article_ids: contextArticleIds,
          context_edge_ids: contextEdgeIds,
          force_web: forceWeb
        }
      },
      id: 1
    };

    // Call MCP endpoint
    const mcpResponse = await fetch(`${process.env.PY_URL}/mcp`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json"
      },
      body: JSON.stringify(mcpPayload),
      signal: AbortSignal.timeout(1000000)
    });

    if (!mcpResponse.ok) {
      throw new Error(`MCP request failed: ${mcpResponse.status} ${mcpResponse.statusText}`);
    }

    const mcpData = await mcpResponse.json();
    
    // Process MCP response
    let answer = "";
    let references = [];
    
    if (mcpData.result?.content?.[0]?.text) {
      try {
        const content = JSON.parse(mcpData.result.content[0].text);
        answer = content.response || content.answer || "";
        references = content.references || [];
      } catch (parseError) {
        // If parsing fails, use the text directly
        answer = mcpData.result.content[0].text;
      }
    } else if (mcpData.error) {
      throw new Error(`MCP error: ${mcpData.error.message || 'Unknown error'}`);
    }

    // Return processed response
    return NextResponse.json({
      ...mcpData,
      answer,
      references
    });

  } catch (error) {
    console.error("API Chat Route Error:", error);
    
    return NextResponse.json(
      { 
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}

// Optional: Add GET method if needed
export async function GET() {
  return NextResponse.json(
    { message: "Chat API endpoint is working. Use POST to send messages." },
    { status: 200 }
  );
}