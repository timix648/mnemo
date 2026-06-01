"use client";

import { useEffect, useState } from "react";
import { Copy, Check, Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getMe, type MeResponse } from "@/lib/api";

/**
 * Shows the user their proxy base URL + bearer token (the things they need to
 * point Cursor/BoltAI at). The token is masked by default; click "Show" to
 * reveal. Both have copy buttons.
 */
export function ProxySetupCard({ address }: { address: string | null | undefined }) {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showToken, setShowToken] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Hydration guard: this component's content depends on the client-only
  // zkLogin session, which doesn't exist during SSR. Render a single stable
  // state on the server AND on the first client paint, then switch to the real
  // branches after mount. Without this, server ("Sign in…") and client
  // ("Loading…") disagree and React throws a hydration mismatch.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!address) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getMe(address)
      .then((data) => { if (!cancelled) setMe(data); })
      .catch(() => { if (!cancelled) setError("Couldn't load your proxy setup. Backend unreachable."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [address]);

  function copy(value: string, field: string) {
    navigator.clipboard.writeText(value);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 1500);
  }

  // Server + first client render land here identically → no mismatch.
  if (!mounted) {
    return (
      <div className="rounded-xl border bg-card p-5 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading your proxy setup…
      </div>
    );
  }

  if (!address) {
    return (
      <div className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">
        Sign in to see your proxy setup.
      </div>
    );
  }
  if (loading) {
    return (
      <div className="rounded-xl border bg-card p-5 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading your proxy setup…
      </div>
    );
  }
  if (error || !me) {
    return (
      <div className="rounded-xl border bg-card p-5 text-sm text-destructive bg-destructive/10">
         {error ?? "Couldn't load proxy setup."}
      </div>
    );
  }

  const maskedToken = me.proxy_token.length > 8
    ? `${me.proxy_token.slice(0, 4)}${"•".repeat(20)}${me.proxy_token.slice(-4)}`
    : "•".repeat(me.proxy_token.length);

  return (
    <div className="rounded-xl border bg-card p-5 flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h3 className="font-semibold">Your proxy setup</h3>
        <p className="text-xs text-muted-foreground">
          Point your AI tool (Cursor, BoltAI, etc.) at this URL with this token to
          capture conversations into Mnemo.
        </p>
      </div>

      {/* Proxy URL */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Proxy base URL
        </label>
        <div className="flex gap-2">
          <code className="flex-1 px-3 py-2 rounded-md bg-muted text-xs font-mono break-all">
            {me.proxy_base_url}
          </code>
          <Button size="sm" variant="outline" onClick={() => copy(me.proxy_base_url, "url")}>
            {copiedField === "url" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          </Button>
        </div>
      </div>

      {/* Bearer token */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Bearer token
        </label>
        <div className="flex gap-2">
          <code className="flex-1 px-3 py-2 rounded-md bg-muted text-xs font-mono break-all">
            {showToken ? me.proxy_token : maskedToken}
          </code>
          <Button size="sm" variant="outline" onClick={() => setShowToken((v) => !v)}>
            {showToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </Button>
          <Button size="sm" variant="outline" onClick={() => copy(me.proxy_token, "token")}>
            {copiedField === "token" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Keep this private,it lets your AI tools post on your behalf.
        </p>
      </div>

      {/* How-to */}
      <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
        <p className="font-medium text-foreground">How to use:</p>
        <p>Set the API base URL in your tool to the proxy URL above, with the bearer token as the API key. Every conversation through that tool is then captured into your Mnemo memory.</p>
      </div>
    </div>
  );
}
