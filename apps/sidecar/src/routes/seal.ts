import { Router } from "express";
import { z } from "zod";
import { sealEncrypt, sealDecrypt } from "../seal/client.js";

export const sealRouter = Router();

const EncryptSchema = z.object({
  policyObjectId: z.string().min(3),
  plaintext: z.string(),
});

sealRouter.post("/encrypt", async (req, res, next) => {
  try {
    const body = EncryptSchema.parse(req.body);
    const ciphertext = await sealEncrypt(body);
    res.json({ ciphertext });
  } catch (err) {
    next(err);
  }
});

const DecryptSchema = z.object({
  policyObjectId: z.string().min(3),
  ciphertext: z.string(),
  requesterAddress: z.string().min(3),
});

sealRouter.post("/decrypt", async (req, res, next) => {
  try {
    const body = DecryptSchema.parse(req.body);
    const plaintext = await sealDecrypt(body);
    res.json({ plaintext });
  } catch (err) {
    next(err);
  }
});
