// Loads the example faces in seed/faces into R2 and D1 under a "seed" user.
// Usage: node scripts/seed.mjs --local    (the wrangler dev database)
//        node scripts/seed.mjs --remote   (the real deployed one)
// Safe to run twice: a face already seeded is skipped.
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

const target = process.argv.includes("--remote") ? "--remote" : "--local"
const BUCKET = "circular-led-faces"
const DB = "circular-led-server"
const dir = "seed/faces"
const wrangler = (args) => execFileSync("npx", ["wrangler", ...args], { stdio: ["ignore", "inherit", "inherit"] })

const files = fs.readdirSync(dir).filter((f) => f.endsWith(".js")).sort()
const nice = (f) => f.replace(/\.js$/, "").replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase())
const q = (s) => `'${s.replace(/'/g, "''")}'`

let sql = `INSERT OR IGNORE INTO user (id, name, email, email_verified) VALUES ('seed-user', 'Example faces', 'seed@circular-led.invalid', 1);\n`
for (const f of files) {
	const key = `seed/${f}`
	wrangler(["r2", "object", "put", `${BUCKET}/${key}`, "--file", path.join(dir, f), "--content-type", "text/plain; charset=utf-8", target])
	sql += `INSERT INTO face (user_id, name, r2_key) SELECT 'seed-user', ${q(nice(f))}, ${q(key)} WHERE NOT EXISTS (SELECT 1 FROM face WHERE r2_key = ${q(key)});\n`
}
const sqlFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "seed-")), "seed.sql")
fs.writeFileSync(sqlFile, sql)
wrangler(["d1", "execute", DB, target, "--file", sqlFile])
console.log(`Seeded ${files.length} faces (${target.slice(2)}).`)
