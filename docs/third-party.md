# Third-party code and licenses

This project's own code is MIT licensed (see [LICENSE](../LICENSE)). It includes one copy of someone else's code.

## p5.js (vendored)

- **What:** [`public/vendor/p5.min.js`](https://github.com/redSlug/clock/blob/main/public/vendor/p5.min.js), version 2.3.4, from the `p5` npm package. It is served to the display and to the editor preview.
- **License:** LGPL-2.1. The full text is next to it: [`public/vendor/p5-LICENSE.txt`](https://github.com/redSlug/clock/blob/main/public/vendor/p5-LICENSE.txt). p5 is © the Processing Foundation and its contributors.
- **Source:** https://github.com/processing/p5.js (the file is p5's own build, unmodified, byte for byte the same as `node_modules/p5/lib/p5.min.js`).

What LGPL-2.1 asks of us when we distribute a copy, and how we meet it:

| The license asks | What we do |
| --- | --- |
| Keep the copyright notices and include the license text | The notices are inside `p5.min.js`, and the license text is served next to it as [`p5-LICENSE.txt`](https://github.com/redSlug/clock/blob/main/public/vendor/p5-LICENSE.txt). |
| Say that the library is used and under which license | This page, and the credit in the README. |
| Let people swap in a different or modified version of the library | We use p5 as a separate, unmodified file loaded by a script tag. Nothing of ours is compiled into it. To use another version, run `npm run vendor-p5` after changing the `p5` version, or replace the file. |
| Share the source of any changes we make to the library | We make none. If that ever changes, publish the changed source. |

Our own code stays MIT. It only calls p5 through the normal p5 functions, so the LGPL does not spread to it.

This is our reading of the license, not legal advice. If you ship this commercially, check it with someone qualified.

## Rubik Dirt (font)

- **What:** [`public/fonts/RubikDirt.woff2`](https://github.com/redSlug/clock/blob/main/public/fonts/RubikDirt.woff2), the web version of the Rubik Dirt font from [Google Fonts](https://fonts.google.com/specimen/Rubik+Dirt). It draws the page titles ("Clock", "Faces") on the home, editor and preview pages. We serve it from our own site, so visitors do not contact Google.
- **License:** SIL Open Font License 1.1. The full text, with the copyright line, is next to it: [`public/fonts/RubikDirt-OFL.txt`](https://github.com/redSlug/clock/blob/main/public/fonts/RubikDirt-OFL.txt). © 2020 The Rubik Filtered Project Authors (designers NaN and Luke Prowse).
- **What the license asks of us:** keep the copyright notice and license text with the font (we do), do not sell the font file on its own (we do not), and do not release a modified copy under the original name (we do not modify it). Using it on a website and shipping it in an MIT repo is allowed. The font stays under the OFL, and our code stays MIT.

## Packages installed with npm

Hono, Better Auth, Drizzle ORM, Wrangler and the rest are installed from npm and bundled into the Worker when it is built. They carry permissive licenses (mostly MIT). We do not copy their source into this repo, and each package's license is in `node_modules/<package>/` after `npm install`.
