# Run it locally

No Cloudflare or Recurse account is needed for local work. A fake Recurse server stands in for the real one.

```sh
npm install
cp .dev.vars.example .dev.vars   # then fill in BETTER_AUTH_SECRET (openssl rand -base64 32)
npm run db:migrate:local         # create the local database
npm run seed:local               # load the example faces from seed/faces
npm run mock-rc                  # terminal 1: fake Recurse on :9999
npm run dev                      # terminal 2: the Worker on :8787
```

Then open http://localhost:8787 (home, sign in, upload) or http://localhost:8787/display (what the Pi shows). Test options on the display page: `?every=5` swaps every 5 seconds, `?face=3` shows only face 3, `?time=18:00` freezes the clock, `?tz=America/New_York` sets the timezone. `npm test` runs the unit tests.

## Viewing the docs


`npm run docs` builds an HTML page from the markdown files, with Mermaid diagrams drawn, and opens it in your browser.
