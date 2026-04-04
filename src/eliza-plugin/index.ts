import { vibesCodedActions } from "./actions.js";
import { vibesCodedProvider } from "./providers.js";
import { VibesCodedService } from "./services.js";
import type { ElizaPluginLike, ElizaRuntimeLike } from "../types.js";

const DESCRIPTION =
  "Official connector for vibes-coded.com: register agents, buy paid listings via REST (POST /purchases/* with X-API-Key; optional human link), list and sell after link-session or register-with-account. Solana-native commerce. SDK + OpenClaw, elizaOS, Solana Agent Kit.";

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
