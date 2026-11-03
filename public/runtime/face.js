// Face runtime. Loaded inside the sandboxed iframe before the user's sketch.
// Defines window.face (see README "Writing a face"). Also runs under Node for tests.
(function (root) {
	var TAU = Math.PI * 2

	// Angles in radians. 0 is 12 o'clock and they grow clockwise.
	function anglesFrom(hours, minutes, seconds, millis) {
		return {
			secondAngle: ((seconds + millis / 1000) / 60) * TAU,
			minuteAngle: ((minutes + seconds / 60) / 60) * TAU,
			hourAngle: (((hours % 12) + minutes / 60) / 12) * TAU,
		}
	}

	var formatters = {}
	// Wall-clock parts for an instant, in an IANA timezone (or the browser's when tz is empty).
	function partsFromMs(ms, tz) {
		var d = new Date(ms)
		if (!tz) {
			return { hours: d.getHours(), minutes: d.getMinutes(), seconds: d.getSeconds(), millis: d.getMilliseconds() }
		}
		var f =
			formatters[tz] ||
			(formatters[tz] = new Intl.DateTimeFormat("en-US", {
				timeZone: tz,
				hourCycle: "h23",
				hour: "numeric",
				minute: "numeric",
				second: "numeric",
			}))
		var p = {}
		f.formatToParts(d).forEach(function (x) {
			p[x.type] = x.value
		})
		return { hours: +p.hour % 24, minutes: +p.minute, seconds: +p.second, millis: d.getMilliseconds() }
	}

	// "18:00", "6:05", or "18:00:30" -> parts, or null when it isn't a valid time.
	function parseTime(text) {
		var m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(String(text || "").trim())
		if (!m) return null
		var h = +m[1], mi = +m[2], s = m[3] ? +m[3] : 0
		if (h > 23 || mi > 59 || s > 59) return null
		return { hours: h, minutes: mi, seconds: s, millis: 0 }
	}

	// config: { size, tz, time }. `time` freezes the clock at that wall time (for testing and previews).
	function createFace(config) {
		config = config || {}
		var size = config.size || 720
		var fixed = parseTime(config.time)
		var tz = config.tz || ""
		function parts() {
			return fixed || partsFromMs(Date.now(), tz)
		}
		function angles() {
			var p = parts()
			return anglesFrom(p.hours, p.minutes, p.seconds, p.millis)
		}
		var face = {
			setTime: function (text) {
				fixed = parseTime(text) // null (or anything invalid) goes back to the live clock
			},
		}
		var getters = {
			size: function () { return size },
			radius: function () { return size / 2 },
			hours: function () { return parts().hours },
			minutes: function () { return parts().minutes },
			seconds: function () { return parts().seconds },
			hourAngle: function () { return angles().hourAngle },
			minuteAngle: function () { return angles().minuteAngle },
			secondAngle: function () { return angles().secondAngle },
		}
		Object.keys(getters).forEach(function (k) {
			Object.defineProperty(face, k, { get: getters[k], enumerable: true })
		})
		return face
	}

	// Inside the sandboxed iframe: install window.face, accept time overrides from the host page,
	// and report sketch errors to it.
	function install(config) {
		var face = createFace(config)
		root.face = face
		root.addEventListener("message", function (e) {
			if (e.source === root.parent && e.data && e.data.type === "face-time") face.setTime(e.data.time)
		})
		root.addEventListener("error", function (e) {
			root.parent.postMessage({ type: "face-error", message: String(e.message) }, "*")
		})
		return face
	}

	root.FaceRuntime = { anglesFrom: anglesFrom, partsFromMs: partsFromMs, parseTime: parseTime, createFace: createFace, install: install }
})(typeof window !== "undefined" ? window : globalThis)
