# apps/worker

Async capture worker. Consumes jobs the proxy enqueues, embeds the
conversation, asks the sidecar to encrypt + persist to Walrus, and records
the row in Postgres.

## Run

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # set OPENAI_API_KEY
python -m mnemo_worker.main
```

Logs every captured entry. Failures are logged and dropped in Week 1; a
DLQ is added in Week 3.
