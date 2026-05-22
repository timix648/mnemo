/**
 * Mnemo Week 2 — REAL round-trip against the live MemWal relayer.
 *
 * Step A: register the delegate keypair on-chain (add_delegate_key) so the
 *         relayer can resolve our signed requests to our MemWalAccount.
 * Step B: signed POST /api/remember (raw text → relayer embeds+Seal+Walrus+chain)
 * Step C: poll GET /api/remember/:job_id until done
 * Step D: signed POST /api/recall (semantic query → decrypted plaintext back)
 *
 * Run:  cd scripts ; pnpm exec tsx test-relayer-roundtrip.ts
 *
 * Requires env (or edit the consts below):
 *   RELAYER_URL              default http://localhost:8000
 *   DELEGATE_SUI_KEY         bech32 suiprivkey1... for mnemo-delegate (sign reqs)
 *   OWNER_SUI_KEY            bech32 suiprivkey1... for the account owner (on-chain tx)
 */

import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";
import { createHash, randomUUID } from "node:crypto";

// ---- Constants from this session ----
const RELAYER_URL = process.env.RELAYER_URL ?? "http://localhost:8000";
const PACKAGE_ID =
  "0x81f9f45e054e9732db40c78daca85fe3b6511b783d461a4557c055fd85bf9aa4";
const ACCOUNT_ID =
  "0x43ef7277216a63cc45950331506bebe043662c5066c32c4678c7538c988940fd";
const CLOCK_ID = "0x6";
const DELEGATE_ADDRESS =
  "0x66daeabfaf6932dc4ecca18185fc7f6355e83a73d202a848177ce6fbd69cab2b";
const NAMESPACE = "default";

// Private keys: paste bech32 suiprivkey1... values, or set env vars.
const DELEGATE_SUI_KEY = process.env.DELEGATE_SUI_KEY ?? "PASTE_DELEGATE_suiprivkey1_HERE";
const OWNER_SUI_KEY = process.env.OWNER_SUI_KEY ?? "PASTE_OWNER_suiprivkey1_HERE";

const sui = new SuiClient({ url: getFullnodeUrl("testnet") });

function kpFromBech32(s: string): Ed25519Keypair {
  const { schema, secretKey } = decodeSuiPrivateKey(s);
  if (schema !== "ED25519") throw new Error(`expected ED25519 key, got ${schema}`);
  return Ed25519Keypair.fromSecretKey(secretKey);
}

const delegateKp = kpFromBech32(DELEGATE_SUI_KEY);
const ownerKp = kpFromBech32(OWNER_SUI_KEY);

// raw 32-byte ed25519 public key (NOT the 33-byte flagged Sui form)
const delegatePubRaw = delegateKp.getPublicKey().toRawBytes(); // 32 bytes
const delegatePubHex = Buffer.from(delegatePubRaw).toString("hex");

// ---- Signed-request helper (scheme from docs/relayer/api-reference.md) ----
// signed message = `{timestamp}.{method}.{path}.{body_sha256}`
async function signedFetch(method: string, path: string, body: unknown): Promise<any> {
  const bodyStr = body === undefined ? "" : JSON.stringify(body);
  const bodySha = createHash("sha256").update(bodyStr).digest("hex");
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = randomUUID();

  // Canonical format (auth.rs): "{timestamp}.{method}.{path_and_query}.{body_sha256}.{nonce}.{account_id}"
  const message = `${timestamp}.${method}.${path}.${bodySha}.${nonce}.${ACCOUNT_ID}`;

  const rawSig = await delegateKp.sign(new TextEncoder().encode(message));
  const sigHex = Buffer.from(rawSig).toString("hex");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-public-key": delegatePubHex,
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
  const text = await res.text();
  if (!res.ok) {
    console.error(`  → status=${res.status}`);
    console.error(`  → body=${text}`);
    throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  }
  return text ? JSON.parse(text) : {};
}

// ---- Step A: register delegate key on-chain ----
async function registerDelegate() {
  console.log("Step A: registering delegate key on-chain...");
  console.log("  delegate pubkey (32B hex):", delegatePubHex);

  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::account::add_delegate_key`,
    arguments: [
      tx.object(ACCOUNT_ID),
      tx.pure.vector("u8", Array.from(delegatePubRaw)),
      tx.pure.address(DELEGATE_ADDRESS),
      tx.pure.string("mnemo-sidecar"),
      tx.object(CLOCK_ID),
    ],
  });

  const result = await sui.signAndExecuteTransaction({
    signer: ownerKp,
    transaction: tx,
    options: { showEffects: true },
  });
  const status = result.effects?.status?.status;
  if (status !== "success") {
    throw new Error("add_delegate_key failed: " + JSON.stringify(result.effects?.status));
  }
  console.log("  ✓ delegate registered, digest:", result.digest);
  // give the fullnode a moment to index the new delegate_keys state
  await new Promise((r) => setTimeout(r, 3000));
}

// ---- Steps B–D: remember → poll → recall ----
async function roundTrip() {
  const memory = "Timi is building Mnemo, a portable encrypted AI memory layer on Sui.";

  console.log("\nStep B: POST /api/remember ...");
  const remember = await signedFetch("POST", "/api/remember", {
    text: memory,
    namespace: NAMESPACE,
  });
  console.log("  job:", remember);
  const jobId = remember.job_id;

  console.log("\nStep C: polling job until done (embed→Seal→Walrus→chain)...");
  let blobId: string | undefined;
  for (let i = 1; i <= 100; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const status = await signedFetch("GET", `/api/remember/${jobId}`, undefined);
    console.log(`  attempt ${i}: status=${status.status}` + (status.blob_id ? ` blob=${status.blob_id}` : ""));
    if (status.status === "done") { blobId = status.blob_id; break; }
    if (status.status === "failed") throw new Error("job failed: " + JSON.stringify(status));
  }
  if (!blobId) throw new Error("job did not finish in time");

  console.log("\nStep D: POST /api/recall ...");
  const recall = await signedFetch("POST", "/api/recall", {
    query: "What is Timi building?",
    limit: 5,
    namespace: NAMESPACE,
  });
  console.log("  results:", JSON.stringify(recall, null, 2));

  const hit = (recall.results ?? []).find((r: any) =>
    typeof r.text === "string" && r.text.includes("Mnemo"),
  );
  if (hit) {
    console.log("\n✓ ROUND TRIP OK — stored, encrypted, recalled, decrypted.");
    console.log("  recalled text:", JSON.stringify(hit.text));
  } else {
    console.log("\n⚠ recall returned no matching memory. Full response above.");
  }
}

async function main() {
  console.log("Mnemo → live MemWal relayer round-trip");
  console.log("  relayer:", RELAYER_URL);
  console.log("  account:", ACCOUNT_ID);

  // Skip registration if SKIP_REGISTER=1 (e.g. already registered on a re-run)
  if (process.env.SKIP_REGISTER !== "1") {
    await registerDelegate();
  } else {
    console.log("Step A: skipped (SKIP_REGISTER=1)");
  }
  await roundTrip();
}

main().catch((e) => {
  console.error("\nFAILED:", e.message ?? e);
  process.exit(1);
});
