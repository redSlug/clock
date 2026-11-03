// Loaded first on every page. If someone opens the direct *.workers.dev address, send them to the public address
// (BASE_URL, for example https://clock.recurse.com). Sign-in has to start on the same host it returns to, because
// the OAuth state cookie only travels to the host that set it; starting elsewhere ends in "state_mismatch".
// Does nothing on localhost or on the public address itself.
;(async function () {
	if (!location.hostname.endsWith(".workers.dev")) return
	try {
		var res = await fetch("/api/v1/config")
		var cfg = await res.json()
		var target = new URL(cfg.publicUrl)
		if (target.origin !== location.origin) location.replace(target.origin + location.pathname + location.search + location.hash)
	} catch (e) {
		/* if the check fails, stay where we are */
	}
})()
