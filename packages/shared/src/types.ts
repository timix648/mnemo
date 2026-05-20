/**
 * Mnemo shared types. These are the canonical shapes that flow between
 * the web app and the Node sidecar (the Python services have their own
 * Pydantic equivalents; keep them in sync manually for the hackathon).
 */

export type Provider = "openai" | "anthropic";

export interface User {
  id: string;
  sui_address: string;
  google_sub?: string | null;
  proxy_token: string;
  created_at: string;
}

export interface Namespace {
  id: string;
  user_id: string;
  sui_object_id: string;
  name: string;
  is_default: boolean;
  created_at: string;
}

export interface ProviderKey {
  id: string;
  user_id: string;
  provider: Provider;
  walrus_blob_id: string;
  seal_policy_id: string;
  created_at: string;
}

export interface MemoryEntrySummary {
  id: string;
  namespace_id: string;
  walrus_blob_id: string | null;
  model: string | null;
  preview: string | null;
  token_input: number | null;
  token_output: number | null;
  ts: string;
}

/** The decrypted JSON we actually store as the Walrus blob. */
export interface MemoryPayload {
  prompt_messages: Array<{ role: string; content: string }>;
  response_text: string;
  model: string;
  ts: string;
  token_counts: { input: number; output: number };
  embedding_model: string;
  provider: Provider;
}
