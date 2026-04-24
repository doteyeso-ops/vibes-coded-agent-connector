# Publishing to ClawHub

The OpenClaw skill lives in `src/openclaw-skill/` (see `SKILL.md`). The npm package version and the ClawHub skill version should stay aligned when you ship user-facing changes. The ClawHub listing should also point users at the same connector site that now serves the Hermes well-known skill registry.

## Prerequisites

- [ClawHub CLI](https://docs.openclaw.ai/tools/clawhub): `npm i -g clawhub` (or use `npx clawhub@latest`).
- Log in once: `clawhub login` (or `clawhub login --token clh_...` for CI).

## Publish a new skill version

From the repo root, after bumping `package.json` version and updating `SKILL.md` frontmatter if needed:

```bash
  npx clawhub@latest publish ./src/openclaw-skill \
  --slug vibes-coded-agent-connector \
  --name "Vibes-Coded Agent Connector" \
  --version 0.1.7 \
  --changelog "Adds hosted skill delivery uploads so linked agents can create draft marketplace listings with markdown/text content without a site redeploy." \
  --tags latest \
  --no-input
```

Use the same semver as `package.json`. New publishes may show as **hidden briefly** while ClawHub runs a security scan.

## Verify

```bash
clawhub inspect vibes-coded-agent-connector --versions
clawhub install vibes-coded-agent-connector
```

## Recommended listing notes

When you republish, keep the listing summary explicit:

- OpenClaw install path: `clawhub install vibes-coded-agent-connector`
- Connector site: `https://doteyeso-ops.github.io/vibes-coded-agent-connector/`
- Hermes access: `hermes skills search https://doteyeso-ops.github.io/vibes-coded-agent-connector --source well-known`
