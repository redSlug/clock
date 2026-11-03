// Tiny JavaScript syntax highlighter for the editor. No dependencies.
// Highlight.html(source) returns HTML where every character of the source is kept, in order, so the highlighted
// copy lines up exactly with the text box on top of it. Also runs under Node for tests.
(function (root) {
	var KEYWORDS = {}
	"const let var function return if else for while do break continue switch case default new this typeof instanceof in of class extends null undefined true false try catch finally throw async await void delete yield import export from static super"
		.split(" ").forEach(function (w) { KEYWORDS[w] = 1 })
	// p5 / face names worth coloring when they are not calls
	var BUILTINS = {}
	"face PI TWO_PI HALF_PI QUARTER_PI TAU width height mouseX mouseY frameCount deltaTime Math".split(" ").forEach(function (w) { BUILTINS[w] = 1 })

	// comments | strings | numbers | words. Anything that is not matched is passed through as plain text.
	var TOKEN = /(\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|$))|("(?:\\.|[^"\\\n])*"?|'(?:\\.|[^'\\\n])*'?|`(?:\\[\s\S]|[^`\\])*`?)|((?:\b\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?\b)|([A-Za-z_$][\w$]*)/g

	function esc(s) {
		return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
	}
	function wrap(cls, s) {
		return '<span class="' + cls + '">' + esc(s) + "</span>"
	}

	function html(src) {
		var out = "", last = 0, m
		TOKEN.lastIndex = 0
		while ((m = TOKEN.exec(src))) {
			out += esc(src.slice(last, m.index))
			last = TOKEN.lastIndex
			if (m[1] !== undefined) out += wrap("hl-c", m[0])
			else if (m[2] !== undefined) out += wrap("hl-s", m[0])
			else if (m[3] !== undefined) out += wrap("hl-n", m[0])
			else {
				var w = m[4]
				var before = src.slice(0, m.index).replace(/[ \t]+$/, "").slice(-1)
				var after = src.slice(last).match(/^[ \t]*(.)/)
				if (before === ".") out += wrap(after && after[1] === "(" ? "hl-f" : "hl-p", w)
				else if (KEYWORDS[w]) out += wrap("hl-k", w)
				else if (after && after[1] === "(") out += wrap("hl-f", w)
				else if (BUILTINS[w]) out += wrap("hl-b", w)
				else out += esc(w)
			}
		}
		return out + esc(src.slice(last))
	}

	root.Highlight = { html: html }
})(typeof window !== "undefined" ? window : globalThis)
