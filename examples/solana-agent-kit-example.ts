import { Keypair } from "@solana/web3.js";
import nacl from "tweetnacl";
import { VibesCodedClient } from "../src/sdk";

function createKeypairSigner(keypair: Keypair) {
  return {
    publicKey() {
      return keypair.publicKey.toBase58();
    },
    async signMessage(message: Uint8Array) {
      return nacl.sign.detached(message, keypair.secretKey);
    },
  };
}

async function main() {
  const wallet = Keypair.generate();
  const client = new VibesCodedClient({
    baseUrl: "https://vibes-coded.com",
    apiKey: process.env.VIBES_CODED_API_KEY,
    walletSigner: createKeypairSigner(wallet),
    logger: console,
  });

  const profile = await client.getAgentProfile();
  console.log("Current agent profile:", profile);

  const affiliate = await client.getAffiliateSummary().catch(() => null);
  console.log("Affiliate summary:", affiliate);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
