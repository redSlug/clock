import { and, asc, desc, eq, gt } from "drizzle-orm"
import { drizzle } from "drizzle-orm/d1"
import { Hono } from "hono"
import { createAuth } from "./auth"
import * as schema from "./schema"

const MAX_SOURCE_BYTES = 100_000
const MAX_NAME_LENGTH = 80

type Vars = { db: ReturnType<typeof getDb>; user: { id: string; name: string } | null }
const getDb = (env: Env) => drizzle(env.DB, { schema })

const app = new Hono<{ Bindings: Env; Variables: Vars }>()

app.use("/api/*", async (c, next) => {
	c.set("db", getDb(c.env))
	await next()
})

app.get("/api/v1/health", (c) => c.json({ ok: true }))

// The public address (BASE_URL). Pages use it to send visitors from the direct workers.dev address to the public one.
app.get("/api/v1/config", (c) => c.json({ publicUrl: c.env.BASE_URL }))

// Better Auth: sign-in, callback, sign-out, session.
app.on(["GET", "POST"], "/api/v1/auth/*", (c) => createAuth(c.env, c.var.db).handler(c.req.raw))

// Everything below /api/v1 can see who is signed in (or null).
app.use("/api/v1/*", async (c, next) => {
	const session = await createAuth(c.env, c.var.db).api.getSession({ headers: c.req.raw.headers })
	c.set("user", session?.user ? { id: session.user.id, name: session.user.name } : null)
	await next()
})

app.get("/api/v1/me", (c) => {
	const user = c.var.user
	return user ? c.json(user) : c.json({ error: "not signed in" }, 401)
})

const faceJson = (f: { id: number; name: string; active?: boolean }) => ({
	id: f.id,
	name: f.name,
	active: f.active ?? true,
	sourceUrl: `/api/v1/faces/${f.id}/source`,
})

// Public: list every face, including paused ones (so they can be resumed).
app.get("/api/v1/faces", async (c) => {
	const rows = await c.var.db
		.select({ id: schema.face.id, name: schema.face.name, active: schema.face.active, userId: schema.face.userId, author: schema.user.name, createdAt: schema.face.createdAt })
		.from(schema.face)
		.innerJoin(schema.user, eq(schema.face.userId, schema.user.id))
		.orderBy(desc(schema.face.id))
	return c.json(rows.map((r) => ({ ...faceJson(r), userId: r.userId, author: r.author, createdAt: r.createdAt })))
})

// Public: the next ACTIVE face after `after`, wrapping to the first. This is how the Pi rotates. Paused faces are skipped.
// If `after` was deleted or paused, we still return the next larger id. No active faces at all: 204.
app.get("/api/v1/faces/next", async (c) => {
	const after = Number(c.req.query("after"))
	const { db } = c.var
	const active = eq(schema.face.active, true)
	let row = Number.isInteger(after) && after > 0
		? await db.select().from(schema.face).where(and(active, gt(schema.face.id, after))).orderBy(asc(schema.face.id)).limit(1).get()
		: undefined
	row ??= await db.select().from(schema.face).where(active).orderBy(asc(schema.face.id)).limit(1).get()
	if (!row) return c.body(null, 204)
	return c.json(faceJson(row), 200, { "Cache-Control": "no-store" })
})

app.post("/api/v1/faces", async (c) => {
	const user = c.var.user
	if (!user) return c.json({ error: "sign in required" }, 401)
	if (!c.req.header("content-type")?.includes("application/json")) return c.json({ error: "send JSON" }, 415)
	const body = await c.req.json<{ name?: unknown; source?: unknown }>().catch(() => null)
	const name = typeof body?.name === "string" ? body.name.trim() : ""
	const source = typeof body?.source === "string" ? body.source : ""
	if (!name || name.length > MAX_NAME_LENGTH) return c.json({ error: `name must be 1-${MAX_NAME_LENGTH} characters` }, 400)
	if (!source.trim()) return c.json({ error: "source is empty" }, 400)
	if (new TextEncoder().encode(source).length > MAX_SOURCE_BYTES) return c.json({ error: `source is over ${MAX_SOURCE_BYTES} bytes` }, 413)

	const r2Key = `faces/${user.id}/${crypto.randomUUID()}.js`
	await c.env.FACES.put(r2Key, source, { httpMetadata: { contentType: "text/plain; charset=utf-8" } })
	try {
		const row = await c.var.db.insert(schema.face).values({ userId: user.id, name, r2Key }).returning().get()
		return c.json(faceJson(row), 201)
	} catch (err) {
		await c.env.FACES.delete(r2Key) // don't leave an orphan file behind
		throw err
	}
})

app.get("/api/v1/faces/:id", async (c) => {
	const id = Number(c.req.param("id"))
	const row = Number.isInteger(id) ? await c.var.db.select().from(schema.face).where(eq(schema.face.id, id)).get() : undefined
	return row ? c.json({ ...faceJson(row), userId: row.userId }) : c.json({ error: "not found" }, 404)
})

app.get("/api/v1/faces/:id/source", async (c) => {
	const id = Number(c.req.param("id"))
	const row = Number.isInteger(id) ? await c.var.db.select().from(schema.face).where(eq(schema.face.id, id)).get() : undefined
	if (!row) return c.json({ error: "not found" }, 404)
	const obj = await c.env.FACES.get(row.r2Key)
	if (!obj) return c.json({ error: "source missing" }, 404)
	// text/plain + nosniff: the browser shows it as text and never runs it as script on our origin.
	return new Response(obj.body, {
		headers: { "Content-Type": "text/plain; charset=utf-8", "X-Content-Type-Options": "nosniff", "Cache-Control": "no-store" },
	})
})

const findFace = (c: { var: Vars }, idParam: string) => {
	const id = Number(idParam)
	return Number.isInteger(id) ? c.var.db.select().from(schema.face).where(eq(schema.face.id, id)).get() : Promise.resolve(undefined)
}

// Edit your own face: new name and/or new source.
app.put("/api/v1/faces/:id", async (c) => {
	const user = c.var.user
	if (!user) return c.json({ error: "sign in required" }, 401)
	const row = await findFace(c, c.req.param("id"))
	if (!row) return c.json({ error: "not found" }, 404)
	if (row.userId !== user.id) return c.json({ error: "you can only edit your own faces" }, 403)
	if (!c.req.header("content-type")?.includes("application/json")) return c.json({ error: "send JSON" }, 415)
	const body = await c.req.json<{ name?: unknown; source?: unknown }>().catch(() => null)
	const name = typeof body?.name === "string" ? body.name.trim() : row.name
	const source = typeof body?.source === "string" ? body.source : null
	if (!name || name.length > MAX_NAME_LENGTH) return c.json({ error: `name must be 1-${MAX_NAME_LENGTH} characters` }, 400)
	if (source !== null) {
		if (!source.trim()) return c.json({ error: "source is empty" }, 400)
		if (new TextEncoder().encode(source).length > MAX_SOURCE_BYTES) return c.json({ error: `source is over ${MAX_SOURCE_BYTES} bytes` }, 413)
		await c.env.FACES.put(row.r2Key, source, { httpMetadata: { contentType: "text/plain; charset=utf-8" } })
	}
	const updated = await c.var.db.update(schema.face).set({ name }).where(eq(schema.face.id, row.id)).returning().get()
	return c.json(faceJson(updated))
})

// Pause or resume ANY face (any signed-in user). A paused face stays saved but is skipped by the rotation.
app.patch("/api/v1/faces/:id", async (c) => {
	if (!c.var.user) return c.json({ error: "sign in required" }, 401)
	const row = await findFace(c, c.req.param("id"))
	if (!row) return c.json({ error: "not found" }, 404)
	const body = await c.req.json<{ active?: unknown }>().catch(() => null)
	if (typeof body?.active !== "boolean") return c.json({ error: "send {\"active\": true} or {\"active\": false}" }, 400)
	const updated = await c.var.db.update(schema.face).set({ active: body.active }).where(eq(schema.face.id, row.id)).returning().get()
	return c.json(faceJson(updated))
})

// Delete ANY face (any signed-in user).
app.delete("/api/v1/faces/:id", async (c) => {
	if (!c.var.user) return c.json({ error: "sign in required" }, 401)
	const row = await findFace(c, c.req.param("id"))
	if (!row) return c.json({ error: "not found" }, 404)
	await c.var.db.delete(schema.face).where(eq(schema.face.id, row.id))
	await c.env.FACES.delete(row.r2Key)
	return c.body(null, 204)
})

app.all("/api/*", (c) => c.json({ error: "not found" }, 404))

export default app
