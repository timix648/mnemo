/**
 * Week 1 DOD: prove the MemWal-shaped path works end-to-end through the sidecar.
 * Right now the sidecar mocks MemWal + Seal; this script hits its HTTP API
 * so that when we swap in the real SDK in Week 2 there's no test rewrite.
 *
 * Run: pnpm exec tsx test-memwal.ts
 */
const SIDECAR = process.env.SIDECAR_URL ?? "http://localhost:3001";
const OWNER = "0xtest_owner_address";
const NAMESPACE = "0xtest_namespace_object";
const POLICY = NAMESPACE; // in v1 the namespace IS the policy anchor

async function post(path: string, body: unknown): Promise<any> {
  const res = await fetch(SIDECAR + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json();
}

async function main() {
  // 1. Encrypt a small payload via Seal (mock).
  const original = "Hello Mnemo — this is a Week 1 round-trip.";
  const plaintextB64 = Buffer.from(original, "utf8").toString("base64");

  const t0 = performance.now();
  const { ciphertext } = await post("/seal/encrypt", { policyObjectId: POLICY, plaintext: plaintextB64 });
  const t1 = performance.now();

  // 2. Remember the ciphertext via MemWal (mock).
  const { walrusBlobId } = await post("/memwal/remember", {
    ownerAddress: OWNER,
    namespaceObjectId: NAMESPACE,
    ciphertext,
    metadata: { test: true },
  });
  const t2 = performance.now();

  // 3. Recall it.
  const { ciphertext: ct2 } = await post("/memwal/recall", {
    ownerAddress: OWNER,
    namespaceObjectId: NAMESPACE,
    walrusBlobId,
  });
  const t3 = performance.now();

  // 4. Decrypt.
  const { plaintext } = await post("/seal/decrypt", {
    policyObjectId: POLICY,
    ciphertext: ct2,
    requesterAddress: OWNER,
  });
  const t4 = performance.now();

  const round_tripped = Buffer.from(plaintext, "base64").toString("utf8");

  console.log("blob ID         :", walrusBlobId);
  console.log("encrypt latency :", (t1 - t0).toFixed(1), "ms");
  console.log("remember latency:", (t2 - t1).toFixed(1), "ms");
  console.log("recall latency  :", (t3 - t2).toFixed(1), "ms");
  console.log("decrypt latency :", (t4 - t3).toFixed(1), "ms");
  console.log("round-tripped   :", JSON.stringify(round_tripped));

  if (round_tripped !== original) {
    console.error("MISMATCH");
    process.exit(1);
  }
  console.log("\n✓ MemWal round trip OK");
}

main().catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});
