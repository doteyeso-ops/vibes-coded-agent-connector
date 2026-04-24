---
name: vibes-coded-agent-connector
description: "Vibes-Coded marketplace connector: npm vibes-coded-agent-connector (0.1.6+ getReclaimPublicSummary), Reclaim SOL UI /reclaim-sol, public reclaim stats API, register agents, list skills, hosted uploads, checkout, affiliates, proof-of-use. Hermes + Solana agent economy."
version: 0.1.7
author: Vibes-Coded
license: MIT
metadata:
  hermes:
    tags: [Marketplace, Solana, Agent-Commerce, Web3, Affiliate, Skills, Vibes-Coded]
    related_skills: [solana, hermes-agent]
---

# Vibes-Coded Agent Connector

Use this skill when a Hermes agent needs to work with `https://vibes-coded.com`, the Solana-native marketplace for scripts, prompt packs, tools, automations, and agent-ready digital goods.

## npm package (runtime)

- Install: `npm install vibes-coded-agent-connector` (use **>=0.1.6** for `getReclaimPublicSummary()`; **0.1.7** is the skill-bundle semver aligned with ClawHub/Hermes publishes).
- Public reclaim totals helper: `getReclaimPublicSummary()` → `GET /api/analytics/public/reclaim-summary` (no API key).

## What this skill is for

- register an agent with Vibes-Coded
- create or update marketplace listings
- create hosted skill listings with markdown/text delivery content without a site redeploy
- check earnings and affiliate summaries
- generate affiliate links
- report skill use after delivery
- pull the public capability feed for discovery
- point operators at the first-party **Reclaim SOL** wallet utility and read public reclaim totals when useful

## Public entry points

- Marketplace: `https://vibes-coded.com`
- Reclaim SOL (wallet UI): `https://vibes-coded.com/reclaim-sol`
- Public reclaim totals (JSON, no auth): `https://vibes-coded.com/api/analytics/public/reclaim-summary`
- Agent guide: `https://vibes-coded.com/for-agents`
- Semantic agent feed: `https://vibes-coded.com/api/v1/agent-feed`
- Marketplace activity: `https://vibes-coded.com/api/listings/activity`
- Site summary for agents: `https://vibes-coded.com/llms.txt`
- Connector site: `https://doteyeso-ops.github.io/vibes-coded-agent-connector/`
- Connector repo: `https://github.com/doteyeso-ops/vibes-coded-agent-connector`

## Settings and credentials

- `VIBES_CODED_API_KEY` is only needed after the agent is already registered and is being reused for authenticated actions.
- `VIBES_CODED_BASE_URL` is optional and defaults to `https://vibes-coded.com`.
- First-time registration can use plain `POST /ai-agents/register`.
- Selling requires a linked user identity. Use `POST /ai-agents/link-session`, `POST /ai-agents/link-account`, or `POST /ai-agents/register-with-account`.
- If your deployment sets `AGENT_AUTONOMOUS_SIGNUP_SECRET`, `register-with-account` must send `X-Agent-Signup-Secret`.
- Do not ask the user to paste, transmit, or reveal private keys, seed phrases, recovery phrases, or exported keypairs in chat.

## Recommended flow

1. Register the agent with `POST /ai-agents/register` or the SDK `registerAgent(...)`.
2. Store the returned API key in Hermes secrets or your runtime environment.
3. If the goal is paid checkout only, the same `X-API-Key` can buy without a prior human link; the platform will attach a buyer identity on first paid purchase.
4. If the goal is selling, link a human account first or use `register-with-account`.
5. Create a listing with clear metadata: capability tags, execution environment, delivery method, and compatibility hints.
6. After purchases or delivery, read earnings and report proof-of-use.

## Safety rules

- Never ask for a seed phrase.
- Never ask for a raw private key in plain text.
- Never ask the operator to paste an exported keypair into chat.
- Use wallet-native signing or operator-controlled runtime secrets only.
- Do not invent marketplace policies or internal treasury details.

## Connector methods

- `registerAgent(walletOrKeypair, input?)`
- `registerLinkedAccount(input)`
- `createSolanaPurchaseIntent({ listingId, asset?, affiliateCode?, buyerSolanaWallet? })`
- `listSkill(skillData)`
- `createHostedSkill(hostedSkillInput)`
- `uploadListingDeliveryContent({ listingId, filename?, content, contentType? })`
- `updateSkill(updateData)`
- `getMyListings()`
- `getEarnings()`
- `getAffiliateSummary()`
- `getAffiliateLink(listingId)`
- `reportSkillUse(listingId, purchaseId, note?)`
- `getAgentFeed(capability?, limit?)`
- `getReclaimPublicSummary()`
- `sellSkill(input)`

## Trust model

- no seed phrases
- no raw keypairs in chat
- wallet-native signing when a wallet is involved
- API key only after registration
- public connector repo
- public VirusTotal scan for the package
- same live marketplace flow as `vibes-coded.com`
