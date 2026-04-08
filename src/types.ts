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

export type ListingKind =
  | "skill"
  | "prompt_pack"
  | "agent"
  | "agent_template"
  | "dataset"
  | "rag_pack"
  | "personality"
  | "memory_template"
  | "swarm"
  | "toolkit"
  | "asset_pack"
  | "upgrade_recipe";

export type PurchaseMode = "one_time" | "licensed" | "nft_wrapped";
export type SecondaryTransferMode = "manual_owner_transfer" | "marketplace_custody";

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
  listingManifest: (listingId: string) => string;
  listingInstall: (listingId: string) => string;
  listingImportPreview: (listingId: string) => string;
  listingImportAction: (listingId: string) => string;
  agentListingImportAction: (listingId: string) => string;
  purchaseLicense: (purchaseId: string) => string;
  purchaseWrap: (purchaseId: string) => string;
  purchaseWrapRequest: (purchaseId: string) => string;
  purchaseResale: (purchaseId: string) => string;
  purchaseResaleList: (purchaseId: string) => string;
  purchaseResaleCancel: (purchaseId: string) => string;
  myListings: string;
  myEarnings: string;
  commerceSummary: string;
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
  agentSignupSecret?: string;
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
  listingKind?: ListingKind;
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
  manifestVersion?: string;
  purchaseMode?: PurchaseMode;
  royaltyBps?: number;
  treasuryRoyaltyBps?: number;
  totalRoyaltyBps?: number;
  secondaryTransferMode?: SecondaryTransferMode;
  resaleAllowed?: boolean;
  nftWrapEnabled?: boolean;
  licenseType?: "personal" | "commercial" | "exclusive" | "custom";
  productManifest?: Record<string, unknown>;
  contentPolicyAccepted?: boolean;
}

export interface UpdateSkillInput extends Partial<SkillData> {
  listingId: string;
  status?: "draft" | "live" | "unlisted";
}

export interface ListingInput extends SkillData {}

export interface UpdateListingInput extends Partial<ListingInput> {
  listingId: string;
  status?: "draft" | "live" | "unlisted";
}

export interface ListingSummary {
  id: string;
  title: string;
  description?: string;
  category?: string;
  listingKind?: string;
  priceCents?: number;
  status?: string;
  deliveryType?: string;
  purchaseMode?: string;
  secondaryTransferMode?: SecondaryTransferMode;
  purchase?: Record<string, unknown>;
  url?: string;
  raw: Record<string, unknown>;
}

export interface AgentFeedOptions {
  capability?: string;
  listingKind?: string;
  limit?: number;
}

export interface ListingManifestResponse {
  listingId: string;
  listingKind?: string;
  manifestVersion?: string | null;
  productManifest?: Record<string, unknown> | null;
  agentSchema?: Record<string, unknown> | null;
  capabilityTags?: string[];
  purchaseMode?: string;
  royaltyBps?: number;
  treasuryRoyaltyBps?: number;
  totalRoyaltyBps?: number;
  secondaryTransferMode?: SecondaryTransferMode;
  resaleAllowed?: boolean;
  nftWrapEnabled?: boolean;
  raw: Record<string, unknown>;
}

export interface InstallArtifactSummary {
  name?: string | null;
  type?: string | null;
  path?: string | null;
  checksum?: string | null;
  sizeBytes?: number | null;
}

export interface InstallStepSummary {
  name?: string | null;
  summary?: string | null;
}

export interface ListingInstallPlan {
  listingId: string;
  title?: string;
  listingKind?: string;
  manifestVersion?: string | null;
  importReady?: boolean;
  runtimeSupported?: boolean;
  targetRuntime?: string | null;
  targetEnvironment?: string | null;
  install?: {
    method?: string | null;
    entrypoint?: string | null;
    runtimeTargets?: string[];
    executionEnvironment?: string | null;
    executionType?: string | null;
    inputType?: string | null;
    outputType?: string | null;
    dependencies?: string[];
    permissions?: string[];
    tools?: string[];
    variables?: string[];
    artifacts?: InstallArtifactSummary[];
    steps?: InstallStepSummary[];
  };
  experience?: {
    experienceKind?: string | null;
    primaryLabel?: string | null;
    secondaryLabel?: string | null;
    operatorSummary?: string | null;
    agentSummary?: string | null;
    deployable?: boolean;
    supportsPreview?: boolean;
    recommendedRuntime?: string | null;
    recommendedArtifactType?: string | null;
    requiredStepsCount?: number | null;
    deploymentTarget?: string | null;
    roleCount?: number | null;
    ingestionTarget?: string | null;
  };
  delivery?: {
    type?: string | null;
    url?: string | null;
    freeDeliverySupported?: boolean;
    freeDeliveryUrl?: string | null;
  };
  commerce?: {
    priceCents?: number;
    currency?: string;
    kind?: string;
    purchaseMode?: string;
    royaltyBps?: number;
    treasuryRoyaltyBps?: number;
    totalRoyaltyBps?: number;
    secondaryTransferMode?: SecondaryTransferMode;
    resaleAllowed?: boolean;
    nftWrapEnabled?: boolean;
    checkoutReady?: boolean;
    requiresWalletSignature?: boolean;
  };
  compatibility?: {
    builtWith?: string[];
    capabilityTags?: string[];
    requirements?: string[];
  };
  previewContext?: Record<string, unknown>;
  urls?: {
    listingUrl?: string | null;
    manifestUrl?: string | null;
    installUrl?: string | null;
    importPreviewUrl?: string | null;
  };
  raw: Record<string, unknown>;
}

export interface ImportPreviewInput {
  listingId: string;
  targetRuntime?: string;
  targetEnvironment?: string;
  agentName?: string;
  notes?: string;
}

export interface ListingImportActionResponse {
  listingId: string;
  title?: string;
  listingKind?: string;
  manifestVersion?: string | null;
  requester?: string;
  actionKind?: string;
  summary?: string;
  importAllowedNow?: boolean;
  purchaseRequired?: boolean;
  checkoutReady?: boolean;
  experience?: {
    experienceKind?: string | null;
    primaryLabel?: string | null;
    secondaryLabel?: string | null;
    operatorSummary?: string | null;
    agentSummary?: string | null;
    deployable?: boolean;
    supportsPreview?: boolean;
    recommendedRuntime?: string | null;
    recommendedArtifactType?: string | null;
    requiredStepsCount?: number | null;
    deploymentTarget?: string | null;
    roleCount?: number | null;
    ingestionTarget?: string | null;
  };
  targetRuntime?: string | null;
  targetEnvironment?: string | null;
  nextSteps?: string[];
  actions?: Array<{
    name?: string | null;
    method?: string | null;
    path?: string | null;
    url?: string | null;
    requiresAuth?: boolean;
    requiresApiKey?: boolean;
    requiresWalletSignature?: boolean;
    summary?: string | null;
  }>;
  importPayload?: Record<string, unknown> | null;
  urls?: {
    importActionUrl?: string | null;
    installUrl?: string | null;
    manifestUrl?: string | null;
    importPreviewUrl?: string | null;
  };
  raw: Record<string, unknown>;
}

export interface PurchaseLicenseReceipt {
  purchaseId: string;
  listingId?: string;
  listingKind?: string;
  purchaseMode?: string;
  manifestVersion?: string | null;
  status?: string;
  ownership?: {
    licenseScope?: string;
    receiptKind?: string;
    resaleAllowed?: boolean;
    royaltyBps?: number;
    creatorRoyaltyBps?: number;
    treasuryRoyaltyBps?: number;
    totalRoyaltyBps?: number;
    secondaryTransferMode?: SecondaryTransferMode;
    nftWrapEnabled?: boolean;
    nftReceiptStatus?: string;
    secondaryPaymentReady?: boolean;
    custodyMode?: string;
    custodyWalletAddress?: string | null;
    transferControlStatus?: string;
  };
  payment?: {
    provider?: string;
    status?: string;
    amountCents?: number;
    currency?: string;
    platformFeeCents?: number;
    creatorCents?: number;
    solanaSignature?: string | null;
    stripePaymentIntentId?: string | null;
    affiliateAgentId?: string | null;
    affiliateCode?: string | null;
    affiliateFeeCents?: number;
  };
  delivery?: {
    status?: string | null;
    url?: string | null;
    deliveredAt?: string | null;
  };
  machineReadable?: {
    hasProductManifest?: boolean;
    manifestUrl?: string | null;
    installUrl?: string | null;
  };
  buyer?: { id?: string | null };
  seller?: { id?: string | null };
  createdAt?: string | null;
  raw: Record<string, unknown>;
}

export interface PurchaseWrapStatus {
  purchaseId: string;
  listingId?: string;
  listingKind?: string;
  purchaseMode?: string;
  eligible?: boolean;
  licenseStatus?: string;
  nftWrapEnabled?: boolean;
  nftReceiptStatus?: string;
  secondaryTransferMode?: SecondaryTransferMode;
  secondaryPaymentReady?: boolean;
  custodyMode?: string;
  custodyWalletAddress?: string | null;
  transferControlStatus?: string;
  wrapRequest?: Record<string, unknown> | null;
  raw: Record<string, unknown>;
}

export interface PurchaseResaleStatus {
  purchaseId: string;
  listingId?: string;
  listingKind?: string;
  purchaseMode?: string;
  licenseStatus?: string;
  resaleAllowed?: boolean;
  executionMode?: string;
  paymentReady?: boolean;
  requiresWalletOwnedTransfer?: boolean;
  reason?: string;
  nextSteps?: string[];
  resale?: {
    eligible?: boolean;
    wrappedRequired?: boolean;
    wrapped?: boolean;
    status?: string;
    active?: boolean;
    offer?: Record<string, unknown> | null;
  };
  raw: Record<string, unknown>;
}

export interface EarningsSummary {
  totalGrossCents: number;
  completedSales: number;
  pendingDeliveries: number;
  recentSales: Array<Record<string, unknown>>;
}

export interface CommerceSummary {
  sales?: {
    totalCount?: number;
    completedCount?: number;
    pendingDeliveryCount?: number;
    grossCents?: number;
    platformFeeCents?: number;
    creatorNetCents?: number;
    averageCreatorRoyaltyBps?: number;
    averageTreasuryRoyaltyBps?: number;
    averageTotalRoyaltyBps?: number;
  };
  purchases?: {
    totalCount?: number;
    paidCount?: number;
    spendCents?: number;
    affiliateFeeCents?: number;
    activeWrapRequests?: number;
    wrappedReceipts?: number;
    custodyReadyReceipts?: number;
  };
  affiliate?: Record<string, unknown> | null;
  raw: Record<string, unknown>;
}

export interface SellSkillInput extends AgentRegistrationInput {
  walletOrKeypair?: WalletOrKeypair;
  skill: SkillData;
}

export interface SellSkillResult {
  registration: AgentRegistrationResult | null;
  listing: ListingSummary;
}

export interface SellListingInput extends AgentRegistrationInput {
  walletOrKeypair?: WalletOrKeypair;
  listing: ListingInput;
}

export interface SellListingResult {
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
