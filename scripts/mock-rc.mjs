// A fake Recurse Center OAuth server, only for local testing without real credentials.
// Run: npm run mock-rc   (listens on http://localhost:9999; set RC_BASE_URL to that in .dev.vars)
import http from "node:http"

const PORT = 9999
// Who the fake Recurse logs in as. Start with MOCK_USER=2 to be a different person (for testing multi-user rules).
const n = process.env.MOCK_USER || "1"
const seen = []
http
	.createServer(async (req, res) => {
		const url = new URL(req.url, `http://localhost:${PORT}`)
		console.log(req.method, url.pathname)
		if (url.pathname === "/oauth/authorize") {
			// A real server shows a login and approve page. We approve instantly.
			seen.push({ pkce: url.searchParams.get("code_challenge_method") })
			const back = new URL(url.searchParams.get("redirect_uri"))
			back.searchParams.set("code", "mock-auth-code")
			back.searchParams.set("state", url.searchParams.get("state"))
			res.writeHead(302, { Location: back.toString() }).end()
		} else if (url.pathname === "/oauth/token" && req.method === "POST") {
			let body = ""
			for await (const chunk of req) body += chunk
			const form = new URLSearchParams(body)
			console.log("  token request:", Object.fromEntries([...form].map(([k, v]) => [k, k === "client_secret" ? "***" : v])))
			if (form.get("code") !== "mock-auth-code") return res.writeHead(400).end(JSON.stringify({ error: "invalid_grant" }))
			res.writeHead(200, { "Content-Type": "application/json" })
			res.end(JSON.stringify({ access_token: "mock-access-token", refresh_token: "mock-refresh", expires_in: 7200, token_type: "Bearer" }))
		} else if (url.pathname === "/api/v1/profiles/me") {
			if (req.headers.authorization !== "Bearer mock-access-token") return res.writeHead(401).end("{}")
			res.writeHead(200, { "Content-Type": "application/json" })
			res.end(JSON.stringify({ id: 424240 + Number(n), name: `Mock Person ${n}`, first_name: "Mock", last_name: `Person ${n}`, email: `mock${n}@example.com`, image_path: null, stints: [] }))
		} else res.writeHead(404).end()
	})
	.listen(PORT, () => console.log(`mock Recurse on http://localhost:${PORT}`))
