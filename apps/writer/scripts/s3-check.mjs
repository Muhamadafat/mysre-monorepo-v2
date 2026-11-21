// Checks the S3 storage settings in apps/writer/.env step by step:
// upload → list → download → delete a small test file under
// <S3_PREFIX>_healthcheck/. Prints which step fails and why; never prints keys.
//
//   npm run s3:check                 (from apps/writer)
//   npm run s3:check -- --tree       also list every folder/file in the bucket (under S3_PREFIX)
import path from "node:path";
import {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

try {
  process.loadEnvFile(path.join(process.cwd(), ".env"));
} catch {
  console.error("✗ apps/writer/.env tidak ditemukan. Jalankan dari folder apps/writer.");
  process.exit(1);
}

const env = process.env;
const missing = ["S3_ENDPOINT", "S3_REGION", "S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"].filter(name => !env[name]);
if (missing.length) {
  console.error(`✗ Variabel belum diisi di .env: ${missing.join(", ")}`);
  process.exit(1);
}

const prefix = (env.S3_PREFIX ?? "").trim().replace(/^\/+|\/+$/g, "");
const base = prefix ? `${prefix}/` : "";
console.log(`Endpoint : ${env.S3_ENDPOINT}`);
console.log(`Region   : ${env.S3_REGION}`);
console.log(`Bucket   : ${env.S3_BUCKET}`);
console.log(`Prefix   : ${base || "(kosong)"}`);
console.log(`Key ID   : ${env.S3_ACCESS_KEY_ID.slice(0, 4)}…  (secret disembunyikan)\n`);

const client = new S3Client({
  region: env.S3_REGION,
  endpoint: env.S3_ENDPOINT,
  forcePathStyle: env.S3_FORCE_PATH_STYLE === "true",
  credentials: { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY },
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
});

const Bucket = env.S3_BUCKET;
const Key = `${base}_healthcheck/cek-${Date.now()}.txt`;
const body = `Tes koneksi writer ${new Date().toISOString()}`;

async function step(label, fn) {
  const start = performance.now();
  try {
    const result = await fn();
    console.log(`✓ ${label} (${Math.round(performance.now() - start)} ms)`);
    return result;
  } catch (err) {
    const status = err?.$metadata?.httpStatusCode;
    console.error(`✗ ${label} gagal${status ? ` [HTTP ${status}]` : ""}: ${err?.name ?? ""} ${err?.message ?? err}`);
    if (status === 403 || err?.name === "InvalidAccessKeyId" || err?.name === "SignatureDoesNotMatch") {
      console.error("  → Cek S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY, dan izin akses key itu ke bucket.");
    } else if (status === 404 || err?.name === "NoSuchBucket") {
      console.error("  → Cek S3_BUCKET. Kalau nama bucket benar, coba S3_FORCE_PATH_STYLE=true.");
    } else if (err?.code === "ENOTFOUND" || err?.code === "ECONNREFUSED") {
      console.error("  → Endpoint tidak bisa dihubungi. Cek S3_ENDPOINT, atau coba S3_FORCE_PATH_STYLE=true.");
    }
    process.exit(1);
  }
}

await step(`Upload   ${Key}`, () => client.send(new PutObjectCommand({ Bucket, Key, Body: body, ContentType: "text/plain" })));
await step("List     _healthcheck/", async () => {
  const res = await client.send(new ListObjectsV2Command({ Bucket, Prefix: `${base}_healthcheck/` }));
  if (!res.Contents?.some(object => object.Key === Key)) throw new Error("file tes tidak muncul di daftar");
});
await step("Download dan cocokkan isi", async () => {
  const res = await client.send(new GetObjectCommand({ Bucket, Key }));
  const text = await res.Body.transformToString();
  if (text !== body) throw new Error("isi file berbeda");
});
await step("Delete   file tes", () => client.send(new DeleteObjectCommand({ Bucket, Key })));
console.log("\nS3 siap dipakai ✓");

if (process.argv.includes("--tree")) {
  console.log(`\nIsi bucket di bawah "${base || "/"}":`);
  let token;
  let total = 0;
  let bytes = 0;
  do {
    const page = await client.send(new ListObjectsV2Command({ Bucket, Prefix: base, ContinuationToken: token }));
    for (const object of page.Contents ?? []) {
      total += 1;
      bytes += object.Size ?? 0;
      const depth = object.Key.slice(base.length).split("/").length - 1;
      console.log(`${"  ".repeat(depth)}${object.Key.slice(base.length)}  (${((object.Size ?? 0) / 1024).toFixed(1)} KB)`);
    }
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  console.log(`\n${total} file, total ${(bytes / 1024 / 1024).toFixed(2)} MB dari kuota 10 GB`);
}
