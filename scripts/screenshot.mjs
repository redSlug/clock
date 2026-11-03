// Screenshot a page with headless Chrome, waiting for it to render, with a transparent background.
// Used for the README image. Needs Google Chrome installed (macOS path below) and the dev server running.
//   npm run dev        (in another terminal)
//   node scripts/screenshot.mjs "http://localhost:8787/display?face=3&time=10:10:35&transparent=1" docs/images/clock-face.png 720 4000
// Args: url, output file, size (720 or WxH like 1200x720), wait in ms. Plain `chrome --screenshot` fires before the
// face has drawn and gives an empty circle, which is why this drives Chrome over its debugging protocol instead.
import { spawn } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

const [url, out, sizeArg = "720", waitArg = "4000"] = process.argv.slice(2)
if (!url || !out) { console.error("usage: node scripts/screenshot.mjs <url> <out.png> [size|WxH] [waitMs]"); process.exit(2) }
const [W, H = W] = sizeArg.split("x").map(Number)
const wait = Number(waitArg)
const port = 9333
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "shot-profile-"))
const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--hide-scrollbars", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--no-first-run", "about:blank"], { stdio: "ignore" })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
try {
	let targets
	for (let i = 0; i < 40; i++) {
		try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (targets.length) break } catch {}
		await sleep(250)
	}
	const ws = new WebSocket(targets.find((t) => t.type === "page").webSocketDebuggerUrl)
	await new Promise((r) => (ws.onopen = r))
	let id = 0
	const waiting = new Map()
	ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && waiting.has(d.id)) waiting.get(d.id)(d) }
	const send = (method, params = {}) => new Promise((res) => { const n = ++id; waiting.set(n, res); ws.send(JSON.stringify({ id: n, method, params })) })
	await send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: 1, mobile: false })
	await send("Emulation.setDefaultBackgroundColorOverride", { color: { r: 0, g: 0, b: 0, a: 0 } })
	await send("Page.navigate", { url })
	await sleep(wait)
	const shot = await send("Page.captureScreenshot", { format: "png", fromSurface: true })
	fs.mkdirSync(path.dirname(out), { recursive: true })
	fs.writeFileSync(out, Buffer.from(shot.result.data, "base64"))
	console.log("wrote", out, fs.statSync(out).size, "bytes")
	ws.close()
} finally {
	chrome.kill()
	await sleep(500)
	try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }) } catch {} // Chrome may still be shutting down; the OS cleans temp
}
