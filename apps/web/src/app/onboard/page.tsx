"use client";

import { useState, useEffect } from "react";
import { Copy, Check, ChevronRight, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getMe, updateProfile, type MeResponse } from "@/lib/api";
import { useEnokiFlow, useZkLogin } from "@mysten/enoki/react";
import { useSuiClient } from "@mysten/dapp-kit";
import { ensureAccount, lookupAccountId, InheritanceError } from "@/lib/inheritance";
import { CreatureAvatar, AVATARS, DEFAULT_AVATAR_ID } from "@/components/avatars";

const STEPS = ["Sign In", "Your Profile", "Your API Key", "Your Endpoint", "Configure Your Tool"];

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

  // Profile step state.
  const [displayName, setDisplayName] = useState("");
  const [avatarId, setAvatarId] = useState<string>(DEFAULT_AVATAR_ID);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // On-chain account creation state.
  const [accountStatus, setAccountStatus] =
    useState<"idle" | "checking" | "creating" | "ready" | "error">("idle");
  const [accountError, setAccountError] = useState<string | null>(null);

  const progress = ((step + 1) / STEPS.length) * 100;
  const endpoint = me?.proxy_base_url ?? "https://proxy.mnemo.app/v1/loading...";
  const proxyToken = me?.proxy_token ?? "loading...";

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    // "Add another key" from Settings → jump straight to the API-key step,
    // skipping sign-in and profile.
    if (params.get("step") === "key") {
      sessionStorage.setItem("mnemo_authed", "true");
      setStep(2);
      return;
    }
    // Arriving fresh from sign-in → skip the sign-in step, start at profile.
    const fromCallback = document.referrer.includes("/auth/callback") ||
      sessionStorage.getItem("mnemo_authed") === "true";
    if (fromCallback) {
      sessionStorage.setItem("mnemo_authed", "true");
      setStep(1);
    }
  }, []);

  // Fetch identity + proxy details once the signed-in address resolves; also
  // prefill the profile fields if the user already has them.
  useEffect(() => {
    if (!address) {
      setLoading(false);
      return;
    }
    setLoading(true);
    getMe(address)
      .then((m) => {
        setMe(m);
        if (m.display_name) setDisplayName(m.display_name);
        if (m.avatar_id) setAvatarId(m.avatar_id);
      })
      .catch(() => setError("Could not reach backend. Showing placeholder data."))
      .finally(() => setLoading(false));
  }, [address]);

  // Create the onchain account if it doesn't exist yet. Idempotent.
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
            : "Couldn't set up your onchain account. You can retry below.",
        );
      }
    })();

    return () => { cancelled = true; };
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
          : "Couldn't set up your onchain account. Try again.",
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

  async function handleSaveProfile() {
    if (!address) {
      setProfileError("Sign in with Google first.");
      return;
    }
    setSavingProfile(true);
    setProfileError(null);
    try {
      await updateProfile(address, {
        display_name: displayName.trim() || null,
        avatar_id: avatarId,
      });
      setStep(2);
    } catch {
      setProfileError("Couldn't save your profile");
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleSaveKey() {
    const key = apiKey.trim();
    if (!key) return;
    if (!address) {
      setSaveError("Sign in with Google before saving your key.");
      return;
    }
    setSaving(true);
    setSaveError(null);

    const identityHeaders = { "X-Sui-Address": address };

    try {
      const vRes = await fetch("http://127.0.0.1:8001/keys/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...identityHeaders },
        body: JSON.stringify({ provider, key }),
      });
      if (!vRes.ok) throw new Error(`validate failed: ${vRes.status}`);
      const v = await vRes.json();
      if (!v.valid) {
        setSaveError(v.detail || "That key didn't work, double check it and try again.");
        return;
      }

      const res = await fetch("http://127.0.0.1:8001/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...identityHeaders },
        body: JSON.stringify({ provider, key }),
      });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      setSaveSuccess(true);
      setApiKey("");
      setTimeout(() => setStep(3), 800);
    } catch {
      setSaveError("Could not save key");
    } finally {
      setSaving(false);
    }
  }

  function AccountStatusBadge() {
    if (accountStatus === "idle") return null;
    if (accountStatus === "ready") {
      return (
        <div className="rounded-lg bg-primary/10 border border-primary/30 px-4 py-3 text-sm text-primary flex items-center gap-2">
          <ShieldCheck className="w-4 h-4" />
          Your onchain Mnemo account is ready.
        </div>
      );
    }
    if (accountStatus === "error") {
      return (
        <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive flex flex-col gap-2">
          <span> {accountError}</span>
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
          ? "Creating your onchain account (gas sponsored by Mnemo)..."
          : "Checking your onchain account..."}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background/60 flex flex-col">

      {/* Navbar */}
      <nav className="flex items-center gap-2 px-6 py-4 border-b">
        {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Mnemo" className="w-8 h-8 object-contain" />
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
              {error}
            </div>
          )}

          {/* Step 0 — Sign In */}
          {step === 0 && (
            <div className="flex flex-col gap-4">
              <p className="text-muted-foreground text-sm">
                Sign in with Google to create your encrypted Mnemo account.
                Your identity is managed via zkLogin, Mnemo never sees your password.
              </p>
              <Button className="w-full" size="lg" onClick={handleGoogleLogin}>
                Sign in with Google
              </Button>
            </div>
          )}

          {/* Step 1 — Your Profile */}
          {step === 1 && (
            <div className="flex flex-col gap-6">
              {/* Live preview of the chosen avatar */}
              <div className="flex flex-col items-center gap-3 text-center">
                <CreatureAvatar id={avatarId} className="h-20 w-20 sm:h-24 sm:w-24 ring-4 ring-primary/20" />
                <div>
                  <h2 className="text-lg font-semibold">
                    {displayName.trim() ? `Hi, ${displayName.trim()}!` : "Make it yours"}
                  </h2>
                  <p className="text-sm text-muted-foreground max-w-xs">
                    Pick a name and a sea creature avatar. They appear on your
                    messages when you browse your memory.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Display name</label>
                <Input
                  placeholder="e.g. Timi"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  maxLength={40}
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Pick your avatar</label>
                <div className="grid grid-cols-4 sm:grid-cols-5 gap-3 justify-items-center">
                  {AVATARS.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => setAvatarId(a.id)}
                      aria-label={a.label}
                      aria-pressed={avatarId === a.id}
                      title={a.label}
                      className={`rounded-full transition-transform ${
                        avatarId === a.id
                          ? "ring-4 ring-primary scale-110"
                          : "ring-1 ring-border hover:scale-105"
                      }`}
                    >
                      <CreatureAvatar id={a.id} className="h-12 w-12 sm:h-14 sm:w-14" />
                    </button>
                  ))}
                </div>
              </div>

              {profileError && (
                <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">
                   {profileError}
                </div>
              )}

              <Button className="w-full" size="lg" onClick={handleSaveProfile} disabled={savingProfile}>
                {savingProfile
                  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</>
                  : <>Continue <ChevronRight className="w-4 h-4 ml-1" /></>}
              </Button>
            </div>
          )}

          {/* Step 2 — API Key */}
          {step === 2 && (
            <div className="flex flex-col gap-4">
              <p className="text-muted-foreground text-sm">
                Paste your API key. We verify it with your provider, then store
                it on your Mnemo backend and use it only to make calls on your
                behalf. (Seal encryption in your browser is coming before mainnet.)
              </p>

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
                <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">
                   {saveError}
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
                  <>Validate and save <ChevronRight className="w-4 h-4 ml-1" /></>
                )}
              </Button>
            </div>
          )}

          {/* Step 3 — Endpoint */}
          {step === 3 && (
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

              <Button className="w-full" onClick={() => setStep(4)} disabled={loading}>
                Next <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          )}

          {/* Step 4 — Configure tool */}
          {step === 4 && (
            <div className="flex flex-col gap-4">
              <p className="text-muted-foreground text-sm">
                Choose your AI tool below and follow the instructions to start
                capturing your conversations.
              </p>

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
                      "Any OpenAI compatible client will work with your API Token",
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