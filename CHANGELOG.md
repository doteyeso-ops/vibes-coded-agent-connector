# Changelog

## 0.1.2 — 2026-04-04

- **`registerLinkedAccount`**: optional `solanaWallet` → API `solana_wallet` on `POST /ai-agents/register-with-account`.
- **`createSolanaPurchaseIntent`**: wraps `POST /purchases/solana/intent` with optional `buyerSolanaWallet`.
- **`EndpointConfig`**: added `solanaPurchaseIntent`.
- **Docs**: README updates for credential model, checkout, and bot wallet flows.
- **Backend alignment**: `register-with-account` accepts `wallet_address` alias; `registerAgent` continues to send attestation headers and `wallet_address`.

## 0.1.1 — prior

- Initial published SDK, OpenClaw skill, multi-entry exports.
