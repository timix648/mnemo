"use client";

import { useState, useEffect } from "react";
import { Brain, Search, Filter, Loader2, Trash2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { getMemories, deleteMemory, getMemoryById, type Memory } from "@/lib/api";
import { useMnemoIdentity } from "@/lib/useMnemoIdentity";
import { LogoutButton } from "@/components/LogoutButton";
import { ChatMessage } from "@/components/ChatMessage";

const APP_FILTERS = ["All", "Cursor", "Bolt_AI", "TypingMind", "Other"];

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

type ChatItem = {
  id: string;
  app: string;
  model: string;
  ts: string;
  preview: string;
};

// Split a captured "user: ...\nassistant: ..." blob into turns for display.
// Falls back to a single block if the format isn't recognized.
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

export default function ChatsPage() {
  const { address, namespaceId, displayName, avatarId } = useMnemoIdentity();

  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [backendError, setBackendError] = useState(false);
  const [total, setTotal] = useState(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Conversation-view modal state
  const [openChat, setOpenChat] = useState<ChatItem | null>(null);
  const [fullText, setFullText] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(false);

  useEffect(() => {
    if (!address) return;
    setLoading(true);
    getMemories(address, namespaceId)
      .then((data) => {
        const mapped = (data.results ?? []).map((m: Memory) => ({
          id: m.id,
          app: m.source_app || "unknown",
          model: m.model,
          ts: m.ts,
          preview: m.preview,
        }));
        setChats(mapped);
        setTotal(data.total ?? mapped.length);
      })
      .catch(() => setBackendError(true))
      .finally(() => setLoading(false));
  }, [address, namespaceId]);

  // Close modal on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeModal();
    }
    if (openChat) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openChat]);

  async function openConversation(chat: ChatItem) {
    setOpenChat(chat);
    setFullText(null);
    setDetailError(false);
    setDetailLoading(true);
    try {
      if (!address) {
        setDetailError(true);
        return;
      }
      // Deterministic by-id fetch via GET /memories/{id}, which goes through
      // the sidecar -> relayer's engine.fetch_one (cache -> Walrus -> Seal).
      // Replaces the old search-and-match workaround.
      const detail = await getMemoryById(chat.id, address);
      if (detail?.text) setFullText(detail.text);
      else setDetailError(true);
    } catch {
      setDetailError(true);
    } finally {
      setDetailLoading(false);
    }
  }

  function closeModal() {
    setOpenChat(null);
    setFullText(null);
    setDetailError(false);
  }

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!address) return;
    setDeletingId(id);
    try {
      await deleteMemory(address, id);
      setChats((prev) => prev.filter((c) => c.id !== id));
      setTotal((prev) => prev - 1);
    } catch {
      alert("Failed to delete memory. Please try again.");
    } finally {
      setDeletingId(null);
    }
  }

  const filtered = chats.filter((c) => {
    const matchesApp =
      activeFilter === "All" || c.app.toLowerCase() === activeFilter.toLowerCase();
    const matchesSearch =
      search === "" || c.preview.toLowerCase().includes(search.toLowerCase());
    return matchesApp && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-background flex flex-col">

      {/* Navbar */}
      <nav className="flex items-center justify-between px-6 py-4 border-b">
        <Link href="/" className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Mnemo" className="w-8 h-8 object-contain" />
          <span className="font-bold tracking-tight">Mnemo</span>
        </Link>
        <div className="flex gap-2">
          <Link href="/search"><Button variant="ghost" size="sm">Search</Button></Link>
          <Link href="/settings"><Button variant="ghost" size="sm">Settings</Button></Link><LogoutButton />
        </div>
      </nav>

      <div className="flex flex-col gap-6 px-4 sm:px-6 py-8 max-w-4xl mx-auto w-full">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-bold">My Memory</h1>
            <p className="text-muted-foreground text-sm">
              {loading
                ? "Loading..."
                : `${total} conversation${total !== 1 ? "s" : ""} captured`}
            </p>
          </div>
          {loading && <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />}
        </div>

        {/* Error banner */}
        {backendError && (
          <div className="rounded-lg bg-yellow-50 border border-yellow-200 px-4 py-3 text-sm text-yellow-800">
            Could not reach backend, please check your services are running.
          </div>
        )}

        {/* Search + Filter */}
        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search your conversations..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex gap-2 items-center flex-wrap">
            <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
            {APP_FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                className={`text-sm px-3 py-1 rounded-full border transition-colors ${activeFilter === f
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-muted-foreground hover:bg-muted"
                  }`}
              >
                {f.replace("_", " ")}
              </button>
            ))}
          </div>
        </div>

        {/* Chat list */}
        <div className="flex flex-col gap-3">
          {loading ? (
            <div className="flex flex-col gap-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-xl border bg-muted p-5 h-36 animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
              <Brain className="w-10 h-10 text-muted-foreground/40" />
              <p className="font-medium">No memories yet</p>
              <p className="text-muted-foreground text-sm max-w-sm">
                Start using AI tools with your Mnemo proxy endpoint and your
                conversations will appear here automatically.
              </p>
              <Link href="/onboard">
                <Button size="sm" variant="outline">Set up your proxy</Button>
              </Link>
            </div>
          ) : (
            filtered.map((chat) => (
              <div
                key={chat.id}
                onClick={() => openConversation(chat)}
                className="rounded-xl border bg-card p-5 flex flex-col gap-3 hover:shadow-sm transition-shadow cursor-pointer"
              >
                {/* Meta */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${APP_COLORS[chat.app.toLowerCase()] ?? APP_COLORS["unknown"]}`}>
                    From {chat.app.replace("_", " ")}
                  </span>
                  <Badge variant="outline" className="text-xs">{chat.model}</Badge>
                  <span className="text-xs text-muted-foreground sm:ml-auto">
                    {formatDate(chat.ts)}
                  </span>
                </div>

                {/* Preview */}
                <div className="flex flex-col gap-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Prompt
                  </p>
                  <p className="text-sm line-clamp-2">{chat.preview}</p>
                </div>

                {/* Actions */}
                <div className="flex gap-2 mt-1 justify-between items-center w-full">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => { e.stopPropagation(); openConversation(chat); }}
                  >
                    View conversation
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-8 w-8"
                    onClick={(e) => handleDelete(chat.id, e)}
                    disabled={deletingId === chat.id}
                  >
                    {deletingId === chat.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Conversation-view modal */}
      {openChat && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={closeModal}
        >
          <div
            className="bg-background rounded-2xl border shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-start justify-between gap-3 px-5 sm:px-6 py-4 border-b">
              <div className="flex flex-col gap-2 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${APP_COLORS[openChat.app.toLowerCase()] ?? APP_COLORS["unknown"]}`}>
                    From {openChat.app.replace("_", " ")}
                  </span>
                  <Badge variant="outline" className="text-xs">{openChat.model}</Badge>
                </div>
                <span className="text-xs text-muted-foreground">{formatDate(openChat.ts)}</span>
              </div>
              <button
                onClick={closeModal}
                className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal body */}
            <div className="overflow-y-auto px-5 sm:px-6 py-5 flex flex-col gap-4">
              {detailLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground text-sm py-8 justify-center">
                  <Loader2 className="w-4 h-4 animate-spin" /> Decrypting conversation...
                </div>
              ) : detailError ? (
                <div className="rounded-lg bg-yellow-50 border border-yellow-200 px-4 py-3 text-sm text-yellow-800">
                  Couldn&apos;t load the full conversation. Showing the preview instead:
                  <p className="mt-2 text-foreground">{openChat.preview}</p>
                </div>
              ) : fullText ? (
                parseTurns(fullText).map((turn, i) => (
                  <ChatMessage
                    key={i}
                    role={turn.role}
                    content={turn.content}
                    avatarId={avatarId}
                    displayName={displayName}
                  />
                ))
              ) : null}
            </div>

            {/* Modal footer */}
            <div className="flex justify-end gap-2 px-5 sm:px-6 py-4 border-t">
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