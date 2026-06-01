import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight } from "lucide-react";

export const metadata = {
  title: "About Mnemo",
  description:
    "What Mnemo is, the problem it solves, how it captures and encrypts your AI conversations, how you stay in control, and how the inheritance feature works.",
};

const STEPS = [
  {
    title: "Sign in with Google",
    body: "zkLogin derives a Sui address from your Google account. There is no seed phrase to back up and no wallet to install. Your first sign-in provisions your Mnemo account on-chain automatically, and gas is sponsored so it costs you nothing.",
  },
  {
    title: "Point your AI tool at your proxy",
    body: "Mnemo gives you a personal, OpenAI-compatible endpoint and token. Set them as the API base URL and key in any tool that supports a custom endpoint (Cursor, Cline, BoltAI, and others). From then on, every conversation that flows through that tool is captured into your memory.",
  },
  {
    title: "Search across everything",
    body: "Your captured conversations are embedded and made semantically searchable. Ask in natural language and Mnemo surfaces the relevant exchange, decrypted in your browser, regardless of which tool or model produced it.",
  },
  {
    title: "Set an heir (optional)",
    body: "Choose a Sui address and a period of silence. If you go inactive for that long, an on-chain dead-man's switch grants your chosen heir the ability to decrypt your archive. The rule is enforced by a Move contract that Mnemo cannot override.",
  },
];

const FAQ = [
  {
    q: "Can Mnemo read my conversations?",
    a: "No. Your memory is encrypted with Seal under a policy tied to your Sui account. Decryption happens in your browser. Mnemo stores ciphertext it cannot read.",
  },
  {
    q: "What happens if Mnemo shuts down?",
    a: "Your data does not live in a Mnemo database you cannot reach. The encrypted content sits on Walrus and the access policy is on Sui, both of which you control. You can export everything as JSON at any time.",
  },
  {
    q: "Which tools work with it?",
    a: "Anything that lets you set a custom OpenAI-compatible base URL and key. That includes most AI coding assistants and chat clients.",
  },
  {
    q: "Do I need crypto experience or a wallet?",
    a: "No. You sign in with Google. zkLogin creates your on-chain identity behind the scenes, and transaction fees are sponsored.",
  },
];

export default function HowItWorksPage() {
  return (
    <main className="relative min-h-screen flex flex-col overflow-hidden">
      {/* Soft ocean gradient backdrop */}
      <div className="pointer-events-none fixed inset-0 bg-gradient-to-b from-accent/40 via-background to-primary/15" />

      {/* Header */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-white/10 bg-background/40 backdrop-blur-md">
        <Link href="/" className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Mnemo" className="w-8 h-8 object-contain" />
          <span className="font-bold text-base sm:text-lg tracking-tight">Mnemo</span>
        </Link>
        <Link href="/">
          <Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4 mr-1.5" /> Back</Button>
        </Link>
      </nav>

      <div className="relative z-10 max-w-3xl mx-auto w-full px-5 sm:px-6 py-10 sm:py-16 flex flex-col gap-10 sm:gap-16">

        {/* Intro */}
        <header className="flex flex-col gap-4">
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            Encrypted · Portable · Yours forever
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Own your AI memory</h1>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Mnemo is a portable, encrypted memory layer for your AI conversations. It
            captures what you discuss with AI tools, keeps it private and under your
            control, makes years of it instantly searchable, and lets you pass it on.
            This page explains what that means and how it works.
          </p>
        </header>

        {/* Problem / What Mnemo does — two glass cards side by side */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="rounded-2xl border border-white/15 bg-background/40 backdrop-blur-md p-6 flex flex-col gap-3">
            <h2 className="text-xl font-bold tracking-tight">The problem</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Your most useful thinking increasingly happens with AI debugging,
              drafting, deciding. But that history is scattered across vendors, locked
              inside each tool, and tied to whichever model you used that day. Switch
              tools and you lose it. Cancel a subscription and it may be gone. And none
              of it survives you.
            </p>
          </div>
          <div className="rounded-2xl border border-white/15 bg-background/40 backdrop-blur-md p-6 flex flex-col gap-3">
            <h2 className="text-xl font-bold tracking-tight">What Mnemo does</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Mnemo sits between you and the AI tools you already use. As you work, it
              archives your conversations into a single private memory that spans every
              tool and model, encrypted so only you can read it, stored on
              decentralized infrastructure, searchable in plain language, exportable at
              will, and, if you choose, inheritable.
            </p>
          </div>
        </section>

        {/* Steps — flowing numbered journey */}
        <section className="flex flex-col gap-5">
          <div className="flex flex-col gap-1">
            <h2 className="text-2xl font-bold tracking-tight">How it works</h2>
            <p className="text-sm text-muted-foreground">Four steps. No wallet, no password.</p>
          </div>

          <div className="relative flex flex-col gap-5">
            {/* flowing "current" line connecting the steps */}
            <div className="pointer-events-none absolute left-[22px] top-3 bottom-3 w-0.5 bg-gradient-to-b from-primary/60 via-primary/25 to-primary/60" />
            {STEPS.map((step, i) => (
              <div
                key={step.title}
                tabIndex={0}
                className="group relative flex gap-5 rounded-2xl border border-white/15 bg-background/40 backdrop-blur-md p-5
                           transition-all duration-300 ease-out
                           hover:-translate-y-1 hover:bg-background/60 hover:border-primary/40 hover:shadow-xl
                           focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              >
                <div className="relative z-10 shrink-0">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-lg shadow-lg
                                  transition-transform duration-300 group-hover:scale-110">
                    {i + 1}
                  </div>
                </div>
                <div className="flex flex-col gap-1.5 pt-1">
                  <h3 className="font-semibold text-lg transition-colors duration-300 group-hover:text-primary">
                    {step.title}
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{step.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Ownership + Inheritance — emphasis cards */}
        <section className="flex flex-col gap-5">
          <div className="rounded-2xl border border-primary/25 bg-primary/5 backdrop-blur-md p-6 flex flex-col gap-3">
            <h2 className="text-xl font-bold tracking-tight">Your data is genuinely yours</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Ownership here is technical, not just a promise. Each memory is encrypted
              with Seal under an access policy bound to your Sui account, so stored
              content is unreadable to anyone without your authorization including
              Mnemo. The encrypted data is written to Walrus, decentralized storage you
              can reach independently, and the rules governing access live in a Move
              smart contract on Sui that you control. Export your entire archive as JSON
              whenever you want.
            </p>
          </div>
          <div className="rounded-2xl border border-primary/25 bg-primary/5 backdrop-blur-md p-6 flex flex-col gap-3">
            <h2 className="text-xl font-bold tracking-tight">Inheritance</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Name an heir (any Sui address) and a silence threshold in days. Normal
              activity counts as a heartbeat that keeps your account active. If you go
              silent longer than the threshold, the contract lets your heir gain
              decryption access. Until then no one but you can read it, and you can
              change or cancel anytime. Because the logic is on-chain, neither Mnemo nor
              anyone else can grant access early or deny it when conditions are met.
            </p>
          </div>
        </section>

        {/* Privacy & security */}
        <section className="flex flex-col gap-3">
          <h2 className="text-2xl font-bold tracking-tight">Privacy and security</h2>
          <p className="text-muted-foreground leading-relaxed">
            Sign-in uses zkLogin, so Mnemo never sees a password and you never manage a
            seed phrase. Your provider API keys are yours and are used only to make the
            calls you initiate. Decryption of your memory happens client-side in your
            browser. The result is a system designed so that the easy thing and the
            private thing are the same thing.
          </p>
        </section>

        {/* FAQ — glass cards */}
        <section className="flex flex-col gap-5">
          <h2 className="text-2xl font-bold tracking-tight">Frequently asked</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {FAQ.map(({ q, a }, i) => (
              <div key={i} className="rounded-2xl border border-white/15 bg-background/40 backdrop-blur-md p-5 flex flex-col gap-1.5">
                <h3 className="font-semibold text-sm">{q}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="flex flex-col items-center gap-3 text-center border-t border-white/10 pt-12">
          <h2 className="text-2xl font-bold tracking-tight">Ready to own your AI memory?</h2>
          <Link href="/">
            <Button size="lg">Get started <ArrowRight className="w-4 h-4 ml-1" /></Button>
          </Link>
        </section>

      </div>
    </main>
  );
}