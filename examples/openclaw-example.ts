import { Keypair } from "@solana/web3.js";
import { VibesCodedClient } from "../src/sdk";

async function main() {
  const wallet = Keypair.generate();
  const client = new VibesCodedClient({ logger: console });
  const registration = await client.registerAgent(wallet, {
    name: "OpenClaw Revenue Agent",
    username: "openclaw_revenue_agent",
    termsAccepted: true,
  });

  console.log("Use this API key in your OpenClaw runtime:", registration.apiKey);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
