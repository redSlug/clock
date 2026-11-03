import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { genericOAuth } from "better-auth/plugins"
import type { DrizzleD1Database } from "drizzle-orm/d1"
import * as schema from "./schema"

export const AUTH_BASE_PATH = "/api/v1/auth"

// Same approach as Batchmate: Better Auth + genericOAuth, with Recurse as the provider.
export function createAuth(env: Env, db: DrizzleD1Database<typeof schema>) {
	const rc = env.RC_BASE_URL
	return betterAuth({
		basePath: AUTH_BASE_PATH,
		baseURL: env.BASE_URL,
		secret: env.BETTER_AUTH_SECRET,
		database: drizzleAdapter(db, { provider: "sqlite", schema }),
		// BASE_URL is the public address people use (https://clock.recurse.com, behind a proxy). Sign-in must start and
		// finish on that host, so it is the only trusted origin. Pages on the direct workers.dev address redirect to it.
		trustedOrigins: [env.BASE_URL],
		user: {
			additionalFields: {
				rcId: { type: "string", required: false, input: false },
			},
		},
		plugins: [
			genericOAuth({
				config: [
					{
						providerId: "recurse",
						authorizationUrl: `${rc}/oauth/authorize`,
						tokenUrl: `${rc}/oauth/token`,
						userInfoUrl: `${rc}/api/v1/profiles/me`,
						clientId: env.RC_CLIENT_ID,
						clientSecret: env.RC_CLIENT_SECRET,
						scopes: [],
						overrideUserInfo: true,
						mapProfileToUser(profile) {
							return {
								name: profile.name,
								email: profile.email,
								image: typeof profile.image_path === "string" ? profile.image_path : undefined,
								rcId: String(profile.id),
							}
						},
					},
				],
			}),
		],
	})
}
