"use client";

import { useState } from "react";
import { Brain, Search, Plus, Copy, Check, X, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { searchMemories, type SearchResult } from "@/lib/api";
import { DEV_TEST_USER } from "@/config/sui";

const APP_COLORS: Record<string, string> = {
  cursor: "bg-blue-100 text-blue-700",
  bolt_ai: "bg-purple-100 text-purple-700",
  typingmind: "bg-green-100 text-green-700",
  openai_sdk: "bg-orange-100 text-orange-700",
  mnemo: "bg-slate-100 text-slate-700",
  other: "bg-gray-100 text-gray-700",
  unknown: "bg-gray-100 text-gray-700",
};

function formatDate(ts: string) {
  return new Date(ts).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function ScoreBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color =
    pct >= 80 ? "bg-green-100 text-green-700" :
    pct >= 60 ? "bg-yellow-100 text-yellow-700" :
    "bg-slate-100 text-slate-600";
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${color}`}>
      {pct}% match
    </span>
  );
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [context, setContext] = useState<SearchResult[]>([]);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch() {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setHasSearched(true);
    try {
      const data = await searchMemories(
        DEV_TEST_USER.user_id,
        DEV_TEST_USER.default_namespace_id,
        query,
      );
      setResults(data.results);
    } catch {
      setError("Backend unreachable — search unavailable right now.");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  function addToContext(result: SearchResult) {
    if (!context.find((c) => (c.id ?? c.walrus_blob_id) === (result.id ?? result.walrus_blob_id))) {
      setContext((prev) => [...prev, result]);
    }
  }

  function removeFromContext(blobId: string) {
    setContext((prev) => prev.filter((c) => (c.id ?? c.walrus_blob_id) !== blobId));
  }

  function handleCopyContext() {
    const blob = context
      .map(
        (c, i) =>
          `// Previous conversation ${i + 1} — ${formatDate(c.ts)} · ${c.model}\n${c.text}`
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
            <Button onClick={handleSearch} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Search"}
            </Button>
          </div>

          {/* Error banner */}
          {error && (
            <div className="rounded-lg bg-yellow-50 border border-yellow-200 px-4 py-3 text-sm text-yellow-800">
              ⚠️ {error}
            </div>
          )}

          {/* Empty state */}
          {!hasSearched && (
            <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
              <Search className="w-10 h-10 text-muted-foreground/40" />
              <p className="text-muted-foreground text-sm">
                Type a question or topic to search your AI memory.
              </p>
            </div>
          )}

          {/* Results */}
          {hasSearched && !loading && (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                {results.length === 0
                  ? `No matches found for "${query}"`
                  : `${results.length} match${results.length > 1 ? "es" : ""} for "${query}"`}
              </p>

              {results.length === 0 && !error ? (
                <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                  <Search className="w-10 h-10 text-muted-foreground/40" />
                  <p className="text-muted-foreground text-sm">
                    No conversations match your search. Try different keywords.
                  </p>
                </div>
              ) : (
                results.map((r) => (
                  <div key={r.id ?? r.walrus_blob_id} className="rounded-xl border bg-card p-5 flex flex-col gap-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${APP_COLORS[(r.source_app || "unknown").toLowerCase()] ?? APP_COLORS["unknown"]}`}>
                        From {(r.source_app || "Unknown").replace("_", " ")}
                      </span>
                      <Badge variant="outline" className="text-xs">{r.model}</Badge>
                      <ScoreBadge score={r.score} />
                      <span className="text-xs text-muted-foreground ml-auto">
                        {formatDate(r.ts)}
                      </span>
                    </div>

                    <div className="flex flex-col gap-1">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Memory
                      </p>
                      <p className="text-sm text-muted-foreground line-clamp-3">{r.preview}</p>
                    </div>

                    <div className="flex gap-2 mt-1">
                      <Button
                        size="sm"
                        onClick={() => addToContext(r)}
                        disabled={!!context.find((c) => (c.id ?? c.walrus_blob_id) === (r.id ?? r.walrus_blob_id))}
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        {context.find((c) => (c.id ?? c.walrus_blob_id) === (r.id ?? r.walrus_blob_id)) ? "Added" : "Add to context"}
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Context panel */}
        {context.length > 0 && (
          <div className="w-80 border-l bg-muted/30 flex flex-col p-5 gap-4 sticky top-0 h-screen overflow-y-auto">
            <div className="flex flex-col gap-1">
              <h2 className="font-semibold text-sm">Context panel</h2>
              <p className="text-xs text-muted-foreground">
                {context.length} snippet{context.length > 1 ? "s" : ""} — ready to paste
              </p>
            </div>

            <div className="flex flex-col gap-2 flex-1">
              {context.map((c) => (
                <div key={c.walrus_blob_id} className="rounded-lg border bg-card p-3 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="text-xs">{c.model}</Badge>
                    <button onClick={() => removeFromContext(c.walrus_blob_id)}>
                      <X className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-3">{c.preview}</p>
                </div>
              ))}
            </div>

            <Button className="w-full" onClick={handleCopyContext}>
              {copied
                ? <><Check className="w-4 h-4 mr-2" />Copied!</>
                : <><Copy className="w-4 h-4 mr-2" />Copy as context</>
              }
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}