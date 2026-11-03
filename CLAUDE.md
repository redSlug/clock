# CLAUDE.md

Project guide for coding assistants. Human-facing docs are in [README.md](README.md) and [docs/design.md](docs/design.md).

## Cloudflare account rules

This project lives in ONE Cloudflare account only: **recurse-round-display**, account ID `78e9f9f85e887bc898342c01067c448c`. Never use any other account.

- Do NOT use the owner's older personal account (ID `cf8a6168894478444be767a94f8ee987`). If `wrangler whoami` ever shows that account, stop and tell the user.
- `account_id` is pinned in `wrangler.jsonc`. Never remove it. It makes wrangler refuse to act on any other account.
- Before ANY remote wrangler command, run `npx wrangler whoami` and confirm the account is `78e9f9f8...`.
- Production deploys normally happen through GitHub Actions on a push to `main` (see the README, CI/CD). Do not deploy by hand unless the user asks. Remote commands need the user's explicit OK first: `deploy`, anything with `--remote`, `r2 bucket create/delete`, `d1 create/delete`, `secret put/delete`. Local commands (`--local`, `wrangler dev`, tests) are fine without asking.
- Before deleting anything remote, look at what is in it and tell the user.

## Credentials

- Never ask the user to paste a token or secret into chat. Prefer `wrangler login`, or have them create a file outside the repo (see below).
- Never print, `cat`, or echo secrets or env files. Check that a secrets file exists with `ls -l` only.
- If an API token is used, it lives in `~/.config/circular-led/cloudflare.env` (owner-only, outside the repo) and is loaded per command. Scope it to this one account.
- Secrets (`RC_CLIENT_ID`, `RC_CLIENT_SECRET`, `BETTER_AUTH_SECRET`) go in the Worker with `wrangler secret put`, and in `.dev.vars` for local development. `.dev.vars` is gitignored. Use a different `BETTER_AUTH_SECRET` in production than locally.
- Never put secrets in `wrangler.jsonc`, source files, docs, or commit messages. Scan staged files for secrets before committing.
- Account IDs, database IDs and the Recurse client ID are not secret. Tokens, client secrets and `BETTER_AUTH_SECRET` are.

## Recurse OAuth

- Recurse does not allow editing redirect URIs after an app is created. Get the final URL right first.
- The public address is `https://clock.recurse.com` (a proxy in front of the Worker), set as `BASE_URL` in `wrangler.jsonc`. Redirect URIs: `http://localhost:8787/api/v1/auth/callback/recurse` and `https://clock.recurse.com/api/v1/auth/callback/recurse` (no trailing slash). An OAuth app registered only for the workers.dev address does not work with this `BASE_URL`.
- Local development uses the fake Recurse server (`npm run mock-rc`), so no real credentials are needed.

## Working in the repo

- `npm test` and `npx tsc --noEmit` should pass before committing.
- Faces run in a sandboxed iframe with no network. Do not add `allow-same-origin` to that sandbox, or let faces make network requests, without discussing it.
- Moderation is deliberately open: any signed-in user can pause or delete ANY face; only the owner can edit. Don't tighten or loosen this without asking.
- Commit and push only when the user asks.
