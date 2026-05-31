
"use client";

import { useState, useEffect } from "react";
import {
  Brain, Key, Heart, GitFork, Download,
  Trash2, Plus, X, Check, Loader2, ExternalLink, Copy, Wallet, UserRound, Pencil
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { deleteAccount, updateProfile } from "@/lib/api";
import { CreatureAvatar, AVATARS, DEFAULT_AVATAR_ID } from "@/components/avatars";

const API_BASE = "http://127.0.0.1:8001";

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
  const suiClient = useSuiClient();
  const flow = useEnokiFlow();
  const router = useRouter();
  const { address, namespaceId, displayName, avatarId } = useMnemoIdentity();

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

  // Profile editor.
  const [profileName, setProfileName] = useState("");
  const [profileAvatar, setProfileAvatar] = useState<string>(DEFAULT_AVATAR_ID);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);

  // Account: copy address + delete modal.
  const [copiedAddr, setCopiedAddr] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Seed the profile editor once identity resolves.
  useEffect(() => {
    if (displayName) setProfileName(displayName);
    if (avatarId) setProfileAvatar(avatarId);
  }, [displayName, avatarId]);

  useEffect(() => {
    if (address) fetchKeys();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

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
      const res = await fetch(`${API_BASE}/keys`, { headers: { "X-Sui-Address": address } });
      if (!res.ok) throw new Error("failed");
      setKeys(await res.json());
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

  async function handleHeartbeat() {
    setPinged(true);
    setHeartbeatStatus("Pinging on-chain...");
    try {
      if (!address) throw new InheritanceError("Sign in to ping your heartbeat.");
      await sendHeartbeat(flow, suiClient, address);
      await refreshState();
    } catch (e) {
      setHeartbeatStatus(
        e instanceof InheritanceError ? e.message
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
        flow, suiClient, ownerAddress: address, recipient, thresholdDays: Number(threshold),
      });
      setInheritanceTx(explorerUrl);
      setInheritanceSaved(true);
      setTimeout(() => setInheritanceSaved(false), 6000);
      await refreshState();
      console.log("Inheritance set on-chain:", digest);
    } catch (e) {
      setInheritanceError(
        e instanceof InheritanceError ? e.message
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
      const res = await fetch(`${API_BASE}/memories?${nsParam}limit=100&offset=0`,
        { headers: { "X-Sui-Address": address } });
      if (!res.ok) throw new Error("failed");
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data.results, null, 2)], { type: "application/json" });
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

  function copyAddress() {
    if (!address) return;
    navigator.clipboard.writeText(address);
    setCopiedAddr(true);
    setTimeout(() => setCopiedAddr(false), 1500);
  }

  async function handleSaveProfile() {
    if (!address) return;
    setProfileSaving(true);
    try {
      await updateProfile(address, {
        display_name: profileName.trim() || null,
        avatar_id: profileAvatar,
      });
      setProfileSaved(true);
      setEditingProfile(false); // collapse back to the summary
      setTimeout(() => setProfileSaved(false), 3000);
    } catch {
      alert("Couldn't save your profile — backend unreachable.");
    } finally {
      setProfileSaving(false);
    }
  }

  function cancelEditProfile() {
    setProfileName(displayName ?? "");
    setProfileAvatar(avatarId ?? DEFAULT_AVATAR_ID);
    setEditingProfile(false);
  }

  async function handleDeleteAccount() {
    if (!address) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteAccount(address);
      await flow.logout().catch(() => {});
      sessionStorage.removeItem("mnemo_authed");
      router.push("/");
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Delete failed. Backend unreachable.");
      setDeleting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background/60 backdrop-blur-sm flex flex-col">

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
            Manage your profile, API keys, inheritance, and account.
          </p>
        </div>

        {/* Profile — collapses to a summary after saving */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserRound className="w-4 h-4 text-primary" />
              <h2 className="font-semibold">Profile</h2>
            </div>
            {profileSaved && !editingProfile && (
              <span className="text-xs text-primary flex items-center gap-1 animate-in fade-in">
                <Check className="w-3.5 h-3.5" /> Saved
              </span>
            )}
          </div>
          <Separator />

          {!editingProfile ? (
            /* Collapsed summary */
            <div className="flex items-center justify-between gap-4 animate-in fade-in slide-in-from-top-1 duration-300">
              <div className="flex items-center gap-3 min-w-0">
                <CreatureAvatar id={profileAvatar} className="h-14 w-14 ring-2 ring-primary/20" />
                <div className="min-w-0">
                  <p className="font-medium truncate">{profileName || "Add your name"}</p>
                  <p className="text-xs text-muted-foreground capitalize">{profileAvatar}</p>
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={() => setEditingProfile(true)}>
                <Pencil className="w-3.5 h-3.5 mr-2" /> Edit profile
              </Button>
            </div>
          ) : (
            /* Expanded editor */
            <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-top-1 duration-300">
              <div className="flex items-center gap-4">
                <CreatureAvatar id={profileAvatar} className="h-16 w-16 ring-2 ring-primary/20" />
                <div className="flex-1 flex flex-col gap-1.5">
                  <label className="text-sm font-medium">Display name</label>
                  <Input
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    maxLength={40}
                    placeholder="Your name"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Avatar</label>
                <div className="grid grid-cols-5 gap-3 justify-items-center">
                  {AVATARS.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => setProfileAvatar(a.id)}
                      aria-label={a.label}
                      aria-pressed={profileAvatar === a.id}
                      title={a.label}
                      className={`rounded-full transition-transform ${
                        profileAvatar === a.id
                          ? "ring-4 ring-primary scale-110"
                          : "ring-1 ring-border hover:scale-105"
                      }`}
                    >
                      <CreatureAvatar id={a.id} className="h-12 w-12" />
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" className="w-fit" onClick={handleSaveProfile} disabled={profileSaving}>
                  {profileSaving
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</>
                    : "Save profile"}
                </Button>
                <Button size="sm" variant="ghost" onClick={cancelEditProfile} disabled={profileSaving}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </section>

        {/* Proxy setup — shows user their proxy URL + token */}
        <ProxySetupCard address={address} />

        {/* Account — your Sui address (share it for inheritance) */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Wallet className="w-4 h-4 text-primary" />
            <h2 className="font-semibold">Your Sui address</h2>
          </div>
          <Separator />
          <p className="text-sm text-muted-foreground">
            Your on-chain identity. Share it with anyone who wants to name you as
            their heir — or whose memory you&apos;ll inherit.
          </p>
          <div className="flex gap-2">
            <code className="flex-1 px-3 py-2 rounded-md bg-muted text-xs font-mono break-all">
              {address ?? "Sign in to see your address"}
            </code>
            {address && (
              <Button size="sm" variant="outline" onClick={copyAddress}>
                {copiedAddr ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              </Button>
            )}
          </div>
        </section>

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
                <div key={k.id} className="flex items-center justify-between rounded-lg border bg-card px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="capitalize">{k.provider}</Badge>
                    <span className="text-sm font-mono text-muted-foreground">
                      {k.provider === "openai" ? "sk-••••••••••••••••" : "sk-ant-••••••••••••"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Added {new Date(k.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <button onClick={() => revokeKey(k.provider)} disabled={revoking === k.provider}>
                    {revoking === k.provider
                      ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                      : <X className="w-4 h-4 text-muted-foreground hover:text-destructive transition-colors" />}
                  </button>
                </div>
              ))}
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            All keys are reached through the single proxy endpoint shown above —
            the provider is chosen by the model name in each request.
          </p>

          <Link href="/onboard?step=key">
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
            <div className="w-2 h-2 rounded-full bg-primary" />
          </div>

          <p className="text-sm text-muted-foreground">
            Any activity on Mnemo counts as a heartbeat. If you have been inactive
            and want to reset your silence timer manually, use the button below.
          </p>

          <Button variant="outline" size="sm" className="w-fit" onClick={handleHeartbeat}>
            {pinged
              ? <><Check className="w-4 h-4 mr-2" />Pinged!</>
              : <><Heart className="w-4 h-4 mr-2" />I&apos;m alive</>}
          </Button>
        </section>

        {/* Inheritance */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <GitFork className="w-4 h-4 text-primary" />
            <h2 className="font-semibold">Inheritance</h2>
            <Badge className="text-xs bg-primary/10 text-primary border-0">Demo crown jewel</Badge>
          </div>
          <Separator />

          <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            After your silence threshold lapses, your designated recipient will be
            granted access to decrypt your memory archive via Seal. This is enforced
            by a Move contract on Sui — no one, including Mnemo, can override it.
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Recipient Sui address</label>
              <Input placeholder="0x..." value={recipient}
                onChange={(e) => setRecipient(e.target.value)} className="font-mono" />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Silence threshold</label>
              <div className="flex items-center gap-3">
                <Input type="number" value={threshold}
                  onChange={(e) => setThreshold(e.target.value)} className="w-28" min="1" max="3650" />
                <span className="text-sm text-muted-foreground">days of inactivity</span>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">
                Note to recipient <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <Input placeholder="A message your recipient will see when they gain access..."
                value={note} onChange={(e) => setNote(e.target.value)} />
              <p className="text-xs text-muted-foreground">
                The heir address and silence window are enforced on-chain. The note
                is delivered with the decryption key (stored off-chain).
              </p>
            </div>
          </div>

          {inheritanceError && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">
              ⚠️ {inheritanceError}
            </div>
          )}

          {inheritanceSaved && (
            <div className="rounded-lg bg-primary/10 border border-primary/30 px-4 py-3 text-sm text-primary flex flex-col gap-1">
              <span>✓ Inheritance enforced on-chain.</span>
              {inheritanceTx && (
                <a href={inheritanceTx} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs underline underline-offset-2">
                  View transaction <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          )}

          <Button className="w-fit" onClick={handleSaveInheritance} disabled={inheritanceSaving}>
            {inheritanceSaving
              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving on-chain...</>
              : inheritanceSaved
                ? <><Check className="w-4 h-4 mr-2" />Saved!</>
                : "Save inheritance config"}
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
            Download all your stored memories as a decrypted JSON file. This is
            your data — take it anywhere.
          </p>
          <Button variant="outline" size="sm" className="w-fit" onClick={handleExport} disabled={exporting}>
            {exporting
              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Exporting...</>
              : <><Download className="w-4 h-4 mr-2" />Download my memory</>}
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
            on Walrus will persist but become permanently inaccessible. This cannot be undone.
          </p>
          <Button variant="destructive" size="sm" className="w-fit" onClick={() => setShowDeleteModal(true)}>
            <Trash2 className="w-4 h-4 mr-2" /> Delete account
          </Button>
        </section>

      </div>

      {/* Full-screen delete confirmation modal */}
      {showDeleteModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
          onClick={() => !deleting && setShowDeleteModal(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-2xl flex flex-col gap-5 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
              <Trash2 className="h-7 w-7 text-destructive" />
            </div>
            <div className="text-center">
              <h2 className="text-xl font-bold">Delete your account?</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                This permanently deletes your account, API keys, and all memory
                metadata. Memories on Walrus persist but become permanently
                inaccessible. <span className="font-medium text-foreground">This cannot be undone.</span>
              </p>
            </div>
            {deleteError && <p className="text-center text-sm text-destructive">{deleteError}</p>}
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowDeleteModal(false)} disabled={deleting}>
                Cancel
              </Button>
              <Button variant="destructive" className="flex-1" onClick={handleDeleteAccount} disabled={deleting}>
                {deleting
                  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Deleting…</>
                  : "Yes, delete everything"}
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
