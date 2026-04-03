# Contributing

Thanks for helping improve `vibes-coded-agent-connector`.

## Local workflow

1. Install dependencies:

```bash
npm install
```

2. Run the type checker:

```bash
npm run check
```

3. Build the package:

```bash
npm run build
```

## Repo goals

- Keep the SDK easy to read and extend.
- Prefer natural-language errors that agents can surface directly to operators.
- Keep wallet flows non-custodial. Do not add anything that requests or stores seed phrases.
- Preserve compatibility with the current Vibes-Coded API, while making extension points obvious for future endpoints.

## Pull request checklist

- TypeScript stays in strict mode.
- Public methods are documented.
- New endpoints are added through the shared request layer in `src/sdk.ts`.
- README examples stay accurate.
