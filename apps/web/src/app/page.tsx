"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Brain, Shield, GitFork, Loader2, AlertTriangle,
  KeyRound, Search, Heart, ChevronDown,
} from "lucide-react";
import { useEnokiFlow } from "@mysten/enoki/react";

export default function LandingPage() {
  const flow = useEnokiFlow();
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGoogleSignIn() {
    setError(null);

    // Friendly pre-flight checks — much better than a silent 401.
    const enokiKey = process.env.NEXT_PUBLIC_ENOKI_API_KEY;
    const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!enokiKey) {
      setError("Sign-in isn't configured: NEXT_PUBLIC_ENOKI_API_KEY is empty. See apps/web/.env.example.");
      return;
    }
    if (!googleClientId) {
      setError("Sign-in isn't configured: NEXT_PUBLIC_GOOGLE_CLIENT_ID is empty. See apps/web/.env.example.");
      return;
    }

    setSigningIn(true);
    try {
      const url = await flow.createAuthorizationURL({
        provider: "google",
        network: "testnet",
        clientId: googleClientId,
        redirectUrl: `${window.location.origin}/auth/callback`,
      });
      window.location.href = url;
    } catch (err) {
      console.error("Sign in failed:", err);
      const msg = err instanceof Error ? err.message : String(err);
      // Decode the two most common Enoki errors into actionable language.
      if (msg.includes("401")) {
        setError(
          "Enoki rejected the sign-in (401). Likely cause: in the Enoki Portal, the Google auth provider isn't configured for this app, or the Client ID there doesn't match NEXT_PUBLIC_GOOGLE_CLIENT_ID. See the setup guide.",
        );
      } else if (msg.includes("403")) {
        setError(
          "Enoki forbade the request (403). Likely cause: your API key doesn't have zkLogin enabled for testnet. Check the Enoki Portal → API Keys.",
        );
      } else {
        setError(`Sign in failed: ${msg}`);
      }
      setSigningIn(false);
    }
  }

  function scrollToHowItWorks() {
    document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <main className="min-h-screen bg-background flex flex-col">

      {/* Navbar */}
      <nav className="flex items-center justify-between px-6 py-4 border-b">
        <div className="flex items-center gap-2">
          <Brain className="w-6 h-6 text-primary" />
          <span className="font-bold text-lg tracking-tight">Mnemo</span>
        </div>
        <Button size="sm" onClick={handleGoogleSignIn} disabled={signingIn}>
          {signingIn ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Signing in…</> : "Get started"}
        </Button>
      </nav>

      {/* Hero */}
      <section className="flex flex-col items-center justify-center text-center flex-1 px-6 py-24 gap-6">
        <div className="inline-flex items-center gap-2 bg-muted text-muted-foreground text-sm px-3 py-1 rounded-full">
          <Shield className="w-3 h-3" />
          Encrypted · Portable · Yours forever
        </div>

        <h1 className="text-5xl font-extrabold tracking-tight max-w-2xl leading-tight">
          Your AI memory,{" "}
          <span className="text-primary">owned forever.</span>
        </h1>

        <p className="text-muted-foreground text-lg max-w-xl">
          Mnemo captures every AI conversation you have — across Cursor, Claude,
          ChatGPT, and more — encrypts it, and makes it searchable. Forever.
          Across every model you'll ever use.
        </p>

        {error && (
          <div className="max-w-xl w-full rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-start gap-2 text-left">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex flex-col items-center gap-3 mt-2">
          <div className="flex gap-3">
            <Button size="lg" onClick={handleGoogleSignIn} disabled={signingIn}>
              {signingIn ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Signing in…</>
              ) : (
                "Sign in with Google"
              )}
            </Button>
            <Button size="lg" variant="outline" onClick={scrollToHowItWorks}>
              See how it works
              <ChevronDown className="w-4 h-4 ml-1" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground max-w-md">
            First sign-in creates your encrypted Mnemo account automatically — no
            password, no wallet to set up. Powered by zkLogin and gas-free via Enoki.
          </p>
        </div>
      </section>

      {/* Value props */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6 px-6 pb-24 max-w-5xl mx-auto w-full">
        <div className="rounded-xl border bg-card p-6 flex flex-col gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Brain className="w-5 h-5 text-primary" />
          </div>
          <h3 className="font-semibold text-lg">Search everything</h3>
          <p className="text-muted-foreground text-sm">
            Semantic search across years of AI conversations. Find that solution
            you figured out three months ago in seconds.
          </p>
        </div>

        <div className="rounded-xl border bg-card p-6 flex flex-col gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <h3 className="font-semibold text-lg">Own it forever</h3>
          <p className="text-muted-foreground text-sm">
            Encrypted with Seal. Stored on Walrus. Governed by a Move contract
            you control. Mnemo cannot read your memory — the math says so.
          </p>
        </div>

        <div className="rounded-xl border bg-card p-6 flex flex-col gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <GitFork className="w-5 h-5 text-primary" />
          </div>
          <h3 className="font-semibold text-lg">Inherit your AI past</h3>
          <p className="text-muted-foreground text-sm">
            Configure a dead-man's switch. After 90 days of silence, your
            designated recipient gains access. Your AI memory outlives you.
          </p>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="bg-muted/30 border-y px-6 py-20">
        <div className="max-w-3xl mx-auto flex flex-col gap-10">
          <div className="text-center flex flex-col gap-2">
            <h2 className="text-3xl font-extrabold tracking-tight">How it works</h2>
            <p className="text-muted-foreground">
              Four steps. No wallet, no password, no servers reading your conversations.
            </p>
          </div>

          <ol className="flex flex-col gap-6">
            <li className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold shrink-0">1</div>
              <div className="flex flex-col gap-1">
                <h3 className="font-semibold flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-primary" /> Sign in with Google
                </h3>
                <p className="text-sm text-muted-foreground">
                  zkLogin derives a Sui address from your Google account. There&apos;s no
                  seed phrase to back up and no wallet to install. First sign-in creates
                  your Mnemo account on-chain automatically; gas is sponsored.
                </p>
              </div>
            </li>

            <li className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold shrink-0">2</div>
              <div className="flex flex-col gap-1">
                <h3 className="font-semibold flex items-center gap-2">
                  <Shield className="w-4 h-4 text-primary" /> Point your AI tool at your proxy
                </h3>
                <p className="text-sm text-muted-foreground">
                  Mnemo gives you a personal OpenAI-compatible endpoint. Drop it into
                  Cursor, BoltAI, Cline — anything that takes a custom base URL. Every
                  conversation flows through it and gets archived to your encrypted
                  memory.
                </p>
              </div>
            </li>

            <li className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold shrink-0">3</div>
              <div className="flex flex-col gap-1">
                <h3 className="font-semibold flex items-center gap-2">
                  <Search className="w-4 h-4 text-primary" /> Search across everything
                </h3>
                <p className="text-sm text-muted-foreground">
                  Semantic search runs over the decrypted view in your browser. Find a
                  fix you figured out months ago across any tool you&apos;ve ever used.
                </p>
              </div>
            </li>

            <li className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold shrink-0">4</div>
              <div className="flex flex-col gap-1">
                <h3 className="font-semibold flex items-center gap-2">
                  <Heart className="w-4 h-4 text-primary" /> Set an heir (optional)
                </h3>
                <p className="text-sm text-muted-foreground">
                  Pick a Sui address and a silence threshold. If you go quiet for that
                  long, the on-chain dead-man&apos;s switch grants your heir decryption
                  access. Enforced by a Move contract — Mnemo can&apos;t override it.
                </p>
              </div>
            </li>
          </ol>

          <div className="flex justify-center pt-4">
            <Button size="lg" onClick={handleGoogleSignIn} disabled={signingIn}>
              {signingIn ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Signing in…</>
              ) : (
                "Get started — it's free"
              )}
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t px-6 py-4 text-center text-sm text-muted-foreground">
        Built for Sui Overflow 2026 · Agentic Web Track
      </footer>

    </main>
  );
}
