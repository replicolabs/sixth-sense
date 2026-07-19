import { config } from "dotenv";
import { resolve } from "node:path";

/**
 * `pnpm --filter <pkg> run <script>` runs with cwd set to that package's
 * directory, not the monorepo root — so a bare `import "dotenv/config"`
 * silently finds no .env file there and every env var comes back
 * `undefined`. Load the root .env explicitly instead.
 *
 * `process.cwd()`-relative, NOT `import.meta.url`-relative — the latter
 * (a `new URL('../../../.env', import.meta.url)` literal) broke a real
 * Vercel build: Turbopack statically detects that exact two-argument
 * `new URL(literal, import.meta.url)` shape as an asset reference and
 * tries to resolve `.env` at BUILD time, which fails since `.env` is
 * gitignored and never reaches the Vercel checkout — even though nothing
 * in apps/web's runtime path ever actually calls this function (Turbopack
 * doesn't care; the mere presence of the pattern in the module graph is
 * enough to fail the build). `process.cwd()` is a plain runtime call the
 * bundler can't (and doesn't need to) statically resolve, and every real
 * place this runs from — `pnpm --filter @sixth-sense/relay start`/`dev`,
 * `pnpm --filter @sixth-sense/txline`'s CLI scripts, Next's own build —
 * sits exactly two directories below the repo root.
 */
export function loadRootEnv(): void {
  const root = resolve(process.cwd(), "../../.env");
  config({ path: root });
}
