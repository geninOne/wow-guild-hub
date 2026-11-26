# Security

🇩🇪 [Deutsch](SECURITY.de.md)

## Supported versions

Security fixes are provided for the latest version on `main`. If you forked the site, you get fixes by pulling
the changes from here (see the [README](README.md), section "Updating").

## Reporting a vulnerability

Please do **not** report security vulnerabilities as a public issue, pull request or on Discord.

Instead, report them privately through GitHub:
[Security, Report a vulnerability](https://github.com/geninOne/wow-guild-hub/security/advisories/new).

Helpful details:

- what is affected (file, endpoint, page),
- how the vulnerability can be exploited, ideally with a small example,
- what impact you see.

I usually confirm receipt within a few days, get back to you with an assessment and let you know when the fix
is released. If you like, you will be credited in the release notes.

## Please don't

- No tests against other people's installations or against the Blizzard API beyond normal use.
- Don't access, change or delete other people's data.
- No attacks on availability (load tests, flooding).

## For operators of your own installation

- Secrets (`BNET_CLIENT_SECRET`, upload codes, tokens) belong only in environment variables, never in the
  repository.
- Local Docker installations are reachable only on `127.0.0.1`. Please keep it that way, because `netlify dev`
  triggers the collectors via a URL without protection.
- Apply Dependabot updates promptly.
