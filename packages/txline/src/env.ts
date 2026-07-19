import { config } from "dotenv";
import { fileURLToPath } from "node:url";

/**
 * `pnpm --filter <pkg> run <script>` runs with cwd set to that package's
 * directory, not the monorepo root — so a bare `import "dotenv/config"`
 * silently finds no .env file there and every env var comes back
 * `undefined`. Load the root .env explicitly, regardless of cwd.
 */
export function loadRootEnv(): void {
  const root = fileURLToPath(new URL("../../../.env", import.meta.url));
  config({ path: root });
}
