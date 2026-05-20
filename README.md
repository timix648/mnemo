# Mnemo

Your AI memory, owned and portable. Mnemo is a transparent HTTP proxy plus a memory layer for AI assistants. Point any AI tool (Cursor, Cline, Continue, the OpenAI/Anthropic desktop apps, custom scripts) at your personal Mnemo proxy URL; every conversation is automatically captured, encrypted, and stored on Walrus via MemWal. Semantic-search across every AI tool you use, from one app.

**Hackathon:** Sui Overflow 2026 — Agentic Web Track
**Build window:** May 16 → June 21, 2026
**Team:** 2 developers + Claude (AI pair-programmer)
**Target:** top 10 of ~5,000 submissions; mainnet by Aug 27 for full prize

## Status

**Week 1 of 5 complete** (May 16 - May 20, 2026). 32 days to submission.

End-to-end pipeline works on testnet:

- Proxy (`:8080`) forwards OpenAI requests upstream, worker captures with 1536-dim pgvector embeddings.
- Sidecar (`:3001`) round-trips through MemWal + Seal **mocked** clients (~30ms). Real SDK wiring is Week 2.
- API (`:8001`) serves `/me`, `/namespaces`, `/keys`, `/search` (semantic search confirmed against seeded entries).
- `namespace` and `policy` Move modules deployed to Sui testnet.

**Testnet package ID:** `0x7b6c4130a57c3bfc8b4d123a2bc96f962932a7dbd73642fb70da0c8039d5b23d`
**Explorer:** https://testnet.suivision.xyz/package/0x7b6c4130a57c3bfc8b4d123a2bc96f962932a7dbd73642fb70da0c8039d5b23d

**Week 2 focus (May 21 - May 27):** replace mocked MemWal + Seal clients with real SDKs. Wire Enoki zkLogin in the web app. Real end-to-end test with Cursor pointing at the proxy.


## Architecture

```
┌──────────────┐   HTTP   ┌──────────────┐   HTTP   ┌─────────────┐
│  AI Tool     │─────────▶│  Mnemo Proxy │─────────▶│  OpenAI /   │
│  (Cursor,    │          │  (Python)    │          │  Anthropic  │
│   Cline...)  │          │  :8080       │          └─────────────┘
└──────────────┘          └──────┬───────┘
                                 │ async capture
                                 ▼
                          ┌──────────────┐
                          │ Redis queue  │
                          └──────┬───────┘
                                 │
                                 ▼
                          ┌──────────────┐    HTTP   ┌─────────────┐
                          │ Capture      │──────────▶│ Node Sidecar│
                          │ Worker       │           │ (MemWal +   │
                          │ (Python)     │           │  Seal SDK)  │
                          └──────┬───────┘           └──────┬──────┘
                                 │                          │
                                 ▼                          ▼
                          ┌──────────────┐           ┌─────────────┐
                          │  Postgres    │           │  Walrus +   │
                          │  + pgvector  │           │  Sui chain  │
                          └──────────────┘           └─────────────┘

                          ┌──────────────┐
                          │  Web App     │ ──HTTP──▶ Mgmt API (Python) :8001
                          │  (Next.js,   │
                          │  Walrus      │
                          │   Sites)     │
                          └──────────────┘
```

## Service map

| Service | Tech | Port | Purpose |
|---|---|---|---|
| `apps/web` | Next.js 14 + TS | 3000 | Frontend, hosted on Walrus Sites |
| `apps/proxy` | Python FastAPI | 8080 | AI-tool-facing OpenAI/Anthropic proxy |
| `apps/api` | Python FastAPI | 8001 | Web app's management API |
| `apps/worker` | Python (RQ) | — | Async capture worker |
| `apps/sidecar` | Node.js Express | 3001 | MemWal + Seal SDK bridge |
| `packages/move` | Sui Move | — | Smart contracts |
| `packages/shared` | TypeScript | — | Shared types (web ↔ sidecar) |

The sidecar exists because MemWal's SDK is Node-only. The Python services HTTP-call it for any operation that needs the Sui/Walrus/Seal SDKs.

## Quickstart

See `SETUP.md` for the full Windows-first setup. The short version:

```bash
# 1. Bring up infra
docker compose up -d

# 2. Run migrations
psql -h localhost -U mnemo_user -d mnemo_db -f migrations/001_initial.sql

# 3. Start the sidecar (Node)
cd apps/sidecar && pnpm install && pnpm dev

# 4. Start the proxy (Python)
cd apps/proxy && pip install -r requirements.txt && uvicorn mnemo_proxy.main:app --port 8080 --reload

# 5. Start the API (Python)
cd apps/api && pip install -r requirements.txt && uvicorn mnemo_api.main:app --port 8001 --reload

# 6. Start the worker (Python)
cd apps/worker && pip install -r requirements.txt && python -m mnemo_worker.main

# 7. Start the web app (Next.js)
cd apps/web && pnpm install && pnpm dev
```

## Week 1 definition of done

- [x] Proxy forwards `POST /v1/chat/completions` to OpenAI, streams the response correctly back to `curl`.
- [x] `scripts/test-memwal.ts` round-trips a remember/recall against testnet (mocked; real SDK wiring is Week 2).
- [x] `namespace.move` is deployed to Sui testnet; address recorded in `packages/move/DEPLOYMENTS.md`.
- [x] API `/me`, `/namespaces`, `/keys`, `/search` endpoints functional. `/search` validated end-to-end with real OpenAI embeddings + pgvector cosine retrieval. (Web app onboarding wiring moves to Week 2.)

See `apps/*/README.md` for per-service details. See the root build plan (`Mnemo_Build_Guide.docx`) for the full 5-week plan.
