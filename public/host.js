// Shared by the display page (Pi), the preview page, and the home page.
// Runs a face's p5 source inside a sandboxed iframe with the face runtime already installed.
;(function (root) {
	function esc(s) {
		return s.replace(/<\/script/gi, "<\\/script")
	}

	// The iframe is sandboxed WITHOUT allow-same-origin, so it gets an opaque origin: it cannot read our
	// cookies or call our API. The CSP also blocks every network request. It may only load our p5 and runtime scripts.
	function buildSrcdoc(source, cfg) {
		var origin = location.origin
		var csp = "default-src 'none'; script-src 'unsafe-inline' " + origin + "; style-src 'unsafe-inline'; img-src data: blob:"
		return (
			'<!doctype html><html><head><meta charset="utf-8">' +
			'<meta http-equiv="Content-Security-Policy" content="' + csp + '">' +
			"<style>html,body{margin:0;background:#000;overflow:hidden}</style>" +
			'<script src="' + origin + '/vendor/p5.min.js"><\/script>' +
			'<script src="' + origin + '/runtime/face.js"><\/script>' +
			"<script>FaceRuntime.install(" + JSON.stringify(cfg).replace(/</g, "\\u003c") + ")<\/script>" +
			"<script>" + esc(source) + "<\/script>" +
			"</head><body></body></html>"
		)
	}

	// Fills `container` (a square, round-clipped box) with a face. Returns { setTime, destroy }.
	function mount(container, source, cfg, onError) {
		cfg = cfg || {}
		var size = cfg.size || 720
		container.textContent = ""
		var frame = document.createElement("iframe")
		frame.setAttribute("sandbox", "allow-scripts")
		frame.width = size
		frame.height = size
		frame.style.cssText = "border:0;display:block;transform-origin:0 0"
		frame.srcdoc = buildSrcdoc(source, { size: size, tz: cfg.tz, time: cfg.time })
		container.appendChild(frame)

		function fit() {
			frame.style.transform = "scale(" + container.clientWidth / size + ")"
		}
		fit()
		root.addEventListener("resize", fit)
		function onMessage(e) {
			if (e.source === frame.contentWindow && e.data && e.data.type === "face-error" && onError) onError(e.data.message)
		}
		root.addEventListener("message", onMessage)

		return {
			setTime: function (t) {
				frame.contentWindow.postMessage({ type: "face-time", time: t }, "*")
			},
			destroy: function () {
				root.removeEventListener("resize", fit)
				root.removeEventListener("message", onMessage)
				frame.remove()
			},
		}
	}

	root.FaceHost = { mount: mount }
})(window)
