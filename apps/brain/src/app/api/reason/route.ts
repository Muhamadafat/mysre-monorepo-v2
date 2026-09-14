/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/reason/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@sre-monorepo/lib';
import { toCanonicalAttributes } from '@/lib/graphContract';

export async function POST(request: Request) {
  try {
    const { input, force_web, external_context } = await request.json();

    // Log untuk debugging
    console.log('Reasoning request:', {
      input: input.substring(0, 50),
      force_web,
      external_context,
    });

    // Inisialisasi dengan strategy yang lebih specific
    let strategy = 'hybrid';
    let confidence = 0.7;
    const context_sources: string[] = ['vector_db'];
    const reasoning_chain = [
      `Processing input: ${input.substring(0, 30)}...`,
      'Initialized reasoning flow',
    ];

    // Analisis berdasarkan external context (node_ids)
    if (external_context?.node_ids && external_context.node_ids.length > 0) {
      // PERBAIKAN: Melewati fetch dari Prisma karena tabel Node sudah dihapus.
      // Data graf sekarang murni dari Neo4j via Backend Python.
      const nodeCount = external_context.node_ids.length;
      console.log(
        `Received ${nodeCount} nodes from external context for reasoning`
      );
      reasoning_chain.push(`Found ${nodeCount} relevant nodes in context`);

      // Gunakan strategy default hybrid karena data detail node ada di Neo4j
      strategy = 'hybrid';
      confidence = 0.8;
      context_sources.push('graphdb');
    }

    // Override jika force_web aktif
    if (force_web) {
      strategy = 'web_enhanced';
      if (!context_sources.includes('web_search')) {
        context_sources.push('web_search');
      }
      // context_sources.push("web_search")
      reasoning_chain.push('Force enabled web search');
      confidence = Math.min(confidence + 0.1, 1.0);
    } else {
      // Jika tidak ada context khusus, gunakan hybrid
      //jika km masih mau menggunakan hybrid (jadi bisa rag + web)
      if (
        !external_context?.node_ids ||
        external_context.node_ids.length === 0
      ) {
        strategy = 'hybrid';
        if (!context_sources.includes('web_search')) {
          context_sources.push('web_search');
        }
        reasoning_chain.push('Using hybrid approach (RAG + Web)');
      }

      //jika kamu tidak mau hybrid jadi rag_only
      // if (!external_context?.node_ids || external_context.node_ids.length === 0){
      //   strategy = "rag_only"
      //   const index = context_sources.indexOf("web_search");
      //   if (index > -1){
      //     context_sources.splice(index, 1);
      //   }
      //   reasoning_chain.push("Using RAG-only approach (no web search)")
      //   confidence = 0.6
      // }

      const result = {
        strategy,
        confidence,
        context_sources,
        reasoning_chain,
        metadata: {
          node_count: external_context?.node_ids?.length || 0,
          edge_count: external_context?.edge_ids?.length || 0,
          force_web,
        },
      };

      console.log('Reasoning result:', result);
      return NextResponse.json(result);
    }
  } catch (error: any) {
    console.error('Reasoning error:', error);
    return NextResponse.json(
      {
        strategy: 'error',
        confidence: 0.0,
        context_sources: [],
        reasoning_chain: ['Error during reasoning: ' + error.message],
        error: error.message,
      },
      { status: 500 }
    );
  }
}
