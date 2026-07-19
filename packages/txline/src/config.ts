import type { SolanaCluster } from "@sixth-sense/shared";

export interface TxLineConfig {
  cluster: SolanaCluster;
  apiBase: string;
  programId: string;
  solanaRpcUrl: string;
  /**
   * The TXLINE SPL token mint used by `subscribe`. This is NOT the same
   * address on devnet vs mainnet (confirmed against the devnet quickstart
   * docs) — the mainnet mint is also the only one baked into the vendored
   * IDL's `constants` section, so it must never be read from there directly.
   */
  txlineMint: string;
}

const DEVNET_PROGRAM_ID = "6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J";
const MAINNET_PROGRAM_ID = "9ExbZjAapQww1vfcisDmrngPinHTEfpjYRWMunJgcKaA";

const DEVNET_API_BASE = "https://txline-dev.txodds.com/api/";
const MAINNET_API_BASE = "https://txline.txodds.com/api/";

const DEVNET_TXLINE_MINT = "4Zao8ocPhmMgq7PdsYWyxvqySMGx7xb9cMftPMkEokRG";
const MAINNET_TXLINE_MINT = "Zhw9TVKp68a1QrftncMSd6ELXKDtpVMNuMGr1jNwdeL";

/**
 * Resolves every cluster-dependent value from SOLANA_CLUSTER. This is the
 * only function in the codebase allowed to branch on cluster — everything
 * else must read from the returned config. Never hardcode a program ID or
 * base URL anywhere else (CLAUDE.md Section 0, rule 3).
 */
export function loadTxLineConfig(env: NodeJS.ProcessEnv = process.env): TxLineConfig {
  const cluster = (env.SOLANA_CLUSTER ?? "devnet") as SolanaCluster;

  if (cluster !== "devnet" && cluster !== "mainnet-beta") {
    throw new Error(
      `SOLANA_CLUSTER must be "devnet" or "mainnet-beta", got "${cluster}"`,
    );
  }

  const apiBase = env.TXLINE_API_BASE ?? (cluster === "devnet" ? DEVNET_API_BASE : MAINNET_API_BASE);
  const programId =
    env.TXLINE_PROGRAM_ID ?? (cluster === "devnet" ? DEVNET_PROGRAM_ID : MAINNET_PROGRAM_ID);
  const solanaRpcUrl =
    env.SOLANA_RPC_URL ??
    (cluster === "devnet" ? "https://api.devnet.solana.com" : "https://api.mainnet-beta.solana.com");
  const txlineMint =
    env.TXLINE_MINT ?? (cluster === "devnet" ? DEVNET_TXLINE_MINT : MAINNET_TXLINE_MINT);

  return { cluster, apiBase, programId, solanaRpcUrl, txlineMint };
}
