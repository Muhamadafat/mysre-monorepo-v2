# Master System Documentation (API & Environment)

## General Information

| Item | Value |
|---|---|
| Application Name | `SRE / Scientific Research Environment` |
| API Version | `v1` |
| Base URL Local (Backend) | `http://localhost:8000` |
| Base URL Local (Frontend) | `http://localhost:3000` |
| Response Format | `JSON / Server-Sent Events (SSE)` |
| Authentication | `Bearer Token (Supabase JWT)` |

---

## Global Environment Variables

| Variable | Location | Required | Description |
|---|---|---:|---|
| `NEXT_PUBLIC_API_URL` | `mysre-monorepo` | Yes | URL backend untuk frontend |
| `NEXT_PUBLIC_SUPABASE_URL` | `mysre-monorepo` | Yes | Supabase endpoint URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `mysre-monorepo` | Yes | Supabase anon key |
| `NEO4J_URI` | `backend-sre` | Yes | URI untuk koneksi graph database |
| `NEO4J_USERNAME` | `backend-sre` | Yes | Username Neo4j |
| `NEO4J_PASSWORD` | `backend-sre` | Yes | Password Neo4j |
| `FRONTEND_URLS` | `backend-sre` | Yes | CORS allowed origins (List) |

### Contoh `.env` (mysre-monorepo / Frontend)
*Catatan: Variabel dengan prefix `NEXT_PUBLIC_` aman untuk terekspos ke browser.*
```env
# Base URL Backend
NEXT_PUBLIC_FASTAPI_URL=http://localhost:8000
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Supabase (Public / Anon)
NEXT_PUBLIC_SUPABASE_URL=https://[PROJECT-ID].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_[YOUR_KEY]

# Database (Digunakan untuk Prisma di server-side, jangan ekspos ke client)
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT-ID].supabase.co:6543/postgres?pgbouncer=true&sslmode=require
```

### Contoh `.env` (backend-sre / Backend)
*Catatan: Pastikan rahasia (API Keys) tidak pernah di-commit ke Git.*
```env
# LLM API Keys (Digunakan oleh PRAL Orchestrator)
DASHSCOPE_API_KEY="sk-..."
OPENAI_API_KEY="sk-proj-..."
COHERE_API_KEY="..."

# Supabase Core & JWT Validation
SUPABASE_URL=https://[PROJECT-ID].supabase.co
SUPABASE_KEY=eyJhbG...
SUPABASE_JWT_SECRET=hc3Nm...
SUPABASE_JWT_ISSUER=https://[PROJECT-ID].supabase.co/auth/v1
SUPABASE_JWT_AUDIENCE=authenticated

# Database & Storage
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT-ID].supabase.co:6543/postgres?pgbouncer=true&sslmode=require
SUPABASE_BUCKET=uploads

# Neo4j Graph Database
NEO4J_URI="neo4j://127.0.0.1:7687"
NEO4J_USERNAME="neo4j"
NEO4J_PASSWORD="[YOUR_PASSWORD]"
FRONTEND_URLS=["http://localhost:3000"]
```

### Contoh `.env.local` (mysre-monorepo / apps/brain)
*Catatan: Digunakan jika aplikasi tertentu (seperti `brain`) berjalan di port berbeda atau memiliki aturan override khusus (seperti bypass auth).*
```env
# Spesifik untuk Brain App (berjalan di port 3002)
NEXT_PUBLIC_SITE_URL=http://localhost:3002
NEXT_PUBLIC_MAIN_APP_URL=http://localhost:3000

# Fitur spesifik (jika ada)
SKIP_AUTH=false
```

---

## Global Headers

| Header | Required | Example | Description |
|---|---:|---|---|
| `Accept` | Yes | `application/json`, `text/event-stream` | Format response yang diminta |
| `Content-Type` | Yes | `application/json` | Format body request |
| `Authorization` | Conditional | `Bearer {token}` | Wajib untuk endpoint private (Supabase JWT) |

---

# Endpoint Documentation

## `GET /health`

| Item | Value |
|---|---|
| Feature | `Health Check` |
| Description | `Memeriksa status service dan konektivitas Neo4j database` |
| Auth Required | `No` |
| Role Access | `Guest` |
| Request Type | `None` |
| Response Type | `JSON` |

### Request

*(Endpoint ini tidak memerlukan payload, path, maupun query parameter)*

### Response Success

| Status | Description |
|---:|---|
| 200 | Request berhasil (Database Connected) |

```json
{
  "status": "ok",
  "db": "connected"
}
```

### Response Error

| Status | Cause | Message |
|---:|---|---|
| 503 | Neo4j Unavailable | `Neo4j unavailable` |
| 429 | Rate Limit Exceeded | `Rate limit exceeded` |
| 500 | Server error | `Internal server error` |

### Related

| Item | Value |
|---|---|
| Table / DB | `Neo4j (Any node for pinging)` |
| Data Contract | `HealthResponse` |
| Frontend Page | `System Monitoring` |
| Notes | `Rate limit dikecualikan (limiter.exempt)` |

---

## `POST /api/chat/stream`

| Item | Value |
|---|---|
| Feature | `Agentic Chatbot (Hybrid Graph-RAG)` |
| Description | `Endpoint streaming untuk AI Assistant berdasarkan konteks dokumen/graph` |
| Auth Required | `Yes (Supabase JWT)` |
| Role Access | `User` |
| Request Type | `JSON` |
| Response Type | `Streaming (text/plain)` |

### Request

| Field | Location | Type | Required | Validation | Example | Description |
|---|---|---|---:|---|---|---|
| `query` | body | string | Yes | `Not Empty` | `"Apa kesimpulan paper ini?"` | Pertanyaan pengguna |
| `session_id` | body | string | Yes | `Required` | `"sess-1234"` | ID untuk riwayat percakapan |
| `active_hashes` | body | array[string] | Yes | `min length: 1` | `["hash_abc123"]` | Daftar hash PDF (konteks) |
| `mode` | body | string | No | `STRICT / RESEARCH` | `"STRICT"` | Mode pencarian agen |

### Example Request

```json
{
  "query": "Jelaskan metode yang digunakan.",
  "session_id": "sess-xyz789",
  "active_hashes": ["8f4b23a1d9..."],
  "mode": "STRICT"
}
```

### Response Success

| Status | Description |
|---:|---|
| 200 | Stream data langsung dari LLM (kata per kata) |

*(Response adalah Streaming/Chunked Text, bukan JSON)*

### Response Error

| Status | Cause | Message |
|---:|---|---|
| 400 | Query Kosong | `Query tidak boleh kosong.` |
| 401 | Belum login | `Unauthenticated / Invalid JWT` |
| 422 | Validasi Pydantic | ` active_hashes harus berisi minimal 1 hash yang valid.` |
| 500 | LLM / Service Error | `[Sistem] Maaf, terjadi kesalahan saat memproses respons` |

### Related

| Item | Value |
|---|---|
| Component | `PRALOrchestrator` |
| Data Contract | `AgenticChatRequest` |
| Frontend Page | `ChatPanel.tsx / ChatInputArea.tsx` |
| Notes | `Pastikan frontend menggunakan API yang mendukung SSE atau Stream Reader untuk membaca response.` |

---

---

## `GET /api/graph/context`

| Item | Value |
|---|---|
| Feature | `Graph Context Retrieval` |
| Description | `Mendapatkan data knowledge graph (nodes dan edges) untuk dirender oleh vis-network` |
| Auth Required | `Yes (Supabase JWT)` |
| Role Access | `User` |
| Request Type | `Query Parameters` |
| Response Type | `JSON` |

### Request

| Field | Location | Type | Required | Validation | Example | Description |
|---|---|---|---:|---|---|---|
| `project_id` | query | string | Yes | `Required` | `"workspace-dev-01"` | ID proyek / workspace |

### Response Success

| Status | Description |
|---:|---|
| 200 | Request berhasil, mengembalikan daftar `nodes` dan `edges` |

```json
{
  "nodes": [
    {
      "id": "node_id_123",
      "label": "Judul Artikel",
      "attributes": {}
    }
  ],
  "edges": [
    {
      "from": "node_id_123",
      "to": "node_id_456",
      "relation": "SIMILAR_BACKGROUND",
      "label": "Alasan similarity (LLM Edge Reasoning)",
      "fromTitle": "Judul 1",
      "toTitle": "Judul 2",
      "score": 0.85
    }
  ]
}
```

### Related

| Item | Value |
|---|---|
| Table / DB | `Neo4j` |
| Data Contract | `GraphResponse`, `VisNode`, `VisEdge` |

---

## `DELETE /api/graph/literature/{node_id}`

| Item | Value |
|---|---|
| Feature | `Delete Literature Node` |
| Description | `Menghapus node literatur dari Neo4j beserta file fisik di Supabase Storage secara atomik` |
| Auth Required | `Yes (Supabase JWT)` |
| Role Access | `User` |
| Request Type | `Path Parameters` |
| Response Type | `JSON` |

### Request

| Field | Location | Type | Required | Validation | Example | Description |
|---|---|---|---:|---|---|---|
| `node_id` | path | string | Yes | `Required` | `"elementId_123"` | Element ID dari Neo4j |

### Response Success

| Status | Description |
|---:|---|
| 200 | Node berhasil dihapus |

```json
{
  "status": "success",
  "message": "Literature node and assets deleted"
}
```

### Response Error

| Status | Cause | Message |
|---:|---|---|
| 404 | Tidak ditemukan / Tidak ada akses | `Node not found or unauthorized` |

---

## `POST /mcp/upload`

| Item | Value |
|---|---|
| Feature | `Synchronous PDF Ingestion (Legacy/Sync)` |
| Description | `Upload file PDF dan tunggu proses ingestion Neo4j (chunk, LLM extract, embed) selesai secara synchronous` |
| Auth Required | `Yes (Supabase JWT)` |
| Role Access | `User` |
| Request Type | `multipart/form-data` |
| Response Type | `JSON` |

### Request

| Field | Location | Type | Required | Validation | Example | Description |
|---|---|---|---:|---|---|---|
| `file` | form | File (PDF) | Yes | `Must be .pdf, >100 bytes` | `document.pdf` | File PDF untuk diproses |
| `project_id` | form | string | No | `Default: workspace-dev-01` | `"workspace-dev-01"` | ID proyek / workspace |

### Response Success

| Status | Description |
|---:|---|
| 200 | Pemrosesan sukses dan node berhasil dibuat |

```json
{
  "status": "success",
  "node_id": "neo4j_element_id_123",
  "storage_url": "https://supabase.../file.pdf",
  "title": "Judul Dokumen",
  "pillars": {
    "background": "...",
    "methodology": "...",
    "gap": "...",
    "objective": "...",
    "futurework": "..."
  }
}
```

### Response Error

| Status | Cause | Message |
|---:|---|---|
| 400 | File tidak valid | `Only PDF files are accepted` / `File is too small to be a valid PDF` |

---

## `POST /mcp/upload/submit`

| Item | Value |
|---|---|
| Feature | `Asynchronous PDF Ingestion Submit` |
| Description | `Mengirim file PDF untuk diproses di background. Langsung mengembalikan job_id untuk SSE streaming.` |
| Auth Required | `Yes (Supabase JWT)` |
| Role Access | `User` |
| Request Type | `multipart/form-data` |
| Response Type | `JSON` |

### Request

(Sama dengan payload `/mcp/upload`)

### Response Success

| Status | Description |
|---:|---|
| 202 | Diterima untuk diproses di background (Accepted) |

```json
{
  "status": "accepted",
  "job_id": "job_1234567890"
}
```

---

## `GET /mcp/upload/stream`

| Item | Value |
|---|---|
| Feature | `Asynchronous PDF Ingestion Progress (SSE)` |
| Description | `Stream progress pemrosesan PDF secara real-time via Server-Sent Events (SSE)` |
| Auth Required | `Yes (Supabase JWT)` |
| Role Access | `User` |
| Request Type | `Query Parameters` |
| Response Type | `Server-Sent Events (text/event-stream)` |

### Request

| Field | Location | Type | Required | Validation | Example | Description |
|---|---|---|---:|---|---|---|
| `job_id` | query | string | Yes | `Exists in progress manager` | `"job_1234567890"` | ID Job dari `/upload/submit` |

### Response Success

| Status | Description |
|---:|---|
| 200 | Stream data progress |

*(Response berupa event stream text/event-stream, bukan JSON)*

### Response Error

| Status | Cause | Message |
|---:|---|---|
| 403 | Forbidden | `forbidden` (User bukan pemilik job) |
| 404 | Job Tidak Ditemukan | `job_id not found` |

### Related

| Item | Value |
|---|---|
| Data Contract | `EventSourceResponse` |
| Frontend Page | `Floating Progress UI` |
