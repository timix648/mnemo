const SIDECAR = process.env.SIDECAR_URL ?? "http://localhost:3001";
const OWNER = "0x609502b084396f9f66feaf6809f88a7243d23105def5b75923cbec58193081e3";

async function post(path, body) {
  const res = await fetch(SIDECAR + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${path} -> ${res.status}: ${text}`);
  return text ? JSON.parse(text) : {};
}

async function main() {
  console.log("Sidecar Step-1 verify ->", SIDECAR);

  console.log("\n[1] POST /memwal/remember ...");
  const remember = await post("/memwal/remember", {
    ownerAddress: OWNER,
    namespaceObjectId: "default",
    text: "Sidecar swap step 1 verification memory.",
    metadata: { source: "test-sidecar-step1" },
  });
  console.log("  remember:", JSON.stringify(remember));
  if (!remember.walrusBlobId) throw new Error("no walrusBlobId returned");

  console.log("\n[2] POST /memwal/recall ...");
  const recall = await post("/memwal/recall", {
    ownerAddress: OWNER,
    namespaceObjectId: "default",
    query: "sidecar swap verification",
    topK: 5,
  });
  console.log("  recall:", JSON.stringify(recall, null, 2));

  const hit = (recall.results ?? []).find((r) => typeof r.text === "string" && r.text.length > 0);
  if (hit) {
    console.log("\nSIDECAR STEP 1 OK - sidecar -> real relayer round-trip works.");
    console.log("  sample text:", JSON.stringify(hit.text));
  } else {
    console.log("\nrecall returned no decrypted text. Full response above.");
  }
}

main().catch((e) => { console.error("\nFAILED:", e?.message ?? e); process.exit(1); });
