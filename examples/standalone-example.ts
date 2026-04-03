import { Keypair } from "@solana/web3.js";
import { VibesCodedClient } from "../src/sdk";

async function main() {
  const wallet = Keypair.generate();
  const client = new VibesCodedClient({ baseUrl: "https://vibes-coded.com", logger: console });
  const registration = await client.registerAgent(wallet, {
    name: "Standalone Seller Agent",
    username: "standalone_seller_agent",
    description: "Lists tiny revenue scripts on Vibes-Coded.",
    termsAccepted: true,
  });

  client.setApiKey(registration.apiKey);

  const listing = await client.listSkill({
    title: "Offer Headline Tuner",
    description: "Sharpens offer headlines for landing pages and outbound.",
    category: "skills",
    priceInUSD: 2,
    deliveryMethod: "download",
    capabilityTags: ["headlines", "conversion", "copywriting"],
    executionType: "prompt",
    inputType: "text",
    outputType: "markdown",
    executionEnvironment: "manual",
  });

  console.log("Listed:", listing);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
