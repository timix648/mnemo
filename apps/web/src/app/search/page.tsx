"use client";

import { useState, useEffect } from "react";
import { Brain, Search, Plus, Copy, Check, X, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { searchMemories, getMemoryById, type SearchResult } from "@/lib/api";
import { useMnemoIdentity } from "@/lib/useMnemoIdentity";
import { LogoutButton } from "@/components/LogoutButton";
import { ChatMessage } from "@/components/ChatMessage";

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

// Single source of truth for identifying a result/context item. MUST be used
// everywhere (add, remove, dedupe, React key) so add and remove agree —
// mixing id-or-blob in one place and blob-only in another silently breaks
// removal (the keys never match).
function keyOf(r: { id: string | null; walrus_blob_id: string }): string {
  return r.id ?? r.walrus_blob_id;
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

// Split a captured "user: ...\nassistant: ..." blob into turns for display.
function parseTurns(text: string): { role: string; content: string }[] {
  const re = /^(user|assistant|system):\s?/gim;
  const matches = [...text.matchAll(re)];
  if (matches.length === 0) return [{ role: "exchange", content: text }];
  const turns: { role: string; content: string }[] = [];
  for (let i = 0; i < matches.length; i++) {
    const role = matches[i][1].toLowerCase();
    const start = matches[i].index! + matches[i][0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index! : text.length;
    turns.push({ role, content: text.slice(start, end).trim() });
  }
  return turns;
}

export default function SearchPage() {
  const { address, namespaceId, displayName, avatarId, ready } = useMnemoIdentity();

  const [query, setQuery] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [context, setContext] = useState<SearchResult[]>([]);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Full-conversation modal state
  const [openResult, setOpenResult] = useState<SearchResult | null>(null);
  const [fullText, setFullText] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(false);

  async function handleSearch() {
    if (!query.trim()) return;

    if (!address) {
      setError("Sign in to search your memory.");
      setHasSearched(true);
      return;
    }
    if (!namespaceId) {
      setError(
        ready
          ? "No memory namespace yet — capture a conversation first."
          : "Loading your account… try again in a second.",
      );
      setHasSearched(true);
      return;
    }

    setLoading(true);
    setError(null);
    setHasSearched(true);
    try {
      const data = await searchMemories(address, namespaceId, query);
      setResults(data.results);
    } catch {
      setError("Backend unreachable — search unavailable right now.");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  const inContext = (r: SearchResult) =>
    context.some((c) => keyOf(c) === keyOf(r));

  function toggleContext(result: SearchResult) {
    setContext((prev) =>
      prev.some((c) => keyOf(c) === keyOf(result))
        ? prev.filter((c) => keyOf(c) !== keyOf(result))   // already in → remove
        : [...prev, result],                                // not in → add
    );
  }

  function removeFromContext(key: string) {
    setContext((prev) => prev.filter((c) => keyOf(c) !== key));
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

  // Open the full-conversation modal. The search result already carries the
  // decrypted `text` from the relayer, so we can show it immediately. If for
  // some reason it's missing, fall back to fetching by id.
  async function viewFull(result: SearchResult) {
    setOpenResult(result);
    setDetailError(false);
    if (result.text && result.text.trim()) {
      setFullText(result.text);
      return;
    }
    if (!result.id || !address) {
      setDetailError(true);
      setFullText(null);
      return;
    }
    setDetailLoading(true);
    setFullText(null);
    try {
      const detail = await getMemoryById(result.id, address);
      if (detail?.text) setFullText(detail.text);
      else setDetailError(true);
    } catch {
      setDetailError(true);
    } finally {
      setDetailLoading(false);
    }
  }

  function closeModal() {
    setOpenResult(null);
    setFullText(null);
    setDetailError(false);
  }

  // Close modal on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeModal();
    }
    if (openResult) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openResult]);

  return (
    <div className="min-h-screen bg-background/60 flex flex-col">

      {/* Navbar */}
      <nav className="flex items-center justify-between px-6 py-4 border-b">
        <Link href="/" className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-primary" />
          <span className="font-bold tracking-tight">Mnemo</span>
        </Link>
        <div className="flex gap-2">
          <Link href="/chats"><Button variant="ghost" size="sm">My Memory</Button></Link>
          <Link href="/settings"><Button variant="ghost" size="sm">Settings</Button></Link><LogoutButton />
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
                  <div key={keyOf(r)} className="rounded-xl border bg-card p-5 flex flex-col gap-3">
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
                        variant={inContext(r) ? "secondary" : "default"}
                        onClick={() => toggleContext(r)}
                      >
                        {inContext(r)
                          ? <><Check className="w-3 h-3 mr-1" />Added (click to remove)</>
                          : <><Plus className="w-3 h-3 mr-1" />Add to context</>}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => viewFull(r)}>
                        View full
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
                <div key={keyOf(c)} className="rounded-lg border bg-card p-3 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="text-xs">{c.model}</Badge>
                    <button onClick={() => removeFromContext(keyOf(c))} aria-label="Remove">
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

      {/* Full-conversation modal */}
      {openResult && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={closeModal}
        >
          <div
            className="bg-background rounded-2xl border shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 px-5 sm:px-6 py-4 border-b">
              <div className="flex flex-col gap-2 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${APP_COLORS[(openResult.source_app || "unknown").toLowerCase()] ?? APP_COLORS["unknown"]}`}>
                    From {(openResult.source_app || "Unknown").replace("_", " ")}
                  </span>
                  <Badge variant="outline" className="text-xs">{openResult.model}</Badge>
                  <ScoreBadge score={openResult.score} />
                </div>
                <span className="text-xs text-muted-foreground">{formatDate(openResult.ts)}</span>
              </div>
              <button
                onClick={closeModal}
                className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto px-5 sm:px-6 py-5 flex flex-col gap-4">
              {detailLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground text-sm py-8 justify-center">
                  <Loader2 className="w-4 h-4 animate-spin" /> Decrypting conversation...
                </div>
              ) : detailError ? (
                <div className="rounded-lg bg-yellow-50 border border-yellow-200 px-4 py-3 text-sm text-yellow-800">
                  Couldn&apos;t load the full conversation. Showing the preview instead:
                  <p className="mt-2 text-foreground">{openResult.preview}</p>
                </div>
              ) : fullText ? (
                parseTurns(fullText).map((turn, i) => (
                  <ChatMessage key={i} role={turn.role} content={turn.content}
                    avatarId={avatarId} displayName={displayName} />
                ))
              ) : null}
            </div>

            <div className="flex justify-end gap-2 px-5 sm:px-6 py-4 border-t">
              <Button
                size="sm"
                variant={inContext(openResult) ? "secondary" : "default"}
                onClick={() => toggleContext(openResult)}
              >
                {inContext(openResult)
                  ? <><Check className="w-4 h-4 mr-2" />Added</>
                  : <><Plus className="w-4 h-4 mr-2" />Add to context</>}
              </Button>
              {fullText && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigator.clipboard.writeText(fullText)}
                >
                  Copy text
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={closeModal}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}