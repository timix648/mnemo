"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Brain, Shield, GitFork } from "lucide-react";
import { useEnokiFlow } from "@mysten/enoki/react";

export default function LandingPage() {
  const flow = useEnokiFlow();

  async function handleGoogleSignIn() {
    try {
      const url = await flow.createAuthorizationURL({
        provider: "google",
        network: "testnet",
        clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "",
        redirectUrl: `${window.location.origin}/auth/callback`,
      });
      window.location.href = url;
    } catch (err) {
      console.error("Sign in failed:", err);
    }
  }

  return (
    <main className="min-h-screen bg-background flex flex-col">

      {/* Navbar */}
      <nav className="flex items-center justify-between px-6 py-4 border-b">
        <div className="flex items-center gap-2">
          <Brain className="w-6 h-6 text-primary" />
          <span className="font-bold text-lg tracking-tight">Mnemo</span>
        </div>
        <Button size="sm" onClick={handleGoogleSignIn}>Get Started</Button>
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

        <div className="flex gap-3 mt-2">
          <Button size="lg" onClick={handleGoogleSignIn}>
            Sign in with Google
          </Button>
          <Link href="/search">
            <Button size="lg" variant="outline">See how it works</Button>
          </Link>
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

      {/* Footer */}
      <footer className="border-t px-6 py-4 text-center text-sm text-muted-foreground">
        Built for Sui Overflow 2026 · Agentic Web Track
      </footer>

    </main>
  );
}