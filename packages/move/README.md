# packages/move

Sui Move smart contracts for Mnemo.

## Modules

- `namespace.move` — user-owned `Namespace` objects. Each user can create
  multiple namespaces; the namespace object is the access-control anchor for
  Seal decryption policies.
- `policy.move` — Seal access policy. v1 rule: only namespace owner decrypts.

## Build & test (locally)

```bash
sui move build
sui move test
```

## Deploy to testnet

```bash
sui client switch --env testnet
sui client publish --gas-budget 100000000
```

Record the resulting package ID and namespace registry object IDs in
`DEPLOYMENTS.md`. Update every service's `.env` with the package ID.

## Deploy to mainnet (Week 4)

```bash
sui client switch --env mainnet
sui client publish --gas-budget 100000000
```

## What we are NOT building yet

- `inheritance.move` (time-locked recipient) — Week 4 stretch only
- Multi-arbitrator policies — out of scope for hackathon
- Token-gated namespaces — out of scope for hackathon
