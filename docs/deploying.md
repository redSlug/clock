# Deploying and the Cloudflare account

Best practices, so nothing lands in the wrong account or leaks:

- Use a dedicated Cloudflare account for this project. Its ID is pinned as `account_id` in `wrangler.jsonc`, so wrangler refuses to act on any other account.
- Run `npx wrangler whoami` before any remote command and check the account.
- Keep secrets out of the repo. Production secrets go in with `npx wrangler secret put <NAME>`. Local ones go in `.dev.vars`, which is gitignored.
- Prefer `npx wrangler login` over a long-lived API token. If you use a token, scope it to this one account and store it outside the project.
- Use a different `BETTER_AUTH_SECRET` in production than in local development.
- Register the Recurse OAuth app only after you know the final public URL (`https://clock.recurse.com`), because its redirect URIs can't be edited later.

To do the whole Cloudflare setup in one go (database, bucket, tables, deploy, secrets), run `npm run setup:cloudflare`. See the header of `scripts/setup-cloudflare.sh` for how to pass values in, and `scripts/setup.env.example` for the env file format.

Rules for coding assistants are in [CLAUDE.md](../CLAUDE.md).

## CI/CD (GitHub Actions)

`.github/workflows/ci.yml` runs on every pull request and every push to `main`:

1. **check** (always): `npm ci`, `npx tsc --noEmit`, `npm test`.
2. **deploy** (only on a push to `main`, and only if `check` passed): applies database migrations (`npm run db:migrate:remote`), deploys the Worker (`npm run deploy`), then calls `/api/v1/health` on the live site to confirm it came up.

Pull requests never deploy. Deploys never overlap, and a deploy that has started is never cancelled halfway.

One-time setup:
1. Create a Cloudflare API token limited to the **recurse-round-display** account, with Workers Scripts (Edit), D1 (Edit) and Workers R2 Storage (Edit). Dashboard: My Profile, API Tokens, Create Token.
2. Store it as a GitHub secret. In your own terminal (the value is hidden as you paste it):
   ```sh
   gh secret set CLOUDFLARE_API_TOKEN
   ```
3. Use one deploy path only. If the Cloudflare dashboard's Git integration (Workers Builds) is also connected to this repo, every push deploys twice. Disconnect it in the dashboard: Workers & Pages, circular-led-server, Settings, Builds.

The Recurse and auth secrets (`RC_CLIENT_ID`, `RC_CLIENT_SECRET`, `BETTER_AUTH_SECRET`) live in the Worker and are not touched by CI. The Cloudflare account ID and D1 database ID are not secret and are in `wrangler.jsonc`.
