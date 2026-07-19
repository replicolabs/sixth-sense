import type { Keypair } from "@solana/web3.js";
import nacl from "tweetnacl";
import type { TxLineConfig } from "./config";

export interface TxLineSession {
  jwt: string;
  apiToken: string;
}

/**
 * `auth/guest/start` hangs off the domain root, NOT under /api/ — unlike
 * every other endpoint (confirmed empirically: the /api/-prefixed path
 * 401s at the CDN/WAF layer with an empty body, the root path 200s with a
 * real token). The leading "/" here is load-bearing: it makes URL
 * resolution ignore config.apiBase's "/api/" path segment and resolve
 * against the origin instead.
 */
async function guestStart(config: TxLineConfig): Promise<string> {
  const res = await fetch(new URL("/auth/guest/start", config.apiBase), {
    method: "POST",
    headers: { "Accept-Encoding": "gzip" },
  });
  if (!res.ok) {
    throw new Error(`guest/start failed: ${res.status} ${await res.text()}`);
  }
  const body = (await res.json()) as { token: string };
  return body.token;
}

/**
 * Message format confirmed from the txodds/tx-on-chain quickstart docs:
 * `${txSig}:${leagues.join(",")}:${jwt}`, or `${txSig}::${jwt}` when
 * leagues is empty (free/unfiltered bundle, which is our default —
 * World Cup real-time is Service Level 12, free tier, all leagues).
 */
function buildActivationMessage(txSig: string, leagues: number[], jwt: string): string {
  return `${txSig}:${leagues.join(",")}:${jwt}`;
}

/** Signature must be base64-encoded per the quickstart docs (not base58). */
function signActivationMessage(message: string, serviceWallet: Keypair): string {
  const signatureBytes = nacl.sign.detached(
    new TextEncoder().encode(message),
    serviceWallet.secretKey,
  );
  return Buffer.from(signatureBytes).toString("base64");
}

async function activateToken(
  config: TxLineConfig,
  jwt: string,
  txSig: string,
  serviceWallet: Keypair,
  leagues: number[] = [],
): Promise<string> {
  const message = buildActivationMessage(txSig, leagues, jwt);
  const walletSignature = signActivationMessage(message, serviceWallet);

  // No leading "api/" here — config.apiBase already ends in "/api/".
  const res = await fetch(new URL("token/activate", config.apiBase), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json",
      "Accept-Encoding": "gzip",
    },
    body: JSON.stringify({ txSig, walletSignature, leagues }),
  });
  if (!res.ok) {
    throw new Error(`token/activate failed: ${res.status} ${await res.text()}`);
  }
  return res.text();
}

/**
 * Full auth flow (CLAUDE.md Section 6.1, steps 2-4). `txSig` is the
 * signature of the on-chain `subscribe` transaction — see subscribe.ts.
 *
 * IMPORTANT (found by running against devnet, not documented anywhere):
 * `token/activate` is single-use per txSig — retrying it for a txSig that
 * already activated a token fails with 403 "This transaction has already
 * been used to activate a subscription". So this must only be called ONCE
 * per subscribe transaction, ever. Callers should use
 * `getOrActivateSession`, which caches the resulting apiToken via
 * TXLINE_API_TOKEN and only calls this when no cached token exists.
 */
export async function establishTxLineSession(
  config: TxLineConfig,
  txSig: string,
  serviceWallet: Keypair,
  leagues: number[] = [],
): Promise<TxLineSession> {
  const jwt = await guestStart(config);
  const apiToken = await activateToken(config, jwt, txSig, serviceWallet, leagues);
  return { jwt, apiToken };
}

/**
 * The guest JWT is cheap and safe to re-mint per call. The apiToken is not
 * — it's tied to the subscribe txSig and can only be minted once (see
 * establishTxLineSession's docs). Reuses TXLINE_API_TOKEN from the
 * environment if set; otherwise activates once and tells the caller to
 * persist the result so this doesn't happen again for the same txSig.
 */
export async function getOrActivateSession(
  config: TxLineConfig,
  txSig: string,
  serviceWallet: Keypair,
  leagues: number[] = [],
): Promise<TxLineSession> {
  const cachedApiToken = process.env.TXLINE_API_TOKEN;
  const jwt = await guestStart(config);
  if (cachedApiToken) {
    return { jwt, apiToken: cachedApiToken };
  }
  const apiToken = await activateToken(config, jwt, txSig, serviceWallet, leagues);
  console.warn(
    `No TXLINE_API_TOKEN cached — activated a new one. Add TXLINE_API_TOKEN=${apiToken} to .env ` +
      "so this txSig's one-time activation isn't wasted on the next run.",
  );
  return { jwt, apiToken };
}
