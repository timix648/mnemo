# Mnemo SDK Notes

**Status:** Week 2, day 1. Architecture locked. Build phase begins.
**Last updated:** 2026-05-20
**Track:** Sui Overflow 2026 — Agentic Web

---

## 1. Architecture Decision

Mnemo runs on Mysten Labs' MemWal as the real backend memory service (self-hosted relayer, not just an SDK import). The inheritance / dead-man's-switch feature — the project's core differentiator — is implemented as a **surgical fork of MemWal's `account.move` module**, deployed as Mnemo's own Sui package. This is the **A2-medium-refined** path.

What this means concretely:

- MemWal's TypeScript sidecar, Rust relayer, indexer, encryption/decryption flows: **unchanged**, used as-is.
- MemWal's `account.move`: **forked once**, with surgical additions for inheritance. Module name stays `account` so the sidecar's hardcoded PTB target (`${packageId}::account::seal_approve`) continues to work without sidecar modifications.
- Mnemo deploys its forked Move package and points the MemWal sidecar's `MEMWAL_PACKAGE_ID` env var at Mnemo's package. The sidecar cannot tell the difference; it just calls a function named `seal_approve` in a module named `account`.
- The Seal's key servers compute decryption keys deterministically from (package_id, identity_id). Decryption requires the requester to prove they can pass seal_approve on the referenced package. Encrypting against Mnemo's MEMWAL_PACKAGE_ID means Seal's key servers will check Mnemo's account::seal_approve (not MemWal's canonical one) before releasing key shares.

**Why this is Sui-native, not "less Sui-native":** Writing a custom `seal_approve` is the canonical way to use Seal. Seal is not just an encryption library — it is a programmable on-chain access policy framework. Any Move module can define a `seal_approve` function and gate decryption with arbitrary logic. MemWal's existing `account::seal_approve` ("owner OR delegate") is one example; Mnemo's `account::seal_approve` ("owner OR delegate OR (timeout_passed AND caller_is_heir)") is a second example. Both are first-class uses of Seal.

---

## 2. Source Code Findings (MemWal commit reviewed locally)

Findings from `git grep` of MemWal source at `C:\Users\hp\Downloads\memwal-src`:

**`seal_approve` is the only on-chain policy gate.**
The only file in MemWal's Move package that contains `policy`-related logic is `services/contract/sources/account.move`. Two hits, both comments next to `seal_approve`. There is no separate policy module, no global registry, no scattered access-control logic.

**No off-chain access enforcement exists.**
A grep for `has_access` and `access_policy` across all Rust (`*.rs`) and TypeScript (`*.ts`) files returned zero results. The Rust relayer and TypeScript sidecar do not enforce who can decrypt. All gating happens on-chain through `seal_approve`. This is the standard Seal architecture: off-chain components are plumbing; policy lives in Move.

**The sidecar hardcodes the module name `account` but treats package_id as runtime config.**
Three PTB call sites use `target: \`${packageId}::account::seal_approve\``:
- `services/server/scripts/seal-decrypt.ts` line 140
- `services/server/scripts/sidecar-server.ts` lines 799 and 894

`packageId` comes from the `MEMWAL_PACKAGE_ID` env var (`services/server/.env.example` line 47, `services/server/src/types.rs` lines 272–273). The module name and function name are hardcoded; the package address is configurable. This is exactly the seam we exploit.

**MemWal anticipates multi-package deployments.**
`services/server/src/routes/admin.rs` line 435: comment reads *"Each blob may have been encrypted with a different package_id (e.g. after contract upgrades)"*. Per-blob package_id is stored in on-chain metadata (`memwal_package_id` key, `sidecar-server.ts` line 1020) and retrieved at decrypt time. Mnemo is exactly the case this was built for.

**Existing `seal_approve` signature and PTB call shape:**
- `account.move` line 531: `entry fun seal_approve(...)`.
- `account.move` line 557: `public fun seal_key_id(owner: address): vector<u8>` — identity derived from owner address (with package_id prepended, per `account.move` line 523 comment: *"Key ID format: [package_id][bcs::to_bytes(owner_address)]"*).
- The sidecar passes a `MemWalAccount` (owned object) into the PTB, not the `AccountRegistry` (sidecar-server.ts line 796 comment).

**Existing tests that must continue passing after the fork:**
- `test_seal_approve_owner` — owner can decrypt
- `test_seal_approve_delegate` — registered delegate can decrypt
- `test_deactivated_blocks_seal_approve` — deactivated account blocks decrypt
- `test_seal_approve_wrong_id_fails` — wrong identity fails
- `test_legacy_account_blocks_seal_approve` — legacy accounts blocked

---

## 3. SDK Stack & Versions

| Package | Version | Role |
|---|---|---|
| `@mysten/sui` | 2.16.0 | Sui client (uses `SuiGrpcClient`) |
| `@mysten/seal` | 1.1.1 | Threshold encryption + on-chain policy via `seal_approve` |
| `@mysten/walrus` | 0.7.0 | Decentralized blob storage |
| `@mysten/enoki` | 1.0.4 | zkLogin / social auth wallets |
| `@mysten-incubation/memwal` | latest | Agent memory storage SDK (requires self-hosted relayer) |

Seal client is now instantiated via `client.$extend(seal({ serverConfigs: [...] }))` rather than a separate constructor.

---

## 4. Mnemo Move Module Plan

**Package layout:**

```
packages/move/
├── Move.toml
├── sources/
│   └── account.move        ← surgical fork of MemWal's account.move
└── tests/
    └── account_tests.move  ← MemWal's existing tests + inheritance tests
```

**Module name:** `account` (same as MemWal — the sidecar PTB hardcodes this).

**Struct additions to `MemWalAccount`:**

- `heir: Option<address>` — designated heir; `None` until owner sets one.
- `dormancy_seconds: u64` — how long owner must be inactive before heir gains access; `0` means inheritance disabled.
- `last_active_ms: u64` — timestamp of last owner activity (set on account creation, refreshed via `touch_activity`).

**New entry functions:**

- `set_heir(account: &mut MemWalAccount, heir: address, ctx: &TxContext)` — owner-only. Aborts if caller is not owner.
- `clear_heir(account: &mut MemWalAccount, ctx: &TxContext)` — owner-only.
- `set_dormancy(account: &mut MemWalAccount, seconds: u64, ctx: &TxContext)` — owner-only.
- `touch_activity(account: &mut MemWalAccount, clock: &Clock, ctx: &TxContext)` — owner-only. Updates `last_active_ms`. Called implicitly on any owner-side write; can also be called explicitly to reset the timer.

**Modified `seal_approve`:**

Existing pass conditions (owner active, delegate authorized) are preserved. One new pass condition is added:

```
caller == account.heir
  AND now_ms >= account.last_active_ms + (account.dormancy_seconds * 1000)
  AND account.dormancy_seconds > 0
```

If none of the conditions hold, abort with `E_NOT_AUTHORIZED` (same error code MemWal already uses).

**New tests to add:**

- `test_seal_approve_heir_after_timeout` — heir succeeds after dormancy elapses.
- `test_seal_approve_heir_before_timeout_fails` — heir fails while owner is still active.
- `test_seal_approve_heir_not_set_fails` — random caller cannot use the heir path when heir is unset.
- `test_touch_resets_timer` — after `touch_activity`, heir's window resets.
- `test_dormancy_zero_disables_inheritance` — `dormancy_seconds == 0` blocks the heir path entirely.

**Estimated scope:** 80–150 lines of Move added to the forked `account.move`. Existing five MemWal tests must continue to pass unchanged.

---

## 5. Relayer Infrastructure

MemWal's relayer is a Rust HTTP service plus a TypeScript sidecar (Express server on `localhost:9000`). Both are self-hosted. Both run together via `docker-compose`.

**Infrastructure dependencies:**

- PostgreSQL with the `pgvector` extension (for embedding storage and retrieval).
- OpenAI API key (or compatible endpoint) for embeddings + summarization.
- A Sui keypair with testnet SUI to pay gas for on-chain blob metadata writes.

**Required env vars (subset — full list goes in `.env.local`, not committed):**

- `MEMWAL_PACKAGE_ID` → Mnemo's deployed package address (Week 1 deploy gives us this).
- `WALRUS_PACKAGE_ID` → Walrus testnet package address.
- `SEAL_SERVER_CONFIGS` → JSON array describing the Seal key-server URLs.
- `SEAL_KEY_SERVER_URLS` → comma-separated list, equivalent.
- `SEAL_KEY_SERVER_TIMEOUT_MS` → timeout per key server.
- `SEAL_THRESHOLD` → number of key servers required for decryption (typically 2 of 3).
- Database URL, OpenAI key, Sui keypair seed phrase / hex private key.

**`.env.local` lives under `services/server/` and `services/indexer/`. Never committed. Testnet credentials are recorded in a local deployment log only.**

---

## 6. Open Risks

**R1 — Forked `account.move` must remain ABI-compatible with the sidecar PTB call shape.**
The sidecar passes `MemWalAccount` and other arguments in a specific order. The fork must keep that exact signature for the existing pass conditions, even while adding the heir branch. Mitigation: copy MemWal's `seal_approve` signature verbatim, add the heir check as an additional condition rather than restructuring.

**R2 — `last_active_ms` updates require integrating `touch_activity` into existing owner-side writes.**
If we only expose `touch_activity` as a standalone entry function, owners may forget to call it, and the dormancy timer will trigger erroneously. Mitigation: call `touch_activity` internally from `set_heir`, `set_dormancy`, and any other owner-side state-changing function. Also expose it as an entry function for explicit refresh from the agent.

**R3 — Relayer setup is the biggest infrastructure unknown.**
First-time `docker-compose up` for MemWal's relayer is untested by us. Postgres + pgvector + Sui keypair config + OpenAI key all have to be right. Mitigation: budget Day 2 of Week 2 entirely for this. If it doesn't come up cleanly, fall back to MemWal SDK calls against their public testnet relayer if one exists; pivot back to self-hosted later.

**R4 — Seal key servers need to be reachable from our deployed relayer.**
Seal's key servers are external services. Mainnet vs testnet configs differ. Mitigation: pin testnet key server URLs in `.env.local` and verify they respond before running the encrypt/decrypt round-trip test.

---

## 7. Build Order (Week 2)

1. **Generate this file's commit** → SDK_NOTES.md committed under `packages/move/`.
2. **Clone MemWal's `docker-compose.yml`** into Mnemo's `services/relayer/` (or wherever the build guide places it). Strip MemWal's `package_id` deployment script if any; we'll deploy our own.
3. **Stand up the relayer locally.** Postgres + pgvector + Sui keypair + OpenAI key. Hit the health endpoint. Smoke-test `POST /seal/encrypt` against MemWal's current package first, just to confirm the relayer works end-to-end before swapping in Mnemo's package.
4. **Fork `account.move`.** Copy MemWal's `account.move` into `packages/move/sources/`. Add the three struct fields, four entry functions, and modified `seal_approve` branch. Add the five new tests.
5. **Deploy Mnemo's package to testnet.** Capture the new `MEMWAL_PACKAGE_ID`. Update relayer `.env.local` to point at it.
6. **End-to-end test:** encrypt → store → decrypt as owner. Then `set_heir` + `set_dormancy` + simulate timeout (use a short dormancy like 60 seconds for testing) + decrypt as heir.

---

## 8. Safety Measures for `seal_approve`

The heir branch is the highest-stakes logic in this codebase. A bug here transfers user data to the wrong party permanently. Mandatory safety measures:

**S1 — Use Sui's `Clock` shared object for time.**
Pass `&Clock` into `seal_approve` and `touch_activity`. Read time via `clock::timestamp_ms(clock)`, not `tx_context::epoch_timestamp_ms`. Clock is the canonical, harder-to-manipulate time source.

**S2 — Owner can always abort heir claim.**
Add `abort_heir_claim(account, clock, ctx)` — owner-only entry function that calls `touch_activity` internally and resets `last_active_ms` to now. Belt-and-suspenders against accidental dormancy from being on vacation.

**S3 — `last_active_ms` must update from inside `seal_approve`'s owner branch.**
When the owner successfully decrypts (uses any of the owner pass conditions), `last_active_ms` should update. Otherwise an owner who reads but doesn't write will appear "dormant" to the heir branch even though they're active.

**S4 — Test the negative cases exhaustively.**
Five tests minimum (listed in Section 4) plus: heir cannot self-assign, heir field can only change with owner signature, dormancy_seconds change resets the timer, future timestamp on Clock cannot trigger the heir branch.

**S5 — Default safe.** New accounts have `dormancy_seconds = 0` (heir branch disabled). Owner must explicitly opt in.

---

## 9. Why Fork Instead of Wrap

Three alternatives were considered. Each is documented here for the record.

**A. Fork MemWal's `account.move`** — adds 3 fields + 4 entry functions + 1 branch in `seal_approve`. Reuses MemWal's relayer, sidecar, indexer unchanged. **Chosen.**

**B. Wrap with a separate policy module** — Seal calls Mnemo's `inheritance.move`, which delegates to MemWal's `account.move`. **Rejected.** Seal calls a single target. Cannot proxy across modules without two encryptions per blob (doubling latency and storage cost). Also forfeits the sidecar's hardcoded `account::seal_approve` target, requiring sidecar modifications.

**C. Reimplement the memory stack from scratch** — own Walrus client, own policy module, own indexer. **Rejected.** Scope blowout. Loses the "we use Mysten's flagship primitives" pitch. Larger bug surface. Demo loses punch.

MemWal's existing `seal_approve` is already an OR of two conditions (owner OR delegate). We extend it to three (owner OR delegate OR heir-after-dormancy). The architectural pattern is theirs; we extend, not invent.

## 10. Reference: Confirmed Mainnet/Testnet Facts

- MemWal relayer runs Rust + TS sidecar on `localhost:9000`.
- Key ID format: `[package_id][bcs::to_bytes(owner_address)]` (32 + 32 bytes).
- Walrus testnet package ID is set via `WALRUS_PACKAGE_ID` env var; the sidecar derives `WALRUS_BLOB_TYPE = ${WALRUS_PACKAGE_ID}::blob::Blob`.
- Sui Overflow 2026 submission deadline: 2026-06-21.
- Mnemo Week 1 deployment artifacts (package ID, upgrade cap, test user/namespace IDs) are recorded in the local deployment log only, never in committed code.
