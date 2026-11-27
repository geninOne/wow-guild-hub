<!-- Title: Conventional Commits in English, e.g. "feat(professions): filter by recipe rank" or "fix: version in the footer".
     Add "!" after the type for changes that operators have to act on (major version). See CONTRIBUTING.md. -->

## What changes?

<!-- Briefly describe what the pull request does and why. Link the related issue, e.g. "Closes #12". -->

## How was it tested?

- [ ] `npm run lint`
- [ ] `npm run check:english -- --all --strict`
- [ ] `npm test`
- [ ] `npm run typecheck`
- [ ] `npm run build`
- [ ] Checked locally in Docker (for interface changes, ideally with a screenshot)

## Checklist

- [ ] The title follows Conventional Commits (`feat`, `fix`, `docs`, `chore`, ...).
- [ ] Texts exist in German and English (dialects are optional).
- [ ] New settings are documented with a comment in `.env.example`.
- [ ] No secrets, no real credentials, no personal data in the diff.
- [ ] `CHANGELOG.md` and the version are untouched (release-please maintains them).

## Upgrade notes

<!-- Only for breaking changes ("!" in the title): what do operators have to do after updating?
     New, renamed or removed environment variables, steps on Netlify, data migration. Otherwise delete this section. -->
