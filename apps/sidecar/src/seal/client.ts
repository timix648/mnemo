/**
 * Seal client. WEEK 1: MOCK IMPLEMENTATION — base64-encodes plaintext.
 *
 * NOT REAL ENCRYPTION. This exists so the rest of the stack can run end-to-end.
 *
 * In Week 2 we wire the real Seal SDK and the on-chain policy from policy.move.
 */
import { logger } from "../log.js";

export async function sealEncrypt(input: {
  policyObjectId: string;
  plaintext: string;          // base64
}): Promise<string> {
  logger.warn({ policy: input.policyObjectId }, "seal.encrypt (MOCK — not real encryption)");
  // Wrap with a sentinel so we can detect mock data in tests.
  return "MOCK_SEAL_v1:" + input.plaintext;
}

export async function sealDecrypt(input: {
  policyObjectId: string;
  ciphertext: string;
  requesterAddress: string;
}): Promise<string> {
  logger.warn(
    { policy: input.policyObjectId, requester: input.requesterAddress },
    "seal.decrypt (MOCK — not real decryption)",
  );
  const prefix = "MOCK_SEAL_v1:";
  if (!input.ciphertext.startsWith(prefix)) {
    throw new Error("not a mock seal blob; refusing to decrypt");
  }
  return input.ciphertext.slice(prefix.length);
}

// ----- WEEK 2 TODO -----
// Replace with @mysten/seal:
//   - sealEncrypt: build a SealClient, call .encrypt({ policy: policyObjectId, data })
//   - sealDecrypt: call .decrypt() with the requester's zkLogin-derived signer;
//     Seal's key servers will check policy.move::has_access() on chain before
//     releasing key shares.
