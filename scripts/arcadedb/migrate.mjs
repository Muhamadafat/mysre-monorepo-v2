// One-off backfill: copies existing Postgres Node/Edge rows into ArcadeDB as
// graph vertices/edges. Safe to re-run — upserts by `id` (UPDATE OR CREATE).
import { Client } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;
const ARCADEDB_URL = process.env.ARCADEDB_URL || 'http://localhost:2480';
const ARCADEDB_USER = process.env.ARCADEDB_USER || 'root';
const ARCADEDB_PASSWORD = process.env.ARCADEDB_PASSWORD;
const ARCADEDB_DATABASE = process.env.ARCADEDB_DATABASE || 'sre_graph';

if (!DATABASE_URL) throw new Error('DATABASE_URL is not set');
if (!ARCADEDB_PASSWORD) throw new Error('ARCADEDB_PASSWORD is not set');

const authHeader = 'Basic ' + Buffer.from(`${ARCADEDB_USER}:${ARCADEDB_PASSWORD}`).toString('base64');

async function arcadeCall(endpoint, command, params) {
  const res = await fetch(`${ARCADEDB_URL}/api/v1/${endpoint}/${ARCADEDB_DATABASE}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: authHeader },
    body: JSON.stringify({ language: 'sql', command, params }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`ArcadeDB ${endpoint} failed: ${JSON.stringify(body)}`);
  return body;
}

const arcadeCommand = (command, params) => arcadeCall('command', command, params);
const arcadeQuery = (command, params) => arcadeCall('query', command, params);

async function main() {
  const pg = new Client({ connectionString: DATABASE_URL });
  await pg.connect();

  const { rows: nodes } = await pg.query('SELECT * FROM "Node"');
  const { rows: edges } = await pg.query('SELECT * FROM "Edge"');

  console.log(`Migrating ${nodes.length} nodes and ${edges.length} edges into ArcadeDB...`);

  let nodeCount = 0;
  for (const n of nodes) {
    await arcadeCommand(
      `UPDATE Node SET label = :label, title = :title, att_goal = :att_goal, att_method = :att_method, ` +
        `att_background = :att_background, att_future = :att_future, att_gaps = :att_gaps, att_url = :att_url, ` +
        `type = :type, content = :content, articleId = :articleId UPSERT WHERE id = :id`,
      n
    );
    nodeCount++;
    if (nodeCount % 50 === 0) console.log(`  nodes: ${nodeCount}/${nodes.length}`);
  }
  console.log(`Nodes done: ${nodeCount}`);

  // ArcadeDB 26.9.1's native build throws on `CREATE EDGE ... FROM (SELECT ...) TO (SELECT ...)`
  // (parser bug: SelectStatement.<init> reflection failure), so resolve RIDs first and use
  // `CREATE EDGE ... FROM #x:y TO #x:y` with literal RIDs instead.
  let edgeCount = 0;
  let skipped = 0;
  for (const e of edges) {
    try {
      const [fromRes, toRes] = await Promise.all([
        arcadeQuery('SELECT @rid as rid FROM Node WHERE id = :id', { id: e.fromId }),
        arcadeQuery('SELECT @rid as rid FROM Node WHERE id = :id', { id: e.toId }),
      ]);
      const fromRid = fromRes.result[0]?.rid;
      const toRid = toRes.result[0]?.rid;
      if (!fromRid || !toRid) throw new Error('missing from/to node');

      // Re-runs are idempotent: drop any prior edge with this id, then recreate it.
      await arcadeCommand('DELETE FROM Edge WHERE id = :id', { id: e.id });
      await arcadeCommand(
        `CREATE EDGE Edge FROM ${fromRid} TO ${toRid} ` +
          `SET id = :id, relation = :relation, label = :label, color = :color, articleId = :articleId`,
        e
      );
      edgeCount++;
    } catch (err) {
      skipped++;
      console.warn(`  skipped edge ${e.id} (${e.fromId} -> ${e.toId}): ${err.message}`);
    }
    if ((edgeCount + skipped) % 50 === 0) console.log(`  edges: ${edgeCount + skipped}/${edges.length}`);
  }
  console.log(`Edges done: ${edgeCount} created, ${skipped} skipped`);

  await pg.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
