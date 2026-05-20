# apps/sidecar

Node + TypeScript bridge service that exposes the MemWal and Seal SDKs over
HTTP. The Python services (proxy, worker, api) call it for any operation that
needs the Mysten Labs SDKs (which are Node-only).

## Run

```bash
pnpm install
cp .env.example .env
pnpm dev
# http://localhost:3001/health
```

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Liveness |
| POST | `/memwal/remember` | Write encrypted blob via MemWal |
| POST | `/memwal/recall` | Read encrypted blob via MemWal |
| POST | `/seal/encrypt` | Seal-encrypt plaintext under a policy |
| POST | `/seal/decrypt` | Seal-decrypt ciphertext under a policy |

## Week 1 status

Both MemWal and Seal are **mocked**. The interfaces are stable; the
implementations will be replaced in Week 2 once we've verified the SDK
APIs against the actual repos. The mocks let the rest of the stack run
end-to-end against an in-memory blob store. **Do not demo against the mocks** —
they are not real encryption.

## Week 2 TODOs

- [ ] Install `@mysten-incubation/memwal`, replace `src/memwal/client.ts`
- [ ] Install `@mysten/seal`, replace `src/seal/client.ts`
- [ ] Wire the delegate Sui keypair from env
- [ ] Add integration tests against testnet
