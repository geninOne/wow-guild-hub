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
4. Open the pull request using the template. Its **title** follows [Conventional Commits](#commits-and-versions),
   a check tests it. Do not edit `CHANGELOG.md` or the version, release-please does that.
5. At least one review by the maintainer is required, and all checks must be green. The pull request is merged
   with "Squash and merge", so its title becomes the commit on `main`.

Workflows on pull requests from forks run with `pull_request`: read-only, without secrets. Anything that needs
credentials can therefore only be tested locally. The maintainer approves workflow runs on pull requests from
forks by hand before they start.

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
- New code, identifiers, comments, tests and log messages are in English. Older code is still partly German and is
  being migrated in dedicated pull requests; fields from the Blizzard API stay as they are. Notes for AI coding
  agents: [AGENTS.md](AGENTS.md).
- Every visible text has a German and an English version (`Fassungen` from `src/sprache.ts`). Swabian and
  Bavarian are optional.
- No em dashes (U+2014) in texts.
- No values hard-coded that differ per guild: add new settings as an environment variable with a default value
  and a comment in `.env.example`.
- Never log secrets and never include them in error messages.
- `npm run lint` (oxlint) must pass without findings.
- New logic gets tests (vitest), interface components get tests with Testing Library.

## Commits and versions

Pull request titles (and therefore the commits on `main`) follow [Conventional Commits](https://www.conventionalcommits.org/),
in English: `<type>(<optional scope>): <summary>`, e.g. `feat(professions): filter by recipe rank` or
`fix: version in the footer`. Commits inside your branch are free-form, they are squashed when merging.

| Type | Use for | Release |
|---|---|---|
| `feat` | new feature | minor |
| `fix` | bug fix | patch |
| `perf`, `revert` | faster code, reverting a change | patch |
| `docs`, `style`, `refactor`, `test`, `build`, `ci`, `chore` | everything else | none |
| `!` after the type, e.g. `feat!: …` | change after which operators have to adjust something (e.g. a new required or renamed variable) | major |

Versions follow [Semantic Versioning](https://semver.org/). [release-please](https://github.com/googleapis/release-please)
collects the merged pull requests in a release pull request with the new version and the `CHANGELOG.md` section.
When the maintainer merges it, a tag `vX.Y.Z` and a GitHub release with the same notes are created. The public
repository deploys nothing itself.

**Breaking changes:** use `!` in the title and fill in "Upgrade notes" in the pull request description: which
environment variables are new, renamed or removed, and what operators have to do on Netlify. When merging, the
maintainer puts these notes into the commit message as a footer starting with `BREAKING CHANGE:`. They then appear
in the release notes of the major version under "Upgrade notes".
