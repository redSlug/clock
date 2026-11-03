// What the Raspberry Pi's browser runs. Every minute it asks the API for the next face and shows it.
// URL options (for testing): ?every=5 (seconds between swaps), ?time=18:00 (freeze the clock),
// ?tz=America/New_York (timezone), ?size=720 (canvas size).
var params = new URLSearchParams(location.search)
var cfg = {
	size: Number(params.get("size")) || 720,
	tz: params.get("tz") || undefined,
	time: params.get("time") || undefined,
}
var everyMs = (Number(params.get("every")) || 60) * 1000
var disc = document.getElementById("disc")
var currentId = null
var mounted = null
var showingDefault = false

function show(source) {
	if (mounted) mounted.destroy()
	mounted = FaceHost.mount(disc, source, cfg)
}

async function showDefault() {
	if (mounted) return // keep whatever is on screen
	var res = await fetch("/default-face.js")
	show(await res.text())
	showingDefault = true
}

async function tick() {
	try {
		var url = "/api/v1/faces/next" + (currentId ? "?after=" + currentId : "")
		var res = await fetch(url, { cache: "no-store" })
		if (res.status === 204) return showDefault()
		if (!res.ok) throw new Error("next: " + res.status)
		var meta = await res.json()
		if (meta.id === currentId && !showingDefault) return // only one face: leave it running
		var src = await fetch(meta.sourceUrl, { cache: "no-store" })
		if (!src.ok) throw new Error("source: " + src.status)
		show(await src.text())
		currentId = meta.id
		showingDefault = false
	} catch (err) {
		console.error(err)
		showDefault().catch(console.error) // network is down: keep the current face, or the built-in clock if nothing is up yet
	}
}

tick()
setInterval(tick, everyMs)
