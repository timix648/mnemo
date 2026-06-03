# apps/api

Mnemo management API. Backs the web app — profile, provider keys, semantic search, memory list, sponsored transactions, and onchain status.

Runs on port `8001`.

## Run

```bash
python -m venv .venv
source .venv/bin/activate   # PowerShell: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
cp .env.example .env
uvicorn mnemo_api.main:app --port 8001 --reload
```

(On Windows, `start-api.ps1` launches it on `8001` with the right inline env.)

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Liveness |
| GET / PATCH / DELETE | `/me` | Current user + namespace + proxy URL; edit profile; delete account |
| DELETE | `/namespaces/{ns_id}` | Remove a namespace (chain object persists) |
| GET / DELETE | `/memories/{memory_id}` | Fetch or soft delete a captured memory |
| POST | `/keys/validate` · DELETE `/keys/{provider}` | Validate / revoke a provider key |
| POST | `/search` | Semantic search across the user's memory |
| POST | `/sponsor/execute` | Execute an Enoki sponsored transaction |
| GET | `/sui/status` | Onchain / Tatum RPC status |

## Configuration (.env)

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres (pgvector), port `5433` |
| `SIDECAR_URL` | Node sidecar (`http://localhost:3001`) |
| `CORS_ALLOWED_ORIGINS` | Web app origin(s) |
| `ENOKI_SECRET_KEY` / `ENOKI_NETWORK` | zkLogin + sponsored tx |
| `MNEMO_PACKAGE_ID` | Onchain package |
| `FERNET_KEY` | Key envelope encryption |
| `TATUM_RPC_URL` / `TATUM_API_KEY` | Sui RPC via Tatum |

## Auth

Identity is the zkLogin derived Sui address, asserted over an authenticated channel in the closed testnet beta. Full server side JWT re verification is the scoped mainnet step, gated behind a config flag in `mnemo_api/auth.py`.