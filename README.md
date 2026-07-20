# Sixth Sense

**Call it before it happens.**

Sixth Sense is a live, second screen football prediction game. Every 30 to 90 seconds during a match, the app asks you to call the next moment on the pitch: will there be a goal in the next two minutes, will the next shot be on target, will there be a corner before the 40th minute. You tap yes or no, a countdown runs, and the real match resolves your call. Correct calls build a streak and earn points. Underneath, every session settles against real match data on Solana through cryptographic proofs, so no result can ever be disputed. The user never sees any of that. They see a fast, warm, addictive game.

This is a real, working product, not a demo shell. Every integration in this repository talks to the real thing: a real third party sports data feed (TxLINE, backed by TxOracle's on chain Merkle proofs), a real deployed Solana program, a real Postgres database, and real invisible embedded wallets through Privy. Nothing is mocked. Where a live dependency could not be reached during development (for example, no World Cup match happens to be live at the exact moment you are reading this), the code still does the real thing against real cached data rather than faking a result.

## Demo video

[![Watch the Sixth Sense demo](https://img.youtube.com/vi/lFGyHs8a-8w/maxresdefault.jpg)](https://youtu.be/lFGyHs8a-8w)

Can't see the embed above, or prefer to watch another way? [View the demo video on Google Drive](https://drive.google.com/drive/folders/1WvIWTfFylTnfZZely5PGWV6FBfZ0CKNr).

## Table of contents

- [What is actually built](#what-is-actually-built)
- [Architecture](#architecture)
- [Tech stack](#tech-stack)
- [Repository layout](#repository-layout)
- [Data model](#data-model)
- [The Solana program](#the-solana-program)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Running the app locally](#running-the-app-locally)
- [Admin and maintenance scripts](#admin-and-maintenance-scripts)
- [Testing](#testing)
- [Deployment](#deployment)
- [Credits](#credits)

## What is actually built

**Core loop.** A live match hero (score, clock, team flags), an event ticker of confirmed match events, a prediction card engine that reads match state (possession zone, imminent event hints, score, time) to surface a genuinely uncertain call, a countdown ring, win and loss reactions, streak and point tracking with a multiplier that rewards a longer run of correct calls.

**Invisible wallet and identity.** Sign in with email or a social login through Privy. A Solana wallet is created automatically behind the scenes. The user never sees the words wallet, seed phrase, gas, or transaction anywhere in the default UI.

**Real on chain settlement.** A deployed Anchor program on Solana devnet CPIs into TxOracle's `validate_stat` instruction with a real Merkle proof fetched from TxLINE, proving the match's final outcome actually happened, then records the result to a per user PDA. This is the anchor the "Provably Fair" badge points to.

**Replay Mode.** Real historical matches, captured once from TxLINE's short lived historical window and cached locally, replayed through the exact same pipeline a live match would use, on an accelerated clock. This is how the app is developed and demoed without waiting for a live match, and it is why the demo path never depends on anything being live at the time someone tries it.

**Live Mode.** A real consumer for TxLINE's live SSE stream, with sequence gap detection and snapshot based rehydration on reconnect, feeding the identical card engine and event pipeline that Replay Mode uses.

**Classics shelf.** A self built, searchable library of real matches the app captured and archived before TxLINE's historical window closed on them. Full text search over team names, competition, and editorial tags, backed by Postgres.

**Leaderboard.** Global and a simple share code based friends view, backed by real lifetime points persisted per user.

**Session summary and share card.** Real calls made, calls won, accuracy, best streak, and a settlement status with a link to the actual Solana transaction. A brand styled image is generated client side on a canvas and can be shared or downloaded.

**Avatars and kits.** A skin tone, hair, facial hair, and presentation avatar builder with no forced binary, plus a stylized, originally designed kit system (never a real club crest or name) unlocked through streaks, lifetime wins, matches played, and XP level. National kits use real national colors, since flags and national colors are not enforced the way corporate trademarks are. A wardrobe screen shows locked kits with a progress ring and lets you equip anything you have earned.

**Real flags for identification.** Match rows and the scoreboard show real national flags, sourced from a free, public domain flag CDN, cached in a small lookup table. Club crests are deliberately not integrated. The free tiers of the sports logo providers that would supply them have ambiguous commercial licensing, and every real fixture this app has ever handled is an international match anyway.

**Real money staking pools.** A weekly, pari mutuel staking pool built on top of the same settlement program. Users stake USDC or USDT on a week of upcoming matches before they kick off, scored with the same free game points engine, and paid out with a weighted rank curve that always sums exactly to the distributable pot. No KYC, no jurisdiction gate, by explicit direction. Ties share their band's payout evenly. Pools under a minimum participant floor refund everyone in full with no rake taken. A user's own embedded wallet signs their stake and their claim directly. Every other on chain write in this app is signed by a service wallet so the user's device never blocks on a signature.

**Positioning content.** Landing copy aimed at people who already like fast, live, outcome based action, speaking to the itch rather than naming or disparaging any competitor.

## Architecture

```
                     +-------------------------+
                     |   TxLINE / TxOracle      |
                     |  (real sports data feed  |
                     |   with on chain proofs)  |
                     +------------+-------------+
                                  |
                     one server credential only
                                  |
                     +------------v-------------+
                     |      apps/relay          |
                     |  Node WebSocket relay    |
                     |  - replay engine         |
                     |  - live engine           |
                     |  - card engine           |
                     +------------+-------------+
                                  |
                        WebSocket fan out
                                  |
                     +------------v---------------+
                     |       apps/web             |
                     |   Next.js app (App Router) |
                     |  - game UI                 |
                     |  - Privy embedded wallet   |
                     |  - all API routes          |
                     +----+---------+---------+---+
                          |         |         |
                +---------v--+ +----v----+ +--v------------------+
                |  Postgres   | | Solana  | |  TxLINE (server    |
                |  (Prisma)   | | devnet  | |  side proof fetch, |
                |             | | Anchor  | |  settlement worker)|
                +-------------+ | program | +--------------------+
                                +---------+
```

The browser never holds the TxLINE credential and never talks to TxLINE directly. The relay owns one long lived subscription and fans a single stream out to every connected client. Settlement is triggered server side from a Next.js API route after a session ends, using a service wallet, so the player's device is never blocked waiting on a signature except for the one real money action that is genuinely theirs: staking and claiming from a pool.

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4 |
| Animation | Framer Motion |
| Auth and invisible wallet | Privy React SDK, embedded Solana wallets |
| Realtime | WebSocket relay written in Node, `ws` |
| On chain | Anchor (Rust), deployed to Solana devnet |
| Database | PostgreSQL through Prisma |
| Client state | Zustand |
| Monorepo tooling | pnpm workspaces |

## Repository layout

```
/apps
  /web            Next.js app: every screen and every API route
  /relay          Node WebSocket relay: replay engine, live engine, card engine
/programs
  /sixth-sense    Anchor program (Rust): settlement and staking pools
/packages
  /shared         Pure TypeScript types and logic, no I/O
                  (scoring, card engine, kits, flags, countries, avatar options)
  /txline         TxLINE API client, settlement worker, pool instruction builders,
                  every admin and maintenance CLI script
  /db             Prisma schema and generated client
/fixtures         Cached real match event streams and real settlement proofs
/runbooks         Optional Surfpool and txtx deployment runbooks
```

### apps/web

The Next.js application. Every screen (`/`, `/play`, `/classics`, `/leaderboard`, `/pools`, `/pools/[poolId]`, `/avatar`, `/wardrobe`) and every API route lives here.

API routes:

| Route | Purpose |
|---|---|
| `GET/POST /api/avatar` | Load and save an avatar, auto grants the national kit |
| `GET /api/classics` | Full text search over archived matches |
| `GET /api/demo-match` | Phase 1 diagnostic: pulls one real fixture from TxLINE directly |
| `GET /api/leaderboard` | Global and friends code leaderboard |
| `GET /api/pools`, `GET /api/pools/[poolId]` | List and inspect staking pools |
| `POST /api/pools/[poolId]/join`, `POST /api/pools/[poolId]/claim` | Verify a client signed on chain transaction and mirror it into Postgres |
| `POST /api/sessions/complete` | Persists a finished session's predictions, updates lifetime stats, checks kit unlocks, and triggers the real settlement worker |
| `GET /api/team-assets/resolve` | Resolves a team name to a real flag URL and caches it |
| `GET /api/users/me`, `POST /api/users/sync` | Profile summary and first login upsert |
| `GET/POST /api/wardrobe`, `POST /api/wardrobe/equip` | List kit unlock progress and equip an unlocked kit |

### apps/relay

A standalone Node process. It owns the one and only connection to TxLINE's data, either replaying a cached fixture on an accelerated clock or consuming the real live SSE stream, runs the prediction card engine once per broadcast so every connected client sees the exact same call at the exact same moment, and fans everything out over a plain WebSocket server. Classics matches get their own private, per connection replay session instead of joining the shared broadcast.

### packages/shared

Pure logic and types with no network or database calls: the scoring engine, the card generation and resolution engine, the club and national kit catalog, the real flag resolver, the country list, and the avatar customization options. Both the relay and the web app import from here so the client and the server always agree on what a card means and how it resolves.

### packages/txline

Everything that talks to TxLINE or to the Solana program from server side code: authentication and session caching, the historical and live stream clients, fixture and proof caching, the settlement worker, the staking pool instruction builders, and every administrative CLI script.

### packages/db

The Prisma schema and a singleton client export, reused across the web app and the txline package.

## Data model

Ten models, backed by PostgreSQL through Prisma.

| Model | What it is |
|---|---|
| `User` | Identity, lifetime points, best streak, lifetime wins, matches played, XP and level |
| `Avatar` | Skin tone, hair, facial hair, presentation, nationality, equipped kit |
| `KitUnlock` | Which kits a user has earned and how |
| `MatchSession` | One played session: fixture, mode, points, best streak, calls made and won |
| `Prediction` | One resolved card within a session, including its settlement status and signature |
| `ArchivedMatch` | One Classics shelf entry, full text searchable |
| `Pool` | Off chain mirror of an on chain staking pool, for fast list and browse reads |
| `StakeEntry` | Off chain mirror of one user's stake in a pool |
| `TeamAssetMap` | Cached resolution from a team name to its real flag (and, if ever added, crest) URL |

The chain is always the source of truth for money. The `Pool` and `StakeEntry` tables exist purely so the pools screen never has to fan out RPC calls just to render a list.

## The Solana program

`programs/sixth-sense`, written in Anchor, deployed to Solana devnet at:

```
5eLFecutwEdSSF5v3FpKbnUpNL4YVD1mmBuZnFMRbUt9
```

This project uses Anchor 1.1.2, a newer major version line, not the older 0.3x versioning scheme. If you are used to older Anchor idioms, check the installed source under `node_modules` before assuming an API shape. Two real differences from what older training data or documentation might suggest: `CpiContext::new` takes a `Pubkey` for the program id argument, not an `AccountInfo`, and `init_user` takes a `payer` signer separate from the `owner` whose PDA is being created, specifically so a service wallet can set up a brand new player's on chain record without needing that player's live signature.

Instructions:

| Instruction | Purpose |
|---|---|
| `init_user` | Creates a per user record PDA |
| `settle_call` | CPIs into TxOracle's `validate_stat` with a real Merkle proof and records a proven outcome |
| `create_pool` | Admin only, opens a weekly staking pool and its vault |
| `join_pool` | Transfers a user's stake into the vault, enforced one entry per wallet |
| `lock_pool` | Permissionless, flips a pool from open to locked once its gameweek starts |
| `record_pool_score` | Permissionless, sums one user's already proven call records into their pool score |
| `settle_pool` | Ranks every participant and computes a weighted rank payout, or refunds everyone in full if the pool missed its minimum participant floor |
| `claim_payout` | Pull payment: a user claims their own computed share from the vault |

Settlement in the free game deliberately proves the match's final outcome once per session rather than every individual card. Proving every card would need its own real Merkle proof fetch and its own roughly 1.4 million compute unit transaction, which is not feasible in real time.

Building and deploying:

```bash
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
anchor build
anchor deploy --provider.cluster devnet
```

A Surfpool and txtx based runbook also exists under `runbooks/deployment` if you prefer infrastructure as code style deployment. See `runbooks/README.md`.

## Getting started

### Prerequisites

- Node.js 20 or newer
- pnpm 11
- PostgreSQL 15 or newer, reachable locally or remotely
- Rust and the Solana CLI, Anchor CLI (through AVM), only if you intend to modify or redeploy the on chain program
- A Privy account and app (for the invisible wallet)
- A TxLINE service wallet already subscribed on chain (see `packages/txline/src/subscribe.ts`)

### Install

```bash
git clone https://github.com/replicolabs/sixth-sense.git (or your forked repo)
cd sixth-sense
pnpm install
```

`pnpm install` will also run `packages/db`'s `postinstall` hook, which generates the Prisma client. If you ever see an error about `@prisma/client` having no exports, run `pnpm --filter @sixth-sense/db run generate` manually.

### Configure

Copy `.env.example` to `.env` at the repository root and fill in every value. The root `.env` is shared by every app and package in this monorepo, loaded explicitly regardless of which package's directory a command is run from.

### Set up the database

```bash
pnpm --filter @sixth-sense/db exec prisma migrate deploy
pnpm --filter @sixth-sense/db exec prisma generate
```

Use `prisma migrate dev` instead of `migrate deploy` only if you are actively authoring a new migration locally.

## Environment variables

All of these live in one root `.env` file.

### Cluster and TxLINE

```
SOLANA_CLUSTER=devnet                 # devnet | mainnet-beta, never hardcode a cluster anywhere else
TXLINE_API_BASE=https://txline-dev.txodds.com/api/
TXLINE_PROGRAM_ID=6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J
TXLINE_SERVICE_WALLET_SECRET=...      # server side only, base58 secret key
TXLINE_SERVICE_LEVEL_ID=1             # only row 1 exists on devnet's live pricing matrix
TXLINE_SUBSCRIPTION_WEEKS=4           # the on chain program enforces weeks % 4 == 0
TXLINE_SUBSCRIBE_TX_SIG=...           # output of the subscribe script, see below
TXLINE_API_TOKEN=...                  # cached activation token, single use per txSig, do not re-activate
SIXTH_SENSE_PROGRAM_ID=...            # documentation only, the real code hardcodes this per cluster
```

### Solana

```
SOLANA_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_SOLANA_CLUSTER=devnet
```

### Replay Mode

```
REPLAY_FIXTURE_ID=18241006            # cache one first with the cache-fixture script
REPLAY_ACCELERATION=6                 # 40x is a highlight reel speed, 6x is actually playable
NEXT_PUBLIC_REPLAY_ACCELERATION=6     # must match REPLAY_ACCELERATION exactly
```

### Live Mode (optional, mutually exclusive with Replay Mode's shared broadcast)

```
LIVE_FIXTURE_ID=...                   # a fixture id currently live on TxLINE, if you have one
```

### Privy

```
NEXT_PUBLIC_PRIVY_APP_ID=...
PRIVY_APP_SECRET=...
```

### Infrastructure

```
DATABASE_URL=postgresql://user:password@host:5432/sixth_sense
RELAY_WS_URL=ws://localhost:8080
NEXT_PUBLIC_RELAY_WS_URL=ws://localhost:8080
```

### Staking pools (test currency)

```
TEST_USDC_MINT=...                    # a self created devnet SPL mint, assumed 6 decimals throughout the UI
```

## Running the app locally

Three real processes, in three terminals.

```bash
# 1. The relay (WebSocket, replay or live engine, card engine)
pnpm --filter @sixth-sense/relay dev

# 2. The web app
pnpm --filter @sixth-sense/web dev

# 3. Postgres, however you run it locally
```

Open `http://localhost:3000`. The home page's demo CTA plays a real, cached, dramatic World Cup match (England versus Argentina, a real comeback) with zero live dependencies at all, including its settlement proof.

## Admin and maintenance scripts

All of these live in `packages/txline` and are real scripts against real infrastructure, never against a mock.

| Script | Purpose |
|---|---|
| `pnpm --filter @sixth-sense/txline subscribe` | One time on chain subscription to TxLINE, run with a funded service wallet |
| `pnpm --filter @sixth-sense/txline list-fixtures` | List fixtures from a given epoch day |
| `pnpm --filter @sixth-sense/txline cache-fixture` | Cache a fixture's full event stream to `/fixtures` for Replay Mode |
| `pnpm --filter @sixth-sense/txline archive-fixture` | Cache a fixture's events and a real settlement proof, then insert it into the Classics shelf |
| `pnpm --filter @sixth-sense/txline create-pool` | Create a real weekly staking pool on chain and mirror it into Postgres |
| `pnpm --filter @sixth-sense/txline pool-admin` | Lock a pool, record participant scores, or settle a pool, with `MODE=lock\|record-scores\|settle` |
| `pnpm --filter @sixth-sense/txline test-settle-call` | Integration test of `settle_call` against a real devnet proof |
| `pnpm --filter @sixth-sense/txline test-pool-lifecycle` | Full real devnet integration test of the staking pool lifecycle |

Environment variables for each script are documented in a comment at the top of its file. Run any script with no arguments to see what it requires.

## Testing

This project has no unit test suite in the conventional sense. Its testing philosophy, set from the start, is that every feature must be checked against real infrastructure before being called done: a real devnet transaction, a real query against a real Postgres database, a real browser session against a running dev server, a real deliberately induced crash to prove reconnect logic actually recovers. `pnpm -r typecheck` at the repository root runs TypeScript across every package and app and should always be clean.

```bash
pnpm -r typecheck
```

For the on chain program, `packages/txline/src/test-settle-call.ts` and `test-pool-lifecycle.ts` are real integration tests runnable against either a local Surfpool validator or real devnet, by setting `TEST_RPC_URL`.

## Deployment

The frontend (`apps/web`) deploys to Vercel. The relay (`apps/relay`) and Postgres deploy to Railway, since a long lived WebSocket process and a stateful database are not a fit for a serverless platform.

In short:

- Vercel: root directory `apps/web`, standard Next.js build, environment variables as listed above (the `NEXT_PUBLIC_` ones plus every server side secret the API routes need: TxLINE credentials, the Solana RPC URL, and the database URL).
- Railway: one service running `pnpm --filter @sixth-sense/relay start` from the repository root (so pnpm can resolve the workspace dependencies between the relay and `packages/shared` and `packages/txline`), plus a Postgres addon whose public connection string becomes Vercel's `DATABASE_URL`. The relay in Replay Mode needs no TxLINE or Solana secrets at all, since it only reads the committed fixture cache files.
- Run `prisma migrate deploy` against the production database once, and again after any future migration.
- Railway assigns its own port through a `PORT` environment variable, which the relay reads and binds to automatically.

Note on Prisma and serverless: Vercel's serverless functions do not reuse database connections the way a long lived server does. Add `?connection_limit=5` to the production `DATABASE_URL` to keep this sane at this project's current scale. If you ever see connection exhaustion under real traffic, that is the point to look at a pooler such as PgBouncer or Prisma Accelerate in front of Postgres, not before.

`target/idl/sixth_sense.json`, the generated Anchor IDL, is deliberately excluded from `.gitignore`'s otherwise blanket exclusion of `target/`. Three files import it statically at build time, and a fresh checkout with no local `anchor build` step (which is exactly what Vercel does) needs it present in the repository.

## Credits

Real match data and on chain proofs from TxLINE and TxOracle. Invisible wallets and authentication from Privy. Built on Solana with Anchor. Flags from flagcdn.com, a free service of flagpedia.net, used under their stated public domain terms.
