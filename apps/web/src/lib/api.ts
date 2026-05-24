const API_BASE = "http://127.0.0.1:8001";

export interface MeResponse {
  user_id: string;
  sui_address: string;
  proxy_token: string;
  proxy_base_url: string;
  default_namespace_id: string;
  memwal_account_id: string;
  memwal_package_id: string;
}

export interface SearchResult {
  blob_id: string;
  id: string;
  text: string;
  preview: string;
  model: string;
  score: number;
  ts: string;
}

export interface Memory {
  blob_id: string;
  preview: string;
  model: string;
  ts: string;
  namespace_id: string;
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
): Promise<{ results: SearchResult[]; total: number }> {
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
): Promise<{ memories: Memory[]; total: number }> {
  const res = await fetch(
    `${API_BASE}/memories?namespace_id=${namespaceId}&limit=${limit}&offset=${offset}`,
    {
      headers: { "X-Dev-User": userId },
    },
  );
  if (!res.ok) throw new Error(`/memories failed: ${res.status}`);
  return res.json();
}