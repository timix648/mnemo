# apps/sidecar

Node + TypeScript bridge service. The Python services (proxy, worker, api) are Python, but the Sui, Seal, and MemWal SDKs are Node only — the sidecar exposes the operations they need over HTTP and forwards them to the self hosted MemWal relayer, which performs the actual encryption and onchain work.

Runs on port `3001`.

## Run

```bash
pnpm install
cp .env.example .env
pnpm dev
# GET http://localhost:3001/health
```

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Liveness |
| POST | `/memwal/remember` | Embed, Seal encrypt, store on Walrus, index on Sui (via relayer) |
| POST | `/memwal/recall` | Semantic recall: resolve blobs and decrypt |
| POST | `/memwal/fetch` | Fetch and decrypt a specific memory |

## Configuration (.env)

| Variable | Purpose |
|---|---|
| `PORT` | Bind port (default `3001`) |
| `SUI_NETWORK` / `SUI_RPC_URL` | Sui testnet |
| `RELAYER_URL` | MemWal relayer (`http://localhost:8000`) |
| `SIDECAR_DELEGATE_SUI_KEY` | Delegate wallet that signs Walrus writes |
| `MNEMO_PACKAGE_ID` / `MNEMO_ACCOUNT_ID` | Onchain package + account |

## Architecture

The sidecar does not mock encryption. It bridges to the MemWal relayer (a self hosted fork of MystenLabs/MemWal), which runs real Seal threshold encryption (2 of 2 testnet key servers), real Walrus testnet storage, and real Sui indexing. Decryption is gated by the forked `account::seal_approve` policy — including the heir / dead man's switch condition. See the root `README.md` and `packages/move/SDK_NOTES.md`.