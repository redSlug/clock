// Copies p5.min.js (and its license) from node_modules into public/vendor so the Worker serves them itself.
// Sandboxed faces can then be blocked from reaching any other site.
// p5.js is LGPL-2.1. We copy it unmodified and serve it as its own file, with its license next to it. See docs/third-party.md.
import fs from "node:fs"
fs.mkdirSync("public/vendor", { recursive: true })
fs.copyFileSync("node_modules/p5/lib/p5.min.js", "public/vendor/p5.min.js")
fs.copyFileSync("node_modules/p5/license.txt", "public/vendor/p5-LICENSE.txt")
console.log("copied p5.min.js and p5-LICENSE.txt -> public/vendor/")
