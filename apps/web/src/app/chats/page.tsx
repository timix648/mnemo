"use client";

import { useState, useEffect } from "react";
import { Brain, Search, Filter, Loader2, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { getMemories, deleteMemory, type Memory } from "@/lib/api";
import { DEV_TEST_USER } from "@/config/sui";

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

export default function ChatsPage() {
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [backendError, setBackendError] = useState(false);
  const [total, setTotal] = useState(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    getMemories(DEV_TEST_USER.user_id, DEV_TEST_USER.default_namespace_id)
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
  }, []);

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.preventDefault();
    setDeletingId(id);
    try {
      await deleteMemory(DEV_TEST_USER.user_id, id);
      setChats((prev) => prev.filter((c) => c.id !== id));
      setTotal((prev) => prev - 1);
    } catch {
      alert("Failed to delete memory. Please check if the backend is running.");
    } finally {
      setDeletingId(null);
    }
  }

  const filtered = chats.filter((c) => {
    const matchesApp = activeFilter === "All" || c.app.toLowerCase() === activeFilter.toLowerCase();
    const matchesSearch =
      search === "" ||
      c.preview.toLowerCase().includes(search.toLowerCase());
    return matchesApp && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-background flex flex-col">

      {/* Navbar */}
      <nav className="flex items-center justify-between px-6 py-4 border-b">
        <Link href="/" className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-primary" />
          <span className="font-bold tracking-tight">Mnemo</span>
        </Link>
        <div className="flex gap-2">
          <Link href="/search"><Button variant="ghost" size="sm">Search</Button></Link>
          <Link href="/settings"><Button variant="ghost" size="sm">Settings</Button></Link>
        </div>
      </nav>

      <div className="flex flex-col gap-6 px-6 py-8 max-w-4xl mx-auto w-full">

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
            ⚠️ Could not reach backend — please check your services are running.
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
            <Filter className="w-4 h-4 text-muted-foreground" />
            {APP_FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                className={`text-sm px-3 py-1 rounded-full border transition-colors ${
                  activeFilter === f
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
                className="rounded-xl border bg-card p-5 flex flex-col gap-3 hover:shadow-sm transition-shadow cursor-pointer"
              >
                {/* Meta */}
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${APP_COLORS[chat.app.toLowerCase()] ?? APP_COLORS["unknown"]}`}>
                    From {chat.app.replace("_", " ")}
                  </span>
                  <Badge variant="outline" className="text-xs">{chat.model}</Badge>
                  <span className="text-xs text-muted-foreground ml-auto">
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
                  <Link href="/search">
                    <Button size="sm" variant="outline">Search similar</Button>
                  </Link>
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
    </div>
  );
}