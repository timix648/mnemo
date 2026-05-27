const API_BASE = "http://127.0.0.1:8001";

export interface MeResponse {
  user_id: string;
  sui_address: string;
  proxy_token: string;
  proxy_base_url: string;
  default_namespace_id: string;
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

export interface SponsorResponse {
  bytes: string;
  digest: string;
}

export interface ExecuteResponse {
  digest: string;
}

export async function getMe(userId: string): Promise<MeResponse> {
  const res = await fetch(`${API_BASE}/me`, {
    headers: { "X-Dev-User": userId },
  });
  if (!res.ok) throw new Error(`/me failed: ${res.status}`);
  return res.json();
}

export async function searchMemories(
  userId: string,
  namespaceId: string,
  query: string,
  topK = 10,
): Promise<{ results: SearchResult[] }> {
  const res = await fetch(`${API_BASE}/search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Dev-User": userId,
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
): Promise<{ results: Memory[]; total: number }> {
  const params = new URLSearchParams({
    namespace_id: namespaceId,
    limit: String(limit),
    offset: String(offset),
  });
  if (sourceApp) params.set("source_app", sourceApp);

  const res = await fetch(`${API_BASE}/memories?${params}`, {
    headers: { "X-Dev-User": userId },
  });
  if (!res.ok) throw new Error(`/memories failed: ${res.status}`);
  return res.json();
}

export async function deleteMemory(
  userId: string,
  memoryId: string,
): Promise<void> {
  const res = await fetch(`${API_BASE}/memories/${memoryId}`, {
    method: "DELETE",
    headers: { "X-Dev-User": userId },
  });
  if (!res.ok) throw new Error(`/memories delete failed: ${res.status}`);
}

// --- Sponsored transaction helpers ---
// Talk to the backend's /sponsor and /sponsor/execute, which in turn call
// Enoki using the PRIVATE API key (the only kind that can sponsor).
// See apps/api/mnemo_api/routers/sponsor.py.

export async function sponsorTransaction(
  userId: string,
  txKindBytesB64: string,
  sender: string,
  allowedMoveCallTargets: string[],
): Promise<SponsorResponse> {
  const res = await fetch(`${API_BASE}/sponsor`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Dev-User": userId,
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
): Promise<ExecuteResponse> {
  const res = await fetch(`${API_BASE}/sponsor/execute`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Dev-User": userId,
    },
    body: JSON.stringify({ digest, signature }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`/sponsor/execute failed: ${res.status} ${text}`);
  }
  return res.json();
}