# Master Data Contract Documentation

Dokumen ini mendefinisikan *Single Source of Truth* untuk kontrak data (schema/payload) yang digunakan dalam komunikasi antara Frontend (`mysre-monorepo`) dan Backend (`backend-sre`).
Semua tabel di bawah ini merepresentasikan Pydantic Models aktual dari backend.

---

## 1. Chatbot & LLM Reasoning

### `AgenticChatRequest`
*Terkait Endpoint: `POST /api/chat/stream`*
*Deskripsi: Model payload untuk memulai sesi percakapan dengan Agentic RAG.*

| Field | Type | Required | Default | Description |
|---|---|:---:|---|---|
| `query` | `string` | **Yes** | - | Pertanyaan inti dari pengguna yang akan diproses oleh asisten AI. |
| `session_id` | `string` | **Yes** | - | ID sesi unik untuk menjaga riwayat percakapan. |
| `active_hashes` | `string[]` | **Yes** | - | Array hash dokumen PDF yang sedang dibuka (menjadi jangkar konteks RAG). |
| `mode` | `string` | No | `"STRICT"` | Mode pencarian chatbot (`"STRICT"` atau `"RESEARCH"`). |

---

## 2. Knowledge Graph

### `GraphResponse`
*Terkait Endpoint: `GET /api/graph/context`*
*Deskripsi: Payload utama yang berisi seluruh data graf untuk dirender oleh vis-network.*

| Field | Type | Required | Default | Description |
|---|---|:---:|---|---|
| `nodes` | `VisNode[]` | No | `[]` | Kumpulan titik (nodes) dalam graf. |
| `edges` | `VisEdge[]` | No | `[]` | Kumpulan garis/relasi (edges) yang menghubungkan nodes. |

### `VisNode`
*Deskripsi: Struktur tunggal untuk entitas Node (seperti Literature, Project).*

| Field | Type | Required | Default | Description |
|---|---|:---:|---|---|
| `id` | `string` | **Yes** | - | ID unik node (berdasarkan `elementId` bawaan Neo4j). |
| `label` | `string` | No | `null` | Judul atau label tampilan untuk node. |
| `attributes` | `object` | No | `{}` | Kumpulan *properties* tambahan dari Neo4j (seperti author, tahun, dll). |

### `VisEdge`
*Deskripsi: Struktur tunggal untuk relasi antar Node beserta reasoning-nya.*

| Field | Type | Required | Default | Description |
|---|---|:---:|---|---|
| `from` | `string` | **Yes** | - | `elementId` dari node sumber (Source). |
| `to` | `string` | **Yes** | - | `elementId` dari node target (Target). |
| `relation` | `string` | **Yes** | - | Tipe relasi Neo4j (contoh: `SIMILAR_BACKGROUND`, `CITED_BY`). |
| `label` | `string` | No | `null` | Teks penjelasan (*reasoning*) yang di-generate oleh LLM mengenai relasi tersebut. |
| `fromTitle` | `string` | No | `null` | Judul dari node sumber (opsional untuk UI tooltip). |
| `toTitle` | `string` | No | `null` | Judul dari node target (opsional untuk UI tooltip). |
| `score` | `number` | No | `null` | Nilai *cosine similarity* relasi jika ada (0.0 - 1.0). |

---

## 3. PDF Ingestion & MCP Pipeline

### `IngestionResponse`
*Terkait Endpoint: `POST /mcp/upload` (Sync)*
*Deskripsi: Payload balasan setelah file PDF selesai diproses penuh secara synchronous.*

| Field | Type | Required | Default | Description |
|---|---|:---:|---|---|
| `status` | `string` | **Yes** | - | Status pemrosesan (misal: `"success"`). |
| `node_id` | `string` | **Yes** | - | `elementId` Neo4j dari node Literature yang baru saja dibuat. |
| `storage_url` | `string` | **Yes** | - | URL publik untuk file PDF di Supabase Storage. |
| `title` | `string` | **Yes** | `""` | Judul dokumen yang berhasil diekstrak. |
| `pillars` | `PillarData` | No | `null` | Data kelima pilar riset yang diekstrak oleh LLM. |

### `PillarData`
*Deskripsi: Struktur 5 pilar ekstraksi riset dari sebuah PDF.*

| Field | Type | Required | Default | Description |
|---|---|:---:|---|---|
| `background` | `string` | **Yes** | `""` | Latar belakang dan konteks riset. |
| `methodology` | `string` | **Yes** | `""` | Metode dan teknik yang digunakan peneliti. |
| `gap` | `string` | **Yes** | `""` | Celah riset (Research Gap) yang diidentifikasi. |
| `objective` | `string` | **Yes** | `""` | Tujuan utama penelitian. |
| `futurework` | `string` | **Yes** | `""` | Saran penelitian lanjutan (Future Work). |

### `SubmitResponse`
*Terkait Endpoint: `POST /mcp/upload/submit` (Async)*
*Deskripsi: Payload awal (202 Accepted) saat PDF dikirim ke background job.*

| Field | Type | Required | Default | Description |
|---|---|:---:|---|---|
| `status` | `string` | **Yes** | `"accepted"` | Menandakan file masuk antrian. |
| `job_id` | `string` | **Yes** | - | ID unik *job* untuk berlangganan via Server-Sent Events (SSE) `/mcp/upload/stream`. |

---

## 4. Sistem Umum & Manajemen

### `DeleteResponse`
*Terkait Endpoint: `DELETE /api/graph/literature/{node_id}`*
*Deskripsi: Payload konfirmasi penghapusan node atomik.*

| Field | Type | Required | Default | Description |
|---|---|:---:|---|---|
| `status` | `string` | **Yes** | - | `"success"` jika penghapusan berhasil. |
| `message` | `string` | **Yes** | - | Pesan konfirmasi penghapusan (PDF, Node, Vector). |

### `HealthResponse`
*Terkait Endpoint: `GET /health`*
*Deskripsi: Payload status pengecekan kesehatan server.*

| Field | Type | Required | Default | Description |
|---|---|:---:|---|---|
| `status` | `string` | **Yes** | - | Status utama aplikasi FastAPI. |
| `db` | `string` | **Yes** | - | Status konektivitas database (Neo4j). |
