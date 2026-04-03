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
  console.log("Loaded plugin:", plugin.name);
  const earnings = await plugin.actions.find((action) => action.name === "GET_VIBES_CODED_EARNINGS")?.handler(runtime, {});
  console.log("Earnings:", earnings);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
