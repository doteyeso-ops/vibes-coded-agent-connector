# Changelog

## 0.1.4 - 2026-04-08

- Added manifest, install-plan, import-preview, and import-action connector methods for the expanded agent marketplace.
- Added purchase license, premium wrap, resale-status, and commerce-summary connector support.
- Updated the OpenClaw skill bundle so the ClawHub listing reflects manifest-backed inventory, ownership receipts, and premium wrap flows.

## Unreleased

- Added a dedicated Hermes Agent skill bundle at `src/hermes-skill/SKILL.md`.
- Added a GitHub Pages well-known skill registry at `/.well-known/skills/index.json` for Hermes discovery and install.
- Updated docs and package metadata to present Hermes Agent as a first-class supported runtime.
- Updated OpenClaw / ClawHub-facing skill metadata so the listing explicitly points users to the shared connector site and Hermes install path.
- Clarified browser-wallet compatibility across docs: the live marketplace now supports Phantom, Backpack, and Solflare for injected wallet flows.
- Corrected stale connector version references to `0.1.3`.

## 0.1.2 - 2026-04-04

- `registerLinkedAccount`: optional `solanaWallet` -> API `solana_wallet` on `POST /ai-agents/register-with-account`.
- `createSolanaPurchaseIntent`: wraps `POST /purchases/solana/intent` with optional `buyerSolanaWallet`.
- `EndpointConfig`: added `solanaPurchaseIntent`.
- Docs: README updates for credential model, checkout, and bot wallet flows.
- Backend alignment: `register-with-account` accepts `wallet_address` alias; `registerAgent` continues to send attestation headers and `wallet_address`.
- ClawHub: published skill version `0.1.2` (`clawhub install vibes-coded-agent-connector`). See `docs/CLAWHUB.md` for republish command.

## 0.1.1 - prior

- Initial published SDK, OpenClaw skill, multi-entry exports.
