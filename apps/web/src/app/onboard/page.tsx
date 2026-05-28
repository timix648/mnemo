"use client";

import { useState, useEffect } from "react";
import { Brain, Copy, Check, ChevronRight, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getMe, type MeResponse } from "@/lib/api";
import { DEV_TEST_USER } from "@/config/sui";
import { useEnokiFlow, useZkLogin } from "@mysten/enoki/react";
import { useSuiClient } from "@mysten/dapp-kit";
import { ensureAccount, lookupAccountId, InheritanceError } from "@/lib/inheritance";

const STEPS = ["Sign In", "Your API Key", "Your Endpoint", "Configure Your Tool"];

export default function OnboardPage() {
  const flow = useEnokiFlow();
  const suiClient = useSuiClient();
  const { address } = useZkLogin();

  const [step, setStep] = useState(0);
  const [provider, setProvider] = useState<"openai" | "anthropic">("openai");
  const [apiKey, setApiKey] = useState("");
  const [copied, setCopied] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // On-chain account creation state.
  const [accountStatus, setAccountStatus] =
    useState<"idle" | "checking" | "creating" | "ready" | "error">("idle");
  const [accountError, setAccountError] = useState<string | null>(null);

  const progress = ((step + 1) / STEPS.length) * 100;
  const endpoint = me?.proxy_base_url ?? "https://proxy.mnemo.app/v1/loading...";
  const proxyToken = me?.proxy_token ?? "loading...";

  useEffect(() => {
    // If coming from auth callback, skip sign-in step
    const fromCallback = document.referrer.includes("/auth/callback") ||
      sessionStorage.getItem("mnemo_authed") === "true";
    if (fromCallback) {
      sessionStorage.setItem("mnemo_authed", "true");
      setStep(1);
    }

    getMe(DEV_TEST_USER.user_id)
      .then(setMe)
      .catch(() => setError("Could not reach backend. Showing placeholder data."))
      .finally(() => setLoading(false));
  }, []);

  // Once we know the signed-in address, create the on-chain account if it
  // doesn't exist yet. This is the step that was missing — without it there's
  // no MemWalAccount for the heir / heartbeat calls to target. Idempotent:
  // ensureAccount() is a no-op if the account already exists.
  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    setAccountStatus("checking");
    setAccountError(null);

    (async () => {
      try {
        const existing = await lookupAccountId(suiClient, address);
        if (cancelled) return;
        if (existing) {
          setAccountStatus("ready");
          return;
        }
        setAccountStatus("creating");
        await ensureAccount(flow, suiClient, address);
        if (!cancelled) setAccountStatus("ready");
      } catch (e) {
        if (cancelled) return;
        setAccountStatus("error");
        setAccountError(
          e instanceof InheritanceError
            ? e.message
            : "Couldn't set up your on-chain account. You can retry below.",
        );
      }
    })();

    return () => { cancelled = true; };
    // re-run if the address changes (e.g. after sign-in)
  }, [address, flow, suiClient]);

  async function retryAccount() {
    if (!address) return;
    setAccountStatus("creating");
    setAccountError(null);
    try {
      await ensureAccount(flow, suiClient, address);
      setAccountStatus("ready");
    } catch (e) {
      setAccountStatus("error");
      setAccountError(
        e instanceof InheritanceError
          ? e.message
          : "Couldn't set up your on-chain account. Try again.",
      );
    }
  }

  async function handleGoogleLogin() {
    try {
      const url = await flow.createAuthorizationURL({
        provider: "google",
        network: "testnet",
        clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "",
        redirectUrl: `${window.location.origin}/auth/callback`,
      });
      window.location.href = url;
    } catch (err) {
      console.error("Login failed:", err);
    }
  }

  function handleCopy(text: string, setter: (v: boolean) => void) {
    navigator.clipboard.writeText(text);
    setter(true);
    setTimeout(() => setter(false), 2000);
  }

  async function handleSaveKey() {
    if (!apiKey.trim()) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("http://127.0.0.1:8001/keys", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Identify as the signed-in user so the key is stored against THEM,
          // not the shared dev user. `address` is the zkLogin address from
          // useMnemoIdentity / useZkLogin (the same one onboarding already uses
          // for account creation). Falls back to dev user if not signed in.
          ...(address
            ? { "X-Sui-Address": address }
            : { "X-Dev-User": DEV_TEST_USER.user_id }),
        },
        body: JSON.stringify({
          provider,
          key: apiKey.trim(),
        }),
      });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      setSaveSuccess(true);
      setApiKey("");          
      setTimeout(() => setStep(2), 800);
    } catch {
      setSaveError("Could not save key — backend unreachable.");
    } finally {
      setSaving(false);
    }
  }

  // Small reusable status chip for the on-chain account.
  function AccountStatusBadge() {
    if (accountStatus === "idle") return null;
    if (accountStatus === "ready") {
      return (
        <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4" />
          Your on-chain Mnemo account is ready.
        </div>
      );
    }
    if (accountStatus === "error") {
      return (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex flex-col gap-2">
          <span>⚠️ {accountError}</span>
          <Button variant="outline" size="sm" className="w-fit" onClick={retryAccount}>
            Retry account setup
          </Button>
        </div>
      );
    }
    return (
      <div className="rounded-lg bg-muted/40 border px-4 py-3 text-sm text-muted-foreground flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        {accountStatus === "creating"
          ? "Creating your on-chain account (gas sponsored by Mnemo)..."
          : "Checking your on-chain account..."}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">

      {/* Navbar */}
      <nav className="flex items-center gap-2 px-6 py-4 border-b">
        <Brain className="w-5 h-5 text-primary" />
        <span className="font-bold tracking-tight">Mnemo</span>
      </nav>

      <div className="flex flex-col items-center justify-center flex-1 px-4 py-16">
        <div className="w-full max-w-lg flex flex-col gap-8">

          {/* Header */}
          <div className="flex flex-col gap-1">
            <p className="text-sm text-muted-foreground">
              Step {step + 1} of {STEPS.length}
            </p>
            <h1 className="text-2xl font-bold">{STEPS[step]}</h1>
            <Progress value={progress} className="h-1.5 mt-2" />
          </div>

          {/* Backend error banner */}
          {error && (
            <div className="rounded-lg bg-yellow-50 border border-yellow-200 px-4 py-3 text-sm text-yellow-800">
              ⚠️ {error}
            </div>
          )}

          {/* Step 0 — Sign In */}
          {step === 0 && (
            <div className="flex flex-col gap-4">
              <p className="text-muted-foreground text-sm">
                Sign in with Google to create your encrypted Mnemo account.
                Your identity is managed via zkLogin — Mnemo never sees your password.
              </p>
              <Button className="w-full" size="lg" onClick={handleGoogleLogin}>
                Sign in with Google
              </Button>
            </div>
          )}

          {/* Step 1 — API Key */}
          {step === 1 && (
            <div className="flex flex-col gap-4">
              <p className="text-muted-foreground text-sm">
                Paste your API key below. It will be encrypted with Seal before
                leaving your browser — Mnemo never sees it in plaintext.
              </p>

              {/* On-chain account setup runs in the background here. */}
              <AccountStatusBadge />

              <Tabs value={provider} onValueChange={(v) => setProvider(v as "openai" | "anthropic")}>
                <TabsList className="w-full">
                  <TabsTrigger value="openai" className="flex-1">OpenAI</TabsTrigger>
                  <TabsTrigger value="anthropic" className="flex-1">Anthropic</TabsTrigger>
                </TabsList>
                <TabsContent value="openai" className="mt-4">
                  <Input
                    placeholder="sk-..."
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    type="password"
                  />
                </TabsContent>
                <TabsContent value="anthropic" className="mt-4">
                  <Input
                    placeholder="sk-ant-..."
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    type="password"
                  />
                </TabsContent>
              </Tabs>

              {saveError && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                  ⚠️ {saveError}
                </div>
              )}

              <Button
                className="w-full"
                disabled={!apiKey || saving}
                onClick={handleSaveKey}
              >
                {saving ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</>
                ) : saveSuccess ? (
                  <><Check className="w-4 h-4 mr-2" />Saved!</>
                ) : (
                  <>Encrypt and save <ChevronRight className="w-4 h-4 ml-1" /></>
                )}
              </Button>
            </div>
          )}

          {/* Step 2 — Endpoint */}
          {step === 2 && (
            <div className="flex flex-col gap-4">
              <p className="text-muted-foreground text-sm">
                This is your personal Mnemo proxy endpoint. Paste it into any
                AI tool that supports a custom API base URL.
              </p>

              {loading ? (
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Fetching your endpoint...
                </div>
              ) : (
                <>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Proxy URL
                    </label>
                    <div className="flex gap-2">
                      <Input value={endpoint} readOnly className="font-mono text-sm" />
                      <Button
                        variant="outline"
                        onClick={() => handleCopy(endpoint, setCopied)}
                        className="shrink-0"
                      >
                        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      API Token
                    </label>
                    <div className="flex gap-2">
                      <Input value={proxyToken} readOnly className="font-mono text-sm" />
                      <Button
                        variant="outline"
                        onClick={() => handleCopy(proxyToken, setCopiedToken)}
                        className="shrink-0"
                      >
                        {copiedToken ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                </>
              )}

              <Button className="w-full" onClick={() => setStep(3)} disabled={loading}>
                Next <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          )}

          {/* Step 3 — Configure tool */}
          {step === 3 && (
            <div className="flex flex-col gap-4">
              <p className="text-muted-foreground text-sm">
                Choose your AI tool below and follow the instructions to start
                capturing your conversations.
              </p>

              {/* Surface account status here too, so the user doesn't leave
                  onboarding without a working on-chain account. */}
              <AccountStatusBadge />

              <Tabs defaultValue="cursor">
                <TabsList className="w-full">
                  <TabsTrigger value="cursor" className="flex-1">Cursor</TabsTrigger>
                  <TabsTrigger value="cline" className="flex-1">Cline</TabsTrigger>
                  <TabsTrigger value="boltai" className="flex-1">BoltAI</TabsTrigger>
                  <TabsTrigger value="other" className="flex-1">Other</TabsTrigger>
                </TabsList>

                {[
                  {
                    key: "cursor",
                    steps: [
                      "Open Cursor → Settings → Models → Custom OpenAI API",
                      "Set Base URL to your Proxy URL above",
                      "Use your API Token as the OpenAI API key",
                    ],
                  },
                  {
                    key: "cline",
                    steps: [
                      "Open Cline → Settings → API Provider",
                      'Choose "OpenAI Compatible"',
                      "Set Base URL to your Proxy URL and API Token as the key",
                    ],
                  },
                  {
                    key: "boltai",
                    steps: [
                      "Open BoltAI → Preferences → API",
                      "Set Custom API Host to your Proxy URL",
                      "Use your API Token as the API key and restart BoltAI",
                    ],
                  },
                  {
                    key: "other",
                    steps: [
                      "Find the custom API base URL setting in your tool",
                      "Paste your Proxy URL",
                      "Any OpenAI-compatible client will work with your API Token",
                    ],
                  },
                ].map(({ key, steps }) => (
                  <TabsContent key={key} value={key} className="mt-4">
                    <ol className="flex flex-col gap-3">
                      {steps.map((s, i) => (
                        <li key={i} className="flex gap-3 text-sm">
                          <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs shrink-0 font-bold">
                            {i + 1}
                          </span>
                          {s}
                        </li>
                      ))}
                    </ol>
                  </TabsContent>
                ))}
              </Tabs>

              <Button className="w-full" onClick={() => window.location.href = "/chats"}>
                Go to my memory →
              </Button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
