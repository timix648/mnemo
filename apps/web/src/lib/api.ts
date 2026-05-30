const API_BASE = "http://127.0.0.1:8001";

export interface MeResponse {
  user_id: string;
  sui_address: string;
  proxy_token: string;
  proxy_base_url: string;
  default_namespace_id: string;
  display_name: string | null;
  avatar_id: string | null;
}

export interface SearchResult {
  id: string | null;
  namespace_id: string;
  walrus_blob_id: string;
  text: string;
  preview: string;
  model: string;
  score: number;
  ts: string;
  token_input: number;
  token_output: number;
  source_app: string | null;
  source_app_raw: string | null;
}

export interface Memory {
  id: string;
  namespace_id: string;
  walrus_blob_id: string;
  model: string;
  preview: string;
  token_input: number;
  token_output: number;
  source_app: string | null;
  source_app_raw: string | null;
  ts: string;
}

export interface MemoryDetail {
  id: string;
  namespace_id: string;
  walrus_blob_id: string;
  text: string;
  model: string;
  preview: string;
  token_input: number;
  token_output: number;
  source_app: string | null;
  source_app_raw: string | null;
  ts: string;
}

export interface SponsorResponse {
  bytes: string;
  digest: string;
}

export interface ExecuteResponse {
  digest: string;
}

/**
 * Build auth headers for an API call.
 *
 * Identity priority:
 *   1. If `suiAddress` is provided (the signed-in zkLogin address), send it as
 *      `X-Sui-Address`. The backend auto-provisions a user row for that address
 *      on first sight (see apps/api/mnemo_api/auth.py, Path 1). This is what
 *      lets ANY real user sign in and use Mnemo with no whitelist and no manual
 *      DB edits — and it makes `user.sui_address` equal the address the
 *      frontend sends as `sender`, so the /sponsor sender-check passes.
 *   2. Otherwise fall back to `X-Dev-User` (the local dev shortcut).
 *
 * Always pass the real address once the user is signed in. The `userId`
 * fallback is only for un-authenticated local dev.
 */
function looksLikeSuiAddress(v: string | undefined): v is string {
  return !!v && v.startsWith("0x") && v.length === 66;
}

function authHeaders(userId: string, suiAddress?: string): Record<string, string> {
  // Prefer an explicit signed-in address.
  if (looksLikeSuiAddress(suiAddress)) {
    return { "X-Sui-Address": suiAddress.toLowerCase() };
  }
  // Some callers (e.g. inheritance.ts) pass the zkLogin address in the first
  // ("userId") slot. If that value is actually an address, route it as
  // X-Sui-Address instead of X-Dev-User — otherwise the backend tries to parse
  // an address as a UUID and 401s with "invalid X-Dev-User".
  if (looksLikeSuiAddress(userId)) {
    return { "X-Sui-Address": userId.toLowerCase() };
  }
  return { "X-Dev-User": userId };
}

export async function getMe(userId: string, suiAddress?: string): Promise<MeResponse> {
  const res = await fetch(`${API_BASE}/me`, {
    headers: authHeaders(userId, suiAddress),
  });
  if (!res.ok) throw new Error(`/me failed: ${res.status}`);
  return res.json();
}

export async function searchMemories(
  userId: string,
  namespaceId: string,
  query: string,
  topK = 10,
  suiAddress?: string,
): Promise<{ results: SearchResult[] }> {
  const res = await fetch(`${API_BASE}/search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(userId, suiAddress),
    },
    body: JSON.stringify({
      namespace_id: namespaceId,
      query,
      top_k: topK,
    }),
  });
  if (!res.ok) throw new Error(`/search failed: ${res.status}`);
  return res.json();
}

export async function getMemories(
  userId: string,
  namespaceId: string,
  limit = 20,
  offset = 0,
  sourceApp?: string,
  suiAddress?: string,
): Promise<{ results: Memory[]; total: number }> {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });
  // namespace_id is optional; never send the string "null"/"undefined".
  if (namespaceId && namespaceId !== "null" && namespaceId !== "undefined") {
    params.set("namespace_id", namespaceId);
  }
  if (sourceApp) params.set("source_app", sourceApp);

  const res = await fetch(`${API_BASE}/memories?${params}`, {
    headers: authHeaders(userId, suiAddress),
  });
  if (!res.ok) throw new Error(`/memories failed: ${res.status}`);
  return res.json();
}

/**
 * Fetch one captured memory's full decrypted text by id.
 *
 * Deterministic by-id lookup via the API's GET /memories/{id}, which goes
 * through the sidecar -> relayer's engine.fetch_one primitive (cache ->
 * Walrus -> Seal-decrypt). Unlike searchMemories, this is NOT a semantic
 * search — it reliably loads a specific conversation even when the preview
 * text wouldn't rank itself highly. Used by the chats page when you click
 * a chat to read the full conversation.
 *
 * Throws on 404 (memory missing, blob unavailable, or owned by another
 * user) and other failures. The chats page catches and shows its
 * "couldn't load" state.
 */
export async function getMemoryById(
  memoryId: string,
  suiAddress?: string,
  userId?: string,
): Promise<MemoryDetail> {
  const res = await fetch(`${API_BASE}/memories/${memoryId}`, {
    headers: authHeaders(userId ?? "", suiAddress),
  });
  if (!res.ok) {
    throw new Error(`/memories/${memoryId} failed: ${res.status}`);
  }
  return res.json();
}

export async function deleteMemory(
  userId: string,
  memoryId: string,
  suiAddress?: string,
): Promise<void> {
  const res = await fetch(`${API_BASE}/memories/${memoryId}`, {
    method: "DELETE",
    headers: authHeaders(userId, suiAddress),
  });
  if (!res.ok) throw new Error(`/memories delete failed: ${res.status}`);
}

// --- Sponsored transaction helpers ---
// Talk to the backend's /sponsor and /sponsor/execute, which in turn call
// Enoki using the PRIVATE API key (the only kind that can sponsor).
// See apps/api/mnemo_api/routers/sponsor.py.
//
// IMPORTANT: pass `suiAddress` (the signed-in zkLogin address). It must equal
// the `sender` of the transaction, or the backend returns 403
// "sender does not match authenticated user". Sending X-Sui-Address makes the
// backend authenticate AS that address, so sender == user.sui_address and the
// check passes for every real user — no whitelist, no DB edits.

export async function sponsorTransaction(
  userId: string,
  txKindBytesB64: string,
  sender: string,
  allowedMoveCallTargets: string[],
  suiAddress?: string,
): Promise<SponsorResponse> {
  const res = await fetch(`${API_BASE}/sponsor`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // Default the identity to the sender itself — for a sponsored tx the
      // authenticated user IS the sender, so this is always correct.
      ...authHeaders(userId, suiAddress ?? sender),
    },
    body: JSON.stringify({
      transaction_kind_bytes: txKindBytesB64,
      sender,
      allowed_move_call_targets: allowedMoveCallTargets,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`/sponsor failed: ${res.status} ${text}`);
  }
  return res.json();
}

export async function executeSponsoredApi(
  userId: string,
  digest: string,
  signature: string,
  suiAddress?: string,
): Promise<ExecuteResponse> {
  const res = await fetch(`${API_BASE}/sponsor/execute`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(userId, suiAddress),
    },
    body: JSON.stringify({ digest, signature }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`/sponsor/execute failed: ${res.status} ${text}`);
  }
  return res.json();
}

export async function deleteAccount(suiAddress: string): Promise<void> {
  const res = await fetch(`${API_BASE}/me`, {
    method: "DELETE",
    headers: { "X-Sui-Address": suiAddress },
  });
  if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
}

export async function updateProfile(
  suiAddress: string,
  profile: { display_name?: string | null; avatar_id?: string | null },
): Promise<void> {
  const res = await fetch(`${API_BASE}/me`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "X-Sui-Address": suiAddress },
    body: JSON.stringify(profile),
  });
  if (!res.ok) throw new Error(`Profile update failed: ${res.status}`);
}
