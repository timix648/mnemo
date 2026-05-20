"use client";

import { useState } from "react";
import { Brain, Search, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";

const FAKE_CHATS = [
  {
    id: "1",
    app: "Cursor",
    model: "gpt-4o",
    timestamp: "2026-05-18 · 11:42 AM",
    prompt: "Why is my useEffect running twice in React 18? I have a fetch call inside and it's causing duplicate API requests on mount.",
    response: "This is expected behavior in React 18 Strict Mode. During development, React intentionally mounts components twice to help detect side effects...",
  },
  {
    id: "2",
    app: "BoltAI",
    model: "claude-sonnet",
    timestamp: "2026-05-17 · 3:15 PM",
    prompt: "Can you explain how Sui Move's object ownership model differs from Ethereum's account model?",
    response: "Sui Move uses an object-centric model where every piece of state is an explicit object with a unique ID and a defined owner...",
  },
  {
    id: "3",
    app: "Cursor",
    model: "gpt-4o",
    timestamp: "2026-05-16 · 9:08 AM",
    prompt: "Write a Python FastAPI endpoint that accepts a streaming response from OpenAI and proxies it back to the client using Server-Sent Events.",
    response: "Here's a complete FastAPI streaming proxy endpoint. We use StreamingResponse with an async generator that yields each SSE chunk as it arrives...",
  },
  {
    id: "4",
    app: "TypingMind",
    model: "gpt-4-turbo",
    timestamp: "2026-05-14 · 6:30 PM",
    prompt: "What's the difference between pgvector's ivfflat and hnsw index types? Which should I use for a semantic search application with ~1M vectors?",
    response: "For 1M vectors in a semantic search application, HNSW is almost always the better choice. IVFFlat requires a training step and struggles with recall...",
  },
  {
    id: "5",
    app: "BoltAI",
    model: "claude-sonnet",
    timestamp: "2026-05-12 · 2:00 PM",
    prompt: "Help me write a Sui Move module for a simple registry that maps addresses to string identifiers.",
    response: "Here's a clean Sui Move registry module using a Table for the mapping and proper event emission for indexers...",
  },
];

const APP_FILTERS = ["All", "Cursor", "BoltAI", "TypingMind"];

const APP_COLORS: Record<string, string> = {
  Cursor: "bg-blue-100 text-blue-700",
  BoltAI: "bg-purple-100 text-purple-700",
  TypingMind: "bg-green-100 text-green-700",
};

export default function ChatsPage() {
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");

  const filtered = FAKE_CHATS.filter((c) => {
    const matchesApp = activeFilter === "All" || c.app === activeFilter;
    const matchesSearch =
      search === "" ||
      c.prompt.toLowerCase().includes(search.toLowerCase()) ||
      c.response.toLowerCase().includes(search.toLowerCase());
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
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold">My Memory</h1>
          <p className="text-muted-foreground text-sm">
            {FAKE_CHATS.length} conversations captured across all providers
          </p>
        </div>

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

          <div className="flex gap-2 items-center">
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
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Chat list */}
        <div className="flex flex-col gap-3">
          {filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground text-sm">
              No conversations match your search.
            </div>
          ) : (
            filtered.map((chat) => (
              <div
                key={chat.id}
                className="rounded-xl border bg-card p-5 flex flex-col gap-3 hover:shadow-sm transition-shadow cursor-pointer"
              >
                {/* Meta */}
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${APP_COLORS[chat.app]}`}>
                    From {chat.app}
                  </span>
                  <Badge variant="outline" className="text-xs">{chat.model}</Badge>
                  <span className="text-xs text-muted-foreground ml-auto">{chat.timestamp}</span>
                </div>

                {/* Prompt */}
                <div className="flex flex-col gap-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Prompt</p>
                  <p className="text-sm line-clamp-2">{chat.prompt}</p>
                </div>

                {/* Response */}
                <div className="flex flex-col gap-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Response</p>
                  <p className="text-sm text-muted-foreground line-clamp-2">{chat.response}</p>
                </div>

                {/* Actions */}
                <div className="flex gap-2 mt-1">
                  <Link href="/search">
                    <Button size="sm" variant="outline">Search similar</Button>
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}