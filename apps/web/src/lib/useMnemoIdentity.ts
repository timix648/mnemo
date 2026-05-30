"use client";
 
import { useEffect, useState } from "react";
import { useZkLogin } from "@mysten/enoki/react";
import { getMe } from "@/lib/api";
 
/**
 * One source of truth for "who is signed in" across the app.
 *
 * Returns the zkLogin address (used as the API identity via X-Sui-Address) and,
 * once /me resolves, the backend user_id, default namespace id, and the user's
 * profile (display name + chosen creature avatar).
 *
 *   const { address, userId, namespaceId, displayName, avatarId, ready } = useMnemoIdentity();
 *
 * `ready` flips true once the /me round-trip finishes (success or failure).
 */
export function useMnemoIdentity() {
  const { address } = useZkLogin();
  const [userId, setUserId] = useState<string | null>(null);
  const [namespaceId, setNamespaceId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [avatarId, setAvatarId] = useState<string | null>(null);
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
        setDisplayName(me.display_name ?? null);
        setAvatarId(me.avatar_id ?? null);
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
 
  return { address, userId, namespaceId, displayName, avatarId, ready };
}
 