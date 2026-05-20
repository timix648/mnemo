"use client";

import { useState } from "react";
import { Brain, Key, Heart, GitFork, Download, Trash2, Plus, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

const FAKE_KEYS = [
  { id: "1", provider: "OpenAI", masked: "sk-...x9Kq", added: "May 16, 2026" },
  { id: "2", provider: "Anthropic", masked: "sk-ant-...mP2z", added: "May 17, 2026" },
];

export default function SettingsPage() {
  const [keys, setKeys] = useState(FAKE_KEYS);
  const [heartbeatStatus] = useState("Active · Last ping 2 minutes ago");
  const [recipient, setRecipient] = useState("");
  const [threshold, setThreshold] = useState("90");
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState(false);
  const [pinged, setPinged] = useState(false);

  function revokeKey(id: string) {
    setKeys((prev) => prev.filter((k) => k.id !== id));
  }

  function handleSaveInheritance() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function handleHeartbeat() {
    setPinged(true);
    setTimeout(() => setPinged(false), 2000);
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
          <Link href="/search"><Button variant="ghost" size="sm">Search</Button></Link>
        </div>
      </nav>

      <div className="flex flex-col gap-10 px-6 py-10 max-w-2xl mx-auto w-full">

        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-muted-foreground text-sm">
            Manage your API keys, inheritance, and account.
          </p>
        </div>

        {/* API Keys */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-primary" />
            <h2 className="font-semibold">API Keys</h2>
          </div>
          <Separator />

          <div className="flex flex-col gap-2">
            {keys.length === 0 && (
              <p className="text-sm text-muted-foreground">No keys added yet.</p>
            )}
            {keys.map((k) => (
              <div key={k.id} className="flex items-center justify-between rounded-lg border bg-card px-4 py-3">
                <div className="flex items-center gap-3">
                  <Badge variant="outline">{k.provider}</Badge>
                  <span className="text-sm font-mono text-muted-foreground">{k.masked}</span>
                  <span className="text-xs text-muted-foreground">Added {k.added}</span>
                </div>
                <button onClick={() => revokeKey(k.id)}>
                  <X className="w-4 h-4 text-muted-foreground hover:text-destructive transition-colors" />
                </button>
              </div>
            ))}
          </div>

          <Link href="/onboard">
            <Button variant="outline" size="sm">
              <Plus className="w-4 h-4 mr-2" /> Add another key
            </Button>
          </Link>
        </section>

        {/* Heartbeat */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Heart className="w-4 h-4 text-primary" />
            <h2 className="font-semibold">Heartbeat</h2>
          </div>
          <Separator />

          <div className="rounded-lg border bg-card px-4 py-3 flex items-center justify-between">
            <div className="flex flex-col gap-0.5">
              <p className="text-sm font-medium">Status</p>
              <p className="text-xs text-muted-foreground">{heartbeatStatus}</p>
            </div>
            <div className="w-2 h-2 rounded-full bg-green-500" />
          </div>

          <p className="text-sm text-muted-foreground">
            Any activity on Mnemo counts as a heartbeat. Use the button below
            if you have been inactive and want to reset your silence timer manually.
          </p>

          <Button variant="outline" size="sm" className="w-fit" onClick={handleHeartbeat}>
            {pinged
              ? <><Check className="w-4 h-4 mr-2" /> Pinged!</>
              : <><Heart className="w-4 h-4 mr-2" /> I&apos;m alive</>
            }
          </Button>
        </section>

        {/* Inheritance */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <GitFork className="w-4 h-4 text-primary" />
            <h2 className="font-semibold">Inheritance</h2>
          </div>
          <Separator />

          <p className="text-sm text-muted-foreground">
            After your silence threshold lapses, your designated recipient will
            be granted access to decrypt your memory archive via Seal.
          </p>

          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Recipient Sui address</label>
              <Input
                placeholder="0x..."
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Silence threshold (days)</label>
              <Input
                type="number"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                className="w-32"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Note to recipient <span className="text-muted-foreground font-normal">(optional)</span></label>
              <Input
                placeholder="A message your recipient will see when they gain access..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          </div>

          <Button className="w-fit" onClick={handleSaveInheritance}>
            {saved
              ? <><Check className="w-4 h-4 mr-2" /> Saved!</>
              : "Save inheritance config"
            }
          </Button>
        </section>

        {/* Export */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Download className="w-4 h-4 text-primary" />
            <h2 className="font-semibold">Export</h2>
          </div>
          <Separator />

          <p className="text-sm text-muted-foreground">
            Download all your stored memories as a decrypted JSON file.
            This is your data — take it anywhere.
          </p>

          <Button variant="outline" size="sm" className="w-fit">
            <Download className="w-4 h-4 mr-2" /> Download my memory
          </Button>
        </section>

        {/* Danger zone */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Trash2 className="w-4 h-4 text-destructive" />
            <h2 className="font-semibold text-destructive">Danger zone</h2>
          </div>
          <Separator />

          <p className="text-sm text-muted-foreground">
            Deleting your account destroys your Seal access keys. Memories stored
            on Walrus will persist but become permanently inaccessible. This
            cannot be undone.
          </p>

          <Button variant="destructive" size="sm" className="w-fit">
            <Trash2 className="w-4 h-4 mr-2" /> Delete account
          </Button>
        </section>

      </div>
    </div>
  );
}