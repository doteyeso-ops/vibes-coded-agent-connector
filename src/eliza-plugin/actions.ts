import { getOrCreateVibesCodedService } from "./services.js";
import type { ElizaActionLike, ElizaRuntimeLike, SkillData, WalletOrKeypair } from "../types.js";

function ensureObject(input: unknown, fallbackMessage: string): Record<string, any> {
  if (!input || typeof input !== "object") {
    throw new Error(fallbackMessage);
  }
  return input as Record<string, any>;
}

export const registerAgentAction: ElizaActionLike = {
  name: "REGISTER_ON_VIBES_CODED",
  description: "Register an autonomous agent on vibes-coded.com (wallet signing). Selling/listings still need link-session or register-with-account; paid buy uses REST + X-API-Key per marketplace docs.",
  similes: ["create marketplace agent", "register seller agent", "connect to vibes coded"],
  async handler(runtime: ElizaRuntimeLike, message: unknown) {
    const payload = ensureObject(message, "REGISTER_ON_VIBES_CODED expects an object with at least a name.");
    const service = getOrCreateVibesCodedService(runtime);
    const walletOrKeypair = payload.walletOrKeypair as WalletOrKeypair | undefined;
    if (!walletOrKeypair) {
      throw new Error(
        "REGISTER_ON_VIBES_CODED needs walletOrKeypair so the agent can register non-custodially."
      );
    }
    return service.client.registerAgent(walletOrKeypair, {
      name: String(payload.name || payload.agentName || "Unnamed Agent"),
      description: payload.description ? String(payload.description) : undefined,
      username: payload.username ? String(payload.username) : undefined,
      webhookUrl: payload.webhookUrl ? String(payload.webhookUrl) : undefined,
      termsAccepted: payload.termsAccepted !== false,
    });
  },
};

export const listSkillAction: ElizaActionLike = {
  name: "LIST_SKILL_ON_VIBES_CODED",
  description: "Publish a skill, prompt pack, script, or automation to vibes-coded.com.",
  similes: ["sell this skill", "publish listing", "list on vibes coded"],
  async handler(runtime: ElizaRuntimeLike, message: unknown) {
    const payload = ensureObject(message, "LIST_SKILL_ON_VIBES_CODED expects a structured skill object.");
    const service = getOrCreateVibesCodedService(runtime);
    return service.client.listSkill(payload as SkillData);
  },
};

export const updateSkillAction: ElizaActionLike = {
  name: "UPDATE_SKILL_ON_VIBES_CODED",
  description: "Update an existing Vibes-Coded listing.",
  similes: ["refresh my listing", "update skill listing"],
  async handler(runtime: ElizaRuntimeLike, message: unknown) {
    const payload = ensureObject(message, "UPDATE_SKILL_ON_VIBES_CODED expects a listingId and the fields to update.");
    const service = getOrCreateVibesCodedService(runtime);
    return service.client.updateSkill({
      listingId: String(payload.listingId),
      ...payload,
    });
  },
};

export const earningsAction: ElizaActionLike = {
  name: "GET_VIBES_CODED_EARNINGS",
  description: "Fetch current seller earnings and pending delivery counts.",
  similes: ["check earnings", "show my sales", "marketplace revenue"],
  async handler(runtime: ElizaRuntimeLike) {
    const service = getOrCreateVibesCodedService(runtime);
    return service.client.getEarnings();
  },
};

export const myListingsAction: ElizaActionLike = {
  name: "GET_MY_VIBES_CODED_LISTINGS",
  description: "Fetch the agent's listings from vibes-coded.com.",
  similes: ["my marketplace listings", "show my skills"],
  async handler(runtime: ElizaRuntimeLike) {
    const service = getOrCreateVibesCodedService(runtime);
    return service.client.getMyListings();
  },
};

export const sellSkillAction: ElizaActionLike = {
  name: "SELL_SKILL_WITH_VIBES_CODED",
  description: "Register if needed, then publish a skill in one agent-friendly flow.",
  similes: ["sell this autonomously", "one shot sell skill"],
  async handler(runtime: ElizaRuntimeLike, message: unknown) {
    const payload = ensureObject(message, "SELL_SKILL_WITH_VIBES_CODED expects { name, skill }.");
    const service = getOrCreateVibesCodedService(runtime);
    return service.client.sellSkill({
      name: String(payload.name || payload.agentName || "Unnamed Agent"),
      description: payload.description ? String(payload.description) : undefined,
      username: payload.username ? String(payload.username) : undefined,
      webhookUrl: payload.webhookUrl ? String(payload.webhookUrl) : undefined,
      termsAccepted: payload.termsAccepted !== false,
      walletOrKeypair: payload.walletOrKeypair as WalletOrKeypair | undefined,
      skill: ensureObject(payload.skill, "SELL_SKILL_WITH_VIBES_CODED needs a skill object to publish.") as SkillData,
    });
  },
};

export const vibesCodedActions: ElizaActionLike[] = [
  registerAgentAction,
  listSkillAction,
  updateSkillAction,
  myListingsAction,
  earningsAction,
  sellSkillAction,
];
