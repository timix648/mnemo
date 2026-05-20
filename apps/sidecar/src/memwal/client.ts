/**
 * MemWal client. WEEK 1: MOCK IMPLEMENTATION — stores blobs in memory.
 *
 * In Week 2 we replace the body of these functions with calls to
 * @mysten-incubation/memwal once we've installed and verified its API.
 *
 * Why this mock? Two reasons:
 *   1. Lets the rest of the stack come up before we tackle the SDK details.
 *   2. Forces us to define a stable interface (the function signatures here)
 *      so the Python worker can call us via HTTP without knowing whether
 *      the backend is real or mocked.
 */
import { randomBytes } from "node:crypto";
import { logger } from "../log.js";

interface BlobKey {
  ownerAddress: string;
  namespaceObjectId: string;
  walrusBlobId: string;
}

// In-memory store for the mock.
const _store = new Map<string, string>();

function _keyOf(k: BlobKey): string {
  return `${k.ownerAddress}::${k.namespaceObjectId}::${k.walrusBlobId}`;
}

export async function rememberBlob(input: {
  ownerAddress: string;
  namespaceObjectId: string;
  ciphertext: string;
  metadata: Record<string, unknown>;
}): Promise<string> {
  const walrusBlobId = "mock_" + randomBytes(16).toString("hex");
  _store.set(_keyOf({
    ownerAddress: input.ownerAddress,
    namespaceObjectId: input.namespaceObjectId,
    walrusBlobId,
  }), input.ciphertext);
  logger.info(
    { walrusBlobId, ns: input.namespaceObjectId, bytes: input.ciphertext.length },
    "memwal.remember (mock)",
  );
  return walrusBlobId;
}

export async function recallBlob(input: BlobKey): Promise<string> {
  const ciphertext = _store.get(_keyOf(input));
  if (!ciphertext) {
    throw new Error(`blob not found: ${input.walrusBlobId}`);
  }
  logger.info({ walrusBlobId: input.walrusBlobId }, "memwal.recall (mock)");
  return ciphertext;
}

// ----- WEEK 2 TODO -----
// Replace the bodies above with the real SDK:
//
//   import { MemWalClient } from "@mysten-incubation/memwal";
//   const memwal = new MemWalClient({
//     suiClient: new SuiClient({ url: process.env.SUI_RPC_URL }),
//     delegateKey: process.env.SIDECAR_DELEGATE_SUI_KEY,
//     network: process.env.SUI_NETWORK,
//   });
//
// Verify the API surface against the MemWal repo before wiring; the function
// names may be `.remember()`/`.recall()` or `.store()`/`.retrieve()`.
