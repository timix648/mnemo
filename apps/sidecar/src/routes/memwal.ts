import { Router } from "express";
import { z } from "zod";
import { rememberBlob, recallBlob } from "../memwal/client.js";
import { logger } from "../log.js";

export const memwalRouter = Router();

const RememberSchema = z.object({
  ownerAddress: z.string().min(3),
  namespaceObjectId: z.string().min(3),
  ciphertext: z.string(),
  metadata: z.record(z.unknown()).optional(),
});

memwalRouter.post("/remember", async (req, res, next) => {
  try {
    const body = RememberSchema.parse(req.body);
    const walrusBlobId = await rememberBlob({
      ownerAddress: body.ownerAddress,
      namespaceObjectId: body.namespaceObjectId,
      ciphertext: body.ciphertext,
      metadata: body.metadata ?? {},
    });
    res.json({ walrusBlobId });
  } catch (err) {
    next(err);
  }
});

const RecallSchema = z.object({
  ownerAddress: z.string().min(3),
  namespaceObjectId: z.string().min(3),
  walrusBlobId: z.string().min(3),
});

memwalRouter.post("/recall", async (req, res, next) => {
  try {
    const body = RecallSchema.parse(req.body);
    const ciphertext = await recallBlob(body);
    res.json({ ciphertext });
  } catch (err) {
    next(err);
  }
});
