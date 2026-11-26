# Changelog

All notable changes to WoW Guild Hub. Version numbers follow
[Semantic Versioning](https://semver.org/): patch for fixes, minor for new content,
major for changes that require operators to adjust something.

New entries go under "Unreleased". `npm run release:patch`, `release:minor` or
`release:major` turns them into the section of the new version, commits and sets the tag.

## Unreleased

First public version. The site was built for a community of two guilds in WoW Forever and can now
be used by any guild.

- **Guild, characters, professions:** member list with filters, character pages with gear, talents, professions,
  reputation, dungeons and raids plus a monthly review, profession directory with recipes. Several guilds can be
  combined into one community.
- **Statistics:** class and level distribution, activity heatmap, guild statistics by week, month and
  all time, dungeons and raids of the whole guild.
- **Fun titles and weekly newspaper:** twelve titles per week with a hall of fame, and a weekly newspaper built from
  text blocks or, with your own AI gateway, written by Claude.
- **Languages:** German and English, optionally also Swabian and Bavarian (`SITE_LANGUAGES`).
- **Configuration via environment variables only:** guild, rank names, game version, name, logo, colors, Discord,
  imprint and Umami (see `.env.example`). Imprint and privacy policy are templates with placeholders.
- **Extensions:** modules for custom tabs, pages, character data, newspaper articles and legal texts
  (`docs/erweiterungen.md`).
- **Installation:** "Deploy to Netlify" button, data from the Blizzard API stored in Netlify Blobs, locally with
  Docker. Checks with oxlint, vitest, typecheck and build on every pull request, Dependabot for npm and Actions.
