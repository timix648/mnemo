# apps/web

Mnemo's frontend — a Next.js (App Router, TypeScript) single page app with a deep sea themed UI. It is statically exported and hosted on Walrus Sites, and talks to the Mnemo management API (`apps/api`) for search, keys, memories, and inheritance.

## Pages

| Route | Purpose |
|---|---|
| `/` | Landing (video background, product pitch) |
| `/how-it-works` | Explainer |
| `/onboard` | Profile setup after sign in |
| `/chats` | Browse captured conversations (My Memory) |
| `/search` | Semantic search across your memory |
| `/settings` | Profile, API keys, heartbeat, inheritance, export |
| `/auth/callback` | zkLogin OAuth callback |

## Run

```bash
pnpm install
pnpm dev
# http://localhost:3000
```

Set `NEXT_PUBLIC_API_BASE` to the management API URL (defaults to `http://127.0.0.1:8001`). zkLogin uses `NEXT_PUBLIC_ENOKI_API_KEY` and `NEXT_PUBLIC_GOOGLE_CLIENT_ID`.

## Build and deploy (Walrus Sites)

```bash
pnpm build        # static export -> apps/web/out/
```

`next.config.ts` sets `output: "export"`, `images.unoptimized`, and `trailingSlash` so the app exports as fully static files and deep link refreshes resolve on a static host. The contents of `out/` are published to Walrus Sites with the `site-builder` CLI. For sign in to work on a deployed origin, register that origin's `/auth/callback` URL in the Google OAuth client and the Enoki allowed origins.

## Stack

Next.js + TypeScript, dapp-kit / Enoki for zkLogin, plain `<img>` assets (no `next/image`, for static export). Sign in is passwordless Google via zkLogin; gas is sponsored via Enoki.