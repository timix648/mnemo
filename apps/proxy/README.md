# apps/proxy

Python FastAPI proxy. AI tools (Cursor, Chatbox, Claude, ChatGPT, or anything with a custom OpenAI/Anthropic endpoint) set their base URL to this service. The proxy forwards the request to the real provider and asynchronously captures every exchange for encrypted storage.

Runs on port `8080`.

## Endpoints

| Method | Path | Forwards to |
|---|---|---|
| GET | `/health` | — |
| POST | `/u/{user_id}/v1/chat/completions` | OpenAI (captured) |
| POST | `/u/{user_id}/v1/embeddings` | OpenAI (not captured) |
| POST | `/u/{user_id}/anthropic/v1/messages` | Anthropic (captured) |

Auth: `Authorization: Bearer <proxy_token>` — the per user token from `users.proxy_token`.

## Run

```bash
python -m venv .venv
source .venv/bin/activate   # PowerShell: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
cp .env.example .env        # see Configuration below
uvicorn mnemo_proxy.main:app --port 8080 --reload
```

## Configuration (.env)

| Variable | Purpose |
|---|---|
| `PROXY_HOST` / `PROXY_PORT` | Bind address (default `0.0.0.0:8080`) |
| `DATABASE_URL` | Postgres (pgvector), port `5433` |
| `REDIS_URL` | Redis capture queue, port `6380` |
| `SIDECAR_URL` | Node sidecar (`http://localhost:3001`) |
| `OPENAI_BASE_URL` / `ANTHROPIC_BASE_URL` | Upstream providers |
| `CAPTURE_ENABLED` | Toggle async capture |
| `MNEMO_PACKAGE_ID` / `FERNET_KEY` | Onchain package + key envelope |

## Capture flow

On a captured request, the proxy streams the provider response to the client immediately, reconstructs the full exchange server side, and enqueues a capture job on Redis. The worker then embeds it, the relayer Seal encrypts it and stores it on Walrus, and the row is indexed in Postgres. Streaming (SSE) is supported for both OpenAI and Anthropic.

## Notes

Provider keys: in the closed testnet beta the proxy can use an env supplied provider key on the request path (provider keys are used unattended, where Seal's user authorized model does not fit). Stored provider keys are envelope encrypted at rest; user memories are Seal encrypted. See the root `README.md` security notes.