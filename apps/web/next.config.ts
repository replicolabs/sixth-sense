import { config } from "dotenv";
import type { NextConfig } from "next";
import path from "node:path";

// Next.js only auto-loads .env* from this app's own directory. Our env vars
// live in the monorepo root .env (CLAUDE.md Section 14) since they're
// shared with apps/relay and packages/txline — load that explicitly.
config({ path: path.resolve(__dirname, "../../.env") });

const nextConfig: NextConfig = {
  // Workspace packages ship raw TS (no build step) — Next must transpile
  // them itself instead of treating them as pre-built external modules.
  transpilePackages: ["@sixth-sense/shared", "@sixth-sense/txline"],
  // @coral-xyz/anchor's ESM build conditionally attaches its `Wallet`
  // export via a runtime `require("./nodewallet.js")` inside what's
  // nominally an ESM module — real Node.js (tsx, the CLI scripts under
  // packages/txline) resolves this fine, but Turbopack's static export
  // analysis can't see through the dynamic require and fails API routes
  // that import it (packages/txline/src/pool-chain.ts) with "Export
  // Wallet doesn't exist in target module". Marking it external tells
  // Next to leave it as a plain `require`/`import` for server code
  // instead of trying to statically bundle it.
  serverExternalPackages: ["@coral-xyz/anchor"],
};

export default nextConfig;
