type ChatMode = 'STRICT' | 'RESEARCH';
type ChatContextMode = 'general' | 'single node' | 'multiple node';

export interface SuggestionNodeSummary {
  id: string;
  title?: string | null;
  label?: string | null;
  articleId?: string | null;
}

export interface SuggestionRequestContext {
  query?: string;
  lastMessage?: string;
  mode?: ChatContextMode;
  chatMode?: ChatMode;
  context?: {
    nodeIds?: string[];
    edgeIds?: string[];
    selectedNodes?: SuggestionNodeSummary[];
  };
}

const MAX_SUGGESTIONS = 5;

const GENERAL_PROMPTS = [
  'Apa topik utama yang ingin dianalisis?',
  'Bantu saya mulai dari inti pembahasan',
  'Apa pertanyaan paling penting di sini?',
];

const SINGLE_STRICT_PROMPTS = [
  'Ringkas inti dokumen ini',
  'Apa kontribusi utama artikel ini?',
  'Apa gap penelitian yang dibahas?',
  'Jelaskan metodologinya',
];

const SINGLE_RESEARCH_PROMPTS = [
  'Analisis mendalam artikel ini',
  'Cari artikel yang paling relevan terkait topik ini',
  'Tunjukkan relasi artikel terdekat',
  'Apa implikasinya ke artikel lain?',
  'Dokumen mana yang paling mirip?',
];

const MULTI_STRICT_PROMPTS = [
  'Bandingkan dokumen-dokumen ini',
  'Apa persamaan utamanya?',
  'Apa perbedaan metodologinya?',
  'Mana yang paling kuat argumennya?',
];

const MULTI_RESEARCH_PROMPTS = [
  'Sintesis temuan dari artikel terpilih',
  'Kelompokkan artikel yang paling mirip',
  'Tunjukkan pola relasi antar artikel ini',
  'Apa cluster artikel yang paling dekat?',
  'Dokumen mana yang paling sentral?',
];

const FOLLOWUP_GENERAL_PROMPTS = [
  'Apa pertanyaan lanjutan yang relevan?',
  'Apa langkah analisis berikutnya?',
  'Apa aspek yang perlu diperdalam?',
];

const FOLLOWUP_SINGLE_STRICT_PROMPTS = [
  'Apa kelemahan argumennya?',
  'Jelaskan bagian yang paling penting',
  'Apa implikasi dari temuan ini?',
  'Apa yang masih belum jelas?',
];

const FOLLOWUP_SINGLE_RESEARCH_PROMPTS = [
  'Cari artikel pendukung yang paling relevan',
  'Apa relasi terdekat dengan artikel ini?',
  'Bandingkan dengan artikel terkait',
  'Apa cluster artikel yang paling mirip?',
];

const FOLLOWUP_MULTI_STRICT_PROMPTS = [
  'Apa perbedaan paling penting antar artikel?',
  'Mana yang paling kuat secara argumen?',
  'Bandingkan metode yang dipakai',
  'Apa pola kesamaan utamanya?',
];

const FOLLOWUP_MULTI_RESEARCH_PROMPTS = [
  'Sintesis temuan lintas artikel ini',
  'Kelompokkan artikel yang paling mirip',
  'Apa pola relasi antar artikel ini?',
  'Tunjukkan artikel yang paling sentral',
];

const TOPIC_PROMPTS: Record<string, string[]> = {
  method: ['Jelaskan metodologi utamanya', 'Bandingkan metode antar artikel'],
  gap: ['Apa gap penelitian yang paling jelas?', 'Apa celah riset yang belum terjawab?'],
  comparison: ['Bandingkan artikel terpilih', 'Apa perbedaan utama antar artikel?'],
  relation: [
    'Cari artikel yang paling relevan terkait topik ini',
    'Tunjukkan relasi artikel terdekat',
  ],
  synthesis: ['Sintesis temuan dari artikel ini', 'Kelompokkan artikel yang paling mirip'],
  summary: ['Ringkas inti dokumen ini', 'Apa kontribusi utama artikel ini?'],
  impact: ['Apa implikasi hasilnya?', 'Apa dampak temuan ini?'],
  result: ['Apa hasil utamanya?', 'Ringkas temuan paling penting'],
};

function cleanText(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

function dedupeLimit(suggestions: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const suggestion of suggestions) {
    const normalized = cleanText(suggestion);
    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    result.push(normalized);

    if (result.length >= MAX_SUGGESTIONS) {
      break;
    }
  }

  return result;
}

function getNodeCount(context: SuggestionRequestContext): number {
  const selectedNodes = context.context?.selectedNodes ?? [];
  if (selectedNodes.length > 0) {
    return selectedNodes.length;
  }

  return context.context?.nodeIds?.length ?? 0;
}

function detectTopic(text: string | undefined): string | null {
  const normalized = cleanText(text).toLowerCase();
  if (!normalized) {
    return null;
  }

  if (/(metode|method|methodologi|methodology)/i.test(normalized)) {
    return 'method';
  }

  if (/(gap|celah|kesenjangan)/i.test(normalized)) {
    return 'gap';
  }

  if (/(banding|compare|perbanding|beda|difference)/i.test(normalized)) {
    return 'comparison';
  }

  if (/(relasi|related|terkait|dekat|neighbor|tetangga)/i.test(normalized)) {
    return 'relation';
  }

  if (/(sintesis|synthesis|gabung|ringkas lintas|lintas artikel)/i.test(normalized)) {
    return 'synthesis';
  }

  if (/(ringkas|summary|inti|kontribusi|kesimpulan)/i.test(normalized)) {
    return 'summary';
  }

  if (/(implikasi|impact|dampak|pengaruh|hasil)/i.test(normalized)) {
    return 'impact';
  }

  return null;
}

function topicBoost(topic: string | null): string[] {
  if (!topic || !TOPIC_PROMPTS[topic]) {
    return [];
  }

  return TOPIC_PROMPTS[topic];
}

function buildBaseInputSuggestions(context: SuggestionRequestContext): string[] {
  const nodeCount = getNodeCount(context);
  const isResearch = context.chatMode === 'RESEARCH';
  const mode = context.mode ?? (nodeCount > 1 ? 'multiple node' : nodeCount === 1 ? 'single node' : 'general');

  if (mode === 'general' || nodeCount === 0) {
    return GENERAL_PROMPTS;
  }

  if (nodeCount === 1 && isResearch) {
    return SINGLE_RESEARCH_PROMPTS;
  }

  if (nodeCount === 1) {
    return SINGLE_STRICT_PROMPTS;
  }

  if (isResearch) {
    return MULTI_RESEARCH_PROMPTS;
  }

  return MULTI_STRICT_PROMPTS;
}

function buildBaseFollowupSuggestions(context: SuggestionRequestContext): string[] {
  const nodeCount = getNodeCount(context);
  const isResearch = context.chatMode === 'RESEARCH';

  if (nodeCount === 0) {
    return FOLLOWUP_GENERAL_PROMPTS;
  }

  if (nodeCount === 1 && isResearch) {
    return FOLLOWUP_SINGLE_RESEARCH_PROMPTS;
  }

  if (nodeCount === 1) {
    return FOLLOWUP_SINGLE_STRICT_PROMPTS;
  }

  if (isResearch) {
    return FOLLOWUP_MULTI_RESEARCH_PROMPTS;
  }

  return FOLLOWUP_MULTI_STRICT_PROMPTS;
}

export function buildInputSuggestions(
  context: SuggestionRequestContext
): string[] {
  const queryBoost = topicBoost(detectTopic(context.query));
  const base = buildBaseInputSuggestions(context);

  return dedupeLimit([...queryBoost, ...base]);
}

export function buildFollowupSuggestions(
  context: SuggestionRequestContext
): string[] {
  const messageBoost = topicBoost(detectTopic(context.lastMessage));
  const base = buildBaseFollowupSuggestions(context);

  return dedupeLimit([...messageBoost, ...base]);
}
