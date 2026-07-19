/**
 * One-time (well, once-per-subscription-period, currently 7 days per the
 * txoracle IDL's SUBSCRIPTION_DURATION constant) on-chain setup step.
 *
 * Run with: pnpm --filter @sixth-sense/txline subscribe
 *
 * Requires TXLINE_SERVICE_WALLET_SECRET (a base58 or JSON-array secret key)
 * to already hold devnet SOL for fees, per CLAUDE.md Section 6.1 step 1.
 *
 * CLAUDE.md states World Cup real-time is "Service Level 12" — but the live
 * devnet pricing_matrix account (fetched and deserialized directly, PDA
 * ["pricing_matrix"] under the devnet program) has exactly ONE row:
 * { rowId: 1, pricePerWeekToken: 0, samplingIntervalSec: 0, leagueBundleId: 1,
 * marketBundleId: 2 }. There is no row 12 on devnet. Defaulting to 1, the
 * only real, free, currently-live row — override via TXLINE_SERVICE_LEVEL_ID
 * if that ever changes.
 */
import anchorPkg from "@coral-xyz/anchor";
import type { Idl } from "@coral-xyz/anchor";
const { AnchorProvider, Program, Wallet } = anchorPkg;
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { Connection, Keypair, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import bs58 from "bs58";
import { loadTxLineConfig } from "./config";
import { loadRootEnv } from "./env";
import idl from "../idl/txoracle.json" with { type: "json" };

loadRootEnv();

function loadServiceWallet(): Keypair {
  const raw = process.env.TXLINE_SERVICE_WALLET_SECRET;
  if (!raw) {
    throw new Error("TXLINE_SERVICE_WALLET_SECRET is not set");
  }
  const trimmed = raw.trim();
  if (trimmed.startsWith("[")) {
    return Keypair.fromSecretKey(new Uint8Array(JSON.parse(trimmed)));
  }
  return Keypair.fromSecretKey(bs58.decode(trimmed));
}

async function main() {
  const config = loadTxLineConfig();
  const serviceWallet = loadServiceWallet();
  const serviceLevelId = Number(process.env.TXLINE_SERVICE_LEVEL_ID ?? 1);
  // Program enforces weeks % 4 === 0 (AnchorError InvalidWeeks, confirmed by
  // running against devnet) — not documented anywhere, found empirically.
  const weeks = Number(process.env.TXLINE_SUBSCRIPTION_WEEKS ?? 4);

  const connection = new Connection(config.solanaRpcUrl, "confirmed");
  const provider = new AnchorProvider(connection, new Wallet(serviceWallet), {
    commitment: "confirmed",
  });
  // The vendored IDL's `address` field is the mainnet program — override it
  // with the cluster-resolved id so this actually targets devnet there.
  const program = new Program({ ...idl, address: config.programId } as Idl, provider);
  const txlineMint = new PublicKey(config.txlineMint);

  const [pricingMatrixPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("pricing_matrix")],
    program.programId,
  );
  const [tokenTreasuryPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("token_treasury_v2")],
    program.programId,
  );

  const userTokenAccount = getAssociatedTokenAddressSync(
    txlineMint,
    serviceWallet.publicKey,
    false,
    TOKEN_2022_PROGRAM_ID,
  );
  const tokenTreasuryVault = getAssociatedTokenAddressSync(
    txlineMint,
    tokenTreasuryPda,
    true,
    TOKEN_2022_PROGRAM_ID,
  );

  console.log(`Subscribing ${serviceWallet.publicKey.toBase58()} on ${config.cluster}`);
  console.log(`  service_level_id=${serviceLevelId} weeks=${weeks}`);

  // `subscribe` expects the user's TXLINE ATA to already exist — it does not
  // create it, even for a free (price 0) row. Found by running against
  // devnet: the instruction reverted with AccountNotInitialized on
  // user_token_account until this was added.
  const userTokenAccountInfo = await connection.getAccountInfo(userTokenAccount);
  if (!userTokenAccountInfo) {
    console.log(`Creating TXLINE ATA ${userTokenAccount.toBase58()}...`);
    const createAtaTx = new Transaction().add(
      createAssociatedTokenAccountInstruction(
        serviceWallet.publicKey,
        userTokenAccount,
        serviceWallet.publicKey,
        txlineMint,
        TOKEN_2022_PROGRAM_ID,
      ),
    );
    await provider.sendAndConfirm(createAtaTx);
  }

  const txSig = await program.methods
    .subscribe(serviceLevelId, weeks)
    .accounts({
      user: serviceWallet.publicKey,
      pricingMatrix: pricingMatrixPda,
      tokenMint: txlineMint,
      userTokenAccount,
      tokenTreasuryVault,
      tokenTreasuryPda,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
    })
    .rpc();

  console.log(`Subscribed. txSig = ${txSig}`);
  console.log("Pass this txSig to establishTxLineSession() to activate an API token.");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
