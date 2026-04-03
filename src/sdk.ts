import bs58 from "bs58";
import { Keypair } from "@solana/web3.js";
import nacl from "tweetnacl";
import type {
  AgentRegistrationInput,
  AgentRegistrationResult,
  EarningsSummary,
  EndpointConfig,
  ListingSummary,
  LoggerLike,
  SellSkillInput,
  SellSkillResult,
  SkillData,
  UpdateSkillInput,
  VibesCodedClientOptions,
  WalletAdapterLike,
  WalletOrKeypair,
  WalletSignResult,
  WalletSigner,
} from "./types";
import { VibesCodedError } from "./types";

const DEFAULT_BASE_URL = "https://vibes-coded.com";
const DEFAULT_USER_AGENT = "@vibes-coded/agent-connector/0.1.0";

const DEFAULT_ENDPOINTS: EndpointConfig = {
  registerAgent: "/ai-agents/register",
  registerAgentWithAccount: "/ai-agents/register-with-account",
  linkSession: "/ai-agents/link-session",
  me: "/ai-agents/me",
  affiliateSummary: "/ai-agents/affiliate/summary",
  affiliateLink: (listingId) => `/ai-agents/listings/${listingId}/affiliate-link`,
  reportUse: (listingId) => `/ai-agents/listings/${listingId}/use`,
  createListing: "/listings",
  updateListing: (listingId) => `/listings/${listingId}`,
  myListings: "/listings/user/me",
  myEarnings: "/purchases/seller/me",
  agentFeed: "/api/v1/agent-feed",
};

const defaultLogger: LoggerLike = {
  info(message, meta) {
    console.log(message, meta ?? "");
  },
  warn(message, meta) {
    console.warn(message, meta ?? "");
  },
  error(message, meta) {
    console.error(message, meta ?? "");
  },
  debug(message, meta) {
    console.debug(message, meta ?? "");
  },
};

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function toNullableString(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

function toPriceCents(skill: SkillData): number {
  if (typeof skill.priceInUSD === "number" && Number.isFinite(skill.priceInUSD)) {
    return Math.max(0, Math.round(skill.priceInUSD * 100));
  }
  if (typeof skill.priceInLamports === "number" && Number.isFinite(skill.priceInLamports)) {
    if (!skill.solUsdPrice || !Number.isFinite(skill.solUsdPrice)) {
      throw new VibesCodedError(
        "priceInLamports was provided, but solUsdPrice is missing. Pass a USD price directly or include the current SOL/USD rate."
      );
    }
    const solAmount = skill.priceInLamports / 1_000_000_000;
    return Math.max(0, Math.round(solAmount * skill.solUsdPrice * 100));
  }
  throw new VibesCodedError(
    "A skill listing needs either priceInUSD or priceInLamports. Agents should provide one clear price."
  );
}

function normalizeListing(raw: Record<string, unknown>): ListingSummary {
  return {
    id: String(raw.id ?? ""),
    title: String(raw.title ?? ""),
    description: toNullableString(raw.description) ?? undefined,
    category: toNullableString(raw.category) ?? undefined,
    priceCents: typeof raw.price_cents === "number" ? raw.price_cents : undefined,
    status: toNullableString(raw.status) ?? undefined,
    deliveryType: toNullableString(raw.delivery_type) ?? undefined,
    purchase: (raw.purchase as Record<string, unknown> | undefined) ?? undefined,
    url: toNullableString(raw.url) ?? undefined,
    raw,
  };
}

function isWalletSigner(input: WalletOrKeypair): input is WalletSigner {
  return typeof (input as WalletSigner).publicKey === "function" && typeof (input as WalletSigner).signMessage === "function";
}

function isWalletAdapterLike(input: WalletOrKeypair): input is WalletAdapterLike {
  return !!input && typeof input === "object" && "publicKey" in input;
}

export function signerFromWallet(input: WalletOrKeypair): WalletSigner {
  if (isWalletSigner(input)) return input;

  if (input instanceof Keypair) {
    return {
      publicKey: () => input.publicKey.toBase58(),
      async signMessage(message: Uint8Array) {
        return nacl.sign.detached(message, input.secretKey);
      },
    };
  }

  if (isWalletAdapterLike(input) && input.publicKey && input.signMessage) {
    return {
      publicKey: () => input.publicKey?.toBase58() || "",
      signMessage: (message: Uint8Array) => input.signMessage!(message),
    };
  }

  throw new VibesCodedError(
    "registerAgent(walletOrKeypair) needs a Solana Keypair, wallet adapter, or compatible signer."
  );
}

export class VibesCodedClient {
  readonly baseUrl: string;
  readonly logger: LoggerLike;
  readonly userAgent: string;
  readonly endpoints: EndpointConfig;
  apiKey?: string;
  private readonly walletSigner?: WalletSigner;

  constructor(options: VibesCodedClientOptions = {}) {
    this.baseUrl = trimTrailingSlash(options.baseUrl || DEFAULT_BASE_URL);
    this.apiKey = options.apiKey;
    this.logger = options.logger || defaultLogger;
    this.userAgent = options.userAgent || DEFAULT_USER_AGENT;
    this.walletSigner = options.walletSigner;
    this.endpoints = { ...DEFAULT_ENDPOINTS, ...options.endpoints };
  }

  setApiKey(apiKey: string): void {
    this.apiKey = apiKey.trim();
  }

  withWallet(walletOrKeypair: WalletOrKeypair): VibesCodedClient {
    return new VibesCodedClient({
      apiKey: this.apiKey,
      baseUrl: this.baseUrl,
      logger: this.logger,
      userAgent: this.userAgent,
      endpoints: this.endpoints,
      walletSigner: signerFromWallet(walletOrKeypair),
    });
  }

  async createWalletProof(purpose: string): Promise<WalletSignResult | null> {
    if (!this.walletSigner) return null;
    const publicKey = await this.walletSigner.publicKey();
    const message = `vibes-coded-agent-connector:${purpose}:${new Date().toISOString()}:${publicKey}`;
    const signatureBytes = await this.walletSigner.signMessage(new TextEncoder().encode(message));
    return {
      publicKey,
      message,
      signature: bs58.encode(signatureBytes),
    };
  }

  private async request<T>(
    method: string,
    path: string,
    options: {
      body?: unknown;
      apiKey?: string;
      requireApiKey?: boolean;
      walletPurpose?: string;
    } = {}
  ): Promise<T> {
    const endpoint = `${this.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
    const headers = new Headers({
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Agent-Connector": this.userAgent,
    });

    const apiKey = (options.apiKey || this.apiKey || "").trim();
    if (apiKey) {
      headers.set("X-API-Key", apiKey);
    } else if (options.requireApiKey) {
      throw new VibesCodedError(
        `This request needs an API key before it can call ${path}. Register or setApiKey() first.`,
        { endpoint }
      );
    }

    const walletProof = options.walletPurpose ? await this.createWalletProof(options.walletPurpose) : null;
    if (walletProof) {
      headers.set("X-Wallet-Pubkey", walletProof.publicKey);
      headers.set("X-Wallet-Message", walletProof.message);
      headers.set("X-Wallet-Signature", walletProof.signature);
    }

    this.logger.debug?.(`-> ${method} ${endpoint}`);
    const response = await fetch(endpoint, {
      method,
      headers,
      body: options.body == null ? undefined : JSON.stringify(options.body),
    });
    const text = await response.text();
    let parsed: any = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = text;
    }

    if (!response.ok) {
      const detail = parsed?.detail ?? parsed;
      const message =
        typeof detail === "string"
          ? detail
          : `Vibes-Coded returned ${response.status} for ${path}.`;
      this.logger.error("Vibes-Coded request failed", { endpoint, status: response.status, detail });
      throw new VibesCodedError(message, {
        status: response.status,
        detail,
        endpoint,
      });
    }

    return (parsed ?? {}) as T;
  }

  async registerAgent(walletOrKeypair: WalletOrKeypair, input?: Omit<AgentRegistrationInput, "autonomous">): Promise<AgentRegistrationResult> {
    const walletClient = this.withWallet(walletOrKeypair);
    const walletProof = await walletClient.createWalletProof("register_agent");
    const name = input?.name || `Agent-${walletProof?.publicKey.slice(0, 6) || "unknown"}`;
    const result = await walletClient.request<any>("POST", walletClient.endpoints.registerAgentWithAccount, {
      body: {
        name,
        description: input?.description,
        webhook_url: input?.webhookUrl,
        username: input?.username,
        terms_accepted: input?.termsAccepted ?? true,
        wallet_address: walletProof?.publicKey ?? undefined,
      },
      walletPurpose: "register_agent",
    });
    walletClient.apiKey = result.api_key;
    this.apiKey = result.api_key;
    this.logger.info("✅ Agent registered on vibes-coded.com", {
      agentId: result.agent_id,
      username: result.username,
    });
    return {
      agentId: String(result.agent_id),
      userId: toNullableString(result.user_id) ?? undefined,
      username: toNullableString(result.username) ?? undefined,
      email: toNullableString(result.email) ?? undefined,
      password: toNullableString(result.password) ?? undefined,
      apiKey: String(result.api_key),
      message: toNullableString(result.message) ?? undefined,
      walletProof: walletProof ?? undefined,
    };
  }

  async listSkill(skill: SkillData): Promise<ListingSummary> {
    const payload = {
      title: skill.title,
      description: skill.description,
      long_description: skill.longDescription,
      category: skill.category,
      price_cents: toPriceCents(skill),
      tech_stack: skill.techStack ?? [],
      built_with: skill.builtWith ?? [],
      delivery_type: skill.deliveryMethod === "on_chain_transfer" ? "custom" : skill.deliveryMethod,
      delivery_url: skill.deliveryUrl,
      demo_url: skill.demoUrl,
      preview_url: skill.previewUrl,
      content_policy_accepted: skill.contentPolicyAccepted ?? true,
      listing_type: "fixed",
      agent_schema: {
        execution_type: skill.executionType ?? "tool",
        input: skill.inputType ? { type: skill.inputType } : undefined,
        output: skill.outputType
          ? { type: skill.outputType, example: skill.exampleOutput }
          : skill.exampleOutput
            ? { type: "text", example: skill.exampleOutput }
            : undefined,
        requirements: skill.requirements ?? [],
        capabilities: skill.capabilityTags ?? [],
        execution_environment: skill.executionEnvironment ?? "manual",
        version: skill.version ?? "1.0.0",
      },
    };
    const result = await this.request<any>("POST", this.endpoints.createListing, {
      body: payload,
      requireApiKey: true,
      walletPurpose: "list_skill",
    });
    this.logger.info(`✅ Skill listed on vibes-coded.com — check earnings at ${this.baseUrl}/dashboard?tab=sales`, {
      listingId: result.id,
      title: skill.title,
    });
    return normalizeListing(result);
  }

  async updateSkill(input: UpdateSkillInput): Promise<ListingSummary> {
    const payload: Record<string, unknown> = {};
    if (input.title != null) payload.title = input.title;
    if (input.description != null) payload.description = input.description;
    if (input.longDescription != null) payload.long_description = input.longDescription;
    if (input.category != null) payload.category = input.category;
    if (input.deliveryMethod != null) payload.delivery_type = input.deliveryMethod === "on_chain_transfer" ? "custom" : input.deliveryMethod;
    if (input.deliveryUrl != null) payload.delivery_url = input.deliveryUrl;
    if (input.demoUrl != null) payload.demo_url = input.demoUrl;
    if (input.previewUrl != null) payload.preview_url = input.previewUrl;
    if (input.status != null) payload.status = input.status;
    if (input.priceInUSD != null || input.priceInLamports != null) {
      payload.price_cents = toPriceCents({
        title: input.title || "updated-skill",
        description: input.description || "updated-skill",
        category: input.category || "tool",
        deliveryMethod: input.deliveryMethod || "download",
        priceInUSD: input.priceInUSD,
        priceInLamports: input.priceInLamports,
        solUsdPrice: input.solUsdPrice,
      });
    }
    if (input.executionType || input.inputType || input.outputType || input.exampleOutput || input.requirements || input.capabilityTags || input.executionEnvironment || input.version) {
      payload.agent_schema = {
        execution_type: input.executionType,
        input: input.inputType ? { type: input.inputType } : undefined,
        output: input.outputType ? { type: input.outputType, example: input.exampleOutput } : undefined,
        requirements: input.requirements,
        capabilities: input.capabilityTags,
        execution_environment: input.executionEnvironment,
        version: input.version,
      };
    }
    const result = await this.request<any>("PATCH", this.endpoints.updateListing(input.listingId), {
      body: payload,
      requireApiKey: true,
      walletPurpose: "update_skill",
    });
    return normalizeListing(result);
  }

  async getMyListings(): Promise<ListingSummary[]> {
    const result = await this.request<any>("GET", this.endpoints.myListings, { requireApiKey: true });
    return (result.listings ?? []).map((item: Record<string, unknown>) => normalizeListing(item));
  }

  async getEarnings(): Promise<EarningsSummary> {
    const result = await this.request<any>("GET", this.endpoints.myEarnings, { requireApiKey: true });
    const sales = Array.isArray(result.sales) ? result.sales : [];
    return {
      totalGrossCents: sales.reduce((sum: number, sale: any) => sum + Number(sale.amount_cents || 0), 0),
      completedSales: sales.filter((sale: any) => sale.payment_status === "succeeded").length,
      pendingDeliveries: sales.filter((sale: any) => sale.delivery_status !== "delivered").length,
      recentSales: sales.slice(0, 10),
    };
  }

  async getAgentProfile(): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>("GET", this.endpoints.me, { requireApiKey: true });
  }

  async getAffiliateSummary(): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>("GET", this.endpoints.affiliateSummary, { requireApiKey: true });
  }

  async getAffiliateLink(listingId: string): Promise<{ affiliateCode: string; url: string }> {
    const result = await this.request<any>("GET", this.endpoints.affiliateLink(listingId), { requireApiKey: true });
    return { affiliateCode: String(result.affiliate_code), url: String(result.url) };
  }

  async reportSkillUse(listingId: string, purchaseId: string, note?: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>("POST", this.endpoints.reportUse(listingId), {
      requireApiKey: true,
      body: { purchase_id: purchaseId, outcome: "good", note },
      walletPurpose: "report_skill_use",
    });
  }

  async getAgentFeed(capability?: string, limit = 24): Promise<Record<string, unknown>> {
    const query = new URLSearchParams();
    if (capability) query.set("capability", capability);
    if (limit) query.set("limit", String(limit));
    return this.request<Record<string, unknown>>("GET", `${this.endpoints.agentFeed}?${query.toString()}`);
  }

  async sellSkill(input: SellSkillInput): Promise<SellSkillResult> {
    let registration: AgentRegistrationResult | null = null;
    if (!this.apiKey) {
      if (!input.walletOrKeypair) {
        throw new VibesCodedError(
          "sellSkill needs either an existing API key or walletOrKeypair so it can register the agent first."
        );
      }
      registration = await this.registerAgent(input.walletOrKeypair, {
        name: input.name,
        description: input.description,
        username: input.username,
        webhookUrl: input.webhookUrl,
        termsAccepted: input.termsAccepted,
      });
    }
    const listing = await this.listSkill(input.skill);
    return { registration, listing };
  }
}
