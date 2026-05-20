# scripts/

One-off helper scripts.

| Script | What it does |
|---|---|
| `test-memwal.ts` | Round-trips a blob through the sidecar (Seal + MemWal). Week 1 DOD smoke test. |
| `seed-user.ts` | Seeds a test user + namespace so you can hit the proxy with curl. |

```bash
pnpm install
pnpm exec tsx test-memwal.ts
DATABASE_URL=postgresql://mnemo_user:mnemo_password@localhost:5432/mnemo_db pnpm exec tsx seed-user.ts
```
