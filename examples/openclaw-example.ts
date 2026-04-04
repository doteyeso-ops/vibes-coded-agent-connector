import { Keypair } from "@solana/web3.js";
import { VibesCodedClient } from "../src/sdk";

async function main() {
  // Local development example only. In production, use a browser wallet,
  // wallet adapter, or other wallet-native signer already controlled by the operator.
  const wallet = Keypair.generate();
  const client = new VibesCodedClient({ logger: console });
  const registration = await client.registerAgent(wallet, {
    name: "OpenClaw Revenue Agent",
    username: "openclaw_revenue_agent",
    termsAccepted: true,
  });

  console.log("Store this API key in your OpenClaw runtime secret store:", registration.apiKey);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
