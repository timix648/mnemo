# Setup (Windows-first)

This walks you through getting every service running locally on Windows. Assumes you've already followed the pre-build checklist (Node 20, pnpm, Python 3.11, Docker Desktop, Rust + `site-builder`).

## Step 0 — Open three terminals

You'll need at least 4–5 terminals running simultaneously by the end. PowerShell is fine. Recommend Windows Terminal with tabs.

## Step 1 — Bring up Postgres + Redis

```powershell
docker compose up -d
docker compose ps    # confirm both containers are Up and healthy
```

Postgres listens on `localhost:5432`. Redis listens on `localhost:6380` (we remapped from 6379 to avoid your existing Redis on that port).

## Step 2 — Apply the database schema

Either use `psql` (if you have it) or DBeaver / pgAdmin / TablePlus:

```powershell
# With psql (install via "scoop install postgresql" or use the Postgres installer)
psql -h localhost -U mnemo_user -d mnemo_db -f migrations/001_initial.sql
# Password is "mnemo_password" (set in docker-compose.yml)
```

Confirm tables exist:
```sql
\dt
-- should list: users, namespaces, provider_keys, entries
```

## Step 3 — Configure environment variables

Each service has a `.env.example` — copy each to `.env` and edit:

```powershell
copy apps\proxy\.env.example apps\proxy\.env
copy apps\api\.env.example apps\api\.env
copy apps\worker\.env.example apps\worker\.env
copy apps\sidecar\.env.example apps\sidecar\.env
copy apps\web\.env.local.example apps\web\.env.local
```

Fill in:
- `OPENAI_API_KEY` (your test key) — used by the worker for embeddings
- `DEV_OPENAI_KEY` (a separate test key, can be the same) — used by the proxy as a fake "user-supplied" key during Week 1
- `ENOKI_PUBLIC_API_KEY` (from enoki.mystenlabs.com, sandbox tier)
- `GOOGLE_CLIENT_ID` (from Google Cloud Console — see `apps/web/README.md`)

## Step 4 — Start the sidecar (Node)

```powershell
cd apps\sidecar
pnpm install
pnpm dev
# listens on http://localhost:3001
# GET http://localhost:3001/health  should return {"ok": true}
```

## Step 5 — Start the proxy (Python)

In a new terminal:
```powershell
cd apps\proxy
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn mnemo_proxy.main:app --port 8080 --reload
```

## Step 6 — Start the API (Python)

In a new terminal:
```powershell
cd apps\api
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn mnemo_api.main:app --port 8000 --reload
```

## Step 7 — Start the worker (Python)

In a new terminal:
```powershell
cd apps\worker
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m mnemo_worker.main
```

## Step 8 — Start the web app

In a new terminal:
```powershell
cd apps\web
pnpm install
pnpm dev
# open http://localhost:3000
```

## Step 9 — Sanity test the proxy

In a new terminal (with one of your OpenAI keys set in `DEV_OPENAI_KEY`):

```powershell
# Insert a test user manually first
psql -h localhost -U mnemo_user -d mnemo_db -c "INSERT INTO users (id, sui_address, proxy_token) VALUES ('00000000-0000-0000-0000-000000000001', '0xabc', 'test-token-week1') ON CONFLICT DO NOTHING;"

# Hit the proxy (PowerShell)
curl http://localhost:8080/u/00000000-0000-0000-0000-000000000001/v1/chat/completions `
  -H "Content-Type: application/json" `
  -H "Authorization: Bearer test-token-week1" `
  -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"Say hello in exactly 5 words."}]}'
```

You should get a real OpenAI response back. Check the worker logs — you should see a capture job processed.

## Step 10 — Run the MemWal test script

```powershell
cd scripts
pnpm install
pnpm exec ts-node test-memwal.ts
```

Expected: writes a test blob, reads it back, prints the round-trip latency.

## Step 11 — Deploy namespace.move to testnet

```powershell
cd packages\move
sui move build
sui client publish --gas-budget 100000000
# Record the package ID printed in the output to packages/move/DEPLOYMENTS.md
```

## Troubleshooting

- **Port 5432 in use:** edit `docker-compose.yml` to map to 5433 and update `DATABASE_URL` in all `.env` files.
- **`pnpm install` slow:** Windows Defender exclusion for the repo directory helps. Add the project root to exclusions in Windows Security.
- **`uvicorn --reload` reloads on EVERY save:** that's intended, but if it gets stuck, kill with Ctrl+C and restart.
- **Worker fails to connect to Redis:** confirm `REDIS_URL=redis://localhost:6380/0` (note the 6380, not 6379).
- **`sui move build` fails:** make sure you're on the testnet branch: `sui client switch --env testnet`.
