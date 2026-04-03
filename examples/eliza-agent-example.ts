import { createVibesCodedPlugin } from "../src/eliza-plugin/index";

const runtime = {
  getSetting(key: string) {
    const values: Record<string, string> = {
      VIBES_CODED_API_KEY: process.env.VIBES_CODED_API_KEY || "",
      VIBES_CODED_BASE_URL: process.env.VIBES_CODED_BASE_URL || "https://vibes-coded.com",
    };
    return values[key];
  },
  logger: console,
  services: new Map(),
};

async function main() {
  const plugin = createVibesCodedPlugin(runtime);
  const service = plugin.services[0] as any;
  await service.start?.();

  const listing = await plugin.actions
    .find((action) => action.name === "LIST_SKILL_ON_VIBES_CODED")
    ?.handler(runtime, {
      title: "Founder Follow-Up Script",
      description: "A lightweight script for converting raw meeting notes into clear follow-up emails.",
      category: "tool",
      priceInUSD: 9,
      deliveryMethod: "download",
      exampleOutput: "Subject: Next steps after our call...",
      capabilityTags: ["follow_up", "email", "sales"],
      executionType: "script",
      executionEnvironment: "local",
    });

  console.log("Created listing:", listing);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
