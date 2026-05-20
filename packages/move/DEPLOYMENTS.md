# Mnemo on-chain deployments

| Network | Package ID | Deployed at | Notes |
|---|---|---|---|
| testnet | 0x7b6c4130a57c3bfc8b4d123a2bc96f962932a7dbd73642fb70da0c8039d5b23d | 2026-05-20 | namespace + policy modules, v0.0.1 |
| mainnet | _TBD Week 4_ | — | — |

## Testnet deployment details

- **Deployer address:** `0x609502b084396f9f66feaf6809f88a7243d23105def5b75923cbec58193081e3`
- **UpgradeCap object:** `0xbf5a32c23fc979f15e46a88c53b6aa78b34443f27afee67adc3835cfff255472`
- **Transaction digest:** `B9n6PEG8MASrsuiTu4h7pLoLk6VF9cpVVLKHpFpj4uK6`
- **Explorer:** https://testnet.suivision.xyz/package/0x7b6c4130a57c3bfc8b4d123a2bc96f962932a7dbd73642fb70da0c8039d5b23d

## Modules

- **`namespace`** — Each user mints their own `Namespace` object via `create()`. Owned by their Sui address. Used as the access-control anchor for Seal decryption policies. Supports `rename()`.
- **`policy`** — Seal access policy. `has_access(ns, requester)` returns true iff the requester is the namespace owner. Called by Seal's threshold key servers during decryption-key issuance.