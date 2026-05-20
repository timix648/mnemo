"use client";

import { useState } from "react";
import { Brain, Search, Plus, Copy, Check, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

const FAKE_RESULTS = [
  {
    id: "1",
    app: "Cursor",
    model: "gpt-4o",
    timestamp: "2026-05-18 · 11:42 AM",
    snippet: "This is expected behavior in React 18 Strict Mode. During development, React intentionally mounts components twice to help detect side effects. Wrap your fetch in a cleanup function or use a library like React Query.",
    prompt: "Why is my useEffect running twice in React 18?",
  },
  {
    id: "2",
    app: "BoltAI",
    model: "claude-sonnet",
    timestamp: "2026-05-17 · 3:15 PM",
    snippet: "Sui Move uses an object-centric model where every piece of state is an explicit object with a unique ID and a defined owner. Unlike Ethereum's account model, ownership is tracked at the protocol level.",
    prompt: "How does Sui Move's ownership model work?",
  },
  {
    id: "3",
    app: "Cursor",
    model: "gpt-4o",
    timestamp: "2026-05-16 · 9:08 AM",
    snippet: "For 1M vectors, HNSW is almost always the better choice over IVFFlat. HNSW builds a hierarchical graph structure that enables fast approximate nearest neighbor search with consistently high recall.",
    prompt: "pgvector ivfflat vs hnsw for semantic search?",
  },
];

const APP_COLORS: Record<string, string> = {
  Cursor: "bg-blue-100 text-blue-700",
  BoltAI: "bg-purple-100 text-purple-700",
  TypingMind: "bg-green-100 text-green-700",
};

type Result = typeof FAKE_RESULTS[0];

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const [context, setContext] = useState<Result[]>([]);
  const [copied, setCopied] = useState(false);

  function handleSearch() {
    if (!query.trim()) return;
    setHasSearched(true);
    // Simulate results — in real app this calls /api/search
    setResults(FAKE_RESULTS);
  }

  function addToContext(result: Result) {
    if (!context.find((c) => c.id === result.id)) {
      setContext((prev) => [...prev, result]);
    }
  }

  function removeFromContext(id: string) {
    setContext((prev) => prev.filter((c) => c.id !== id));
  }

  function handleCopyContext() {
    const blob = context
      .map(
        (c, i) =>
          `[Memory ${i + 1} — ${c.app} · ${c.timestamp}]\nQ: ${c.prompt}\nA: ${c.snippet}`
      )
      .join("\n\n---\n\n");
    navigator.clipboard.writeText(blob);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">

      {/* Navbar */}
      <nav className="flex items-center justify-between px-6 py-4 border-b">
        <Link href="/" className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-primary" />
          <span className="font-bold tracking-tight">Mnemo</span>
        </Link>
        <div className="flex gap-2">
          <Link href="/chats"><Button variant="ghost" size="sm">My Memory</Button></Link>
          <Link href="/settings"><Button variant="ghost" size="sm">Settings</Button></Link>
        </div>
      </nav>

      <div className="flex flex-1 gap-0">

        {/* Main */}
        <div className="flex flex-col gap-6 px-6 py-8 flex-1 max-w-3xl mx-auto w-full">

          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-bold">Search your memory</h1>
            <p className="text-muted-foreground text-sm">
              Semantic search across all your captured AI conversations.
            </p>
          </div>

          {/* Search bar */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder='Try "auth bug fix" or "how pgvector works"'
                className="pl-9"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
            </div>
            <Button onClick={handleSearch}>Search</Button>
          </div>

          {/* Results */}
          {!hasSearched && (
            <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
              <Search className="w-10 h-10 text-muted-foreground/40" />
              <p className="text-muted-foreground text-sm">
                Type a question or topic to search your AI memory.
              </p>
            </div>
          )}

          {hasSearched && (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                {results.length} matches for &quot;{query}&quot;
              </p>

              {results.map((r) => (
                <div
                  key={r.id}
                  className="rounded-xl border bg-card p-5 flex flex-col gap-3"
                >
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${APP_COLORS[r.app]}`}>
                      From {r.app}
                    </span>
                    <Badge variant="outline" className="text-xs">{r.model}</Badge>
                    <span className="text-xs text-muted-foreground ml-auto">{r.timestamp}</span>
                  </div>

                  <div className="flex flex-col gap-1">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Prompt</p>
                    <p className="text-sm font-medium">{r.prompt}</p>
                  </div>

                  <div className="flex flex-col gap-1">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Matched snippet</p>
                    <p className="text-sm text-muted-foreground">{r.snippet}</p>
                  </div>

                  <div className="flex gap-2 mt-1">
                    <Link href="/chats">
                      <Button size="sm" variant="outline">Open conversation</Button>
                    </Link>
                    <Button
                      size="sm"
                      onClick={() => addToContext(r)}
                      disabled={!!context.find((c) => c.id === r.id)}
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      {context.find((c) => c.id === r.id) ? "Added" : "Add to context"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Context panel */}
        {context.length > 0 && (
          <div className="w-80 border-l bg-muted/30 flex flex-col p-5 gap-4 sticky top-0 h-screen overflow-y-auto">
            <div className="flex flex-col gap-1">
              <h2 className="font-semibold text-sm">Context panel</h2>
              <p className="text-xs text-muted-foreground">
                {context.length} snippet{context.length > 1 ? "s" : ""} added
              </p>
            </div>

            <div className="flex flex-col gap-2 flex-1">
              {context.map((c) => (
                <div key={c.id} className="rounded-lg border bg-card p-3 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${APP_COLORS[c.app]}`}>
                      {c.app}
                    </span>
                    <button onClick={() => removeFromContext(c.id)}>
                      <X className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
                    </button>
                  </div>
                  <p className="text-xs font-medium line-clamp-1">{c.prompt}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2">{c.snippet}</p>
                </div>
              ))}
            </div>

            <Button className="w-full" onClick={handleCopyContext}>
              {copied
                ? <><Check className="w-4 h-4 mr-2" /> Copied!</>
                : <><Copy className="w-4 h-4 mr-2" /> Copy context</>
              }
            </Button>
          </div>
        )}

      </div>
    </div>
  );
}