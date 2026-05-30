import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Brain, KeyRound, Shield, Search, Heart, ArrowLeft, ArrowRight,
} from "lucide-react";

export const metadata = {
  title: "How Mnemo works",
  description:
    "Four steps: sign in with Google, point your AI tool at your proxy, search across everything, and optionally set an heir.",
};

const STEPS = [
  {
    icon: KeyRound,
    title: "Sign in with Google",
    body:
      "zkLogin derives a Sui address from your Google account. There's no seed phrase to back up and no wallet to install. First sign-in creates your Mnemo account on-chain automatically; gas is sponsored.",
  },
  {
    icon: Shield,
    title: "Point your AI tool at your proxy",
    body:
      "Mnemo gives you a personal OpenAI-compatible endpoint. Drop it into Cursor, BoltAI, Cline — anything that takes a custom base URL. Every conversation flows through it and gets archived to your encrypted memory.",
  },
  {
    icon: Search,
    title: "Search across everything",
    body:
      "Semantic search runs over the decrypted view in your browser. Find a fix you figured out months ago across any tool you've ever used.",
  },
  {
    icon: Heart,
    title: "Set an heir (optional)",
    body:
      "Pick a Sui address and a silence threshold. If you go quiet for that long, the on-chain dead-man's switch grants your heir decryption access. Enforced by a Move contract — Mnemo can't override it.",
  },
];

export default function HowItWorksPage() {
  return (
    <main className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <nav className="flex items-center justify-between px-6 py-4 border-b">
        <Link href="/" className="flex items-center gap-2">
          <Brain className="w-6 h-6 text-primary" />
          <span className="font-bold text-lg tracking-tight">Mnemo</span>
        </Link>
        <Link href="/">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Back
          </Button>
        </Link>
      </nav>

      {/* Intro */}
      <section className="px-6 pt-16 pb-10">
        <div className="max-w-3xl mx-auto text-center flex flex-col gap-3">
          <h1 className="text-4xl font-extrabold tracking-tight">How Mnemo works</h1>
          <p className="text-muted-foreground text-lg">
            Four steps. No wallet, no password, no servers reading your conversations.
          </p>
        </div>
      </section>

      {/* Steps */}
      <section className="px-6 pb-16 flex-1">
        <ol className="max-w-3xl mx-auto flex flex-col gap-6">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            return (
              <li
                key={i}
                className="flex gap-4 rounded-2xl border bg-card p-5 sm:p-6"
              >
                <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold shrink-0">
                  {i + 1}
                </div>
                <div className="flex flex-col gap-1">
                  <h2 className="font-semibold text-lg flex items-center gap-2">
                    <Icon className="w-4 h-4 text-primary" /> {s.title}
                  </h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">{s.body}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      {/* CTA */}
      <section className="px-6 pb-20">
        <div className="max-w-3xl mx-auto flex flex-col items-center gap-3 text-center">
          <h2 className="text-2xl font-bold tracking-tight">Ready to own your AI memory?</h2>
          <Link href="/">
            <Button size="lg">
              Get started — it&apos;s free
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </div>
      </section>

      <footer className="border-t px-6 py-4 text-center text-sm text-muted-foreground">
        Built for Sui Overflow 2026 · Agentic Web Track
      </footer>
    </main>
  );
}
