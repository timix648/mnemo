"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEnokiFlow, useZkLogin } from "@mysten/enoki/react";
import { Button } from "@/components/ui/button";
import { LogoutButton } from "@/components/LogoutButton";
import { MnemoSchoolLoader } from "@/components/Clownfish";
import { AlertTriangle, ArrowRight } from "lucide-react";

const VALUE_PROPS = [
  { title: "Search everything", body: "Semantic search across years of AI conversations. Find that solution you cracked three months ago in seconds." },
  { title: "Own it forever", body: "Encrypted with Seal, stored on Walrus, governed by a Move contract you control. Mnemo cannot read your memory." },
  { title: "Inherit your AI past", body: "Set a dead-man's switch. After a chosen silence, your chosen recipient gains access. Your memory outlives you." },
];

export default function LandingPage() {
  const flow = useEnokiFlow();
  const router = useRouter();
  const { address } = useZkLogin();
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null); // shows the school loader

  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const signedIn = mounted && Boolean(address);

  async function startSignIn() {
    setError(null);
    const enokiKey = process.env.NEXT_PUBLIC_ENOKI_API_KEY;
    const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!enokiKey) { setError("Sign-in isn't configured: NEXT_PUBLIC_ENOKI_API_KEY is empty."); setPending(null); return; }
    if (!googleClientId) { setError("Sign-in isn't configured: NEXT_PUBLIC_GOOGLE_CLIENT_ID is empty."); setPending(null); return; }
    setSigningIn(true);
    try {
      const url = await flow.createAuthorizationURL({
        provider: "google", network: "testnet", clientId: googleClientId,
        redirectUrl: `${window.location.origin}/auth/callback`,
      });
      window.location.href = url;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Sign in failed: ${msg}`);
      setSigningIn(false);
      setPending(null);
    }
  }

  // Click → brief clownfish swim → smooth navigate.
  function go(href: string) {
    setPending(href);
    setTimeout(() => router.push(href), 850);
  }
  function goSignIn() {
    setPending("signin");
    setTimeout(() => startSignIn(), 750);
  }

  return (
    <main className="relative min-h-screen overflow-hidden flex flex-col">
      <style>{`
        .mnemo-word{position:relative;display:inline-block}
        .mnemo-base{color:color-mix(in oklab, var(--foreground) 24%, transparent);
                    text-shadow:0 1px 10px color-mix(in oklab, #ffffff 30%, transparent)}
        /* Liquid fill: a slower reveal, then a gentle wave shimmer that loops forever */
        .mnemo-fill{position:absolute;inset:0;white-space:nowrap;
                    clip-path:inset(0 100% 0 0);
                    animation:mnemo-reveal 2.8s cubic-bezier(.4,0,.2,1) .3s forwards}
        .mnemo-fill-ink{color:#0a0f14}
        .mnemo-fill-orange{
          background:linear-gradient(100deg,
            var(--primary) 0%, color-mix(in oklab, var(--primary) 60%, #ffd9b3) 50%, var(--primary) 100%);
          background-size:220% 100%;
          -webkit-background-clip:text;background-clip:text;color:transparent;
          animation:mnemo-reveal 2.8s cubic-bezier(.4,0,.2,1) .3s forwards,
                    mnemo-wave 6s ease-in-out 3.1s infinite;
        }
        @keyframes mnemo-reveal{to{clip-path:inset(0 0 0 0)}}
        @keyframes mnemo-wave{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}
        @media (prefers-reduced-motion: reduce){
          .mnemo-fill{clip-path:inset(0 0 0 0);animation:none}
          .mnemo-fill-orange{animation:none;background:none;color:var(--primary)}
        }
      `}</style>

      {/* ---- Video background (landing only) — no full-screen overlay; the video stays crisp ---- */}
      <video
        className="absolute inset-0 h-full w-full object-cover motion-reduce:hidden"
        autoPlay loop muted playsInline preload="metadata"
        poster="/video/landing-bg-poster.jpg"
      >
        <source src="/video/landing-bg.mp4" type="video/mp4" />
      </video>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/video/landing-bg-poster.jpg" alt=""
        className="hidden motion-reduce:block absolute inset-0 h-full w-full object-cover" />

      {/* ---- Content ---- */}
      <div className="relative z-10 flex flex-col min-h-screen">

        {/* Glassy navbar — local contrast only */}
        <nav className="flex items-center justify-between px-6 py-4 border-b border-white/20 bg-background/30 backdrop-blur-md">
          <Link href="/" className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Mnemo" className="w-8 h-8 object-contain" />
            <span className="font-bold text-base sm:text-lg tracking-tight">Mnemo</span>
          </Link>
          {signedIn ? (
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={() => go("/chats")}>My Memory</Button>
              <Button variant="ghost" size="sm" onClick={() => go("/settings")}>Settings</Button>
              <LogoutButton />
            </div>
          ) : (
            <Button size="sm" onClick={goSignIn} disabled={signingIn}>Get started</Button>
          )}
        </nav>

        {/* Hero */}
        <section className="flex flex-1 items-center justify-center px-4 py-12 sm:py-20">
          <div className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-white/30 bg-background/50 backdrop-blur-xl shadow-2xl ring-1 ring-white/10 px-5 py-8 sm:px-8 sm:py-12 flex flex-col items-center text-center gap-5 sm:gap-6">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/50" />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/10 to-transparent" />

            {/* Animated glassy → color-fill headline */}
            <h1 className="relative text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight leading-tight">
              <span className="mnemo-word">
                <span className="mnemo-base">Your AI memory,</span>
                <span aria-hidden className="mnemo-fill mnemo-fill-ink">Your AI memory,</span>
              </span>{" "}
              <span className="mnemo-word">
                <span className="mnemo-base">owned forever.</span>
                <span aria-hidden className="mnemo-fill mnemo-fill-orange">owned forever.</span>
              </span>
            </h1>

            <p className="relative text-muted-foreground text-base sm:text-lg max-w-xl">
              Mnemo captures every AI conversation you have across Cursor, Claude,
              ChatGPT, and more. It encrypts it, and makes it searchable Forever.
            </p>

            {error && (
              <div className="relative w-full rounded-lg bg-destructive/15 border border-destructive/30 px-4 py-3 text-sm text-destructive flex items-start gap-2 text-left">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="relative flex flex-col items-center gap-3">
              <div className="flex flex-wrap justify-center gap-3">
                {signedIn ? (
                  <Button size="lg" onClick={() => go("/search")} disabled={!!pending}>
                    Open your memory <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                ) : (
                  <Button size="lg" onClick={goSignIn} disabled={signingIn || !!pending}>
                    Sign in with Google
                  </Button>
                )}
                <Button size="lg" variant="outline" className="bg-background/40 backdrop-blur-sm"
                  onClick={() => go("/how-it-works")} disabled={!!pending}>
                  See how it works <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
              {!signedIn && (
                <p className="text-xs text-muted-foreground max-w-md">
                  First sign-in creates your encrypted account automatically. No password,
                  no wallet. Powered by zkLogin, gas-free via Enoki.
                </p>
              )}
            </div>
          </div>
        </section>

        {/* Value props — interactive glass cards (each carries its own local contrast) */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-5 px-6 pb-24 max-w-5xl mx-auto w-full">
          {VALUE_PROPS.map(({ title, body }) => (
            <div
              key={title}
              tabIndex={0}
              className="group relative overflow-hidden rounded-2xl border border-white/25 bg-background/40 backdrop-blur-md p-6 flex flex-col gap-2 shadow-lg
                         cursor-default transition-all duration-300 ease-out
                         hover:-translate-y-2 hover:bg-background/60 hover:border-primary/45 hover:shadow-2xl
                         focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              <div className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/15 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
              <h3 className="text-lg font-semibold transition-colors duration-300 group-hover:text-primary">{title}</h3>
              <span className="h-0.5 w-8 rounded-full bg-primary/40 transition-all duration-300 group-hover:w-16 group-hover:bg-primary" />
              <p className="text-muted-foreground text-sm">{body}</p>
            </div>
          ))}
        </section>
      </div>

      {/* Click → school of clownfish circles → navigate */}
      {pending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-md animate-in fade-in duration-200">
          <MnemoSchoolLoader label="Diving in…" />
        </div>
      )}
    </main>
  );
}