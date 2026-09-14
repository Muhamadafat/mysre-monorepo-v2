/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@sre-monorepo/lib/server';

export interface AnalisisPoin {
  aspek_analisis: string;
  argumen_utama: string;
  bukti_dokumen: string;
}

export interface PoinKritik {
  kelemahan_metodologi: string;
  dampak_terhadap_kesimpulan: string;
  bukti_dokumen: string;
}

export interface AnalisisKomparatifResponse {
  sintesis_objektif: string;
  keterbatasan_analisis: string;
  konvergensi: AnalisisPoin[];
  divergensi: AnalisisPoin[];
  kritik_akademis: PoinKritik[];
  diagnostics?: Record<string, any>;
}
/**
 * POST /api/comparative
 *
 * BFF Proxy for Deep Comparative Analysis.
 * Forwards the request to the FastAPI backend /api/comparative/deep endpoint.
 *
 * Supports two input modes for backward compatibility:
 * 1. NEW (canonical): { file_hashes, aspects, ... }
 *    - Direct proxy to FastAPI, gated by the app's own session cookie.
 * 2. LEGACY: { nodeIds, edgeRelation, projectId, aspects }
 *    - Returns 400 with migration instructions.
 *    - Frontend should be updated to use the new contract.
 *
 * The canonical contract matches the FastAPI DeepAnalysisRequest:
 *   - file_hashes: string[]  (min 2, required)
 *   - aspects: string[]      (optional, defaults server-side)
 *   - llm_model: string      (optional, default "qwen-plus")
 *   - top_k: number          (optional, 1-50, default 15)
 *   - similarity_threshold: number (optional, 0.0-1.0, default 0.3)
 *   - project_id: string     (optional)
 */

const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const PY_URL = process.env.PY_URL || (!IS_PRODUCTION ? 'http://localhost:8000' : '');

export async function POST(req: NextRequest) {
  // -- 1. Authentication via session cookie --
  const session = await getServerSession();

  if (!session) {
    return NextResponse.json(
      {
        error: 'Unauthorized',
        error_source: 'brain_session',
        error_detail: 'Session is missing or invalid.',
      },
      { status: 401 }
    );
  }

  // -- 2. Parse request body --
  let body: Record<string, any>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // -- 3. Determine input mode and resolve file_hashes --
  const {
    file_hashes,
    nodeIds,
    aspects,
    llm_model,
    top_k,
    similarity_threshold,
    project_id,
  } = body;

  let resolvedHashes: string[];

  if (file_hashes && Array.isArray(file_hashes) && file_hashes.length >= 2) {
    // NEW canonical mode: file_hashes provided directly
    resolvedHashes = file_hashes.filter((h: string) => h && h.trim());
  } else if (nodeIds && Array.isArray(nodeIds) && nodeIds.length >= 2) {
    // LEGACY mode: nodeIds provided but no file_hashes
    // The frontend should resolve nodeIds -> file_hashes before calling this endpoint.
    // This is consistent with the chat streaming proxy pattern where activeHashes
    // are resolved on the frontend from node.attributes.hash.
    return NextResponse.json(
      {
        error:
          'Legacy nodeIds format is no longer supported. Please provide file_hashes directly.',
        migration_hint:
          'Use node.attributes.hash to resolve file_hashes from your ExtendedNode objects before calling this endpoint.',
      },
      { status: 400 }
    );
  } else {
    return NextResponse.json(
      { error: 'file_hashes must contain at least 2 valid document hashes.' },
      { status: 400 }
    );
  }

  if (resolvedHashes.length < 2) {
    return NextResponse.json(
      {
        error:
          'file_hashes must contain at least 2 valid document hashes after filtering.',
      },
      { status: 400 }
    );
  }

  if (!PY_URL) {
    return NextResponse.json(
      {
        error: 'Backend service URL not configured',
        error_source: 'brain_config',
      },
      { status: 503 }
    );
  }

  // -- 5. Build the canonical request payload --
  const payload: Record<string, any> = {
    file_hashes: resolvedHashes,
  };

  // Forward optional parameters only if provided
  if (aspects && Array.isArray(aspects) && aspects.length > 0) {
    payload.aspects = aspects;
  }
  if (llm_model) {
    payload.llm_model = llm_model;
  }
  if (typeof top_k === 'number') {
    payload.top_k = top_k;
  }
  if (typeof similarity_threshold === 'number') {
    payload.similarity_threshold = similarity_threshold;
  }
  if (project_id) {
    payload.project_id = project_id;
  }

  // -- 6. Proxy request to FastAPI backend --
  let pyResponse: Response;
  try {
    pyResponse = await fetch(`${PY_URL}/api/comparative/deep`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(180000), // 3 minutes for multi-aspect analysis
    });
  } catch (fetchError: any) {
    console.error(
      '[/api/comparative] Failed to connect to Python backend:',
      fetchError
    );
    return NextResponse.json(
      {
        error: 'Failed to connect to AI backend service',
        error_source: 'brain_proxy',
      },
      { status: 502 }
    );
  }

  // -- 7. Handle response --
  if (!pyResponse.ok) {
    const errorText = await pyResponse.text().catch(() => 'Unknown error');
    console.error(
      `[/api/comparative] Python backend returned ${pyResponse.status}: ${errorText}`
    );

    // Forward the original status code from FastAPI
    let errorBody: any;
    try {
      errorBody = JSON.parse(errorText);
    } catch {
      errorBody = { error: errorText };
    }

    return NextResponse.json(errorBody, { status: pyResponse.status });
  }

  const analysisData = await pyResponse.json();

  // -- 8. Return canonical backend response directly --
  // The frontend ComparativeAnalysisResult now expects the new SLR schema.
  return NextResponse.json(analysisData as AnalisisKomparatifResponse);
}
