# apps/proxy

Python FastAPI proxy. AI tools point their OpenAI/Anthropic base URL at this
service. We forward to the real provider and asynchronously capture every
exchange for storage.

## Endpoints

| Method | Path | Forwards to |
|---|---|---|
| GET | `/health` | — |
| POST | `/u/{user_id}/v1/chat/completions` | OpenAI |
| POST | `/u/{user_id}/v1/embeddings` | OpenAI (no capture) |
| POST | `/u/{user_id}/anthropic/v1/messages` | Anthropic |

Auth: `Authorization: Bearer <proxy_token>` (the per-user token from `users.proxy_token`).

## Run

```bash
python -m venv .venv
source .venv/bin/activate   # PowerShell: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
cp .env.example .env
# edit .env — set DEV_OPENAI_KEY for Week 1 testing
uvicorn mnemo_proxy.main:app --port 8080 --reload
```

## Test it

```bash
# Seed a test user first (see SETUP.md step 9)
curl http://localhost:8080/u/00000000-0000-0000-0000-000000000001/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-token-week1" \
  -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"Hello in 5 words."}]}'
```

## Streaming

Both OpenAI and Anthropic streaming are supported. The proxy forwards each
SSE line to the client immediately and reconstructs the full message
server-side for the capture job.

## What's mocked in Week 1

`upstream_keys.py` falls back to `DEV_OPENAI_KEY` / `DEV_ANTHROPIC_KEY` env
vars. Week 2 replaces this with a sidecar call to Seal-decrypt the stored key.

## What is NOT here yet

- Rate limiting (Week 3)
- Per-tool routing (Week 3)
- Mainnet observability (Week 4)
