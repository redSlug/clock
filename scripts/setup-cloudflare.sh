#!/usr/bin/env bash
# One-time setup of the Cloudflare side of this project. Run it yourself in a normal terminal.
# Safe to re-run: it skips anything that already exists.
#
# USAGE
#   npm run setup:cloudflare        # interactive. Type each value at its prompt; secrets are hidden. No file needed.
#   npm run setup:cloudflare -- --env-file ~/.config/circular-lcd/setup.env --yes   # non-interactive alternative
#
# PASSING VALUES. Easiest: just run it and answer the prompts. Alternatively set these variables (or use --env-file).
# Anything missing is prompted for when you run it in a terminal.
#   CLOUDFLARE_ACCOUNT_ID  which account to use. Optional: the account_id in wrangler.jsonc is used by default.
#   CLOUDFLARE_API_TOKEN   deploy token scoped to that account. Without it, wrangler uses `wrangler login`.
#   WORKERS_SUBDOMAIN      the part before .workers.dev
#   R2_ACCESS_KEY_ID       R2 S3 API credentials (Cloudflare dashboard: R2 > Manage API tokens). Give all three or none.
#   R2_SECRET_ACCESS_KEY   |
#   R2_S3_ENDPOINT         | https://<account id>.r2.cloudflarestorage.com (must be the same account)
#   RC_CLIENT_ID           Recurse OAuth client ID
#   RC_CLIENT_SECRET       Recurse OAuth client secret
#   BETTER_AUTH_SECRET     production session secret (generated for you if omitted)
#
# The R2 S3 keys can only read and write objects in buckets. They CANNOT create the database or bucket, deploy,
# or set secrets, so they do not replace CLOUDFLARE_API_TOKEN / `wrangler login`. The Worker itself reads R2
# through its binding and never needs them. Here they are used to check bucket access and, if the `aws` CLI is
# installed, to upload the example faces over the S3 API.
#
# Put them in an env file OUTSIDE the repo (chmod 600), one KEY=value per line, and pass --env-file.
# Do not type secrets inline (VAR=secret npm run ...) or as flags: they end up in your shell history
# and process list. Secrets are piped straight to wrangler. They are never printed or written into the project.
set -euo pipefail
cd "$(dirname "$0")/.."

YES=0; ENV_FILE=""
while [[ $# -gt 0 ]]; do
	case "$1" in
		--yes|-y) YES=1 ;;
		--env-file) ENV_FILE="${2:-}"; shift ;;
		--env-file=*) ENV_FILE="${1#*=}" ;;
		*) echo "unknown option: $1" >&2; exit 2 ;;
	esac
	shift
done

if [[ -n "$ENV_FILE" ]]; then
	ENV_FILE="${ENV_FILE/#\~/$HOME}"
	[[ -f "$ENV_FILE" ]] || { echo "env file not found: $ENV_FILE" >&2; exit 2; }
	PERMS="$(stat -f '%Lp' "$ENV_FILE" 2>/dev/null || stat -c '%a' "$ENV_FILE")"
	[[ "$PERMS" == "600" || "$PERMS" == "400" ]] || { echo "refusing to read $ENV_FILE: permissions are $PERMS, run: chmod 600 \"$ENV_FILE\"" >&2; exit 2; }
	case "$(cd "$(dirname "$ENV_FILE")" && pwd)/" in "$PWD"/*) echo "refusing: keep the env file outside the repo" >&2; exit 2 ;; esac
	set -a; . "$ENV_FILE"; set +a
fi

# Which Cloudflare account to use. Nothing is hardcoded in this script. The source is the account_id in
# wrangler.jsonc. If that is missing, $CLOUDFLARE_ACCOUNT_ID is used, and if that is missing too you are asked.
# If wrangler.jsonc and $CLOUDFLARE_ACCOUNT_ID are both set and differ, we stop.
CFG_ACCOUNT_ID="$(grep -oE '"account_id"[[:space:]]*:[[:space:]]*"[0-9a-f]{32}"' wrangler.jsonc 2>/dev/null | grep -oE '[0-9a-f]{32}' | head -1 || true)"
if [[ -n "$CFG_ACCOUNT_ID" && -n "${CLOUDFLARE_ACCOUNT_ID:-}" && "$CFG_ACCOUNT_ID" != "$CLOUDFLARE_ACCOUNT_ID" ]]; then
	echo "CLOUDFLARE_ACCOUNT_ID ($CLOUDFLARE_ACCOUNT_ID) does not match account_id in wrangler.jsonc ($CFG_ACCOUNT_ID). Fix one of them." >&2; exit 2
fi
ACCOUNT_ID="${CFG_ACCOUNT_ID:-${CLOUDFLARE_ACCOUNT_ID:-}}"
if [[ -z "$ACCOUNT_ID" && -t 0 ]]; then
	read -r -p "Cloudflare account ID (32 characters; wrangler.jsonc has no account_id): " ACCOUNT_ID
fi
ACCOUNT_ID="$(printf '%s' "$ACCOUNT_ID" | tr -d '[:space:]')"
[[ "$ACCOUNT_ID" =~ ^[0-9a-f]{32}$ ]] || { echo "No valid Cloudflare account ID. Set account_id in wrangler.jsonc, or CLOUDFLARE_ACCOUNT_ID." >&2; exit 2; }
WORKER="circular-led-server"
DB="circular-led-server"
BUCKET="circular-led-faces"
W="npx wrangler"
export CLOUDFLARE_ACCOUNT_ID="$ACCOUNT_ID"   # wrangler then acts on this account only
echo "Cloudflare account: $ACCOUNT_ID"

# Interactive prompts for anything not already provided. Secrets are read hidden (not echoed, not in history).
if [[ -t 0 && $YES == 0 ]]; then
	if [[ -z "${CLOUDFLARE_API_TOKEN:-}" ]]; then
		read -r -s -p "Cloudflare API token (hidden; press Enter to use 'wrangler login' instead): " T; echo
		if [[ -n "$T" ]]; then export CLOUDFLARE_API_TOKEN="$T"; fi
		unset T
	fi
	if [[ -z "${R2_ACCESS_KEY_ID:-}${R2_SECRET_ACCESS_KEY:-}${R2_S3_ENDPOINT:-}" ]]; then
		read -r -p "R2 S3 Access Key ID (press Enter to skip R2 S3 keys): " R2_ACCESS_KEY_ID
		if [[ -n "$R2_ACCESS_KEY_ID" ]]; then
			read -r -s -p "R2 S3 Secret Access Key (hidden): " R2_SECRET_ACCESS_KEY; echo
			read -r -p "R2 S3 endpoint [https://$ACCOUNT_ID.r2.cloudflarestorage.com]: " R2_S3_ENDPOINT
			R2_S3_ENDPOINT="${R2_S3_ENDPOINT:-https://$ACCOUNT_ID.r2.cloudflarestorage.com}"
		fi
	fi
fi

# R2 S3 credentials: all three or none, and the endpoint must belong to the account above.
R2_KEY="${R2_ACCESS_KEY_ID:-}"; R2_SEC="${R2_SECRET_ACCESS_KEY:-}"; R2_EP="${R2_S3_ENDPOINT:-}"
if [[ -n "$R2_KEY$R2_SEC$R2_EP" ]]; then
	[[ -n "$R2_KEY" && -n "$R2_SEC" && -n "$R2_EP" ]] || { echo "set all three of R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_S3_ENDPOINT, or none" >&2; exit 2; }
	R2_EP="$(printf '%s' "$R2_EP" | sed -E 's#^(https://[^/]+).*#\1#')"   # drop any trailing /bucket path
	R2_RE="^https://${ACCOUNT_ID}(\.[a-z]+)?\.r2\.cloudflarestorage\.com\$"
	[[ "$R2_EP" =~ $R2_RE ]] || { echo "R2_S3_ENDPOINT must be https://$ACCOUNT_ID.r2.cloudflarestorage.com (the account above). Got: $R2_EP" >&2; exit 2; }
	export R2_ACCESS_KEY_ID="$R2_KEY" R2_SECRET_ACCESS_KEY="$R2_SEC" R2_S3_ENDPOINT="$R2_EP"
fi

say() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
ask() { [[ $YES == 1 ]] && return 0; local a; read -r -p "$1 [y/N] " a; [[ "$a" == [yY]* ]]; }
die() { printf '\033[31mStopped: %s\033[0m\n' "$*" >&2; exit 1; }
json_find() { node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const x=JSON.parse(s).find(d=>d.name===process.argv[1]);if(x)console.log(x.uuid)}catch{}})' "$1"; }

[[ -d node_modules ]] || { say "Installing dependencies"; npm install; }

say "1/9 Checking the Cloudflare account ($ACCOUNT_ID)"
if [[ -n "${CLOUDFLARE_API_TOKEN:-}" ]]; then
	echo "Using CLOUDFLARE_API_TOKEN. Checking that it can reach account $ACCOUNT_ID..."
	$W d1 list --json >/dev/null 2>&1 || die "the token can't access account $ACCOUNT_ID (wrong token, wrong account, or missing D1 permission)"
	echo "OK: token works for account $ACCOUNT_ID."
else
	WHOAMI="$($W whoami 2>&1)" || true
	echo "$WHOAMI" | grep -E "Account Name|$ACCOUNT_ID|logged in|not authenticated" || true
	echo "$WHOAMI" | grep -q "$ACCOUNT_ID" || die "account $ACCOUNT_ID is not listed for this login. Run: npx wrangler login, as the user that owns it."
	echo "OK: this login can use account $ACCOUNT_ID."
fi

say "This will, in Cloudflare account $ACCOUNT_ID (check this is the one you mean):"
cat <<PLAN
  - create D1 database "$DB" and R2 bucket "$BUCKET" (skipped if they exist)
  - write their IDs and your workers.dev URL into wrangler.jsonc
  - create the database tables, and deploy the Worker "$WORKER"
  - set secrets BETTER_AUTH_SECRET, RC_CLIENT_ID, RC_CLIENT_SECRET
  - optionally load the 3 example faces
PLAN
ask "Continue?" || die "cancelled, nothing was changed"

say "2/9 Public URL (BASE_URL)"
# If BASE_URL in wrangler.jsonc is already a real address that is not workers.dev (for example the
# clock.recurse.com proxy), keep it. Otherwise build it from your workers.dev subdomain.
CURRENT_BASE="$(grep -oE '"BASE_URL"[[:space:]]*:[[:space:]]*"[^"]*"' wrangler.jsonc | sed -E 's/.*"([^"]*)"$/\1/' | head -1)"
if [[ "$CURRENT_BASE" =~ ^https://[^/]+$ && "$CURRENT_BASE" != *REPLACE* && "$CURRENT_BASE" != *.workers.dev ]]; then
	BASE_URL="$CURRENT_BASE"
	echo "Keeping BASE_URL $BASE_URL (already set in wrangler.jsonc, not a workers.dev address)."
else
	SUB="${WORKERS_SUBDOMAIN:-}"
	if [[ -z "$SUB" ]]; then
		echo "Find it in the dashboard under Workers & Pages (it looks like <name>.workers.dev)."
		read -r -p "Subdomain (just the part before .workers.dev): " SUB
	fi
	[[ "$SUB" =~ ^[a-z0-9-]+$ ]] || die "that doesn't look like a subdomain"
	BASE_URL="https://$WORKER.$SUB.workers.dev"
	sed -i.bak -E "s#\"BASE_URL\": \"[^\"]*\"#\"BASE_URL\": \"$BASE_URL\"#" wrangler.jsonc && rm -f wrangler.jsonc.bak
	echo "BASE_URL set to $BASE_URL"
fi

# `wrangler d1 create` and `r2 bucket create` can edit wrangler.jsonc themselves (adding duplicate bindings).
# We keep a copy and put it back after both, then write the database id ourselves.
CFG_SNAPSHOT="$(mktemp)"; cp wrangler.jsonc "$CFG_SNAPSHOT"

say "3/9 D1 database"
DB_ID="$($W d1 list --json 2>/dev/null | json_find "$DB")"
if [[ -z "$DB_ID" ]]; then
	$W d1 create "$DB"
	DB_ID="$($W d1 list --json | json_find "$DB")"
	[[ -n "$DB_ID" ]] || die "created the database but could not read its id"
else
	echo "already exists"
fi

say "4/9 R2 bucket"
if $W r2 bucket list 2>/dev/null | grep -qE "^name:[[:space:]]+$BUCKET\$"; then echo "already exists"; else $W r2 bucket create "$BUCKET"; fi

cp "$CFG_SNAPSHOT" wrangler.jsonc && rm -f "$CFG_SNAPSHOT"
sed -i.bak -E "s#\"database_id\": \"[^\"]*\"#\"database_id\": \"$DB_ID\"#" wrangler.jsonc && rm -f wrangler.jsonc.bak
echo "wrangler.jsonc: database_id set to $DB_ID (any bindings wrangler added on its own were removed)"

if [[ -n "$R2_KEY" ]]; then
	say "4b R2 S3 credentials (optional)"
	if command -v aws >/dev/null 2>&1; then
		if AWS_ACCESS_KEY_ID="$R2_KEY" AWS_SECRET_ACCESS_KEY="$R2_SEC" AWS_DEFAULT_REGION=auto AWS_EC2_METADATA_DISABLED=true \
			aws s3 ls "s3://$BUCKET" --endpoint-url "$R2_EP" >/dev/null
		then
			echo "OK: the S3 keys can reach bucket $BUCKET."
		else
			# The S3 keys are optional, so this does not stop the setup. Common causes: a TLS/network problem
			# between this machine and the R2 endpoint, wrong keys, or a key not allowed on this bucket.
			echo "WARNING: could not use the R2 S3 keys. Continuing without them; the example faces will be uploaded with wrangler."
			unset R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY R2_S3_ENDPOINT
		fi
	else
		echo "aws CLI not installed, so the S3 keys can't be checked or used. Seeding will use wrangler instead."
	fi
fi

say "5/9 Database tables (migrations)"
npm run db:migrate:remote

say "6/9 Deploy"
npm run deploy

say "7/9 Secrets"
if $W secret list 2>/dev/null | grep -q '"BETTER_AUTH_SECRET"'; then
	echo "BETTER_AUTH_SECRET already set, leaving it alone"
elif [[ -n "${BETTER_AUTH_SECRET:-}" ]]; then
	printf '%s' "$BETTER_AUTH_SECRET" | $W secret put BETTER_AUTH_SECRET
else
	openssl rand -base64 32 | $W secret put BETTER_AUTH_SECRET
fi
RC_ID="${RC_CLIENT_ID:-}"; RC_SECRET="${RC_CLIENT_SECRET:-}"
if [[ -z "$RC_ID" || -z "$RC_SECRET" ]] && ask "Set the Recurse OAuth client ID and secret now? (Say no if you haven't created the Recurse app yet.)"; then
	[[ -n "$RC_ID" ]] || read -r -p "RC client ID: " RC_ID
	[[ -n "$RC_SECRET" ]] || { read -r -s -p "RC client secret (hidden): " RC_SECRET; echo; }
fi
if [[ -n "$RC_ID" && -n "$RC_SECRET" ]]; then
	printf '%s' "$RC_ID" | $W secret put RC_CLIENT_ID
	printf '%s' "$RC_SECRET" | $W secret put RC_CLIENT_SECRET
else
	echo "Skipped. Later, run:  npx wrangler secret put RC_CLIENT_ID   and   npx wrangler secret put RC_CLIENT_SECRET"
fi

say "8/9 Example faces"
if ask "Load the 3 example faces into the real database?"; then npm run seed:remote; fi

unset RC_SECRET RC_CLIENT_SECRET BETTER_AUTH_SECRET R2_SEC R2_SECRET_ACCESS_KEY

say "9/9 Done"
cat <<DONE
Worker URL:        $BASE_URL
Display page:      $BASE_URL/display
Recurse redirect URIs (register these when you create the Recurse OAuth app; they can't be edited later):
  http://localhost:8787/api/v1/auth/callback/recurse
  $BASE_URL/api/v1/auth/callback/recurse
Changed wrangler.jsonc (database_id, BASE_URL). Review it with: git diff wrangler.jsonc
DONE
