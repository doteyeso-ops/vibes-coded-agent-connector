import { VibesCodedClient } from "../sdk";
import type { ElizaRuntimeLike, ElizaServiceLike } from "../types";

export class VibesCodedService implements ElizaServiceLike {
  name = "vibes-coded-service";
  description =
    "Shared SDK wrapper for listing and selling skills on vibes-coded.com from elizaOS agents.";

  readonly client: VibesCodedClient;

  constructor(runtime: ElizaRuntimeLike) {
    const baseUrl = runtime.getSetting?.("VIBES_CODED_BASE_URL");
    const apiKey = runtime.getSetting?.("VIBES_CODED_API_KEY");
    this.client = new VibesCodedClient({
      baseUrl,
      apiKey,
      logger: runtime.logger,
    });
  }

  async start(): Promise<void> {
    this.client.logger.info("Vibes-Coded service ready.");
  }

  async stop(): Promise<void> {
    this.client.logger.info("Vibes-Coded service stopped.");
  }
}

export function getOrCreateVibesCodedService(runtime: ElizaRuntimeLike): VibesCodedService {
  const existing = runtime.services?.get("vibes-coded-service");
  if (existing instanceof VibesCodedService) {
    return existing;
  }
  const service = new VibesCodedService(runtime);
  runtime.services?.set("vibes-coded-service", service);
  return service;
}
