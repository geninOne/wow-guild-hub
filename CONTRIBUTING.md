# Contributing

🇩🇪 [Deutsch](CONTRIBUTING.de.md)

Great that you want to help! Bug reports, ideas, translations and code are all equally welcome.
By taking part, you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).

## Issues

- **Bugs:** use the "Report a bug" template. Please include the version (in the site footer), steps to reproduce
  and, if possible, logs. Never post secrets (client secret, codes, tokens).
- **Ideas:** use the "Request a feature" template. For larger plans, please open an issue first and agree on the
  approach before writing a lot of code.
- **Security vulnerabilities:** never in public, but as described in [SECURITY.md](SECURITY.md).

## Pull requests

1. Fork the repository and create a branch from `main`, e.g. `berufe-filter` or `fix-talentbaum`.
2. Keep it small: one topic per pull request, ideally in several small commits.
3. Check locally (see below). The GitHub Action runs the same steps on every pull request.
4. Add an entry under "Unreleased" in [CHANGELOG.md](CHANGELOG.md).
5. Open the pull request using the template. At least one review is required, and all checks must be green.

Pull requests from forks get no access to secrets. Anything that needs credentials can therefore only be tested
locally.

## Developing locally

Requirements: Docker or Node.js 22.

```bash
cp .env.example .env
```

For real data, enter credentials from the
[Battle.net Developer Portal](https://develop.battle.net/access/clients) and the slug of a guild in `.env`. Then:

```bash
docker compose up -d --build
```

The site runs at http://localhost:8888, and the collectors run on schedule. Without Docker:

```bash
npm ci
npx netlify dev
```

The tests run even without your own credentials; they use recorded API responses (`test/fixtures`).

## Checks

```bash
npm run lint
```

```bash
npm test
```

```bash
npm run typecheck
```

```bash
npm run build
```

## Code style

- TypeScript, React with function components, no new dependencies without a good reason.
- Identifiers, comments and texts are mostly German; fields from the Blizzard API stay as they are.
- Every visible text has a German and an English version (`Fassungen` from `src/sprache.ts`). Swabian and
  Bavarian are optional.
- No em dashes (U+2014) in texts.
- No values hard-coded that differ per guild: add new settings as an environment variable with a default value
  and a comment in `.env.example`.
- Never log secrets and never include them in error messages.
- `npm run lint` (oxlint) must pass without findings.
- New logic gets tests (vitest), interface components get tests with Testing Library.

## Commits

A short subject line in German following the pattern `Area: what changes`, e.g.
`Berufe: Filter nach Rezeptstufe`. In the body below, if needed, explain why. Each commit should build on its own
and pass the tests.

## Versions

Versions follow [Semantic Versioning](https://semver.org/): patch for fixes, minor for new features, major for
changes after which operators have to adjust something (e.g. new required variables).
Releases are made by the maintainer.
