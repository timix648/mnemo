# apps/worker

Async capture worker. Consumes jobs the proxy enqueues on Redis, generates an embedding, hands the payload to the Node sidecar (which bridges to the MemWal relayer for Seal encryption + Walrus storage + Sui indexing), and records the memory row in Postgres.

## Run

```bash
python -m venv .venv
source .venv/bin/activate   # PowerShell: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
cp .env.example .env
python -m mnemo_worker.main
```

## Configuration (.env)

| Variable | Purpose |
|---|---|
| `REDIS_URL` | Capture queue, port `6380` |
| `SIDECAR_URL` | Node sidecar (`http://localhost:3001`) |
| `DATABASE_URL` | Postgres (pgvector), port `5433` |

## Reliability

Each job is embedded, sent to the relayer for Seal encryption and Walrus upload, then indexed. Failed jobs are retried with backoff and, on exhaustion, moved to a dead letter queue rather than dropped — so a transient provider, relayer, or network error does not lose a capture. Every processed entry is logged with its Walrus blob ID and onchain object ID.