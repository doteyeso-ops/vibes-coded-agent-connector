import type { Keypair } from "@solana/web3.js";

export type DeliveryMethod =
  | "download"
  | "repo_access"
  | "api_key"
  | "custom"
  | "on_chain_transfer";

export type ListingCategory =
  | "tool"
  | "skills"
  | "agent"
  | "api"
  | "extension"
  | "saas"
  | "ebook"
  | "other";

export interface LoggerLike {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  debug?(message: string, meta?: Record<string, unknown>): void;
}

export interface WalletSignResult {
  message: string;
  signature: string;
  publicKey: string;
}

export interface WalletSigner {
  publicKey(): Promise<string> | string;
  signMessage(message: Uint8Array): Promise<Uint8Array>;
}

export interface WalletAdapterLike {
  publicKey?: { toBase58(): string } | null;
  signMessage?(message: Uint8Array): Promise<Uint8Array>;
}

export type WalletOrKeypair = WalletSigner | WalletAdapterLike | Keypair;

export interface EndpointConfig {
  registerAgent: string;
  registerAgentWithAccount: string;
  linkSession: string;
  me: string;
  affiliateSummary: string;
  affiliateLink: (listingId: string) => string;
  reportUse: (listingId: string) => string;
  createListing: string;
  updateListing: (listingId: string) => string;
  myListings: string;
  myEarnings: string;
  agentFeed: string;
  solanaPurchaseIntent: string;
}

export interface VibesCodedClientOptions {
  apiKey?: string;
  baseUrl?: string;
  logger?: LoggerLike;
  walletSigner?: WalletSigner;
  endpoints?: Partial<EndpointConfig>;
  userAgent?: string;
}

export interface AgentRegistrationInput {
  name: string;
  description?: string;
  webhookUrl?: string;
  username?: string;
  termsAccepted?: boolean;
  autonomous?: boolean;
  /** Buyer/seller Solana pubkey — stored as users.solana_wallet (payouts + recorded spending address). */
  solanaWallet?: string;
}

/** POST /purchases/solana/intent — optional buyerSolanaWallet persists on the buyer user (works for shadow API-key buyers). */
export interface SolanaPurchaseIntentInput {
  listingId: string;
  asset?: "sol" | "usdc";
  affiliateCode?: string;
  buyerSolanaWallet?: string;
}

export interface AgentRegistrationResult {
  agentId: string;
  apiKey: string;
  userId?: string;
  username?: string;
  email?: string;
  password?: string;
  message?: string;
  walletProof?: WalletSignResult;
}

export interface SkillData {
  title: string;
  description: string;
  longDescription?: string;
  category: ListingCategory;
  priceInUSD?: number;
  priceInLamports?: number;
  solUsdPrice?: number;
  deliveryMethod: DeliveryMethod;
  deliveryUrl?: string;
  exampleOutput?: string;
  demoUrl?: string;
  previewUrl?: string;
  builtWith?: string[];
  techStack?: string[];
  requirements?: string[];
  capabilityTags?: string[];
  executionType?: "script" | "prompt" | "api" | "tool";
  inputType?: string;
  outputType?: string;
  executionEnvironment?: string;
  version?: string;
  contentPolicyAccepted?: boolean;
}

export interface UpdateSkillInput extends Partial<SkillData> {
  listingId: string;
  status?: "draft" | "live" | "unlisted";
}

export interface ListingSummary {
  id: string;
  title: string;
  description?: string;
  category?: string;
  priceCents?: number;
  status?: string;
  deliveryType?: string;
  purchase?: Record<string, unknown>;
  url?: string;
  raw: Record<string, unknown>;
}

export interface EarningsSummary {
  totalGrossCents: number;
  completedSales: number;
  pendingDeliveries: number;
  recentSales: Array<Record<string, unknown>>;
}

export interface SellSkillInput extends AgentRegistrationInput {
  walletOrKeypair?: WalletOrKeypair;
  skill: SkillData;
}

export interface SellSkillResult {
  registration: AgentRegistrationResult | null;
  listing: ListingSummary;
}

export class VibesCodedError extends Error {
  readonly status?: number;
  readonly detail?: unknown;
  readonly endpoint?: string;

  constructor(message: string, options?: { status?: number; detail?: unknown; endpoint?: string }) {
    super(message);
    this.name = "VibesCodedError";
    this.status = options?.status;
    this.detail = options?.detail;
    this.endpoint = options?.endpoint;
  }
}

export interface ElizaRuntimeLike {
  getSetting?(key: string): string | undefined;
  logger?: LoggerLike;
  services?: Map<string, unknown>;
}

export interface ElizaActionLike {
  name: string;
  description: string;
  similes?: string[];
  validate?: (runtime: ElizaRuntimeLike, message: unknown) => Promise<boolean> | boolean;
  handler: (runtime: ElizaRuntimeLike, message: unknown, state?: unknown, options?: Record<string, unknown>) => Promise<unknown>;
}

export interface ElizaProviderLike {
  name: string;
  description: string;
  get: (runtime: ElizaRuntimeLike) => Promise<Record<string, unknown>>;
}

export interface ElizaServiceLike {
  name: string;
  description: string;
  start?(): Promise<void>;
  stop?(): Promise<void>;
}

export interface ElizaPluginLike {
  name: string;
  description: string;
  actions: ElizaActionLike[];
  providers: ElizaProviderLike[];
  services: ElizaServiceLike[];
}
