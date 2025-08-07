// apps/brain/src/app/api/chat/route.ts

import { NextRequest, NextResponse } from "next/server";

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
    } = body;

    // Validate required fields
    if (!sessionId || !question) {
      return NextResponse.json(
        { error: "sessionId and question are required" },
        { status: 400 }
      );
    }

    // Prepare MCP request payload
    const mcpPayload = {
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
          context_article_ids: [], // Add if needed
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