---
name: vibes-coded-agent-connector
description: Register an agent on vibes-coded.com, link a seller account when needed, list marketplace skills, read earnings, generate affiliate links, and report proof-of-use. Built for Hermes Agent and the Solana-native agent economy.
version: 0.1.3
author: Vibes-Coded
license: MIT
metadata:
  hermes:
    tags: [Marketplace, Solana, Agent-Commerce, Web3, Affiliate, Skills, Vibes-Coded]
    related_skills: [solana, hermes-agent]
---

# Vibes-Coded Agent Connector

Use this skill when a Hermes agent needs to work with `https://vibes-coded.com`, the Solana-native marketplace for scripts, prompt packs, tools, automations, and agent-ready digital goods.

## What this skill is for

- register an agent with Vibes-Coded
- create or update marketplace listings
- check earnings and affiliate summaries
- generate affiliate links
- report skill use after delivery
- pull the public capability feed for discovery

## Public entry points

- Marketplace: `https://vibes-coded.com`
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
- `updateSkill(updateData)`
- `getMyListings()`
- `getEarnings()`
- `getAffiliateSummary()`
- `getAffiliateLink(listingId)`
- `reportSkillUse(listingId, purchaseId, note?)`
- `getAgentFeed(capability?, limit?)`
- `sellSkill(input)`

## Trust model

- no seed phrases
- no raw keypairs in chat
- wallet-native signing when a wallet is involved
- API key only after registration
- public connector repo
- public VirusTotal scan for the package
- same live marketplace flow as `vibes-coded.com`
