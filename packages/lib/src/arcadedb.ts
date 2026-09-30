// ArcadeDB client for the Node/Edge concept-map graph. Postgres (via Prisma) stays the
// source of truth for Node/Edge rows; ArcadeDB is a secondary store kept in sync on
// write so graph traversal queries (multi-hop, shortest path) don't have to be hand-rolled
// in application code over Prisma results.
const ARCADEDB_URL = process.env.ARCADEDB_URL || 'http://localhost:2480';
const ARCADEDB_USER = process.env.ARCADEDB_USER || 'root';
const ARCADEDB_PASSWORD = process.env.ARCADEDB_PASSWORD;
const ARCADEDB_DATABASE = process.env.ARCADEDB_DATABASE || 'sre_graph';

function authHeader() {
  return 'Basic ' + Buffer.from(`${ARCADEDB_USER}:${ARCADEDB_PASSWORD}`).toString('base64');
}

async function call(endpoint: 'command' | 'query', command: string, params?: object) {
  if (!ARCADEDB_PASSWORD) throw new Error('ARCADEDB_PASSWORD is not set');
  const res = await fetch(`${ARCADEDB_URL}/api/v1/${endpoint}/${ARCADEDB_DATABASE}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: authHeader() },
    body: JSON.stringify({ language: 'sql', command, params }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`ArcadeDB ${endpoint} failed: ${JSON.stringify(body)}`);
  return body.result as Array<Record<string, any>>;
}

/** Mutating SQL (CREATE/UPDATE/DELETE). */
export const arcadeCommand = (command: string, params?: object) => call('command', command, params);

/** Read-only SQL (SELECT, MATCH, TRAVERSE). */
export const arcadeQuery = (command: string, params?: object) => call('query', command, params);

export interface GraphNodeInput {
  id: string;
  label: string;
  title?: string | null;
  att_goal?: string | null;
  att_method?: string | null;
  att_background?: string | null;
  att_future?: string | null;
  att_gaps?: string | null;
  att_url?: string | null;
  type: string;
  content: string;
  articleId: string;
}

export interface GraphEdgeInput {
  id: string;
  fromId: string;
  toId: string;
  relation?: string | null;
  label?: string | null;
  color?: string | null;
  articleId: string;
}

/** Upserts a Node vertex. Failures are logged, never thrown — Postgres write already succeeded. */
export async function upsertGraphNode(node: GraphNodeInput) {
  try {
    await arcadeCommand(
      `UPDATE Node SET label = :label, title = :title, att_goal = :att_goal, att_method = :att_method, ` +
        `att_background = :att_background, att_future = :att_future, att_gaps = :att_gaps, att_url = :att_url, ` +
        `type = :type, content = :content, articleId = :articleId UPSERT WHERE id = :id`,
      node
    );
  } catch (err) {
    console.error('[arcadedb] upsertGraphNode failed:', err);
  }
}

/** Creates an Edge between two existing Node vertices. Failures are logged, never thrown. */
export async function createGraphEdge(edge: GraphEdgeInput) {
  try {
    const [fromRes, toRes] = await Promise.all([
      arcadeQuery('SELECT @rid as rid FROM Node WHERE id = :id', { id: edge.fromId }),
      arcadeQuery('SELECT @rid as rid FROM Node WHERE id = :id', { id: edge.toId }),
    ]);
    const fromRid = fromRes[0]?.rid;
    const toRid = toRes[0]?.rid;
    if (!fromRid || !toRid) throw new Error(`missing from/to node vertex for edge ${edge.id}`);

    await arcadeCommand('DELETE FROM Edge WHERE id = :id', { id: edge.id });
    await arcadeCommand(
      `CREATE EDGE Edge FROM ${fromRid} TO ${toRid} ` +
        `SET id = :id, relation = :relation, label = :label, color = :color, articleId = :articleId`,
      edge
    );
  } catch (err) {
    console.error('[arcadedb] createGraphEdge failed:', err);
  }
}

/** Deletes every Node/Edge vertex belonging to an article (mirrors Postgres's cascade delete). */
export async function deleteGraphForArticle(articleId: string) {
  try {
    await arcadeCommand('DELETE FROM Edge WHERE articleId = :articleId', { articleId });
    await arcadeCommand('DELETE FROM Node WHERE articleId = :articleId', { articleId });
  } catch (err) {
    console.error('[arcadedb] deleteGraphForArticle failed:', err);
  }
}

/**
 * Nodes within `depth` hops of `nodeId`, across the whole graph (not limited to one
 * article) — the traversal Prisma/Postgres can't express without hand-rolled recursive CTEs.
 *
 * Note: this build's SQL parser throws on subselects nested inside FROM/TRAVERSE clauses
 * (`SelectStatement.<init>` reflection bug), so the starting RID is resolved separately
 * and spliced in as a literal rather than using `TRAVERSE ... FROM (SELECT ...)`.
 */
export async function getRelatedNodes(nodeId: string, depth = 2) {
  const startRes = await arcadeQuery('SELECT @rid as rid FROM Node WHERE id = :nodeId', { nodeId });
  const startRid = startRes[0]?.rid;
  if (!startRid) return [];

  return arcadeQuery(
    `SELECT id, label, title, type, articleId FROM (
       TRAVERSE both('Edge') FROM ${startRid} MAXDEPTH ${Number(depth)}
     ) WHERE @this.@type = 'Node' AND id != :nodeId`,
    { nodeId }
  );
}
