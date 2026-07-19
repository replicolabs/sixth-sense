/**
 * Diagnostic: fetches and prints the live on-chain pricing_matrix account
 * for the current cluster. The pricing matrix is runtime state, not
 * something the IDL encodes statically, and it has already been caught
 * disagreeing with CLAUDE.md's "Service Level 12" claim once (devnet only
 * has row_id 1) — run this before trusting any TXLINE_SERVICE_LEVEL_ID
 * value against a cluster you haven't checked yet.
 *
 * Usage: pnpm --filter @sixth-sense/txline check-pricing
 */
import { AnchorProvider, Program, Wallet, type Idl } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import { loadTxLineConfig } from "./config";
import { loadRootEnv } from "./env";
import idl from "../idl/txoracle.json" with { type: "json" };

loadRootEnv();

async function main() {
  const config = loadTxLineConfig();
  const secret = process.env.TXLINE_SERVICE_WALLET_SECRET;
  if (!secret) throw new Error("TXLINE_SERVICE_WALLET_SECRET is not set");

  const kp = Keypair.fromSecretKey(bs58.decode(secret.trim()));
  const conn = new Connection(config.solanaRpcUrl, "confirmed");
  const provider = new AnchorProvider(conn, new Wallet(kp), { commitment: "confirmed" });
  // Override the IDL's embedded (mainnet) address with the cluster-resolved one.
  const program = new Program({ ...idl, address: config.programId } as Idl, provider);

  const [pricingMatrixPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("pricing_matrix")],
    program.programId,
  );
  console.log(`cluster: ${config.cluster}`);
  console.log(`program id: ${program.programId.toBase58()}`);
  console.log(`pricing_matrix PDA: ${pricingMatrixPda.toBase58()}`);

  const acct = await (program.account as { pricingMatrix: { fetch: (pda: PublicKey) => Promise<{
    admin: PublicKey;
    rows: {
      rowId: number;
      pricePerWeekToken: { toString(): string };
      samplingIntervalSec: number;
      leagueBundleId: number;
      marketBundleId: number;
    }[];
  }> } }).pricingMatrix.fetch(pricingMatrixPda);

  console.log(`admin: ${acct.admin.toBase58()}`);
  console.log("rows:");
  for (const r of acct.rows) {
    console.log(
      `  rowId=${r.rowId} pricePerWeekToken=${r.pricePerWeekToken.toString()} ` +
        `samplingIntervalSec=${r.samplingIntervalSec} leagueBundleId=${r.leagueBundleId} ` +
        `marketBundleId=${r.marketBundleId}`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
