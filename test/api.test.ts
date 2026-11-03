// API rule tests. They run the real Hono app against local D1 and R2 (wrangler's getPlatformProxy), with a fake
// sign-in: the header `x-test-user: <id>` says who is signed in, and no header means signed out. No network, no
// Recurse. They cover the rules that used to be checked by hand: who can edit, pause and delete, and the rotation.
import { readdirSync, readFileSync } from "node:fs"
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { getPlatformProxy } from "wrangler"

vi.mock("../src/auth", () => ({
	AUTH_BASE_PATH: "/api/v1/auth",
	createAuth: () => ({
		handler: async () => new Response("auth stub"),
		api: {
			getSession: async ({ headers }: { headers: Headers }) => {
				const id = headers.get("x-test-user")
				return id ? { user: { id, name: `Person ${id}` } } : null
			},
		},
	}),
}))

import app from "../src/index"

let env: any
let dispose: () => Promise<void>

beforeAll(async () => {
	const proxy = await getPlatformProxy({ persist: false })
	env = proxy.env
	dispose = proxy.dispose
	for (const file of readdirSync("migrations").filter((f) => f.endsWith(".sql")).sort()) {
		for (const stmt of readFileSync(`migrations/${file}`, "utf8").split("--> statement-breakpoint")) {
			if (stmt.trim()) await env.DB.prepare(stmt).run()
		}
	}
})
afterAll(async () => dispose?.())

beforeEach(async () => {
	await env.DB.prepare("DELETE FROM face").run()
	await env.DB.prepare("DELETE FROM user").run()
	for (const id of ["alice", "bob"]) {
		await env.DB.prepare("INSERT INTO user (id, name, email, email_verified) VALUES (?, ?, ?, 1)").bind(id, `Person ${id}`, `${id}@example.invalid`).run()
	}
})

const call = (method: string, path: string, opts: { as?: string; body?: unknown } = {}) =>
	app.request(
		path,
		{
			method,
			headers: { ...(opts.as ? { "x-test-user": opts.as } : {}), ...(opts.body !== undefined ? { "content-type": "application/json" } : {}) },
			body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
		},
		env,
	)

const create = async (as: string, name = "face", source = "function draw() {}") => {
	const res = await call("POST", "/api/v1/faces", { as, body: { name, source } })
	expect(res.status).toBe(201)
	return (await res.json()) as { id: number; name: string; active: boolean }
}

describe("health and sign-in", () => {
	it("health works without signing in", async () => {
		const res = await call("GET", "/api/v1/health")
		expect(await res.json()).toEqual({ ok: true })
	})
	it("/me is 401 when signed out and returns the user when signed in", async () => {
		expect((await call("GET", "/api/v1/me")).status).toBe(401)
		const res = await call("GET", "/api/v1/me", { as: "alice" })
		expect(await res.json()).toEqual({ id: "alice", name: "Person alice" })
	})
})

describe("creating faces", () => {
	it("needs sign-in", async () => {
		expect((await call("POST", "/api/v1/faces", { body: { name: "x", source: "y" } })).status).toBe(401)
	})
	it("stores the source and serves it back as plain text", async () => {
		const f = await create("alice", "hello", "function draw() { background(1) }")
		const res = await call("GET", `/api/v1/faces/${f.id}/source`)
		expect(res.status).toBe(200)
		expect(res.headers.get("content-type")).toContain("text/plain")
		expect(res.headers.get("x-content-type-options")).toBe("nosniff")
		expect(await res.text()).toBe("function draw() { background(1) }")
	})
	it("rejects an empty name, an empty source and an oversized source", async () => {
		expect((await call("POST", "/api/v1/faces", { as: "alice", body: { name: " ", source: "x" } })).status).toBe(400)
		expect((await call("POST", "/api/v1/faces", { as: "alice", body: { name: "a", source: "  " } })).status).toBe(400)
		expect((await call("POST", "/api/v1/faces", { as: "alice", body: { name: "a", source: "x".repeat(100_001) } })).status).toBe(413)
		expect((await call("POST", "/api/v1/faces", { as: "alice", body: { name: "x".repeat(81), source: "x" } })).status).toBe(400)
	})
	it("rejects a body that is not JSON", async () => {
		const res = await app.request("/api/v1/faces", { method: "POST", headers: { "x-test-user": "alice", "content-type": "text/plain" }, body: "hi" }, env)
		expect(res.status).toBe(415)
	})
})

describe("editing: owner only", () => {
	it("the owner can rename and change the source", async () => {
		const f = await create("alice", "old", "a")
		const res = await call("PUT", `/api/v1/faces/${f.id}`, { as: "alice", body: { name: "new", source: "b" } })
		expect(res.status).toBe(200)
		expect(((await res.json()) as any).name).toBe("new")
		expect(await (await call("GET", `/api/v1/faces/${f.id}/source`)).text()).toBe("b")
	})
	it("someone else gets 403 and nothing changes", async () => {
		const f = await create("alice", "mine", "a")
		const res = await call("PUT", `/api/v1/faces/${f.id}`, { as: "bob", body: { name: "stolen", source: "b" } })
		expect(res.status).toBe(403)
		expect(await (await call("GET", `/api/v1/faces/${f.id}/source`)).text()).toBe("a")
	})
	it("signed out gets 401, and a missing face gets 404", async () => {
		const f = await create("alice")
		expect((await call("PUT", `/api/v1/faces/${f.id}`, { body: { name: "x" } })).status).toBe(401)
		expect((await call("PUT", "/api/v1/faces/99999", { as: "alice", body: { name: "x" } })).status).toBe(404)
	})
})

describe("moderation is open: any signed-in user can pause, resume and delete any face", () => {
	it("pause and resume", async () => {
		const f = await create("alice")
		const paused = await call("PATCH", `/api/v1/faces/${f.id}`, { as: "bob", body: { active: false } })
		expect(((await paused.json()) as any).active).toBe(false)
		const resumed = await call("PATCH", `/api/v1/faces/${f.id}`, { as: "bob", body: { active: true } })
		expect(((await resumed.json()) as any).active).toBe(true)
	})
	it("pause needs sign-in and a boolean", async () => {
		const f = await create("alice")
		expect((await call("PATCH", `/api/v1/faces/${f.id}`, { body: { active: false } })).status).toBe(401)
		expect((await call("PATCH", `/api/v1/faces/${f.id}`, { as: "bob", body: { active: "no" } })).status).toBe(400)
	})
	it("delete removes the row and the stored source", async () => {
		const f = await create("alice")
		expect((await call("DELETE", `/api/v1/faces/${f.id}`, { as: "bob" })).status).toBe(204)
		expect((await call("GET", `/api/v1/faces/${f.id}`)).status).toBe(404)
		expect((await call("GET", `/api/v1/faces/${f.id}/source`)).status).toBe(404)
	})
	it("delete needs sign-in", async () => {
		const f = await create("alice")
		expect((await call("DELETE", `/api/v1/faces/${f.id}`)).status).toBe(401)
	})
})

describe("rotation: faces/next", () => {
	it("is 204 when there are no faces", async () => {
		expect((await call("GET", "/api/v1/faces/next")).status).toBe(204)
	})
	it("goes to the next id, then wraps to the first", async () => {
		const a = await create("alice", "a")
		const b = await create("alice", "b")
		const c = await create("alice", "c")
		const next = async (after?: number) => ((await (await call("GET", `/api/v1/faces/next${after ? `?after=${after}` : ""}`)).json()) as any).id
		expect(await next()).toBe(a.id)
		expect(await next(a.id)).toBe(b.id)
		expect(await next(b.id)).toBe(c.id)
		expect(await next(c.id)).toBe(a.id)
	})
	it("skips paused faces, and is 204 if every face is paused", async () => {
		const a = await create("alice", "a")
		const b = await create("alice", "b")
		const c = await create("alice", "c")
		await call("PATCH", `/api/v1/faces/${b.id}`, { as: "alice", body: { active: false } })
		const res = await call("GET", `/api/v1/faces/next?after=${a.id}`)
		expect(((await res.json()) as any).id).toBe(c.id)
		for (const f of [a, c]) await call("PATCH", `/api/v1/faces/${f.id}`, { as: "alice", body: { active: false } })
		expect((await call("GET", "/api/v1/faces/next")).status).toBe(204)
	})
	it("still works when the `after` face was deleted", async () => {
		const a = await create("alice", "a")
		const b = await create("alice", "b")
		await call("DELETE", `/api/v1/faces/${a.id}`, { as: "alice" })
		const res = await call("GET", `/api/v1/faces/next?after=${a.id}`)
		expect(((await res.json()) as any).id).toBe(b.id)
	})
})

describe("listing", () => {
	it("lists every face including paused ones, with author", async () => {
		const a = await create("alice", "a")
		await create("bob", "b")
		await call("PATCH", `/api/v1/faces/${a.id}`, { as: "bob", body: { active: false } })
		const list = (await (await call("GET", "/api/v1/faces")).json()) as any[]
		expect(list.map((f) => f.name).sort()).toEqual(["a", "b"])
		expect(list.find((f) => f.name === "a").active).toBe(false)
		expect(list.find((f) => f.name === "b").author).toBe("Person bob")
	})
	it("unknown API paths are JSON 404s", async () => {
		const res = await call("GET", "/api/v1/nope")
		expect(res.status).toBe(404)
		expect(await res.json()).toEqual({ error: "not found" })
	})
})
