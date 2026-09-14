// src/types.ts
import type { Node, Edge } from 'vis-network';

export interface ExtendedNode extends Node {
  att_goal?: string;
  att_method?: string;
  att_background?: string;
  att_future?: string;
  att_gaps?: string;
  att_url?: string;
  title?: string;
}

export interface ExtendedEdge extends Edge {
  id?: string;
  relation?: string;
  label?: string;
  color?: {
    color?: string;
    highlight?: string;
    hover?: string;
    opacity?: number;
  };
  fromTitle?: string;
  toTitle?: string;
  properties?: {
    description?: string;
    weight?: number;
    explanation?: string;
    similarity?: string;
    keywords?: string;
    type?: string;
  };
  displayDescription?: string;
}

export interface Evidence {
  sumber_dokumen: string;
  kutipan_verbatim: string;
}

export interface AnalisisPoin {
  aspek_analisis?: string;
  argumen_utama?: string;
  bukti_dokumen?: string;
  aspek_konteks?: string;
  argumen_objektif?: string;
  bukti?: Evidence[];
}

export interface PoinKritik {
  kelemahan_metodologi?: string;
  dampak_terhadap_kesimpulan?: string;
  bukti_dokumen?: string;
  celah_metodologis_atau_klaim?: string;
  dampak_kelemahan?: string;
  dokumen_sasaran?: string;
  aspek_yang_dikritik?: string;
  sumber_bukti?: Evidence;
}

export interface ComparativeAnalysisData {
  sintesis_objektif: string;
  keterbatasan_analisis: string;
  konvergensi: AnalisisPoin[];
  divergensi: AnalisisPoin[];
  kritik_akademis: PoinKritik[];
  diagnostics?: Record<string, any>;
  error?: string;
}

// ── Multi-Tab Analisis ────────────────────────────────────────────────────────
export type LoadingStepStatus = 'waiting' | 'running' | 'done' | 'error';

export interface LoadingStep {
  id: string;
  label: string;
  description: string;
  status: LoadingStepStatus;
  durationMs?: number; // durasi aktual (diisi saat selesai)
  estimateSec?: number; // estimasi detik (opsional, untuk step yang lama)
  errorMsg?: string;
}

export interface AnalysisTab {
  id: string; // unique id (timestamp-based)
  nodeIds: string[]; // artikel yang dibandingkan
  aspects: string[]; // aspek analisis yang dipilih
  edgeRelation?: string; // relasi edge (opsional)
  label: string; // label informatif, contoh: "Gap — A vs B"
  status: 'loading' | 'done' | 'error';
  data: ComparativeAnalysisData | null;
  error: string | null;
  createdAt: number; // Date.now()
  loadingSteps: LoadingStep[]; // tahapan loading bertahap
  isOpen?: boolean; // menentukan apakah tab sedang terbuka di workspace
  localHighlights: string[]; // highlight permanen yang disimpan di tab ini
}

export type Reference = {
  title?: string;
  url: string;
  snippet?: string;
  text?: string;
  preview?: string;
  ref_mark?: string;
  type?: string;
  index?: number;
};

export interface StoredChatTurn {
  id: string;
  userId: string;
  projectId: string;
  userQuery: string;
  aiResponse: string;
  references?: Reference[];
  metadata?: Record<string, any> | null;
  createdAt?: string;
}

export type ChatMessage = {
  sender: 'user' | 'ai';
  text: string;
  mode?: 'STRICT' | 'RESEARCH';
  contextNodeIds?: string[];
  contextEdgeIds?: string[];
  references?: Reference[];
  turnId?: string;
};
