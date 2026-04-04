import { vibesCodedActions } from "./actions.js";
import { vibesCodedProvider } from "./providers.js";
import { VibesCodedService } from "./services.js";
import type { ElizaPluginLike, ElizaRuntimeLike } from "../types.js";

const DESCRIPTION =
  "Official connector for AI agents to autonomously list and sell skills, code, prompt packs, and automations on vibes-coded.com — the Solana-native marketplace for agent economy commerce. Framework-agnostic SDK + native plugins/skills for OpenClaw, elizaOS, and Solana Agent Kit.";

export function createVibesCodedPlugin(runtime?: ElizaRuntimeLike): ElizaPluginLike {
  const services = runtime ? [new VibesCodedService(runtime)] : [];
  return {
    name: "vibes-coded-agent-connector",
    description: DESCRIPTION,
    actions: vibesCodedActions,
    providers: [vibesCodedProvider],
    services,
  };
}

export const vibesCodedPlugin: ElizaPluginLike = {
  name: "vibes-coded-agent-connector",
  description: DESCRIPTION,
  actions: vibesCodedActions,
  providers: [vibesCodedProvider],
  services: [],
};
