/**
 * test-heir-direct-seal.ts — Mnemo crown-jewel demo
 *
 * Proves the dead-man's-switch: after the owner is dormant past the timeout,
 * the HEIR can decrypt the owner's encrypted memory by talking DIRECTLY to
 * Seal + Walrus — with NO relayer, NO Mnemo infrastructure involved.
 *
 * Flow:
 *   1. Owner sets heir + dormancy (60s) on the v2 account (Clock-based).
 *   2. Wait ~70s so now >= last_active + dormancy.
 *   3. Heir builds a Seal SessionKey for the v2 package.
 *   4. Heir fetches an encrypted blob straight from the Walrus aggregator.
 *   5. Heir builds the seal_approve(id, account, clock) PTB and calls
 *      fetchKeys + decrypt — the on-chain heir branch passes, keys release,
 *      plaintext recovered.
 *
 * Run:
 *   cd C:\Users\hp\Downloads\Mnemo\apps\sidecar
 *   $env:OWNER_SUI_KEY="suiprivkey1qrqcrjmtn45eckceqsgcdpyttn2fgdrvpvpqu8e7flyeaymf7sun6s6t03f"
 *   $env:HEIR_SUI_KEY="suiprivkey1qqthygjspf2jg8k48fk674mt9el49j857gvya7gd09pka9aef3sg5gsclfu"
 *   pnpm exec tsx test-heir-direct-seal.ts
 */

import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";
import { SealClient, SessionKey, EncryptedObject } from "@mysten/seal";

// ---- v2 (Clock) deployment ----
const PACKAGE_ID = "0x140618622e96fe604e8fd1e8a752e1fe44726cdb0622a18020a61955ce918a60";
const ACCOUNT_ID = "0x9ffdf5d63098926afb07148034bdf0a5fdd7d9f7b11d9e66e1b7ea3f74c3f054";
const CLOCK_ID = "0x6";

// Heir wallet (mnemo-heir)
const HEIR_ADDRESS = "0x04789017efe03929c7feb83db754440235f8e943d2a6a73711b2c4d5fa16933b";

// A known v2 blob (owner's encrypted memory). Any of the decryptable v2 blobs work.
const BLOB_ID = "6ittKOgVTApa98ZR5VcdU4wjFDV1RxPyTI9WmmWPQY0";
const WALRUS_AGGREGATOR = "https://aggregator.walrus-testnet.walrus.space";

// Seal testnet key servers (must match the relayer's config exactly).
const SEAL_SERVER_OBJECT_IDS = [
    "0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75",
    "0xf5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8",
];
const SEAL_THRESHOLD = 2;

const DORMANCY_MS = 60_000; // 60s
const WAIT_MS = 70_000;     // wait past dormancy with margin

function keypairFromEnv(name: string): Ed25519Keypair {
    const raw = process.env[name];
    if (!raw) throw new Error(`Missing env ${name}`);
    const { secretKey } = decodeSuiPrivateKey(raw.trim());
    return Ed25519Keypair.fromSecretKey(secretKey);
}

async function ownerCall(
    suiClient: SuiJsonRpcClient,
    owner: Ed25519Keypair,
    fn: string,
    args: (tx: Transaction) => any[],
): Promise<string> {
    const tx = new Transaction();
    tx.moveCall({ target: `${PACKAGE_ID}::account::${fn}`, arguments: args(tx) });
    const res = await suiClient.signAndExecuteTransaction({
        signer: owner,
        transaction: tx,
        options: { showEffects: true },
    });
    await suiClient.waitForTransaction({ digest: res.digest });
    const status = res.effects?.status?.status;
    if (status !== "success") {
        throw new Error(`${fn} failed: ${JSON.stringify(res.effects?.status)}`);
    }
    return res.digest;
}

async function main() {
    const suiClient = new SuiJsonRpcClient({ url: "https://fullnode.testnet.sui.io:443" });

    const owner = keypairFromEnv("OWNER_SUI_KEY");
    const heir = keypairFromEnv("HEIR_SUI_KEY");
    const ownerAddr = owner.getPublicKey().toSuiAddress();
    const heirAddr = heir.getPublicKey().toSuiAddress();

    console.log("Mnemo → heir-direct-Seal demo (dead-man's-switch)");
    console.log("  package:", PACKAGE_ID);
    console.log("  account:", ACCOUNT_ID);
    console.log("  owner:  ", ownerAddr);
    console.log("  heir:   ", heirAddr);
    if (heirAddr !== HEIR_ADDRESS) {
        console.warn(`  ⚠ heir addr ${heirAddr} != expected ${HEIR_ADDRESS}`);
    }

    // --- Step 1: owner sets heir + dormancy ---
    console.log(`\nStep 1: owner sets heir=${heirAddr} dormancy=${DORMANCY_MS}ms ...`);
    const setHeirDigest = await ownerCall(suiClient, owner, "set_heir", (tx) => [
        tx.object(ACCOUNT_ID),
        tx.pure.address(heirAddr),
        tx.object(CLOCK_ID),
    ]);
    console.log("  ✓ set_heir digest:", setHeirDigest);

    const setDormDigest = await ownerCall(suiClient, owner, "set_dormancy", (tx) => [
        tx.object(ACCOUNT_ID),
        tx.pure.u64(DORMANCY_MS),
        tx.object(CLOCK_ID),
    ]);
    console.log("  ✓ set_dormancy digest:", setDormDigest);
    console.log("  (last_active_ms is now refreshed; dormancy clock starts here)");

    // --- Step 2: wait past dormancy ---
    console.log(`\nStep 2: waiting ${WAIT_MS / 1000}s for dormancy to elapse (Clock is real-time)...`);
    const startWait = Date.now();
    while (Date.now() - startWait < WAIT_MS) {
        await new Promise((r) => setTimeout(r, 5000));
        const left = Math.max(0, WAIT_MS - (Date.now() - startWait));
        console.log(`  ...${Math.round(left / 1000)}s left`);
    }
    console.log("  ✓ dormancy window elapsed — heir should now be authorized");

    // --- Step 3: heir builds a SessionKey for the package ---
    console.log("\nStep 3: heir builds Seal SessionKey...");
    const sessionKey = await SessionKey.create({
        address: heirAddr,
        packageId: PACKAGE_ID,
        ttlMin: 10,
        signer: heir,
        suiClient: suiClient as any,
    });
    console.log("  ✓ session key created (signed by heir, no gas)");

    // --- Step 4: heir fetches the encrypted blob directly from Walrus ---
    console.log(`\nStep 4: heir fetches blob ${BLOB_ID} from Walrus aggregator (no relayer)...`);
    const resp = await fetch(`${WALRUS_AGGREGATOR}/v1/blobs/${BLOB_ID}`);
    if (!resp.ok) throw new Error(`Walrus fetch failed: ${resp.status} ${resp.statusText}`);
    const encryptedData = new Uint8Array(await resp.arrayBuffer());
    console.log(`  ✓ fetched ${encryptedData.length} bytes of ciphertext`);

    const parsed = EncryptedObject.parse(encryptedData);
    const fullId = parsed.id;
    console.log("  blob seal id:", fullId);

    // --- Step 5: heir builds seal_approve PTB + fetchKeys + decrypt ---
    console.log("\nStep 5: heir runs seal_approve(id, account, clock) + fetchKeys + decrypt...");
    const sealClient = new SealClient({
        suiClient: suiClient as any,
        serverConfigs: SEAL_SERVER_OBJECT_IDS.map((objectId) => ({ objectId, weight: 1 })),
        verifyKeyServers: true,
    });

    const idBytes = Array.from(
        Uint8Array.from(fullId.match(/.{1,2}/g)!.map((b: string) => parseInt(b, 16)))
    );

    const tx = new Transaction();
    tx.moveCall({
        target: `${PACKAGE_ID}::account::seal_approve`,
        arguments: [
            tx.pure("vector<u8>", idBytes),
            tx.object(ACCOUNT_ID),
            tx.object(CLOCK_ID),
        ],
    });
    const txBytes = await tx.build({ client: suiClient as any, onlyTransactionKind: true });

    await sealClient.fetchKeys({
        ids: [fullId],
        txBytes,
        sessionKey,
        threshold: SEAL_THRESHOLD,
    });
    console.log("  ✓ fetchKeys succeeded — heir branch in seal_approve PASSED");

    const decrypted = await sealClient.decrypt({
        data: encryptedData,
        sessionKey,
        txBytes,
    });
    const plaintext = Buffer.from(decrypted).toString("utf8");

    console.log("\n✓ HEIR DECRYPT OK — owner's memory recovered by the heir, no Mnemo infra.");
    console.log('  plaintext: "' + plaintext + '"');
}

main().catch((err) => {
    console.error("\n✗ FAILED:", err?.message || err);
    if (String(err?.message || err).includes("NoAccess") || String(err).includes("does not have access")) {
        console.error(
            "  → seal_approve denied. Check: dormancy elapsed? heir set correctly? " +
            "blob bound to this package? account id correct?"
        );
    }
    process.exit(1);
});
