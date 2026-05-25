"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useEnokiFlow } from "@mysten/enoki/react";
import { Brain, Loader2 } from "lucide-react";

export default function AuthCallbackPage() {
  const router = useRouter();
  const flow = useEnokiFlow();

  useEffect(() => {
    const hash = window.location.hash;
    const params = new URLSearchParams(window.location.search);

    // Enoki puts the auth response in the URL hash or query params
    if (hash || params.get("id_token") || params.get("code")) {
      flow.handleAuthCallback()
        .then((result) => {
          console.log("Auth callback success:", result);
          sessionStorage.setItem("mnemo_authed", "true");
          router.push("/onboard");
        })
        .catch((err) => {
          console.error("Auth callback failed:", err);
          router.push("/");
        });
    } else {
      // No auth params — redirect to home
      router.push("/");
    }
  }, [flow, router]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="flex flex-col items-center gap-4 text-center">
        <Brain className="w-10 h-10 text-primary animate-pulse" />
        <h1 className="text-xl font-bold">Securing your identity...</h1>
        <p className="text-muted-foreground text-sm">
          Completing Google sign-in via Enoki zkLogin...
        </p>
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    </div>
  );
}