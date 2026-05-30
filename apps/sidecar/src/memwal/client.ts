/**
 * MemWal client — REAL implementation (Week 2, Architecture 1).
 *
 * Talks to the live MemWal relayer. The relayer owns the WHOLE pipeline:
 * embed → Seal-encrypt → Walrus upload → on-chain index. We send PLAINTEXT
 * text and the relayer handles everything; recall is semantic (query → the
 * relayer vector-searches, fetches from Walrus, Seal-decrypts, returns text).
 *
 * This replaces the Week-1 mock that base64-stored ciphertext in memory.
 * Encryption is no longer done here (the old seal/client.ts mock is deleted);
 * the relayer's Seal integration owns it.
 *
 * Auth scheme (from the relayer's auth.rs, proven in test-relayer-roundtrip.ts):
 *   signed message = `{timestamp}.{method}.{path}.{body_sha256}.{nonce}.{account_id}`
 *   headers: x-public-key (32B raw ed25519 hex), x-signature (raw ed25519 hex),
 *            x-timestamp (unix s), x-nonce (uuid v4), x-account-id
 *   The relayer resolves the owner by looking up the delegate pubkey on-chain.
 *
 * Required env:
 *   RELAYER_URL            default http://localhost:8000
 *   MNEMO_ACCOUNT_ID       the shared MemWalAccount object id
 *   SIDECAR_DELEGATE_SUI_KEY   bech32 suiprivkey1... for the registered delegate
 */
import { createHash, randomUUID } from "node:crypto";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";
import { logger } from "../log.js";

const RELAYER_URL = process.env.RELAYER_URL ?? "http://localhost:8000";
const ACCOUNT_ID = process.env.MNEMO_ACCOUNT_ID ?? "";
const DELEGATE_SUI_KEY = process.env.SIDECAR_DELEGATE_SUI_KEY ?? "";

if (!ACCOUNT_ID) {
  logger.warn("MNEMO_ACCOUNT_ID is not set — relayer calls will fail until configured");
}
if (!DELEGATE_SUI_KEY) {
  logger.warn("SIDECAR_DELEGATE_SUI_KEY is not set — relayer calls will fail until configured");
}

function kpFromBech32(s: string): Ed25519Keypair {
  const { schema, secretKey } = decodeSuiPrivateKey(s);
  if (schema !== "ED25519") throw new Error(`expected ED25519 key, got ${schema}`);
  return Ed25519Keypair.fromSecretKey(secretKey);
}

// Lazily build the keypair so the module can import even with empty env
// (health checks etc.); throws clearly only when a call actually needs it.
let _delegateKp: Ed25519Keypair | null = null;
let _delegatePubHex: string | null = null;
function delegate(): { kp: Ed25519Keypair; pubHex: string } {
  if (!DELEGATE_SUI_KEY) throw new Error("SIDECAR_DELEGATE_SUI_KEY not configured");
  if (!ACCOUNT_ID) throw new Error("MNEMO_ACCOUNT_ID not configured");
  if (!_delegateKp) {
    _delegateKp = kpFromBech32(DELEGATE_SUI_KEY);
    _delegatePubHex = Buffer.from(_delegateKp.getPublicKey().toRawBytes()).toString("hex");
  }
  return { kp: _delegateKp, pubHex: _delegatePubHex! };
}

/**
 * Signed request to the relayer. Mirrors test-relayer-roundtrip.ts exactly.
 * Returns { ok, status, body } so callers can branch on status (e.g. 404)
 * without losing access to the response. Existing callers that want the
 * old throw-on-non-2xx behaviour wrap this in signedFetch().
 */
async function signedFetchRaw(
  method: string,
  path: string,
  body?: unknown,
): Promise<{ ok: boolean; status: number; bodyText: string }> {
  const { kp, pubHex } = delegate();
  const bodyStr = body === undefined ? "" : JSON.stringify(body);
  const bodySha = createHash("sha256").update(bodyStr).digest("hex");
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = randomUUID();

  const message = `${timestamp}.${method}.${path}.${bodySha}.${nonce}.${ACCOUNT_ID}`;
  const rawSig = await kp.sign(new TextEncoder().encode(message));
  const sigHex = Buffer.from(rawSig).toString("hex");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-public-key": pubHex,
    "x-signature": sigHex,
    "x-timestamp": timestamp,
    "x-nonce": nonce,
    "x-account-id": ACCOUNT_ID,
  };

  const res = await fetch(RELAYER_URL + path, {
    method,
    headers,
    body: method === "GET" ? undefined : bodyStr,
  });
  const bodyText = await res.text();
  return { ok: res.ok, status: res.status, bodyText };
}

/**
 * Throwing wrapper around signedFetchRaw — preserves the original
 * signedFetch contract (parse JSON, throw on non-2xx) for callers that
 * don't need status-aware branching.
 */
async function signedFetch(method: string, path: string, body?: unknown): Promise<any> {
  const { ok, status, bodyText } = await signedFetchRaw(method, path, body);
  if (!ok) {
    throw new Error(`${method} ${path} → ${status}: ${bodyText}`);
  }
  return bodyText ? JSON.parse(bodyText) : {};
}

async function pollJob(jobId: string, timeoutMs = 90_000, intervalMs = 3_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const job = await signedFetch("GET", `/api/remember/${jobId}`);
    const status = job.status as string;
    if (status === "done") {
      const blobId = job.blob_id ?? job.blobId ?? job.walrus_blob_id ?? "";
      logger.info({ jobId, blobId }, "memwal.remember done");
      return blobId;
    }
    if (status === "failed") {
      throw new Error(`remember job ${jobId} failed: ${job.error_msg ?? "unknown"}`);
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`remember job ${jobId} did not finish within ${timeoutMs}ms`);
}

/**
 * Store a memory. Sends PLAINTEXT text to the relayer, which embeds,
 * Seal-encrypts, uploads to Walrus, and indexes on-chain. Returns the blob id.
 *
 * NOTE (Architecture 1): the relayer owns embedding + indexing. The caller
 * (worker) should NOT pre-embed or pre-encrypt; it passes the raw text.
 */
export async function rememberBlob(input: {
  ownerAddress: string;
  namespaceObjectId: string;
  text: string;
  metadata?: Record<string, unknown>;
}): Promise<string> {
  const namespace = input.namespaceObjectId || "default";
  const job = await signedFetch("POST", "/api/remember", {
    text: input.text,
    namespace,
    metadata: input.metadata ?? {},
  });
  const jobId = job.job_id ?? job.jobId;
  if (!jobId) {
    // Some relayer responses may be synchronous; accept a direct blob id too.
    const direct = job.blob_id ?? job.walrus_blob_id;
    if (direct) return direct;
    throw new Error(`unexpected /api/remember response: ${JSON.stringify(job)}`);
  }
  logger.info({ jobId, ns: namespace, bytes: input.text.length }, "memwal.remember enqueued");
  return await pollJob(jobId);
}

/**
 * Semantic recall. Sends a query; the relayer vector-searches its index,
 * fetches matching blobs from Walrus, Seal-decrypts, and returns the
 * decrypted memories. Returns the raw relayer results array.
 */
export async function recallMemories(input: {
  ownerAddress: string;
  namespaceObjectId: string;
  query: string;
  topK?: number;
}): Promise<Array<{ blob_id: string; text: string; distance?: number }>> {
  const namespace = input.namespaceObjectId || "default";
  const resp = await signedFetch("POST", "/api/recall", {
    query: input.query,
    namespace,
    limit: input.topK ?? 10,
  });
  const results = resp.results ?? [];
  logger.info({ ns: namespace, count: results.length }, "memwal.recall");
  return results;
}

/**
 * Deterministic fetch of one already-known memory by walrus_blob_id.
 *
 * Calls the relayer's /api/fetch route (new — wraps the engine's fetch_one
 * primitive: cache → Walrus → Seal-decrypt → UTF-8). Unlike recall, this
 * does NOT run a vector search; the caller already knows which blob it
 * wants. Used by the API's GET /memories/{id} so the chats browser can
 * reliably load a specific conversation without going through search.
 *
 * Returns:
 *   - the decrypted text on success
 *   - null when the relayer responds 404 (blob gone, decrypt failed, dropped)
 * Throws on auth / network / unexpected failures.
 */
export async function fetchBlob(input: {
  ownerAddress: string;
  namespaceObjectId: string;
  walrusBlobId: string;
}): Promise<string | null> {
  const namespace = input.namespaceObjectId || "default";
  const path = "/api/fetch";
  const { ok, status, bodyText } = await signedFetchRaw("POST", path, {
    namespace,
    blob_id: input.walrusBlobId,
  });

  if (status === 404) {
    logger.info({ ns: namespace, blobId: input.walrusBlobId }, "memwal.fetch 404");
    return null;
  }
  if (!ok) {
    throw new Error(`POST ${path} → ${status}: ${bodyText}`);
  }

  const json = bodyText ? JSON.parse(bodyText) : {};
  const text = json.text;
  if (typeof text !== "string") {
    throw new Error(`POST ${path} → 200 but missing text field: ${bodyText}`);
  }
  logger.info({ ns: namespace, blobId: input.walrusBlobId, bytes: text.length }, "memwal.fetch ok");
  return text;
}