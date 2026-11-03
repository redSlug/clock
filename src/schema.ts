import { relations, sql } from "drizzle-orm"
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

// Better Auth tables (same shape as Batchmate's auth-schema).
const timestamps = {
	createdAt: integer("created_at", { mode: "timestamp_ms" })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.notNull(),
	updatedAt: integer("updated_at", { mode: "timestamp_ms" })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.$onUpdate(() => new Date())
		.notNull(),
}

export const user = sqliteTable("user", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	email: text("email").notNull().unique(),
	emailVerified: integer("email_verified", { mode: "boolean" }).default(false).notNull(),
	image: text("image"),
	rcId: text("rc_id").unique(),
	...timestamps,
})

export const session = sqliteTable(
	"session",
	{
		id: text("id").primaryKey(),
		expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
		token: text("token").notNull().unique(),
		ipAddress: text("ip_address"),
		userAgent: text("user_agent"),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		...timestamps,
	},
	(t) => [index("session_userId_idx").on(t.userId)],
)

export const account = sqliteTable(
	"account",
	{
		id: text("id").primaryKey(),
		accountId: text("account_id").notNull(),
		providerId: text("provider_id").notNull(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		accessToken: text("access_token"),
		refreshToken: text("refresh_token"),
		idToken: text("id_token"),
		accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp_ms" }),
		refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp_ms" }),
		scope: text("scope"),
		password: text("password"),
		...timestamps,
	},
	(t) => [index("account_userId_idx").on(t.userId)],
)

export const verification = sqliteTable(
	"verification",
	{
		id: text("id").primaryKey(),
		identifier: text("identifier").notNull(),
		value: text("value").notNull(),
		expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
		...timestamps,
	},
	(t) => [index("verification_identifier_idx").on(t.identifier)],
)

// Our table. The p5 source lives in R2; we only keep its key.
// `id` is an autoincrement integer, so ordering by id is ordering by creation time.
export const face = sqliteTable(
	"face",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		r2Key: text("r2_key").notNull(),
		// false = paused: hidden from the rotation, but kept so anyone can resume it.
		active: integer("active", { mode: "boolean" }).default(true).notNull(),
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
	},
	(t) => [index("face_userId_idx").on(t.userId)],
)

export const userRelations = relations(user, ({ many }) => ({
	sessions: many(session),
	accounts: many(account),
	faces: many(face),
}))
