"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useEnokiFlow, useZkLogin } from "@mysten/enoki/react";
import { Button } from "@/components/ui/button";
import { LogoutButton } from "@/components/LogoutButton";
import {
  Brain, Shield, GitFork, Loader2, AlertTriangle, ArrowRight,
} from "lucide-react";



export default function LandingPage() {
  const flow = useEnokiFlow();
  const { address } = useZkLogin();
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // NOTE: we intentionally do NOT auto-redirect signed-in users away from the
  // landing page. That redirect was what caused the logo to "glitch" back into
  // the app — clicking the Mnemo logo (which links to "/") would mount this
  // page and immediately bounce out. First-login routing is handled by
  // /auth/callback, so the landing page is now a valid place to be while
  // signed in.

  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const signedIn = mounted && Boolean(address);
  async function handleGoogleSignIn() {
    setError(null);

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

  return (
    <main className="min-h-screen bg-background flex flex-col">

      {/* Navbar — adapts to signed-in state so the logo can lead back here. */}
      <nav className="flex items-center justify-between px-6 py-4 border-b">
        <Link href="/" className="flex items-center gap-2">
          <Brain className="w-6 h-6 text-primary" />
          <span className="font-bold text-lg tracking-tight">Mnemo</span>
        </Link>

        {signedIn ? (
          <div className="flex items-center gap-1">
            <Link href="/chats"><Button variant="ghost" size="sm">My Memory</Button></Link>
            <Link href="/settings"><Button variant="ghost" size="sm">Settings</Button></Link>
            <LogoutButton />
          </div>
        ) : (
          <Button size="sm" onClick={handleGoogleSignIn} disabled={signingIn}>
            {signingIn ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Signing in…</> : "Get started"}
          </Button>
        )}
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
          Across every model you&apos;ll ever use.
        </p>

        {error && (
          <div className="max-w-xl w-full rounded-lg bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive flex items-start gap-2 text-left">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex flex-col items-center gap-3 mt-2">
          <div className="flex gap-3">
            {signedIn ? (
              <Link href="/search">
                <Button size="lg">
                  Open your memory
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            ) : (
              <Button size="lg" onClick={handleGoogleSignIn} disabled={signingIn}>
                {signingIn ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Signing in…</>
                ) : (
                  "Sign in with Google"
                )}
              </Button>
            )}
            <Link href="/how-it-works">
              <Button size="lg" variant="outline">
                See how it works
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </div>
          {!signedIn && (
            <p className="text-xs text-muted-foreground max-w-md">
              First sign-in creates your encrypted Mnemo account automatically — no
              password, no wallet to set up. Powered by zkLogin and gas-free via Enoki.
            </p>
          )}
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
            Configure a dead-man&apos;s switch. After a chosen silence, your
            designated recipient gains access. Your AI memory outlives you.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t px-6 py-4 text-center text-sm text-muted-foreground">
        Built for Sui Overflow 2026 · Agentic Web Track
      </footer>

    </main>
  );
}
