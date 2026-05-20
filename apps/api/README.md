# apps/api

Mnemo management API. Backs the web app — namespaces, keys, search, /me.

## Run

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # set OPENAI_API_KEY for /search
uvicorn mnemo_api.main:app --port 8000 --reload
```

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Liveness |
| GET | `/me` | Current user + default namespace + proxy URL |
| GET | `/namespaces` | List user's namespaces |
| POST | `/namespaces` | Create namespace (after web app mints it on chain) |
| DELETE | `/namespaces/{id}` | Remove namespace (chain object persists) |
| GET | `/keys` | List provider keys (metadata only) |
| POST | `/keys` | Save provider key reference (Seal-encrypted blob ID + policy) |
| DELETE | `/keys/{provider}` | Revoke a provider key |
| POST | `/search` | Semantic search across a namespace |

## Dev auth header

For local testing without going through Enoki, pass `X-Dev-User: <uuid>` to
any endpoint. Set `ALLOW_DEV_HEADER=false` before production.
