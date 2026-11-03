// Copies p5.min.js from node_modules into public/vendor so the Worker serves it itself.
// Sandboxed faces can then be blocked from reaching any other site.
import fs from "node:fs"
const src = "node_modules/p5/lib/p5.min.js"
fs.mkdirSync("public/vendor", { recursive: true })
fs.copyFileSync(src, "public/vendor/p5.min.js")
console.log("copied", src, "->", "public/vendor/p5.min.js")
