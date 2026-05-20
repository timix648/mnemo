/**
 * HTTP API contracts. Mirrored by Pydantic models in apps/api and apps/proxy.
 */

import type { Provider, MemoryEntrySummary, Namespace, ProviderKey } from "./types";

// --- apps/api (port 8000) ---

export interface MeResponse {
  user_id: string;
  sui_address: string;
  proxy_token: string;
  proxy_base_url: string;
  default_namespace_id: string;
}

export interface CreateNamespaceRequest {
  name: string;
  sui_object_id: string;
}
export type CreateNamespaceResponse = Namespace;

export interface SaveKeyRequest {
  provider: Provider;
  walrus_blob_id: string;
  seal_policy_id: string;
}
export type SaveKeyResponse = ProviderKey;

export interface SearchRequest {
  namespace_id: string;
  query: string;
  top_k?: number;
}
export interface SearchResponse {
  results: Array<MemoryEntrySummary & { score: number }>;
}

// --- apps/sidecar (port 3001) ---

export interface SidecarRememberRequest {
  ownerAddress: string;
  namespaceObjectId: string;
  ciphertext: string;       // base64
  metadata?: Record<string, unknown>;
}
export interface SidecarRememberResponse {
  walrusBlobId: string;
}

export interface SidecarRecallRequest {
  ownerAddress: string;
  namespaceObjectId: string;
  walrusBlobId: string;
}
export interface SidecarRecallResponse {
  ciphertext: string;       // base64
}

export interface SidecarEncryptRequest {
  policyObjectId: string;
  plaintext: string;        // base64
}
export interface SidecarEncryptResponse {
  ciphertext: string;       // base64
}

export interface SidecarDecryptRequest {
  policyObjectId: string;
  ciphertext: string;       // base64
  requesterAddress: string;
}
export interface SidecarDecryptResponse {
  plaintext: string;        // base64
}
