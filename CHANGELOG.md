# Changelog

All notable changes to WoW Guild Hub. Version numbers follow
[Semantic Versioning](https://semver.org/): patch for fixes, minor for new content,
major for changes that require operators to adjust something.

This file is maintained by [release-please](https://github.com/googleapis/release-please) from the
[Conventional Commits](https://www.conventionalcommits.org/) on `main`. Please do not edit it by hand; see
[CONTRIBUTING.md](CONTRIBUTING.md#commits-and-versions).

## [2.1.2](https://github.com/geninOne/wow-guild-hub/compare/v2.1.1...v2.1.2) (2026-11-26)


### Bug Fixes

* dedicated budget for character stats, static collector every 4 hours ([#8](https://github.com/geninOne/wow-guild-hub/issues/8)) ([4b1d3e4](https://github.com/geninOne/wow-guild-hub/commit/4b1d3e4a1e131230adb843679af99fd721fe7a12))

## [2.1.1](https://github.com/geninOne/wow-guild-hub/compare/v2.1.0...v2.1.1) (2026-11-26)


### Bug Fixes

* retry missing icons and fill item levels from the item endpoint ([#6](https://github.com/geninOne/wow-guild-hub/issues/6)) ([f7a8f3e](https://github.com/geninOne/wow-guild-hub/commit/f7a8f3e9eb538b78bf7ed5612c236f9c7d03dca2))

## [2.1.0](https://github.com/geninOne/wow-guild-hub/compare/v2.0.0...v2.1.0) (2026-11-26)


### Features

* stats tab on the character page ([#4](https://github.com/geninOne/wow-guild-hub/issues/4)) ([f92853d](https://github.com/geninOne/wow-guild-hub/commit/f92853dbc0323b68ae0becf13cad9824e2b91df2))

## 2.0.0 (2026-11-26)

First public version. The site was built for a community of two guilds in WoW Forever and can now
be used by any guild.

- **Guild, characters, professions:** member list with filters, character pages with gear, stats, talents,
  professions, reputation, dungeons and raids plus a monthly review, profession directory with recipes. Several guilds can be
  combined into one community.
- **Statistics:** class and level distribution, activity heatmap, guild statistics by week, month and
  all time, dungeons and raids of the whole guild.
- **Fun titles and weekly newspaper:** twelve titles per week with a hall of fame, and a weekly newspaper built from
  text blocks or, with your own AI gateway, written by Claude.
- **Languages:** German and English, optionally also Swabian and Bavarian (`WEBSITE_LANGUAGES`).
- **Configuration via environment variables only:** guild, rank names, game version, name, logo, colors, Discord,
  imprint and Umami (see `.env.example`). Imprint and privacy policy are templates with placeholders.
- **Extensions:** modules for custom tabs, pages, character data, newspaper articles and legal texts
  (`docs/extensions.md`).
- **Installation:** "Deploy to Netlify" button, data from the Blizzard API stored in Netlify Blobs, locally with
  Docker. Checks with oxlint, vitest, typecheck and build on every pull request, Dependabot for npm and Actions.
