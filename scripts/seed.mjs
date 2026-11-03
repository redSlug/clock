// Loads the example faces in seed/faces into R2 and D1 under a "seed" user.
// Usage: node scripts/seed.mjs --local    (the wrangler dev database)
//        node scripts/seed.mjs --remote   (the real deployed one)
// Safe to run twice: a face already seeded is skipped.
import { execFileSync, spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

const target = process.argv.includes("--remote") ? "--remote" : "--local"
const BUCKET = "circular-led-faces"
const DB = "circular-led-server"
const dir = "seed/faces"
const wrangler = (args) => execFileSync("npx", ["wrangler", ...args], { stdio: ["ignore", "inherit", "inherit"] })

// With --remote, if R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_S3_ENDPOINT are set and the aws CLI exists,
// upload objects over the S3 API. Otherwise use wrangler.
const { R2_ACCESS_KEY_ID: s3Key, R2_SECRET_ACCESS_KEY: s3Secret, R2_S3_ENDPOINT: s3Endpoint } = process.env
const useS3 = target === "--remote" && s3Key && s3Secret && s3Endpoint && spawnSync("aws", ["--version"]).status === 0
if (target === "--remote") console.log(useS3 ? "Uploading objects over the R2 S3 API." : "Uploading objects with wrangler.")
function putObject(key, file) {
	if (!useS3) {
		return wrangler(["r2", "object", "put", `${BUCKET}/${key}`, "--file", file, "--content-type", "text/plain; charset=utf-8", target])
	}
	execFileSync("aws", ["s3", "cp", file, `s3://${BUCKET}/${key}`, "--endpoint-url", s3Endpoint, "--content-type", "text/plain; charset=utf-8"], {
		stdio: ["ignore", "inherit", "inherit"],
		env: { ...process.env, AWS_ACCESS_KEY_ID: s3Key, AWS_SECRET_ACCESS_KEY: s3Secret, AWS_DEFAULT_REGION: "auto", AWS_EC2_METADATA_DISABLED: "true" },
	})
}

const files = fs.readdirSync(dir).filter((f) => f.endsWith(".js")).sort()
const nice = (f) => f.replace(/\.js$/, "").replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase())
const q = (s) => `'${s.replace(/'/g, "''")}'`

let sql = `INSERT OR IGNORE INTO user (id, name, email, email_verified) VALUES ('seed-user', 'Example faces', 'seed@circular-lcd.invalid', 1);\n`
for (const f of files) {
	const key = `seed/${f}`
	putObject(key, path.join(dir, f))
	sql += `INSERT INTO face (user_id, name, r2_key) SELECT 'seed-user', ${q(nice(f))}, ${q(key)} WHERE NOT EXISTS (SELECT 1 FROM face WHERE r2_key = ${q(key)});\n`
}
const sqlFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "seed-")), "seed.sql")
fs.writeFileSync(sqlFile, sql)
wrangler(["d1", "execute", DB, target, "--file", sqlFile])
console.log(`Seeded ${files.length} faces (${target.slice(2)}).`)
