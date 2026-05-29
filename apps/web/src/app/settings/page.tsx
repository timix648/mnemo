"use client";

import { useState, useEffect } from "react";
import {
  Brain, Key, Heart, GitFork, Download,
  Trash2, Plus, X, Check, Loader2, ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { useSuiClient } from "@mysten/dapp-kit";
import { useEnokiFlow } from "@mysten/enoki/react";
import { useMnemoIdentity } from "@/lib/useMnemoIdentity";
import {
  saveInheritance,
  sendHeartbeat,
  readInheritanceState,
  InheritanceError,
  type InheritanceState,
} from "@/lib/inheritance";
import { LogoutButton } from "@/components/LogoutButton";
import { ProxySetupCard } from "@/components/ProxySetupCard";




const API_BASE = "http://127.0.0.1:8001";

// Turn the on-chain inheritance state into a human-readable heartbeat line.
function formatHeartbeat(state: InheritanceState): string {
  if (state.dormancyMs === 0 || !state.heir) {
    return "Active · inheritance not configured yet";
  }
  if (state.isDormant) {
    return "⚠ DORMANT · your heir can claim access now";
  }
  const ms = state.msUntilClaimable ?? 0;
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  return days > 0
    ? `Active · heir can claim in ${days}d ${hours}h of silence`
    : `Active · heir can claim in ${hours}h of silence`;
}

interface ProviderKey {
  id: string;
  provider: string;
  walrus_blob_id: string;
  created_at: string;
}

export default function SettingsPage() {
  // dapp-kit / Enoki — the user signs & Mnemo sponsors gas via these.
  const suiClient = useSuiClient();
  const flow = useEnokiFlow();
  // Identity: the signed-in zkLogin address + the user's default namespace.
  const { address, namespaceId } = useMnemoIdentity();

  const [keys, setKeys] = useState<ProviderKey[]>([]);
  const [keysLoading, setKeysLoading] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [heartbeatStatus, setHeartbeatStatus] = useState("Checking...");
  const [pinged, setPinged] = useState(false);
  const [recipient, setRecipient] = useState("");
  const [threshold, setThreshold] = useState("90");
  const [note, setNote] = useState("");
  const [inheritanceSaving, setInheritanceSaving] = useState(false);
  const [inheritanceSaved, setInheritanceSaved] = useState(false);
  const [inheritanceError, setInheritanceError] = useState<string | null>(null);
  const [inheritanceTx, setInheritanceTx] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  // Load the user's stored provider keys once the address resolves.
  useEffect(() => {
    if (address) fetchKeys();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  // Pull the real on-chain inheritance config once the address resolves, so the
  // form reflects what's actually set rather than blank defaults.
  const refreshState = async () => {
    if (!address) return;
    try {
      const state = await readInheritanceState(suiClient, address);
      if (state) {
        if (state.heir) setRecipient(state.heir);
        if (state.dormancyDays > 0) setThreshold(String(state.dormancyDays));
        setHeartbeatStatus(formatHeartbeat(state));
      } else {
        setHeartbeatStatus("No on-chain account yet · finish onboarding");
      }
    } catch {
      setHeartbeatStatus("Couldn't read on-chain status");
    }
  };

  useEffect(() => {
    refreshState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, suiClient]);

  async function fetchKeys() {
    if (!address) return;
    try {
      const res = await fetch(`${API_BASE}/keys`, {
        headers: { "X-Sui-Address": address },
      });
      if (!res.ok) throw new Error("failed");
      const data = await res.json();
      setKeys(data);
    } catch {
      setKeys([]);
    } finally {
      setKeysLoading(false);
    }
  }

  async function revokeKey(provider: string) {
    if (!address) return;
    setRevoking(provider);
    try {
      const res = await fetch(`${API_BASE}/keys/${provider}`, {
        method: "DELETE",
        headers: { "X-Sui-Address": address },
      });
      if (!res.ok) throw new Error("failed");
      setKeys((prev) => prev.filter((k) => k.provider !== provider));
    } catch {
      alert("Could not revoke key — try again.");
    } finally {
      setRevoking(null);
    }
  }

  // Real on-chain heartbeat (account::touch_activity), sponsored by Mnemo.
  // Optimistic UI so the button feels instant; the chain call runs in the
  // background and the status reflects the real result (re-read after).
  async function handleHeartbeat() {
    setPinged(true);
    setHeartbeatStatus("Pinging on-chain...");
    try {
      if (!address) throw new InheritanceError("Sign in to ping your heartbeat.");
      await sendHeartbeat(flow, suiClient, address);
      await refreshState();
    } catch (e) {
      // Don't block the demo on a heartbeat failure — keep it soft.
      setHeartbeatStatus(
        e instanceof InheritanceError
          ? e.message
          : "Couldn't confirm on-chain ping (still counts locally).",
      );
    } finally {
      setTimeout(() => setPinged(false), 2000);
    }
  }

  async function handleSaveInheritance() {
    setInheritanceError(null);
    setInheritanceTx(null);

    if (!address) {
      setInheritanceError("Please sign in with Google before setting your heir.");
      return;
    }

    setInheritanceSaving(true);
    try {
      const { digest, explorerUrl } = await saveInheritance({
        flow,
        suiClient,
        ownerAddress: address,
        recipient,
        thresholdDays: Number(threshold),
      });
      setInheritanceTx(explorerUrl);
      setInheritanceSaved(true);
      setTimeout(() => setInheritanceSaved(false), 6000);
      // Setting the heir also stamps last_active on-chain — re-read to reflect it.
      await refreshState();
      console.log("Inheritance set on-chain:", digest);
    } catch (e) {
      setInheritanceError(
        e instanceof InheritanceError
          ? e.message
          : "On-chain save failed. Check your connection and try again.",
      );
    } finally {
      setInheritanceSaving(false);
    }
  }

  async function handleExport() {
    if (!address) return;
    setExporting(true);
    try {
      const nsParam = namespaceId ? `namespace_id=${namespaceId}&` : "";
      const res = await fetch(
        `${API_BASE}/memories?${nsParam}limit=100&offset=0`,
        { headers: { "X-Sui-Address": address } }
      );
      if (!res.ok) throw new Error("failed");
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data.results, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mnemo-export-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Export failed — check your backend is running.");
    } finally {
      setExporting(false);
    }
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
          <Link href="/search"><Button variant="ghost" size="sm">Search</Button></Link><LogoutButton />
        </div>
      </nav>

      <div className="flex flex-col gap-10 px-6 py-10 max-w-2xl mx-auto w-full">

        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-muted-foreground text-sm">
            Manage your API keys, inheritance, and account.
          </p>
        </div>

         {/* Proxy setup — shows user their proxy URL + token */}
        <ProxySetupCard address={address} />

        {/* API Keys */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-primary" />
            <h2 className="font-semibold">API Keys</h2>
          </div>
          <Separator />

          {keysLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading keys...
            </div>
          ) : keys.length === 0 ? (
            <p className="text-sm text-muted-foreground">No keys added yet.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {keys.map((k) => (
                <div
                  key={k.id}
                  className="flex items-center justify-between rounded-lg border bg-card px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="capitalize">{k.provider}</Badge>
                    <span className="text-sm font-mono text-muted-foreground">
                      {k.provider === "openai"
                        ? "sk-••••••••••••••••"
                        : "sk-ant-••••••••••••"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Added {new Date(k.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <button
                    onClick={() => revokeKey(k.provider)}
                    disabled={revoking === k.provider}
                  >
                    {revoking === k.provider
                      ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                      : <X className="w-4 h-4 text-muted-foreground hover:text-destructive transition-colors" />
                    }
                  </button>
                </div>
              ))}
            </div>
          )}

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
            Any activity on Mnemo counts as a heartbeat. If you have been
            inactive and want to reset your silence timer manually, use the
            button below.
          </p>

          <Button
            variant="outline"
            size="sm"
            className="w-fit"
            onClick={handleHeartbeat}
          >
            {pinged
              ? <><Check className="w-4 h-4 mr-2" />Pinged!</>
              : <><Heart className="w-4 h-4 mr-2" />I&apos;m alive</>
            }
          </Button>
        </section>

        {/* Inheritance */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <GitFork className="w-4 h-4 text-primary" />
            <h2 className="font-semibold">Inheritance</h2>
            <Badge className="text-xs bg-primary/10 text-primary border-0">
              Demo crown jewel
            </Badge>
          </div>
          <Separator />

          <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            After your silence threshold lapses, your designated recipient will
            be granted access to decrypt your memory archive via Seal. This is
            enforced by a Move contract on Sui — no one, including Mnemo, can
            override it.
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Recipient Sui address</label>
              <Input
                placeholder="0x..."
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                className="font-mono"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Silence threshold</label>
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  value={threshold}
                  onChange={(e) => setThreshold(e.target.value)}
                  className="w-28"
                  min="1"
                  max="3650"
                />
                <span className="text-sm text-muted-foreground">days of inactivity</span>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">
                Note to recipient{" "}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <Input
                placeholder="A message your recipient will see when they gain access..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                The heir address and silence window are enforced on-chain. The note
                is delivered with the decryption key (stored off-chain).
              </p>
            </div>
          </div>

          {inheritanceError && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              ⚠️ {inheritanceError}
            </div>
          )}

          {inheritanceSaved && (
            <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700 flex flex-col gap-1">
              <span>✓ Inheritance enforced on-chain.</span>
              {inheritanceTx && (
                <a
                  href={inheritanceTx}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs underline underline-offset-2"
                >
                  View transaction <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          )}

          <Button
            className="w-fit"
            onClick={handleSaveInheritance}
            disabled={inheritanceSaving}
          >
            {inheritanceSaving ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving on-chain...</>
            ) : inheritanceSaved ? (
              <><Check className="w-4 h-4 mr-2" />Saved!</>
            ) : (
              "Save inheritance config"
            )}
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

          <Button
            variant="outline"
            size="sm"
            className="w-fit"
            onClick={handleExport}
            disabled={exporting}
          >
            {exporting
              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Exporting...</>
              : <><Download className="w-4 h-4 mr-2" />Download my memory</>
            }
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
            Deleting your account destroys your Seal access keys. Memories
            stored on Walrus will persist but become permanently inaccessible.
            This cannot be undone.
          </p>

          <Button variant="destructive" size="sm" className="w-fit">
            <Trash2 className="w-4 h-4 mr-2" /> Delete account
          </Button>
        </section>

      </div>
    </div>
  );
}
