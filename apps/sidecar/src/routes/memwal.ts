import { Router } from "express";
import { z } from "zod";
import { rememberBlob, recallMemories, fetchBlob } from "../memwal/client.js";
import { logger } from "../log.js";

export const memwalRouter = Router();

const RememberSchema = z.object({
  ownerAddress: z.string().min(3),
  namespaceObjectId: z.string().min(1),
  text: z.string().min(1),
  metadata: z.record(z.unknown()).optional(),
});

memwalRouter.post("/remember", async (req, res, next) => {
  try {
    const body = RememberSchema.parse(req.body);
    const walrusBlobId = await rememberBlob({
      ownerAddress: body.ownerAddress,
      namespaceObjectId: body.namespaceObjectId,
      text: body.text,
      metadata: body.metadata ?? {},
    });
    res.json({ walrusBlobId });
  } catch (err) {
    next(err);
  }
});

const RecallSchema = z.object({
  ownerAddress: z.string().min(3),
  namespaceObjectId: z.string().min(1),
  query: z.string().min(1),
  topK: z.number().int().min(1).max(50).optional(),
});

memwalRouter.post("/recall", async (req, res, next) => {
  try {
    const body = RecallSchema.parse(req.body);
    const results = await recallMemories({
      ownerAddress: body.ownerAddress,
      namespaceObjectId: body.namespaceObjectId,
      query: body.query,
      topK: body.topK,
    });
    res.json({ results });
  } catch (err) {
    next(err);
  }
});

// Deterministic fetch of one memory by its walrus blob id. Wraps the
// relayer's /api/fetch route (engine fetch_one: cache → Walrus → Seal-decrypt).
// Used by the API's GET /memories/{id} so the chats UI can reliably load
// a specific captured conversation without going through semantic search.
const FetchSchema = z.object({
  ownerAddress: z.string().min(3),
  namespaceObjectId: z.string().min(1),
  walrusBlobId: z.string().min(1),
});

memwalRouter.post("/fetch", async (req, res, next) => {
  try {
    const body = FetchSchema.parse(req.body);
    const text = await fetchBlob({
      ownerAddress: body.ownerAddress,
      namespaceObjectId: body.namespaceObjectId,
      walrusBlobId: body.walrusBlobId,
    });
    if (text === null) {
      return res.status(404).json({ error: "memory not available" });
    }
    res.json({ walrusBlobId: body.walrusBlobId, text });
  } catch (err) {
    logger.warn({ err }, "memwal.fetch failed");
    next(err);
  }
});