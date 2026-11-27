# AGENTS.md

Guidance for AI coding agents (Claude Code, Codex, Copilot and others) working in this repository. Humans should
read [CONTRIBUTING.md](CONTRIBUTING.md) first; this file sums up the same rules plus what an agent tends to get
wrong.

## Project

A self-hosted website for a World of Warcraft guild. Scheduled Netlify Functions pull data from the Blizzard API,
store it as JSON in Netlify Blobs (no database), and an `/api/*` function turns it into views for a Vite + React
single-page app. Forks deploy it for their own guild; a private downstream fork pulls `main` regularly.

```
Blizzard API ──> collectors (scheduled functions) ──> Netlify Blobs ──> /api/* ──> React app (web/)
                 collect-guild    hourly               store "gilde"     router.ts
                 collect-static   every 4 h at :30
                 collect-weekly   daily 5:15-7:15 UTC (writes once per finished week)
```

| Path | What |
| --- | --- |
| `netlify/functions/*.mts` | Thin entry points: `api`, `collect-guild`, `collect-static`, `collect-weekly` |
| `src/blizzard/client.ts` | Blizzard API client: OAuth token, request spacing, timeouts, secret-free errors |
| `src/collect/` | Collectors: roster, characters, activity, level-ups, static game data, time budget |
| `src/transform/` | Raw Blizzard responses to stored records |
| `src/stats/`, `src/weekly/` | Statistics snapshots and diffs; weekly fun titles and the weekly newspaper |
| `src/api/` | `router.ts` dispatches `/api/*`; one `*-view.ts` per view; `http.ts` builds JSON responses with cache headers |
| `src/store.ts` | `JsonStore` interface: Netlify Blobs in production, in-memory store in tests |
| `src/model.ts`, `src/api/types.ts` | Stored records and API response types (shared with `web/`) |
| `src/language.ts` | `Translations`: a text in every UI language |
| `web/src/` | React app: `pages/`, `components/`, `lib/`, `styles/theme.css` |
| `web/build/` | Build-time helpers (HTML head, error page, site URL from `WEBSITE_*` variables) |
| `config/*.json` | Static game data the API does not provide (dungeons, instance images, stat cards) |
| `scripts/` | Local tools: trigger collectors, sample data, blob copy, release helpers |
| `test/` | vitest, mirrors `src/` and `web/`; recorded API responses in `test/fixtures` |

**Extension points.** Modules add features without touching core files. They live in `src/extensions/<id>/` and
`web/src/extensions/<id>/` and register with one line each in `src/extensions/index.ts` and
`web/src/extensions/index.ts`. Hooks: own API routes, extra data on the character page, newspaper articles,
statistics and character tabs, own pages, legal pages. Full reference: [docs/extensions.md](docs/extensions.md).
Downstream forks keep private modules there, so the interfaces in `src/extensions/types.ts` and
`web/src/extensions/types.ts` are a public API: change them only in a backwards-compatible way or as a breaking
change (see below). Until 4.0 the 2.x registries (`src/erweiterungen/index.ts`, `web/src/erweiterungen/index.ts`)
and the deprecated aliases at the 2.x paths stay as well; `src/extensions/legacy.ts` and
`web/src/extensions/legacy.tsx` convert 2.x modules.

## Commands

Requires Node.js 22 (or Docker). Install with `npm ci`.

| Task | Command |
| --- | --- |
| Full local stack (site, `/api`, Blobs, scheduler) at http://localhost:8888 | `cp .env.example .env`, then `docker compose up -d --build` |
| Run a collector by hand | `docker compose exec app npm run collect:guild` (or `collect:static`, `collect:weekly`) |
| Collector report | `docker compose logs app \| grep '"job"'` |
| Fill the local store with sample data (`-- --remove` removes it) | `docker compose exec app npm run data:sample` |
| Rebuild the container after `package.json` changes | `docker compose up -d --build --renew-anon-volumes` |
| UI only with hot reload, no `/api` (http://127.0.0.1:5173) | `npm run dev:web` |
| Lint (must have zero findings) | `npm run lint` |
| Tests | `npm test` (single file: `npx vitest run test/api/router.test.ts`) |
| Type check (server and web) | `npm run typecheck` |
| Production build | `npm run build` |

CI (`.github/workflows/ci.yml`) runs `npm ci`, lint, test, typecheck and build. Run all four before you say a change
is done. Tests need no credentials; never add tests that call the real Blizzard API.

## Conventions

- **Language.** Write new code, identifiers, comments, test names, log and error messages, scripts, workflows and
  docs in English. Some existing code and comments are still German; they are migrated area by area in dedicated
  pull requests. Do not mix renames into feature or fix pull requests, and do not rename German identifiers you merely
  touch. Fields from the Blizzard API keep their original names.
- **UI texts are translations, not code.** Every visible text is a `Translations` object with `de` and `en`
  (required) and optionally `schwaebisch` and `bayrisch`. Add or change all languages you can; missing dialects fall
  back to German. Do not remove dialects.
- **No em dashes** (U+2014) anywhere in texts, comments or docs.
- **Docs.** English is the source. Files with a `.de.md` twin (README, CONTRIBUTING, SECURITY, CODE_OF_CONDUCT,
  `docs/extensions`) must be updated in both languages in the same pull request.
- **Configuration.** Nothing guild-specific is hard-coded. New settings become environment variables with a default
  and a comment in `.env.example`; if Netlify needs them, also add them to `scripts/netlify-env-lib.mjs` and
  `.github/workflows/release.yml`. `WEBSITE_*` variables apply at build time.
- **Code style.** TypeScript, React function components, no new dependencies without a strong reason. New logic
  gets vitest tests; components get Testing Library tests.
- **Commits and pull requests.** `main` is protected: work on a branch and open a pull request. Pull requests are
  squash-merged, so the **title** must follow Conventional Commits in English
  (`feat(professions): filter by recipe rank`, `fix: footer version`); a workflow checks it.
  Use `!` for changes operators must act on and fill in "Upgrade notes" in the description. Never edit
  `CHANGELOG.md`, the version in `package.json` or `.release-please-manifest.json`: release-please does that.
  Use the pull request template.

## Hard rules

1. **Time budget.** Netlify's scheduler waits about 15 s for a scheduled function and starts it again otherwise.
   Collectors therefore work within `COLLECT_BUDGET_MS` (default 12 s) and stop starting new work after
   `workEndOf()` (`src/collect/budget.ts`); unfinished work continues in the next run. Every new loop over
   characters or API calls must check the budget, and no single request may run unbounded
   (`DEFAULT_REQUEST_TIMEOUT_MS` in the client). The `/api` function must answer from stored data only, never call
   Blizzard.
2. **Blizzard rate limit.** Blizzard allows 100 requests per second; the client spaces requests at 80/s. Do not bypass the client,
   raise these limits or add parallel fetch loops of your own. `COLLECT_CONCURRENCY` caps parallel requests per run,
   and the schedules are staggered so runs do not collide.
3. **No secrets.** Never commit `.env`, keys, tokens, gateway URLs or Netlify IDs. Never log secrets or put them
   in error messages (`BlizzardError` is deliberately secret-free). Example values belong in `.env.example` only.
4. **Stored data and public interfaces are stable.** Live sites hold years of data. Do not rename or restructure
   without a migration (and, for URLs, a redirect):
   - the Blobs store name (`gilde`) and blob keys and prefixes (`guild`, `characters/<id>`, `attributes/<id>`,
     `weekly/…`, `stats/…`, `history/…`, `static/…`, `activity/…`, `levelups`, extension prefixes);
   - fields of stored records (`src/model.ts`) and of API responses (`src/api/types.ts`);
   - API routes and query parameters (`/api/newspaper`, `/api/stats/week`, `?guild=`, `?week=`, …), including the
     German aliases of 2.x (`/api/zeitung`, `/api/stats/woche`, `?gilde=`, …) in `src/api/router.ts`;
   - page URLs and their redirects in `netlify.toml` (`/charakter/*`, `/berufe`, `/zeitung`, `?reiter=`, …);
   - environment variable names, Netlify function names and their schedules;
   - the extension interfaces (`src/extensions/types.ts`, `web/src/extensions/types.ts`) and, until 4.0, the
     deprecated 2.x paths (`src/erweiterungen/`, `web/src/erweiterungen/`, `src/sprache.ts`,
     `web/src/lib/sprache.tsx`, `src/weekly/zeitung-facts.ts`, `src/weekly/bausteine.ts`).
   Readers must tolerate old data (missing fields, old shapes). If a change here is unavoidable, it is a breaking
   change (`!`) with upgrade notes.
5. **UI texts in every language.** See Conventions: `de` and `en` are required by the `Translations` type, keep the
   dialects in step where they exist.
6. **Fork safety in workflows.** Never use `pull_request_target`, never check out or run fork code with secrets,
   keep `permissions:` minimal (default `contents: read`), use `persist-credentials: false` on checkout, and pin
   third-party actions to a commit SHA. Workflows on pull requests run with `pull_request` only.
7. **Pages need a redirect.** A new SPA route needs an entry in `netlify.toml` (no catch-all `/*`, so `/api/*`
   is never shadowed); `test/web/netlify-redirects.test.ts` checks it.

## Testing and verifying

- Unit and integration tests use `createMemoryStore()` and the fake client in `test/helpers/` with recorded
  responses from `test/fixtures/`; prefer extending those over new mocks. Inject time via `now` instead of
  mocking the clock globally.
- For a bug fix, write a failing test first.
- UI changes: check them in the running app (`docker compose up`, then `npm run data:sample` for data) at
  desktop and phone width, in German and English, not only in tests.
- Collector changes: run the collector in the container and read the JSON report line in the log; check that it
  finishes inside the budget and makes progress across runs.
- Before declaring done: `npm run lint && npm test && npm run typecheck && npm run build`, all green.
