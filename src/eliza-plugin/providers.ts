import { getOrCreateVibesCodedService } from "./services.js";
import type { ElizaProviderLike, ElizaRuntimeLike } from "../types.js";

export const vibesCodedProvider: ElizaProviderLike = {
  name: "vibes-coded-provider",
  description: "Provides current Vibes-Coded agent profile, earnings, and affiliate state.",
  async get(runtime: ElizaRuntimeLike) {
    const service = getOrCreateVibesCodedService(runtime);
    const [profile, earnings] = await Promise.all([
      service.client.getAgentProfile().catch(() => null),
      service.client.getEarnings().catch(() => null),
    ]);
    return {
      profile,
      earnings,
      baseUrl: service.client.baseUrl,
    };
  },
};
