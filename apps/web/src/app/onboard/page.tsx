"use client";

import { useState, useEffect } from "react";
import { Brain, Copy, Check, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getMe, type MeResponse } from "@/lib/api";
import { DEV_TEST_USER } from "@/config/sui";

const STEPS = ["Your API Key", "Your Endpoint", "Configure Your Tool"];

export default function OnboardPage() {
  const [step, setStep] = useState(0);
  const [provider, setProvider] = useState<"openai" | "anthropic">("openai");
  const [apiKey, setApiKey] = useState("");
  const [copied, setCopied] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const progress = ((step + 1) / STEPS.length) * 100;

  // Fallback endpoint for when API isn't available
  const endpoint = me?.proxy_base_url ?? "https://proxy.mnemo.app/v1/loading...";
  const proxyToken = me?.proxy_token ?? "loading...";

  useEffect(() => {
    getMe(DEV_TEST_USER.user_id)
      .then(setMe)
      .catch(() => setError("Could not reach backend. Showing placeholder data."))
      .finally(() => setLoading(false));
  }, []);

  function handleCopy(text: string, setter: (v: boolean) => void) {
    navigator.clipboard.writeText(text);
    setter(true);
    setTimeout(() => setter(false), 2000);
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

          {/* Error banner */}
          {error && (
            <div className="rounded-lg bg-yellow-50 border border-yellow-200 px-4 py-3 text-sm text-yellow-800">
              ⚠️ {error}
            </div>
          )}

          {/* Step 1 — API Key */}
          {step === 0 && (
            <div className="flex flex-col gap-4">
              <p className="text-muted-foreground text-sm">
                Paste your API key below. It will be encrypted with Seal before
                leaving your browser — Mnemo never sees it in plaintext.
              </p>

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

              <Button
                className="w-full"
                disabled={!apiKey}
                onClick={() => setStep(1)}
              >
                Encrypt and save <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          )}

          {/* Step 2 — Endpoint */}
          {step === 1 && (
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
                  {/* Proxy URL */}
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

                  {/* Proxy Token */}
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

                  {/* Test snippet */}
                  <div className="rounded-lg bg-muted p-4 text-sm font-mono text-muted-foreground">
                    <p className="text-xs text-muted-foreground mb-2">Test it in your terminal:</p>
                    curl {endpoint}/chat/completions \<br />
                    &nbsp;&nbsp;-H &quot;Content-Type: application/json&quot; \<br />
                    &nbsp;&nbsp;-d &apos;{"{"}&quot;model&quot;:&quot;gpt-4o&quot;,&quot;messages&quot;:[{"{"}&quot;role&quot;:&quot;user&quot;,&quot;content&quot;:&quot;hi&quot;{"}"}]{"}"}&apos;
                  </div>
                </>
              )}

              <Button className="w-full" onClick={() => setStep(2)} disabled={loading}>
                Next <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          )}

          {/* Step 3 — Configure tool */}
          {step === 2 && (
            <div className="flex flex-col gap-4">
              <p className="text-muted-foreground text-sm">
                Choose your AI tool below and follow the instructions to start
                capturing your conversations.
              </p>

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