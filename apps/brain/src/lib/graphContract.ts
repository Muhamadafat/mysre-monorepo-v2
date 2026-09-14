export type CanonicalRelation =
  | 'SIMILAR_BACKGROUND'
  | 'SIMILAR_METHODOLOGY'
  | 'SIMILAR_OBJECTIVE'
  | 'SIMILAR_GAP'
  | 'SIMILAR_FUTUREWORK';

const LEGACY_RELATION_MAP: Record<string, CanonicalRelation> = {
  same_background: 'SIMILAR_BACKGROUND',
  extended_method: 'SIMILAR_METHODOLOGY',
  shares_goal: 'SIMILAR_OBJECTIVE',
  addresses_same_gap: 'SIMILAR_GAP',
  follows_future_work: 'SIMILAR_FUTUREWORK',
};

export interface CanonicalAttributes {
  background?: string;
  methodology?: string;
  gap?: string;
  objective?: string;
  futurework?: string;
  storage_url?: string;
  storage_path?: string;
}

export const normalizeRelation = (relation?: string | null): string | null => {
  if (!relation) return null;
  return LEGACY_RELATION_MAP[relation] ?? relation;
};

export const toCanonicalAttributes = (input: any): CanonicalAttributes => {
  // 1. Coba ambil dari format baru (Fase D.3)
  if (input?.attributes) {
    return {
      background: input.attributes.background || '',
      methodology: input.attributes.methodology || '',
      objective: input.attributes.objective || '',
      futurework: input.attributes.futurework || '',
      gap: input.attributes.gap || '',
      storage_url: input.attributes.storage_url || '',
      storage_path: input.attributes.storage_path || '',
    };
  }

  // 2. Fallback ke format legacy (Prisma/Legacy Neo4j)
  return {
    background: input?.att_background || input?.text_background || '',
    methodology: input?.att_method || input?.text_methodology || '',
    objective: input?.att_goal || input?.text_objective || '',
    futurework: input?.att_future || input?.text_futurework || '',
    gap: input?.att_gaps || input?.text_gap || '',
    storage_url: input?.att_url || input?.pdfUrl || '',
  };
};
