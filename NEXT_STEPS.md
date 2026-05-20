# Next Steps — running this scaffold

You've got the bones. Here's exactly what to do, in order, to hit the
Week 1 Definition of Done.

## Order of operations

### Day 1 (today)
1. Unzip this into your existing repo, **next to** the `docker-compose.yml` and `pnpm-workspace.yaml` you already have. Confirm `git status` shows the new files as added.
2. **Replace** the docker-compose.yml in this scaffold over your existing one — it adds healthchecks and named volumes (your data persists across restarts).
3. **Replace** your existing `pnpm-workspace.yaml` with the one here — it includes `scripts/` as a workspace.
4. `pnpm install` at the repo root. It'll fetch every TS package: web, sidecar, shared, scripts.
5. `docker compose up -d` and verify both services healthy (`docker compose ps`).
6. Apply the migration: `psql -h localhost -U mnemo_user -d mnemo_db -f migrations/001_initial.sql`.

### Day 2
7. **Sidecar:** `cd apps/sidecar && pnpm dev` — visit http://localhost:3001/health, should return `{"ok":true,...}`.
8. **MemWal smoke test:** `cd scripts && pnpm exec tsx test-memwal.ts` — should print `✓ MemWal round trip OK`.
9. **Seed a test user:** `pnpm add -D pg` in `scripts/`, then `DATABASE_URL=postgresql://mnemo_user:mnemo_password@localhost:5432/mnemo_db pnpm exec tsx seed-user.ts`. Copy the proxy_token it prints.

### Day 3
10. **Proxy:** create venv, install requirements, set `DEV_OPENAI_KEY=sk-...` in `.env`, `uvicorn mnemo_proxy.main:app --port 8080 --reload`.
11. **Worker:** same in `apps/worker/`, set `OPENAI_API_KEY=sk-...`, `python -m mnemo_worker.main`.
12. **End-to-end test:** curl the proxy with the user_id + token from step 9. Check the worker logs — you should see "captured entry".
13. Query Postgres: `SELECT id, model, preview FROM entries;` — your conversation should be there.

### Day 4
14. **API:** set `OPENAI_API_KEY` in `apps/api/.env`, run on :8000.
15. Verify `/me` and `/search` work with `X-Dev-User: <your_user_id>`.

### Day 5–6
16. **Web app:** create Google OAuth client, get Enoki sandbox key, fill `apps/web/.env.local`, `pnpm dev`. Sign in with Google. See your Sui address on `/onboard`.
17. **Move:** `cd packages/move && sui move build && sui move test`. Publish to testnet, record the package ID.

### Day 7 (buffer)
18. Whatever broke. Document it. Move on to Week 2.

## Week 1 DOD checklist

- [ ] Proxy forwards `POST /v1/chat/completions` to OpenAI and streams the response back to curl.
- [ ] Worker captures the conversation; entry appears in `entries` table with a non-null embedding.
- [ ] `test-memwal.ts` round-trips a blob through the sidecar.
- [ ] `namespace.move` builds, tests pass, deployed to testnet.
- [ ] Web app boots, Google sign-in produces a Sui address visible on `/onboard`.

## When you hit a wall

Whatever the error, paste it into a fresh conversation with me along with:
- the exact command you ran
- the full stderr
- which file you were touching when it broke

I'll fix it. **Don't waste hours fighting environment issues alone**. The
hackathon clock is the enemy, not your pride.

## What we explicitly punted from this scaffold

These are NOT bugs — they're deliberately deferred. Build them in the
listed week:

| Week | Item |
|---|---|
| 2 | Replace MemWal mock in `apps/sidecar/src/memwal/client.ts` with real SDK |
| 2 | Replace Seal mock in `apps/sidecar/src/seal/client.ts` with real SDK |
| 2 | Real Enoki sponsored-transactions wiring on namespace creation |
| 2 | Wire `apps/web/app/onboard/page.tsx` step 2 + 3 (paste-key form, save via API) |
| 2 | `apps/web/app/search/page.tsx` (search UI calling `/search`) |
| 3 | Multi-namespace UI + switcher |
| 3 | Proper rate limiting on proxy |
| 3 | Dead-letter queue in worker |
| 4 | Walrus Sites deployment |
| 4 | Mainnet contract deployment |
| 4 | `inheritance.move` (only if there's slack) |
| 5 | Demo video |
| 5 | Threat model document |
