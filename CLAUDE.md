# CLAUDE.md

Project guide for coding assistants. Human-facing docs: [README.md](README.md), [docs/design.md](docs/design.md), [docs/todo.md](docs/todo.md).

## What this is

A round LCD clock display. A **Cloudflare Worker** stores circular p5.js "clock faces", and a **Raspberry Pi** runs a fullscreen browser on `/display`, which asks the API for a new face every minute and shows it over HDMI. People sign in with **Recurse Center OAuth** (Better Auth), write faces in a live editor, and can pause or delete any face. Theme is a clock, but a face can be any circular sketch.

## Where things are

- Live site: https://clock.recurse.com (a proxy at Recurse in front of the Worker). Display page: `/display`. Editor: `/editor`.
- **It is an LCD display, not LED.** The Worker, D1, R2 and package names say `circular-led-*` by mistake and stay as they are on purpose. Do not write "LED" anywhere else.
- GitHub: `redSlug/clock` (private). Local folder: `/Users/bd/Development/clock`. The repo and folder were renamed from `circular-led-server`; the **Worker, D1 database and npm package keep the name `circular-led-server` on purpose** (renaming them would change the deployed Worker).
- Cloudflare: account `recurse-round-display`, Worker `circular-led-server`, D1 `circular-led-server` (id in `wrangler.jsonc`), R2 bucket `circular-led-faces`.

## Code map

- `src/index.ts` Hono API under `/api/v1`: `faces` list, `faces/next?after=ID` (next ACTIVE face, wraps, 204 if none), create, `PUT` (owner only), `PATCH {active}` (pause/resume, any signed-in user), `DELETE` (any signed-in user), `faces/:id/source`, `me`, `config`, `health`. Auth routes under `/api/v1/auth/*`.
- `src/auth.ts` Better Auth with `genericOAuth` provider `recurse`. `src/schema.ts` Drizzle schema (Better Auth tables + `face`). Migrations in `migrations/` (Drizzle generated, applied with wrangler).
- `public/` is served by Cloudflare static assets. Only `/api/*` runs the Worker first, so **pages never reach Worker code**.
  - `index.html` list, pause, delete. `editor.html` live editor. `preview.html` one face. `display.html` + `display.js` the Pi page (URL options: `?every=SECONDS`, `?face=ID`, `?time=HH:MM[:SS]`, `?tz=ZONE`, `?size=PX`, `?transparent`).
  - `runtime/face.js` defines the global `face` object (size, time, hand angles). `host.js` runs a face's source in a **sandboxed iframe** (no network, opaque origin). `highlight.js` editor syntax colors. `redirect.js` sends workers.dev visitors to the public URL. `starter-face.js` the editor's example code.
- `seed/faces/*.js` example faces. `scripts/` helpers (`seed.mjs`, `mock-rc.mjs`, `setup-cloudflare.sh`, `screenshot.mjs`, `docs-preview.mjs`).
- Tests are Vitest unit tests in `test/` (face runtime math, highlighter). API rules were only checked by hand so far (see TODO).

## Commands

```sh
npm install
cp .dev.vars.example .dev.vars        # then set BETTER_AUTH_SECRET
npm run db:migrate:local && npm run seed:local
npm run mock-rc                       # fake Recurse login on :9999 (MOCK_USER=2 logs in as a second person)
npm run dev                           # Worker on http://localhost:8787
npm test && npx tsc --noEmit          # what CI runs
npm run docs -- docs/todo.md          # render the markdown docs (with Mermaid) as an HTML page
npm run screenshot -- <url> <out.png> # headless Chrome screenshot, see the script header
npx wrangler types                    # after changing wrangler.jsonc or .dev.vars; commit worker-configuration.d.ts
```

## Status (2026-11-03)

- Live and working: faces API, editor with syntax highlighting, pause/delete, rotation, redirect to the public URL, and Recurse sign-in (a real person has signed in on https://clock.recurse.com).
- Auto deploy works. A push to `main` runs CI (type-check and test), then deploys through GitHub Actions with the `CLOUDFLARE_API_TOKEN` repo secret. Confirmed 2026-11-03. See [docs/deploying.md](docs/deploying.md).
- What is left is in [docs/todo.md](docs/todo.md).

## Gotchas learned the hard way

- **Sign-in must start on the host it returns to.** The OAuth state cookie only goes to the host that set it; starting on `workers.dev` and landing on `clock.recurse.com` gives `state_mismatch`. That is why `redirect.js` exists.
- `wrangler d1 create` and `r2 bucket create` rewrite `wrangler.jsonc` (duplicate bindings, reformatting). `setup-cloudflare.sh` snapshots and restores it. Check `git diff wrangler.jsonc` after any wrangler command that creates things.
- Local D1 state is keyed by `database_id`. Changing it in `wrangler.jsonc` gives an empty local database (re-run migrate and seed).
- `wrangler dev` reads its settings from `.dev.vars` (fake values are fine with the mock Recurse); `worker-configuration.d.ts` is generated from it and committed, because CI type-checks without `.dev.vars`.
- Plain `chrome --headless --screenshot` captures before p5 draws (blank circle). Use `scripts/screenshot.mjs`.
- The proxy caches static pages, so a page can look stale after a deploy.
- From the dev machine, the R2 S3 endpoint fails its TLS handshake for every account (cause unknown). The S3 keys are optional; the Worker uses the R2 binding.
- Recurse OAuth redirect URIs cannot be edited after creation, so a changed public URL needs a new OAuth app.

## How the user likes to work

- **Simple over clever.** They pushed back when designs and diagrams got complicated. Prefer the small, direct solution, and keep answers short and in plain language.
- **Be honest about what is tested.** Say what ran, what did not, and what you could not check. Do not claim a deploy, test or sign-in that did not happen.
- **Show things in Chrome:** `open -a "Google Chrome" <url>`, for example the docs preview or a screenshot.
- **No secrets in chat, no env files.** Scripts use hidden prompts. No hardcoded account IDs in scripts (read them from `wrangler.jsonc`).
- **Ask before outward actions** (deploy, push, deleting things) unless the user just asked for it, for example "pls deploy" or "push all changes". An automatic permission check once blocked a production deploy until the user asked explicitly.
- The user often sends messages while a task is running. Treat them as updates to the current task.

## Cloudflare account rules

This project lives in ONE Cloudflare account only: **recurse-round-display**, account ID `78e9f9f85e887bc898342c01067c448c`. Never use any other account.

- Do NOT use the owner's older personal account (ID `cf8a6168894478444be767a94f8ee987`). If `wrangler whoami` ever shows that account, stop and tell the user.
- `account_id` is pinned in `wrangler.jsonc`. Never remove it. It makes wrangler refuse to act on any other account.
- Before ANY remote wrangler command, run `npx wrangler whoami` and confirm the account is `78e9f9f8...`.
- Production deploys normally happen through GitHub Actions on a push to `main` (see [docs/deploying.md](docs/deploying.md)). Do not deploy by hand unless the user asks. Remote commands need the user's explicit OK first: `deploy`, anything with `--remote`, `r2 bucket create/delete`, `d1 create/delete`, `secret put/delete`. Local commands (`--local`, `wrangler dev`, tests) are fine without asking.
- Before deleting anything remote, look at what is in it and tell the user.

## Credentials

- Never ask the user to paste a token or secret into chat. Use `wrangler login`, or hidden prompts (`read -s`) in a script the user runs. The user does not want secrets kept in env files.
- Never print, `cat`, or echo secrets or env files. Check that a secrets file exists with `ls -l` only.
- Any Cloudflare API token must be scoped to this one account. The CI deploy uses the `CLOUDFLARE_API_TOKEN` GitHub repository secret.
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
