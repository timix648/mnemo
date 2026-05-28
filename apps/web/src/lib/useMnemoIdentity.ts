"use client";
 
import { useEffect, useState } from "react";
import { useZkLogin } from "@mysten/enoki/react";
import { getMe } from "@/lib/api";
 
/**
 * One source of truth for "who is signed in" across the app.
 *
 * Returns the zkLogin address (used as the API identity via X-Sui-Address) and,
 * once /me resolves, the backend user_id and the user's default namespace id.
 * The backend auto-provisions the user + a default namespace on first call, so
 * for a brand-new signed-in user these become available after the first /me.
 *
 *   const { address, userId, namespaceId, ready } = useMnemoIdentity();
 *
 * Gate data loads on `address` (and `namespaceId` where a namespace is required,
 * e.g. search). `ready` flips true once the /me round-trip finishes (success or
 * failure), so you can distinguish "still loading" from "loaded, no namespace".
 */
export function useMnemoIdentity() {
  const { address } = useZkLogin();
  const [userId, setUserId] = useState<string | null>(null);
  const [namespaceId, setNamespaceId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
 
  useEffect(() => {
    if (!address) {
      setReady(false);
      return;
    }
    let cancelled = false;
    setReady(false);
    getMe(address)
      .then((me) => {
        if (cancelled) return;
        setUserId(me.user_id);
        setNamespaceId(me.default_namespace_id);
      })
      .catch(() => {
        // Leave ids null; pages render their own "backend unreachable" state.
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [address]);
 
  return { address, userId, namespaceId, ready };
}
 