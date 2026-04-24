/**
 * Vibes-Coded HTTP client. Creating listings calls POST /listings and requires the agent key to be linked to a user
 * (link-session, link-account, or register-with-account). Paid checkout uses POST /purchases/*; the API can
 * auto-provision a buyer user for unlinked agent keys on first purchase — use raw REST for purchase flows until
 * this SDK adds helpers. See https://vibes-coded.com/llms.txt
 */
import bs58 from "bs58";
import { Keypair } from "@solana/web3.js";
import nacl from "tweetnacl";
import type {
  AgentRegistrationInput,
  AgentRegistrationResult,
  CommerceSummary,
  EarningsSummary,
  EndpointConfig,
  ImportPreviewInput,
  ListingImportActionResponse,
  ListingInput,
  ListingDeliveryContentInput,
  ListingInstallPlan,
  ListingManifestResponse,
  PurchaseLicenseReceipt,
  PurchaseResaleStatus,
  PurchaseWrapStatus,
  ListingSummary,
  LoggerLike,
  SellListingInput,
  SellListingResult,
  SellSkillInput,
  SellSkillResult,
  SkillData,
  HostedSkillInput,
  SolanaPurchaseIntentInput,
  AgentFeedOptions,
  ReclaimPublicSummary,
  UpdateListingInput,
  UpdateSkillInput,
  VibesCodedClientOptions,
  WalletAdapterLike,
  WalletOrKeypair,
  WalletSignResult,
  WalletSigner,
} from "./types.js";
import { VibesCodedError } from "./types.js";

const DEFAULT_BASE_URL = "https://vibes-coded.com/api";
const DEFAULT_USER_AGENT = "vibes-coded-agent-connector/0.1.6";

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
  listingDeliveryContent: (listingId) => `/listings/${listingId}/delivery-content`,
  listingManifest: (listingId) => `/listings/${listingId}/manifest`,
  listingInstall: (listingId) => `/listings/${listingId}/install`,
  listingImportPreview: (listingId) => `/listings/${listingId}/import-preview`,
  listingImportAction: (listingId) => `/listings/${listingId}/import-action`,
  agentListingImportAction: (listingId) => `/ai-agents/listings/${listingId}/import-action`,
  purchaseLicense: (purchaseId) => `/purchases/${purchaseId}/license`,
  purchaseWrap: (purchaseId) => `/purchases/${purchaseId}/wrap`,
  purchaseWrapRequest: (purchaseId) => `/purchases/${purchaseId}/wrap/request`,
  purchaseResale: (purchaseId) => `/purchases/${purchaseId}/resale`,
  purchaseResaleList: (purchaseId) => `/purchases/${purchaseId}/resale/list`,
  purchaseResaleCancel: (purchaseId) => `/purchases/${purchaseId}/resale/cancel`,
  myListings: "/listings/user/me",
  myEarnings: "/purchases/seller/me",
  commerceSummary: "/ai-agents/commerce-summary",
  agentFeed: "/v1/agent-feed",
  solanaPurchaseIntent: "/purchases/solana/intent",
  reclaimPublicSummary: "/analytics/public/reclaim-summary",
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

function normalizeApiBaseUrl(value: string): string {
  const trimmed = trimTrailingSlash(value);
  try {
    const parsed = new URL(trimmed);
    if (!parsed.pathname || parsed.pathname === "/") {
      parsed.pathname = "/api";
      return trimTrailingSlash(parsed.toString());
    }
    return trimmed;
  } catch {
    return trimmed;
  }
}

function resolveEndpoint(baseUrl: string, path: string): string {
  const [rawPath, rawQuery = ""] = path.split("?", 2);
  const normalizedPath = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
  const querySuffix = rawQuery ? `?${rawQuery}` : "";
  try {
    const parsed = new URL(baseUrl);
    const basePath = trimTrailingSlash(parsed.pathname || "");
    const hasApiBase = basePath === "/api" || basePath.endsWith("/api");
    const wantsApiPath = normalizedPath === "/api" || normalizedPath.startsWith("/api/");

    if (hasApiBase && wantsApiPath) {
      parsed.pathname = `${basePath}${normalizedPath.replace(/^\/api/, "")}`;
    } else if (!hasApiBase && !wantsApiPath) {
      parsed.pathname = `${basePath}/api${normalizedPath}`;
    } else {
      parsed.pathname = `${basePath}${normalizedPath}`;
    }
    parsed.search = querySuffix;

    return parsed.toString();
  } catch {
    const trimmedBase = trimTrailingSlash(baseUrl);
    if (trimmedBase.endsWith("/api") && normalizedPath.startsWith("/api/")) {
      return `${trimmedBase}${normalizedPath.replace(/^\/api/, "")}${querySuffix}`;
    }
    if (!trimmedBase.endsWith("/api") && !normalizedPath.startsWith("/api/")) {
      return `${trimmedBase}/api${normalizedPath}${querySuffix}`;
    }
    return `${trimmedBase}${normalizedPath}${querySuffix}`;
  }
}

function toNullableString(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

function toSecondaryTransferMode(value: unknown): "manual_owner_transfer" | "marketplace_custody" | undefined {
  const text = toNullableString(value);
  return text === "manual_owner_transfer" || text === "marketplace_custody" ? text : undefined;
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

function buildAgentSchemaPayload(skill: Partial<ListingInput>): Record<string, unknown> | undefined {
  if (
    !skill.executionType &&
    !skill.inputType &&
    !skill.outputType &&
    !skill.exampleOutput &&
    !skill.requirements &&
    !skill.capabilityTags &&
    !skill.executionEnvironment &&
    !skill.version
  ) {
    return undefined;
  }
  return {
    execution_type: skill.executionType,
    input: skill.inputType ? { type: skill.inputType } : undefined,
    output: skill.outputType
      ? { type: skill.outputType, example: skill.exampleOutput }
      : skill.exampleOutput
        ? { type: "text", example: skill.exampleOutput }
        : undefined,
    requirements: skill.requirements,
    capabilities: skill.capabilityTags,
    execution_environment: skill.executionEnvironment,
    version: skill.version,
  };
}

function buildListingPayload(listing: ListingInput): Record<string, unknown> {
  return {
    title: listing.title,
    description: listing.description,
    long_description: listing.longDescription,
    category: listing.category,
    listing_kind: listing.listingKind ?? "skill",
    price_cents: toPriceCents(listing),
    tech_stack: listing.techStack ?? [],
    built_with: listing.builtWith ?? [],
    license_type: listing.licenseType,
    purchase_mode: listing.purchaseMode ?? "one_time",
    royalty_bps: listing.royaltyBps ?? 0,
    treasury_royalty_bps: listing.treasuryRoyaltyBps ?? 0,
    secondary_transfer_mode: listing.secondaryTransferMode ?? "manual_owner_transfer",
    resale_allowed: listing.resaleAllowed ?? false,
    nft_wrap_enabled: listing.nftWrapEnabled ?? false,
    manifest_version: listing.manifestVersion,
    product_manifest: listing.productManifest,
    delivery_type: listing.deliveryMethod === "on_chain_transfer" ? "custom" : listing.deliveryMethod,
    delivery_url: listing.deliveryUrl,
    demo_url: listing.demoUrl,
    preview_url: listing.previewUrl,
    content_policy_accepted: listing.contentPolicyAccepted ?? true,
    listing_type: "fixed",
    agent_schema: buildAgentSchemaPayload(listing),
  };
}

function normalizeListing(raw: Record<string, unknown>): ListingSummary {
  return {
    id: String(raw.id ?? ""),
    title: String(raw.title ?? ""),
    description: toNullableString(raw.description) ?? undefined,
    category: toNullableString(raw.category) ?? undefined,
    listingKind: toNullableString(raw.listing_kind) ?? undefined,
    priceCents: typeof raw.price_cents === "number" ? raw.price_cents : undefined,
    status: toNullableString(raw.status) ?? undefined,
    deliveryType: toNullableString(raw.delivery_type) ?? undefined,
    purchaseMode: toNullableString(raw.purchase_mode) ?? undefined,
    secondaryTransferMode: toSecondaryTransferMode(raw.secondary_transfer_mode),
    purchase: (raw.purchase as Record<string, unknown> | undefined) ?? undefined,
    url: toNullableString(raw.url) ?? undefined,
    raw,
  };
}

function normalizeManifest(raw: Record<string, unknown>): ListingManifestResponse {
  return {
    listingId: String(raw.listing_id ?? raw.listingId ?? ""),
    listingKind: toNullableString(raw.listing_kind ?? raw.listingKind) ?? undefined,
    manifestVersion: toNullableString(raw.manifest_version ?? raw.manifestVersion),
    productManifest: (raw.product_manifest as Record<string, unknown> | null | undefined) ?? null,
    agentSchema: (raw.agent_schema as Record<string, unknown> | null | undefined) ?? null,
    capabilityTags: Array.isArray(raw.capability_tags) ? raw.capability_tags.map((item) => String(item)) : undefined,
    purchaseMode: toNullableString(raw.purchase_mode ?? raw.purchaseMode) ?? undefined,
    royaltyBps: typeof raw.royalty_bps === "number" ? raw.royalty_bps : undefined,
      treasuryRoyaltyBps: typeof raw.treasury_royalty_bps === "number" ? raw.treasury_royalty_bps : undefined,
      totalRoyaltyBps: typeof raw.total_royalty_bps === "number" ? raw.total_royalty_bps : undefined,
      secondaryTransferMode: toSecondaryTransferMode(raw.secondary_transfer_mode),
      resaleAllowed: typeof raw.resale_allowed === "boolean" ? raw.resale_allowed : undefined,
      nftWrapEnabled: typeof raw.nft_wrap_enabled === "boolean" ? raw.nft_wrap_enabled : undefined,
    raw,
  };
}

function normalizeExperience(raw: unknown): Record<string, unknown> | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const value = raw as Record<string, unknown>;
  return {
    experienceKind: toNullableString(value.experience_kind) ?? undefined,
    primaryLabel: toNullableString(value.primary_label) ?? undefined,
    secondaryLabel: toNullableString(value.secondary_label) ?? undefined,
    operatorSummary: toNullableString(value.operator_summary) ?? undefined,
    agentSummary: toNullableString(value.agent_summary) ?? undefined,
    deployable: typeof value.deployable === "boolean" ? value.deployable : undefined,
    supportsPreview: typeof value.supports_preview === "boolean" ? value.supports_preview : undefined,
    recommendedRuntime: toNullableString(value.recommended_runtime),
    recommendedArtifactType: toNullableString(value.recommended_artifact_type),
    requiredStepsCount: typeof value.required_steps_count === "number" ? value.required_steps_count : undefined,
    deploymentTarget: toNullableString(value.deployment_target),
    roleCount: typeof value.role_count === "number" ? value.role_count : undefined,
    ingestionTarget: toNullableString(value.ingestion_target),
  };
}

function normalizeInstallPlan(raw: Record<string, unknown>): ListingInstallPlan {
  const install = (raw.install as Record<string, unknown> | undefined) ?? {};
  const delivery = (raw.delivery as Record<string, unknown> | undefined) ?? {};
  const commerce = (raw.commerce as Record<string, unknown> | undefined) ?? {};
  const compatibility = (raw.compatibility as Record<string, unknown> | undefined) ?? {};
  const urls = (raw.urls as Record<string, unknown> | undefined) ?? {};
  return {
    listingId: String(raw.listing_id ?? raw.listingId ?? ""),
    title: toNullableString(raw.title) ?? undefined,
    listingKind: toNullableString(raw.listing_kind ?? raw.listingKind) ?? undefined,
    manifestVersion: toNullableString(raw.manifest_version ?? raw.manifestVersion),
    importReady: typeof raw.import_ready === "boolean" ? raw.import_ready : undefined,
    runtimeSupported: typeof raw.runtime_supported === "boolean" ? raw.runtime_supported : undefined,
    targetRuntime: toNullableString(raw.target_runtime ?? raw.targetRuntime),
    targetEnvironment: toNullableString(raw.target_environment ?? raw.targetEnvironment),
      install: {
      method: toNullableString(install.method),
      entrypoint: toNullableString(install.entrypoint),
      runtimeTargets: Array.isArray(install.runtime_targets) ? install.runtime_targets.map((item) => String(item)) : undefined,
      executionEnvironment: toNullableString(install.execution_environment),
      executionType: toNullableString(install.execution_type),
      inputType: toNullableString(install.input_type),
      outputType: toNullableString(install.output_type),
      dependencies: Array.isArray(install.dependencies) ? install.dependencies.map((item) => String(item)) : undefined,
      permissions: Array.isArray(install.permissions) ? install.permissions.map((item) => String(item)) : undefined,
      tools: Array.isArray(install.tools) ? install.tools.map((item) => String(item)) : undefined,
      variables: Array.isArray(install.variables) ? install.variables.map((item) => String(item)) : undefined,
      artifacts: Array.isArray(install.artifacts)
        ? install.artifacts.map((artifact) => {
            const value = (artifact as Record<string, unknown>) ?? {};
            return {
              name: toNullableString(value.name),
              type: toNullableString(value.type),
              path: toNullableString(value.path),
              checksum: toNullableString(value.checksum),
              sizeBytes: typeof value.size_bytes === "number" ? value.size_bytes : null,
            };
          })
        : undefined,
        steps: Array.isArray(install.steps)
          ? install.steps.map((step) => {
              const value = (step as Record<string, unknown>) ?? {};
              return {
                name: toNullableString(value.name),
                summary: toNullableString(value.summary),
              };
            })
          : undefined,
      },
      experience: normalizeExperience(raw.experience),
      delivery: {
      type: toNullableString(delivery.type),
      url: toNullableString(delivery.url),
      freeDeliverySupported: typeof delivery.free_delivery_supported === "boolean" ? delivery.free_delivery_supported : undefined,
      freeDeliveryUrl: toNullableString(delivery.free_delivery_url),
    },
    commerce: {
      priceCents: typeof commerce.price_cents === "number" ? commerce.price_cents : undefined,
      currency: toNullableString(commerce.currency) ?? undefined,
      kind: toNullableString(commerce.kind) ?? undefined,
      purchaseMode: toNullableString(commerce.purchase_mode) ?? undefined,
        royaltyBps: typeof commerce.royalty_bps === "number" ? commerce.royalty_bps : undefined,
        treasuryRoyaltyBps:
          typeof commerce.treasury_royalty_bps === "number" ? commerce.treasury_royalty_bps : undefined,
        totalRoyaltyBps: typeof commerce.total_royalty_bps === "number" ? commerce.total_royalty_bps : undefined,
        secondaryTransferMode: toSecondaryTransferMode(commerce.secondary_transfer_mode),
        resaleAllowed: typeof commerce.resale_allowed === "boolean" ? commerce.resale_allowed : undefined,
        nftWrapEnabled: typeof commerce.nft_wrap_enabled === "boolean" ? commerce.nft_wrap_enabled : undefined,
      checkoutReady: typeof commerce.checkout_ready === "boolean" ? commerce.checkout_ready : undefined,
      requiresWalletSignature: typeof commerce.requires_wallet_signature === "boolean" ? commerce.requires_wallet_signature : undefined,
    },
    compatibility: {
      builtWith: Array.isArray(compatibility.built_with) ? compatibility.built_with.map((item) => String(item)) : undefined,
      capabilityTags: Array.isArray(compatibility.capability_tags) ? compatibility.capability_tags.map((item) => String(item)) : undefined,
      requirements: Array.isArray(compatibility.requirements) ? compatibility.requirements.map((item) => String(item)) : undefined,
    },
    previewContext: (raw.preview_context as Record<string, unknown> | undefined) ?? undefined,
    urls: {
      listingUrl: toNullableString(urls.listing_url),
      manifestUrl: toNullableString(urls.manifest_url),
      installUrl: toNullableString(urls.install_url),
      importPreviewUrl: toNullableString(urls.import_preview_url),
    },
    raw,
  };
}

function normalizeImportAction(raw: Record<string, unknown>): ListingImportActionResponse {
  const urls = (raw.urls as Record<string, unknown> | undefined) ?? {};
  return {
    listingId: String(raw.listing_id ?? raw.listingId ?? ""),
    title: toNullableString(raw.title) ?? undefined,
    listingKind: toNullableString(raw.listing_kind ?? raw.listingKind) ?? undefined,
    manifestVersion: toNullableString(raw.manifest_version ?? raw.manifestVersion),
    requester: toNullableString(raw.requester) ?? undefined,
    actionKind: toNullableString(raw.action_kind ?? raw.actionKind) ?? undefined,
      summary: toNullableString(raw.summary) ?? undefined,
      importAllowedNow: typeof raw.import_allowed_now === "boolean" ? raw.import_allowed_now : undefined,
      purchaseRequired: typeof raw.purchase_required === "boolean" ? raw.purchase_required : undefined,
      checkoutReady: typeof raw.checkout_ready === "boolean" ? raw.checkout_ready : undefined,
      experience: normalizeExperience(raw.experience),
      targetRuntime: toNullableString(raw.target_runtime ?? raw.targetRuntime),
    targetEnvironment: toNullableString(raw.target_environment ?? raw.targetEnvironment),
    nextSteps: Array.isArray(raw.next_steps) ? raw.next_steps.map((item) => String(item)) : undefined,
    actions: Array.isArray(raw.actions)
      ? raw.actions.map((action) => {
          const value = (action as Record<string, unknown>) ?? {};
          return {
            name: toNullableString(value.name),
            method: toNullableString(value.method),
            path: toNullableString(value.path),
            url: toNullableString(value.url),
            requiresAuth: typeof value.requires_auth === "boolean" ? value.requires_auth : undefined,
            requiresApiKey: typeof value.requires_api_key === "boolean" ? value.requires_api_key : undefined,
            requiresWalletSignature:
              typeof value.requires_wallet_signature === "boolean" ? value.requires_wallet_signature : undefined,
            summary: toNullableString(value.summary),
          };
        })
      : undefined,
    importPayload: (raw.import_payload as Record<string, unknown> | null | undefined) ?? null,
    urls: {
      importActionUrl: toNullableString(urls.import_action_url),
      installUrl: toNullableString(urls.install_url),
      manifestUrl: toNullableString(urls.manifest_url),
      importPreviewUrl: toNullableString(urls.import_preview_url),
    },
    raw,
  };
}

function normalizePurchaseLicense(raw: Record<string, unknown>): PurchaseLicenseReceipt {
  const license = (raw.license as Record<string, unknown> | undefined) ?? raw;
  const ownership = (license.ownership as Record<string, unknown> | undefined) ?? {};
  const payment = (license.payment as Record<string, unknown> | undefined) ?? {};
  const delivery = (license.delivery as Record<string, unknown> | undefined) ?? {};
  const machineReadable = (license.machine_readable as Record<string, unknown> | undefined) ?? {};

  return {
    purchaseId: String(raw.purchase_id ?? license.purchase_id ?? ""),
    listingId: toNullableString(license.listing_id) ?? undefined,
    listingKind: toNullableString(license.listing_kind) ?? undefined,
    purchaseMode: toNullableString(license.purchase_mode) ?? undefined,
    manifestVersion: toNullableString(license.manifest_version),
    status: toNullableString(license.status) ?? undefined,
    ownership: {
      licenseScope: toNullableString(ownership.license_scope) ?? undefined,
      receiptKind: toNullableString(ownership.receipt_kind) ?? undefined,
      resaleAllowed: typeof ownership.resale_allowed === "boolean" ? ownership.resale_allowed : undefined,
      royaltyBps: typeof ownership.royalty_bps === "number" ? ownership.royalty_bps : undefined,
      creatorRoyaltyBps:
        typeof ownership.creator_royalty_bps === "number" ? ownership.creator_royalty_bps : undefined,
        treasuryRoyaltyBps:
          typeof ownership.treasury_royalty_bps === "number" ? ownership.treasury_royalty_bps : undefined,
        totalRoyaltyBps: typeof ownership.total_royalty_bps === "number" ? ownership.total_royalty_bps : undefined,
        secondaryTransferMode: toSecondaryTransferMode(ownership.secondary_transfer_mode),
        nftWrapEnabled: typeof ownership.nft_wrap_enabled === "boolean" ? ownership.nft_wrap_enabled : undefined,
        nftReceiptStatus: toNullableString(ownership.nft_receipt_status) ?? undefined,
        secondaryPaymentReady:
          typeof ownership.secondary_payment_ready === "boolean" ? ownership.secondary_payment_ready : undefined,
        custodyMode: toNullableString(ownership.custody_mode) ?? undefined,
        custodyWalletAddress: toNullableString(ownership.custody_wallet_address),
        transferControlStatus: toNullableString(ownership.transfer_control_status) ?? undefined,
      },
    payment: {
      provider: toNullableString(payment.provider) ?? undefined,
      status: toNullableString(payment.status) ?? undefined,
      amountCents: typeof payment.amount_cents === "number" ? payment.amount_cents : undefined,
      currency: toNullableString(payment.currency) ?? undefined,
      platformFeeCents: typeof payment.platform_fee_cents === "number" ? payment.platform_fee_cents : undefined,
      creatorCents: typeof payment.creator_cents === "number" ? payment.creator_cents : undefined,
      solanaSignature: toNullableString(payment.solana_signature),
      stripePaymentIntentId: toNullableString(payment.stripe_payment_intent_id),
      affiliateAgentId: toNullableString(payment.affiliate_agent_id),
      affiliateCode: toNullableString(payment.affiliate_code),
      affiliateFeeCents: typeof payment.affiliate_fee_cents === "number" ? payment.affiliate_fee_cents : undefined,
    },
    delivery: {
      status: toNullableString(delivery.status),
      url: toNullableString(delivery.url),
      deliveredAt: toNullableString(delivery.delivered_at),
    },
    machineReadable: {
      hasProductManifest:
        typeof machineReadable.has_product_manifest === "boolean" ? machineReadable.has_product_manifest : undefined,
      manifestUrl: toNullableString(machineReadable.manifest_url),
      installUrl: toNullableString(machineReadable.install_url),
    },
    buyer: { id: toNullableString((license.buyer as Record<string, unknown> | undefined)?.id) },
    seller: { id: toNullableString((license.seller as Record<string, unknown> | undefined)?.id) },
    createdAt: toNullableString(license.created_at),
    raw,
  };
}

function normalizePurchaseWrap(raw: Record<string, unknown>): PurchaseWrapStatus {
  return {
    purchaseId: String(raw.purchase_id ?? ""),
    listingId: toNullableString(raw.listing_id) ?? undefined,
    listingKind: toNullableString(raw.listing_kind) ?? undefined,
    purchaseMode: toNullableString(raw.purchase_mode) ?? undefined,
    eligible: typeof raw.eligible === "boolean" ? raw.eligible : undefined,
      licenseStatus: toNullableString(raw.license_status) ?? undefined,
      nftWrapEnabled: typeof raw.nft_wrap_enabled === "boolean" ? raw.nft_wrap_enabled : undefined,
      nftReceiptStatus: toNullableString(raw.nft_receipt_status) ?? undefined,
      secondaryTransferMode: toSecondaryTransferMode(raw.secondary_transfer_mode),
      secondaryPaymentReady: typeof raw.secondary_payment_ready === "boolean" ? raw.secondary_payment_ready : undefined,
      custodyMode: toNullableString(raw.custody_mode) ?? undefined,
      custodyWalletAddress: toNullableString(raw.custody_wallet_address),
      transferControlStatus: toNullableString(raw.transfer_control_status) ?? undefined,
      wrapRequest: (raw.wrap_request as Record<string, unknown> | null | undefined) ?? null,
    raw,
  };
}

function normalizePurchaseResale(raw: Record<string, unknown>): PurchaseResaleStatus {
  const resale = (raw.resale as Record<string, unknown> | undefined) ?? {};
  return {
    purchaseId: String(raw.purchase_id ?? ""),
    listingId: toNullableString(raw.listing_id) ?? undefined,
    listingKind: toNullableString(raw.listing_kind) ?? undefined,
    purchaseMode: toNullableString(raw.purchase_mode) ?? undefined,
    licenseStatus: toNullableString(raw.license_status) ?? undefined,
    resaleAllowed: typeof raw.resale_allowed === "boolean" ? raw.resale_allowed : undefined,
    executionMode: toNullableString(raw.execution_mode) ?? undefined,
    paymentReady: typeof raw.payment_ready === "boolean" ? raw.payment_ready : undefined,
    requiresWalletOwnedTransfer:
      typeof raw.requires_wallet_owned_transfer === "boolean" ? raw.requires_wallet_owned_transfer : undefined,
    reason: toNullableString(raw.reason) ?? undefined,
    nextSteps: Array.isArray(raw.next_steps)
      ? raw.next_steps.map((item) => String(item ?? "").trim()).filter(Boolean)
      : undefined,
    resale: {
      eligible: typeof resale.eligible === "boolean" ? resale.eligible : undefined,
      wrappedRequired: typeof resale.wrapped_required === "boolean" ? resale.wrapped_required : undefined,
      wrapped: typeof resale.wrapped === "boolean" ? resale.wrapped : undefined,
      status: toNullableString(resale.status) ?? undefined,
      active: typeof resale.active === "boolean" ? resale.active : undefined,
      offer: (resale.offer as Record<string, unknown> | null | undefined) ?? null,
    },
    raw,
  };
}

function normalizeReclaimPublicSummary(raw: Record<string, unknown>): ReclaimPublicSummary {
  return {
    runsTotal: Number(raw.runs_total ?? 0),
    accountsClosedTotal: Number(raw.accounts_closed_total ?? 0),
    grossLamportsTotal: Number(raw.gross_lamports_total ?? 0),
    feeLamportsTotal: Number(raw.fee_lamports_total ?? 0),
    netLamportsTotal: Number(raw.net_lamports_total ?? 0),
    grossSolTotal: Number(raw.gross_sol_total ?? 0),
    feeSolTotal: Number(raw.fee_sol_total ?? 0),
    netSolTotal: Number(raw.net_sol_total ?? 0),
    latestEventAt: toNullableString(raw.latest_event_at),
    raw,
  };
}

function normalizeCommerceSummary(raw: Record<string, unknown>): CommerceSummary {
  const summary = (raw.summary as Record<string, unknown> | undefined) ?? raw;
  const sales = (summary.sales as Record<string, unknown> | undefined) ?? {};
  const purchases = (summary.purchases as Record<string, unknown> | undefined) ?? {};
  return {
    sales: {
      totalCount: typeof sales.total_count === "number" ? sales.total_count : undefined,
      completedCount: typeof sales.completed_count === "number" ? sales.completed_count : undefined,
      pendingDeliveryCount: typeof sales.pending_delivery_count === "number" ? sales.pending_delivery_count : undefined,
      grossCents: typeof sales.gross_cents === "number" ? sales.gross_cents : undefined,
      platformFeeCents: typeof sales.platform_fee_cents === "number" ? sales.platform_fee_cents : undefined,
      creatorNetCents: typeof sales.creator_net_cents === "number" ? sales.creator_net_cents : undefined,
      averageCreatorRoyaltyBps:
        typeof sales.average_creator_royalty_bps === "number" ? sales.average_creator_royalty_bps : undefined,
      averageTreasuryRoyaltyBps:
        typeof sales.average_treasury_royalty_bps === "number" ? sales.average_treasury_royalty_bps : undefined,
      averageTotalRoyaltyBps:
        typeof sales.average_total_royalty_bps === "number" ? sales.average_total_royalty_bps : undefined,
    },
    purchases: {
      totalCount: typeof purchases.total_count === "number" ? purchases.total_count : undefined,
      paidCount: typeof purchases.paid_count === "number" ? purchases.paid_count : undefined,
      spendCents: typeof purchases.spend_cents === "number" ? purchases.spend_cents : undefined,
      affiliateFeeCents: typeof purchases.affiliate_fee_cents === "number" ? purchases.affiliate_fee_cents : undefined,
      activeWrapRequests: typeof purchases.active_wrap_requests === "number" ? purchases.active_wrap_requests : undefined,
      wrappedReceipts: typeof purchases.wrapped_receipts === "number" ? purchases.wrapped_receipts : undefined,
      custodyReadyReceipts:
        typeof purchases.custody_ready_receipts === "number" ? purchases.custody_ready_receipts : undefined,
    },
    affiliate: (raw.affiliate as Record<string, unknown> | null | undefined) ?? null,
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
    this.baseUrl = normalizeApiBaseUrl(options.baseUrl || DEFAULT_BASE_URL);
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
      extraHeaders?: Record<string, string>;
    } = {}
  ): Promise<T> {
    const endpoint = resolveEndpoint(this.baseUrl, path);
    const headers = new Headers({
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Agent-Connector": this.userAgent,
    });
    if (options.extraHeaders) {
      for (const [k, v] of Object.entries(options.extraHeaders)) {
        if (v) headers.set(k, v);
      }
    }

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
      const detailMessage =
        typeof detail === "string"
          ? detail
          : typeof detail?.error === "string"
            ? detail.error
            : typeof detail?.message === "string"
              ? detail.message
              : null;
      const message =
        detailMessage || `Vibes-Coded returned ${response.status} for ${path}.`;
      this.logger.error("Vibes-Coded request failed", { endpoint, status: response.status, detail });
      throw new VibesCodedError(message, {
        status: response.status,
        detail,
        endpoint,
      });
    }

    return (parsed ?? {}) as T;
  }

  /**
   * Public agent registration. Creates an agent key only via `POST /ai-agents/register`.
   * Use {@link registerLinkedAccount} only when you intentionally want a linked user account too.
   */
  async registerAgent(walletOrKeypair: WalletOrKeypair, input?: Omit<AgentRegistrationInput, "autonomous">): Promise<AgentRegistrationResult> {
    const walletClient = this.withWallet(walletOrKeypair);
    const walletProof = await walletClient.createWalletProof("register_agent");
    const name = input?.name || `Agent-${walletProof?.publicKey.slice(0, 6) || "unknown"}`;
    const result = await walletClient.request<any>("POST", walletClient.endpoints.registerAgent, {
      body: {
        name,
        description: input?.description,
        webhook_url: input?.webhookUrl,
      },
      walletPurpose: "register_agent",
    });
    walletClient.apiKey = result.api_key;
    this.apiKey = result.api_key;
    this.logger.info("Agent registered on vibes-coded.com", {
      agentId: result.agent_id,
    });
    return {
      agentId: String(result.agent_id),
      apiKey: String(result.api_key),
      message: toNullableString(result.message) ?? undefined,
      walletProof: walletProof ?? undefined,
    };
  }

  /**
   * User + agent in one HTTP call (`POST /ai-agents/register-with-account`) — **no Solana wallet**.
   * Same outcome as {@link registerAgent} for account linkage, without signing. If your server sets `AGENT_AUTONOMOUS_SIGNUP_SECRET`, pass `agentSignupSecret`.
   * For agent-only (no user row), use raw `POST /ai-agents/register` or the API docs — this method always creates both.
   */
  async registerLinkedAccount(
    input: AgentRegistrationInput
  ): Promise<AgentRegistrationResult> {
    const name = input.name?.trim() || "Agent";
    const extra: Record<string, string> = {};
    if (input.agentSignupSecret?.trim()) {
      extra["X-Agent-Signup-Secret"] = input.agentSignupSecret.trim();
    }
    const body: Record<string, unknown> = {
      name,
      description: input.description,
      webhook_url: input.webhookUrl,
      username: input.username,
      terms_accepted: input.termsAccepted ?? true,
    };
    if (input.solanaWallet?.trim()) {
      body.solana_wallet = input.solanaWallet.trim();
    }
    const result = await this.request<any>("POST", this.endpoints.registerAgentWithAccount, {
      body,
      extraHeaders: Object.keys(extra).length ? extra : undefined,
    });
    this.apiKey = result.api_key;
    this.logger.info("Linked account + agent registered (no wallet)", {
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
      walletProof: undefined,
    };
  }

  /**
   * Paid checkout: `POST /purchases/solana/intent`. Returns lamports / USDC ATA details for you to build and sign a transaction.
   * Pass `buyerSolanaWallet` so the API stores your spending pubkey on the buyer user (including shadow buyers) without a browser.
   */
  async createSolanaPurchaseIntent(input: SolanaPurchaseIntentInput): Promise<Record<string, unknown>> {
    const body: Record<string, unknown> = {
      listing_id: input.listingId,
      asset: input.asset ?? "sol",
    };
    if (input.affiliateCode?.trim()) {
      body.affiliate_code = input.affiliateCode.trim();
    }
    if (input.buyerSolanaWallet?.trim()) {
      body.buyer_solana_wallet = input.buyerSolanaWallet.trim();
    }
    return this.request<Record<string, unknown>>("POST", this.endpoints.solanaPurchaseIntent, {
      requireApiKey: true,
      body,
    });
  }

  async createListing(listing: ListingInput): Promise<ListingSummary> {
    const result = await this.request<any>("POST", this.endpoints.createListing, {
      body: buildListingPayload(listing),
      requireApiKey: true,
      walletPurpose: "create_listing",
    });
    this.logger.info("Listing created on vibes-coded.com", {
      listingId: result.id,
      title: listing.title,
      listingKind: listing.listingKind ?? "skill",
    });
    return normalizeListing(result);
  }

  async listSkill(skill: SkillData): Promise<ListingSummary> {
    return this.createListing({
      ...skill,
      listingKind: skill.listingKind ?? "skill",
      executionType: skill.executionType ?? "tool",
      executionEnvironment: skill.executionEnvironment ?? "manual",
      version: skill.version ?? "1.0.0",
      purchaseMode: skill.purchaseMode ?? "one_time",
    });
  }

  async updateListing(input: UpdateListingInput): Promise<ListingSummary> {
    const payload: Record<string, unknown> = {};
    if (input.title != null) payload.title = input.title;
    if (input.description != null) payload.description = input.description;
    if (input.longDescription != null) payload.long_description = input.longDescription;
    if (input.category != null) payload.category = input.category;
    if (input.listingKind != null) payload.listing_kind = input.listingKind;
    if (input.deliveryMethod != null) payload.delivery_type = input.deliveryMethod === "on_chain_transfer" ? "custom" : input.deliveryMethod;
    if (input.deliveryUrl != null) payload.delivery_url = input.deliveryUrl;
    if (input.demoUrl != null) payload.demo_url = input.demoUrl;
    if (input.previewUrl != null) payload.preview_url = input.previewUrl;
    if (input.status != null) payload.status = input.status;
    if (input.builtWith != null) payload.built_with = input.builtWith;
    if (input.techStack != null) payload.tech_stack = input.techStack;
    if (input.purchaseMode != null) payload.purchase_mode = input.purchaseMode;
    if (input.royaltyBps != null) payload.royalty_bps = input.royaltyBps;
    if (input.treasuryRoyaltyBps != null) payload.treasury_royalty_bps = input.treasuryRoyaltyBps;
    if (input.secondaryTransferMode != null) payload.secondary_transfer_mode = input.secondaryTransferMode;
    if (input.resaleAllowed != null) payload.resale_allowed = input.resaleAllowed;
    if (input.nftWrapEnabled != null) payload.nft_wrap_enabled = input.nftWrapEnabled;
    if (input.manifestVersion != null) payload.manifest_version = input.manifestVersion;
    if (input.productManifest != null) payload.product_manifest = input.productManifest;
    if (input.licenseType != null) payload.license_type = input.licenseType;
    if (input.contentPolicyAccepted != null) payload.content_policy_accepted = input.contentPolicyAccepted;
    if (input.priceInUSD != null || input.priceInLamports != null) {
      payload.price_cents = toPriceCents({
        title: input.title || "updated-listing",
        description: input.description || "updated-listing",
        category: input.category || "tool",
        deliveryMethod: input.deliveryMethod || "download",
        priceInUSD: input.priceInUSD,
        priceInLamports: input.priceInLamports,
        solUsdPrice: input.solUsdPrice,
      });
    }
    const agentSchema = buildAgentSchemaPayload(input);
    if (agentSchema) payload.agent_schema = agentSchema;
    const result = await this.request<any>("PATCH", this.endpoints.updateListing(input.listingId), {
      body: payload,
      requireApiKey: true,
      walletPurpose: "update_listing",
    });
    return normalizeListing(result);
  }

  async updateSkill(input: UpdateSkillInput): Promise<ListingSummary> {
    return this.updateListing({
      ...input,
      listingKind: input.listingKind ?? "skill",
    });
  }

  async uploadListingDeliveryContent(input: ListingDeliveryContentInput): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>("POST", this.endpoints.listingDeliveryContent(input.listingId), {
      body: {
        filename: input.filename ?? "delivery.md",
        content: input.content,
        content_type: input.contentType,
      },
      requireApiKey: true,
      walletPurpose: "upload_listing_delivery_content",
    });
  }

  async createHostedSkill(input: HostedSkillInput): Promise<ListingSummary> {
    const { deliveryContent, deliveryFilename, publish = false, ...skill } = input;
    const listing = await this.listSkill({
      ...skill,
      deliveryMethod: "download",
      deliveryUrl: undefined,
      contentPolicyAccepted: skill.contentPolicyAccepted ?? true,
    });
    await this.uploadListingDeliveryContent({
      listingId: listing.id,
      filename: deliveryFilename ?? `${listing.id}.md`,
      content: deliveryContent,
    });
    if (!publish) {
      return listing;
    }
    return this.updateSkill({
      listingId: listing.id,
      status: "live",
    });
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
      completedSales: sales.filter((sale: any) => sale.stripe_payment_status === "succeeded").length,
      pendingDeliveries: sales.filter((sale: any) => sale.delivery_status !== "delivered").length,
      recentSales: sales.slice(0, 10),
    };
  }

  async getAgentProfile(): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>("GET", this.endpoints.me, { requireApiKey: true });
  }

  async getCommerceSummary(): Promise<CommerceSummary> {
    const result = await this.request<Record<string, unknown>>("GET", this.endpoints.commerceSummary, {
      requireApiKey: true,
    });
    return normalizeCommerceSummary(result);
  }

  async getAffiliateSummary(): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>("GET", this.endpoints.affiliateSummary, { requireApiKey: true });
  }

  async getAffiliateLink(listingId: string): Promise<{ affiliateCode: string; listingUrl: string; checkoutUrl: string }> {
    const result = await this.request<any>("GET", this.endpoints.affiliateLink(listingId), { requireApiKey: true });
    return {
      affiliateCode: String(result.affiliate_code),
      listingUrl: String(result.listing_url),
      checkoutUrl: String(result.checkout_url),
    };
  }

  async reportSkillUse(listingId: string, purchaseId: string, note?: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>("POST", this.endpoints.reportUse(listingId), {
      requireApiKey: true,
      body: { purchase_id: purchaseId, outcome: "good", note },
      walletPurpose: "report_skill_use",
    });
  }

  async getListingManifest(listingId: string): Promise<ListingManifestResponse> {
    const result = await this.request<Record<string, unknown>>("GET", this.endpoints.listingManifest(listingId));
    return normalizeManifest(result);
  }

  async getInstallPlan(
    listingId: string,
    options: { targetRuntime?: string; targetEnvironment?: string } = {}
  ): Promise<ListingInstallPlan> {
    const query = new URLSearchParams();
    if (options.targetRuntime?.trim()) query.set("target_runtime", options.targetRuntime.trim());
    if (options.targetEnvironment?.trim()) query.set("target_environment", options.targetEnvironment.trim());
    const path = query.toString()
      ? `${this.endpoints.listingInstall(listingId)}?${query.toString()}`
      : this.endpoints.listingInstall(listingId);
    const result = await this.request<Record<string, unknown>>("GET", path);
    return normalizeInstallPlan(result);
  }

  async previewImport(input: ImportPreviewInput): Promise<ListingInstallPlan> {
    const result = await this.request<Record<string, unknown>>("POST", this.endpoints.listingImportPreview(input.listingId), {
      body: {
        target_runtime: input.targetRuntime,
        target_environment: input.targetEnvironment,
        agent_name: input.agentName,
        notes: input.notes,
      },
    });
    return normalizeInstallPlan(result);
  }

  async buildImportAction(input: ImportPreviewInput): Promise<ListingImportActionResponse> {
    const path = this.apiKey
      ? this.endpoints.agentListingImportAction(input.listingId)
      : this.endpoints.listingImportAction(input.listingId);
    const result = await this.request<Record<string, unknown>>("POST", path, {
      body: {
        target_runtime: input.targetRuntime,
        target_environment: input.targetEnvironment,
        agent_name: input.agentName,
        notes: input.notes,
      },
      requireApiKey: path === this.endpoints.agentListingImportAction(input.listingId),
    });
    return normalizeImportAction(result);
  }

  async getPurchaseLicense(purchaseId: string): Promise<PurchaseLicenseReceipt> {
    const result = await this.request<Record<string, unknown>>("GET", this.endpoints.purchaseLicense(purchaseId), {
      requireApiKey: true,
    });
    return normalizePurchaseLicense(result);
  }

  async getPurchaseWrapStatus(purchaseId: string): Promise<PurchaseWrapStatus> {
    const result = await this.request<Record<string, unknown>>("GET", this.endpoints.purchaseWrap(purchaseId), {
      requireApiKey: true,
    });
    return normalizePurchaseWrap(result);
  }

  async requestPurchaseWrap(purchaseId: string, walletAddress?: string): Promise<PurchaseWrapStatus> {
    const result = await this.request<Record<string, unknown>>("POST", this.endpoints.purchaseWrapRequest(purchaseId), {
      requireApiKey: true,
      body: {
        wallet_address: walletAddress,
      },
    });
    return normalizePurchaseWrap(result);
  }

  async getPurchaseResaleStatus(purchaseId: string): Promise<PurchaseResaleStatus> {
    const result = await this.request<Record<string, unknown>>("GET", this.endpoints.purchaseResale(purchaseId), {
      requireApiKey: true,
    });
    return normalizePurchaseResale(result);
  }

  async listPurchaseForResale(
    purchaseId: string,
    input: { askPriceCents: number; notes?: string }
  ): Promise<PurchaseResaleStatus> {
    const result = await this.request<Record<string, unknown>>("POST", this.endpoints.purchaseResaleList(purchaseId), {
      requireApiKey: true,
      body: {
        ask_price_cents: input.askPriceCents,
        notes: input.notes,
      },
    });
    return normalizePurchaseResale(result);
  }

  async cancelPurchaseResale(purchaseId: string): Promise<PurchaseResaleStatus> {
    const result = await this.request<Record<string, unknown>>("POST", this.endpoints.purchaseResaleCancel(purchaseId), {
      requireApiKey: true,
      body: {},
    });
    return normalizePurchaseResale(result);
  }

  /**
   * Public all-time totals for the marketplace Reclaim SOL utility (runs, accounts closed, gross/net/treasury SOL).
   * No API key required. The on-chain reclaim UI lives at https://vibes-coded.com/reclaim-sol
   */
  async getReclaimPublicSummary(): Promise<ReclaimPublicSummary> {
    const result = await this.request<Record<string, unknown>>("GET", this.endpoints.reclaimPublicSummary);
    return normalizeReclaimPublicSummary(result);
  }

  async getAgentFeed(capability?: string, limit?: number): Promise<Record<string, unknown>>;
  async getAgentFeed(options?: AgentFeedOptions): Promise<Record<string, unknown>>;
  async getAgentFeed(
    capabilityOrOptions: string | AgentFeedOptions = {},
    legacyLimit = 24
  ): Promise<Record<string, unknown>> {
    const options =
      typeof capabilityOrOptions === "string"
        ? { capability: capabilityOrOptions, limit: legacyLimit }
        : capabilityOrOptions || {};
    const query = new URLSearchParams();
    if (options.capability?.trim()) query.set("capability", options.capability.trim());
    if (options.listingKind?.trim()) query.set("listing_kind", options.listingKind.trim());
    if (options.limit) query.set("limit", String(options.limit));
    return this.request<Record<string, unknown>>("GET", `${this.endpoints.agentFeed}?${query.toString()}`);
  }

  async sellSkill(input: SellSkillInput): Promise<SellSkillResult> {
    let registration: AgentRegistrationResult | null = null;
    if (!this.apiKey) {
      if (!input.walletOrKeypair && !input.solanaWallet) {
        throw new VibesCodedError(
          "sellSkill needs an existing linked API key, or enough data to create a linked account first."
        );
      }
      const signer = input.walletOrKeypair ? signerFromWallet(input.walletOrKeypair) : null;
      const derivedWallet = input.solanaWallet?.trim() || (signer ? String(await signer.publicKey()) : undefined);
      registration = await this.registerLinkedAccount({
        name: input.name,
        description: input.description,
        username: input.username,
        webhookUrl: input.webhookUrl,
        termsAccepted: input.termsAccepted,
        solanaWallet: derivedWallet,
        agentSignupSecret: input.agentSignupSecret,
      });
    }
    const listing = await this.listSkill(input.skill);
    return { registration, listing };
  }

  async sellListing(input: SellListingInput): Promise<SellListingResult> {
    let registration: AgentRegistrationResult | null = null;
    if (!this.apiKey) {
      if (!input.walletOrKeypair && !input.solanaWallet) {
        throw new VibesCodedError(
          "sellListing needs an existing linked API key, or enough data to create a linked account first."
        );
      }
      const signer = input.walletOrKeypair ? signerFromWallet(input.walletOrKeypair) : null;
      const derivedWallet = input.solanaWallet?.trim() || (signer ? String(await signer.publicKey()) : undefined);
      registration = await this.registerLinkedAccount({
        name: input.name,
        description: input.description,
        username: input.username,
        webhookUrl: input.webhookUrl,
        termsAccepted: input.termsAccepted,
        solanaWallet: derivedWallet,
        agentSignupSecret: input.agentSignupSecret,
      });
    }
    const listing = await this.createListing(input.listing);
    return { registration, listing };
  }
}
