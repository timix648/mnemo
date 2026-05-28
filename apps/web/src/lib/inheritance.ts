import { Transaction } from "@mysten/sui/transactions";
import { toBase64, fromBase64, isValidSuiAddress, normalizeSuiAddress } from "@mysten/sui/utils";
// In @mysten/sui v2 the JSON-RPC client is `SuiJsonRpcClient` (from /jsonRpc).
// This is exactly what dapp-kit's `useSuiClient()` returns, so the types line up.
import type { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import type { EnokiFlow } from "@mysten/enoki";

// Alias so the rest of the file reads naturally.
type SuiClient = SuiJsonRpcClient;

import { MNEMO_TESTNET, DEV_TEST_USER } from "@/config/sui";
import { sponsorTransaction, executeSponsoredApi } from "@/lib/api";

const PACKAGE_ID = MNEMO_TESTNET.PACKAGE_ID;
const REGISTRY_ID = MNEMO_TESTNET.REGISTRY_ID;
const CLOCK_ID = MNEMO_TESTNET.CLOCK_ID; // 0x6
const NETWORK = "testnet" as const;

// Dev-only: identifies the user to the backend so /sponsor can look up
// sui_address and validate that `sender` matches. In production this comes
// from the authenticated session (JWT). One place to change later.
const CURRENT_USER_ID = DEV_TEST_USER.user_id;

// Optional demo override: point the UI at a specific known account object.
// MUST be owned by the signed-in address or the tx will abort with ENotOwner.
const ACCOUNT_ID_OVERRIDE = process.env.NEXT_PUBLIC_MNEMO_ACCOUNT_ID || null;

// Move call targets (module is `account`, NOT `mnemo`).
export const MOVE_TARGETS = {
  createAccount: `${PACKAGE_ID}::account::create_account`,
  setHeir: `${PACKAGE_ID}::account::set_heir`,
  setDormancy: `${PACKAGE_ID}::account::set_dormancy`,
  touchActivity: `${PACKAGE_ID}::account::touch_activity`,
} as const;

// Contract guard: MAX_DORMANCY_MS = 315_360_000_000 (3650 days / ~10y).
const MS_PER_DAY = 86_400_000;
const MAX_DORMANCY_DAYS = 3650;

export class InheritanceError extends Error {}

/** Convert a human "days of inactivity" value to the u64 ms the contract wants. */
export function daysToDormancyMs(days: number): bigint {
  return BigInt(Math.round(days)) * BigInt(MS_PER_DAY);
}

export function explorerTxUrl(digest: string): string {
  return `${MNEMO_TESTNET.EXPLORER}/txblock/${digest}`;
}

/**
 * Look up the signed-in user's MemWalAccount object id, returning `null` if
 * none exists yet (rather than throwing). Useful for "do I need onboarding?"
 * checks.
 */
export async function lookupAccountId(
  suiClient: SuiClient,
  ownerAddress: string,
): Promise<string | null> {
  if (ACCOUNT_ID_OVERRIDE) return ACCOUNT_ID_OVERRIDE;

  const owner = normalizeSuiAddress(ownerAddress);

  // 1) read the registry to find the internal Table object id.
  let registry;
  try {
    registry = await suiClient.getObject({
      id: REGISTRY_ID,
      options: { showContent: true },
    });
  } catch (e) {
    console.error("[inheritance] getObject(registry) failed:", e, { REGISTRY_ID });
    throw new InheritanceError(
      `Couldn't reach the Sui RPC to read the account registry: ${errMsg(e)}.`,
    );
  }

  const regContent = registry.data?.content as any;
  const tableId: string | undefined = regContent?.fields?.accounts?.fields?.id?.id;
  if (!tableId) {
    console.error("[inheritance] registry content (unexpected shape):", regContent, { REGISTRY_ID });
    throw new InheritanceError(
      "Could not read the on-chain account registry. Check REGISTRY_ID in config/sui.ts points at the v2 (0x140618…) registry.",
    );
  }

  // 2) look up this owner's entry in the Table<address, ID>.
  try {
    const field = await suiClient.getDynamicFieldObject({
      parentId: tableId,
      name: { type: "address", value: owner },
    });
    const value = (field.data?.content as any)?.fields?.value;
    if (typeof value === "string" && value.startsWith("0x")) {
      return normalizeSuiAddress(value);
    }
  } catch {
    // Dynamic field doesn't exist => no account yet. Expected "not found".
  }
  return null;
}

/** Convenience boolean for "does this address have a Mnemo account on-chain?" */
export async function accountExists(
  suiClient: SuiClient,
  ownerAddress: string,
): Promise<boolean> {
  return (await lookupAccountId(suiClient, ownerAddress)) !== null;
}

/**
 * Resolve the signed-in user's MemWalAccount object id, throwing a friendly
 * error if it doesn't exist yet.
 */
export async function resolveAccountId(
  suiClient: SuiClient,
  ownerAddress: string,
): Promise<string> {
  const id = await lookupAccountId(suiClient, ownerAddress);
  if (!id) {
    throw new InheritanceError(
      "No on-chain account found for your address yet. Finish onboarding to create your Mnemo account before setting an heir.",
    );
  }
  return id;
}

/** Pull a human-readable message out of an unknown thrown value. */
function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}

/**
 * Sponsor + sign + execute a transaction as the signed-in zkLogin user.
 *
 * The flow now goes through OUR backend (apps/api), which holds the Enoki
 * PRIVATE key — the only kind Enoki accepts for sponsorship. Public keys
 * get 403s. We send tx-kind bytes to /sponsor, sign the returned data with
 * the zkLogin keypair locally, then post the signature to /sponsor/execute.
 */
export async function executeSponsored(
  flow: EnokiFlow,
  suiClient: SuiClient,
  tx: Transaction,
  sender: string,
  allowedMoveCallTargets: string[],
): Promise<string> {
  // 1. Build the transaction-kind bytes (no gas data yet — the sponsor adds it).
  let txKindBytes: Uint8Array;
  try {
    txKindBytes = await tx.build({ client: suiClient, onlyTransactionKind: true });
  } catch (e) {
    console.error("[inheritance] tx.build failed:", e);
    throw new InheritanceError(`Couldn't build the transaction: ${errMsg(e)}`);
  }

  // 2. Ask our backend to sponsor it. The backend forwards to Enoki using the
  //    private API key, gets back { bytes, digest }, and returns them.
  let sponsored: { bytes: string; digest: string };
  try {
    sponsored = await sponsorTransaction(
      CURRENT_USER_ID,
      toBase64(txKindBytes),
      sender,
      allowedMoveCallTargets,
    );
  } catch (e) {
    console.error("[inheritance] /sponsor failed:", e, { sender, allowedMoveCallTargets });
    throw new InheritanceError(
      `Server refused to sponsor this transaction: ${errMsg(e)}. ` +
        `Check that ENOKI_SECRET_KEY is set on the API and that these targets are ` +
        `allowlisted in the Enoki Portal for the PRIVATE key: ${allowedMoveCallTargets.join(", ")}.`,
    );
  }

  // 3. User signs the sponsored TransactionData with their zkLogin keypair.
  //    (This stays client-side — the zkLogin session can't leave the browser.)
  let signature: string;
  try {
    const keypair = await flow.getKeypair({ network: NETWORK });
    ({ signature } = await keypair.signTransaction(fromBase64(sponsored.bytes)));
  } catch (e) {
    console.error("[inheritance] getKeypair/signTransaction failed:", e);
    throw new InheritanceError(
      `Couldn't sign with your zkLogin session: ${errMsg(e)}. ` +
        `Your session may have expired — sign in again and retry.`,
    );
  }

  // 4. Hand the signed bytes back to the backend to submit via Enoki.
  let digest: string;
  try {
    ({ digest } = await executeSponsoredApi(CURRENT_USER_ID, sponsored.digest, signature));
  } catch (e) {
    console.error("[inheritance] /sponsor/execute failed:", e);
    throw new InheritanceError(`The sponsored transaction failed on execution: ${errMsg(e)}.`);
  }

  // 5. Wait for finality so callers can immediately read fresh state.
  try {
    await suiClient.waitForTransaction({ digest });
  } catch (e) {
    // The tx was submitted; finality wait failing is usually a transient RPC
    // issue. Log but don't fail — the digest is valid.
    console.warn("[inheritance] waitForTransaction warning (tx already submitted):", e);
  }
  return digest;
}

/**
 * Create the user's MemWalAccount on-chain (memwal::account::create_account).
 * This is the missing onboarding step — without it there is no account object
 * for set_heir / set_dormancy / touch_activity to target.
 */
export async function createAccount(
  flow: EnokiFlow,
  suiClient: SuiClient,
  ownerAddress: string,
): Promise<SaveInheritanceResult> {
  if (!ownerAddress) {
    throw new InheritanceError("You need to sign in before creating your account.");
  }
  const sender = normalizeSuiAddress(ownerAddress);

  const tx = new Transaction();
  tx.moveCall({
    target: MOVE_TARGETS.createAccount,
    arguments: [tx.object(REGISTRY_ID), tx.object(CLOCK_ID)],
  });

  const digest = await executeSponsored(flow, suiClient, tx, sender, [
    MOVE_TARGETS.createAccount,
  ]);

  // Read the freshly-registered account id back out of the registry.
  const accountId = (await lookupAccountId(suiClient, sender)) ?? "";
  return { digest, explorerUrl: explorerTxUrl(digest), accountId };
}

/**
 * Idempotent helper: return the user's account id, creating it first if it
 * doesn't exist yet. Safe to call from onboarding or lazily before set_heir.
 */
export async function ensureAccount(
  flow: EnokiFlow,
  suiClient: SuiClient,
  ownerAddress: string,
): Promise<string> {
  const existing = await lookupAccountId(suiClient, ownerAddress);
  if (existing) return existing;
  const { accountId } = await createAccount(flow, suiClient, ownerAddress);
  if (!accountId) {
    throw new InheritanceError(
      "Account created but its id couldn't be read back. Refresh and try again.",
    );
  }
  return accountId;
}

export interface SaveInheritanceArgs {
  flow: EnokiFlow;
  suiClient: SuiClient;
  /** The signed-in user's zkLogin address (must own the account). */
  ownerAddress: string;
  /** Heir Sui address from the form. */
  recipient: string;
  /** Silence threshold in DAYS (converted to ms for the contract). */
  thresholdDays: number;
  /** Optional pre-resolved account id (skips the registry lookup). */
  accountId?: string;
}

export interface SaveInheritanceResult {
  digest: string;
  explorerUrl: string;
  accountId: string;
}

/**
 * The crown jewel: configure the on-chain dead-man's-switch.
 * Sets the heir and the dormancy window in a single sponsored transaction.
 */
export async function saveInheritance(
  args: SaveInheritanceArgs,
): Promise<SaveInheritanceResult> {
  const { flow, suiClient, ownerAddress, recipient, thresholdDays } = args;

  if (!ownerAddress) {
    throw new InheritanceError("You need to sign in before configuring inheritance.");
  }

  // --- validate the recipient (mirror the contract's guards) ---
  const heir = recipient.trim();
  if (!heir) throw new InheritanceError("Please enter a recipient Sui address.");
  if (!isValidSuiAddress(heir)) {
    throw new InheritanceError("That doesn't look like a valid Sui address (expected 0x + 64 hex chars).");
  }
  if (normalizeSuiAddress(heir) === normalizeSuiAddress(ownerAddress)) {
    throw new InheritanceError("Your heir must be a different address from your own.");
  }

  // --- validate the threshold ---
  if (!Number.isFinite(thresholdDays) || thresholdDays < 1) {
    throw new InheritanceError("Silence threshold must be at least 1 day.");
  }
  if (thresholdDays > MAX_DORMANCY_DAYS) {
    throw new InheritanceError(`Silence threshold can't exceed ${MAX_DORMANCY_DAYS} days.`);
  }
  const dormancyMs = daysToDormancyMs(thresholdDays);

  // --- resolve the account object (creating it on the fly if needed) ---
  const accountId = args.accountId ?? (await ensureAccount(flow, suiClient, ownerAddress));

  // --- build the PTB: set_heir + set_dormancy in one signature ---
  const tx = new Transaction();
  tx.moveCall({
    target: MOVE_TARGETS.setHeir,
    arguments: [
      tx.object(accountId),
      tx.pure.address(normalizeSuiAddress(heir)),
      tx.object(CLOCK_ID),
    ],
  });
  tx.moveCall({
    target: MOVE_TARGETS.setDormancy,
    arguments: [
      tx.object(accountId),
      tx.pure.u64(dormancyMs),
      tx.object(CLOCK_ID),
    ],
  });

  const digest = await executeSponsored(flow, suiClient, tx, normalizeSuiAddress(ownerAddress), [
    MOVE_TARGETS.setHeir,
    MOVE_TARGETS.setDormancy,
  ]);

  return { digest, explorerUrl: explorerTxUrl(digest), accountId };
}

/**
 * Heartbeat: record on-chain that the owner is still alive, resetting the
 * dormancy timer (memwal::account::touch_activity). Same sponsored path.
 */
export async function sendHeartbeat(
  flow: EnokiFlow,
  suiClient: SuiClient,
  ownerAddress: string,
  accountId?: string,
): Promise<SaveInheritanceResult> {
  if (!ownerAddress) {
    throw new InheritanceError("You need to sign in before pinging your heartbeat.");
  }
  const id = accountId ?? (await resolveAccountId(suiClient, ownerAddress));

  const tx = new Transaction();
  tx.moveCall({
    target: MOVE_TARGETS.touchActivity,
    arguments: [tx.object(id), tx.object(CLOCK_ID)],
  });

  const digest = await executeSponsored(
    flow,
    suiClient,
    tx,
    normalizeSuiAddress(ownerAddress),
    [MOVE_TARGETS.touchActivity],
  );
  return { digest, explorerUrl: explorerTxUrl(digest), accountId: id };
}

export interface InheritanceState {
  accountId: string;
  heir: string | null;
  dormancyMs: number;
  dormancyDays: number;
  lastActiveMs: number;
  active: boolean;
  /** ms from now until the heir can claim; null if disabled or already claimable. */
  msUntilClaimable: number | null;
  /** true once the dormancy window has lapsed (heir can claim right now). */
  isDormant: boolean;
}

/**
 * Read the owner's current on-chain inheritance config from their MemWalAccount.
 * Returns null if no account exists yet (not onboarded).
 */
export async function readInheritanceState(
  suiClient: SuiClient,
  ownerAddress: string,
): Promise<InheritanceState | null> {
  const accountId = await lookupAccountId(suiClient, ownerAddress);
  if (!accountId) return null;

  let obj;
  try {
    obj = await suiClient.getObject({ id: accountId, options: { showContent: true } });
  } catch (e) {
    throw new InheritanceError(`Couldn't read your on-chain account: ${errMsg(e)}`);
  }

  const fields = (obj.data?.content as any)?.fields;
  if (!fields) {
    throw new InheritanceError(
      "Your account object couldn't be read. It may be on an older package version.",
    );
  }

  // heir is Option<address>: null, a bare "0x..", { fields: { vec: [...] } }, or a bare array.
  let heir: string | null = null;
  const rawHeir = fields.heir;
  if (typeof rawHeir === "string" && rawHeir.startsWith("0x")) {
    heir = normalizeSuiAddress(rawHeir);
  } else if (rawHeir?.fields?.vec?.length) {
    heir = normalizeSuiAddress(rawHeir.fields.vec[0]);
  } else if (Array.isArray(rawHeir) && rawHeir.length) {
    heir = normalizeSuiAddress(rawHeir[0]);
  }

  // u64 fields arrive as strings; epoch ms (~1.7e12) and max dormancy (~3.15e11)
  // are both far below Number.MAX_SAFE_INTEGER, so Number math is safe.
  const dormancyMs = Number(fields.dormancy_ms ?? 0);
  const lastActiveMs = Number(fields.last_active_ms ?? 0);
  const active = Boolean(fields.active);
  const dormancyDays = Math.round(dormancyMs / MS_PER_DAY);

  const now = Date.now();
  const claimableAt = lastActiveMs + dormancyMs;
  const enabled = dormancyMs > 0 && heir !== null;
  const isDormant = enabled && now >= claimableAt;
  const msUntilClaimable = enabled && !isDormant ? claimableAt - now : null;

  return { accountId, heir, dormancyMs, dormancyDays, lastActiveMs, active, msUntilClaimable, isDormant };
}