# TODO

What is left, roughly in the order to do it. Tick items off as they are done.

## Auto deploy (do this first)

CI already type-checks and tests every push. The deploy job exists but fails on purpose until the secret is added (see [docs/deploying.md](deploying.md)).

- [x] Create a Cloudflare API token limited to the **recurse-round-display** account: Workers Scripts (Edit), D1 (Edit), Workers R2 Storage (Edit). Give it an expiry and note the date here so it gets rotated.
- [x] Store it: `gh secret set CLOUDFLARE_API_TOKEN` (in your own terminal; the value is hidden).
- [x] Re-run the failed deploy job: `gh run rerun <run id> --failed`. This ships anything not yet live, such as the editor syntax highlighting.
- [ ] Disconnect the Cloudflare dashboard Git integration (Workers & Pages, circular-led-server, Settings, Builds) if it is connected, so a push does not deploy twice.
- [ ] Optional: add a branch protection rule on `main` that requires the **Type-check and test** check, and require approval on the `production` environment.
- [ ] Optional: add a CI status badge to the README.

## Check it works for real

Checked in tests or with fake users. A real person has signed in; the items below are still unchecked on the live site.

- [x] Sign in with Recurse from https://clock.recurse.com (not the workers.dev address). Confirmed by a real person.
- [ ] On the live site: create a face in the editor, edit it, pause it, resume it, delete it.
- [ ] Editor in a real browser: cursor position matches the colored text, scrolling stays aligned, Tab indents, Cmd/Ctrl+S saves. Also try it on a phone; the layout stacks, but it has not been tried.
- [ ] Confirm the display page swaps faces every minute on the real display, and skips a paused face.

## Raspberry Pi

- [ ] Write the setup steps: a browser in kiosk mode on https://clock.recurse.com/display, starting at boot, with the screen never sleeping.
- [ ] Set the timezone (or add `?tz=America/New_York` to the display URL) and make sure network time (NTP) is on. A Pi has no battery-backed clock.
- [ ] Decide what the Pi shows when the network is down. Today it keeps the current face, or the built-in clock if nothing has loaded yet.
- [ ] Set the real face size. `face.size` is 720 by default, so match it to the LCD display's resolution (`?size=`).
- [ ] Hide the mouse cursor and any browser UI on the display.

## Product decisions still open

- [ ] Delete is permanent and any signed-in person can delete any face. If that becomes a problem: soft delete, an owner-or-admin rule, or an audit log (see design doc, Moderation).
- [ ] What the face sandbox allows exactly. It blocks all network access today.
- [ ] Offer `face.date` or `face.millis` to faces?
- [ ] Limits on uploads: faces per user, and rate limiting on the API. There is only a size limit (100 KB) today.

## Editor improvements

- [ ] Show the round edge and safe area, so people see what a square canvas loses.
- [ ] Show the line number of an error from the sketch.
- [ ] Warn before leaving with unsaved changes.
- [ ] More starter templates, not just one.
- [ ] Idea, later: draw on a phone and turn the drawing into p5 code (see design doc, Ideas).

## Engineering

- [ ] API integration tests that run in CI. The API rules (pause, delete, edit, rotation) were only checked by hand against a local server with fake users.
- [ ] The proxy at clock.recurse.com caches static pages. After a deploy a page can look stale. Check cache headers, or find out how to purge.
- [ ] The R2 S3 endpoint failed its TLS handshake from the dev machine (for every hostname, with both `curl` and `openssl`). Cause unknown, probably the network. The S3 keys are optional, so nothing depends on this.
- [ ] Remove the unused Recurse OAuth app if one is still registered for the old workers.dev address.
