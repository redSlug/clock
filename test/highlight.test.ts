import { readFileSync, readdirSync } from "node:fs"
import { beforeAll, describe, expect, it } from "vitest"

let html: (s: string) => string
beforeAll(() => {
	new Function(readFileSync("public/highlight.js", "utf8"))()
	html = (globalThis as any).Highlight.html
})

// What the browser would show as text: strip the tags, undo the escaping.
const textOf = (h: string) => h.replace(/<[^>]+>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")

describe("highlight", () => {
	it("colors comments, strings, numbers and keywords", () => {
		expect(html("// hi")).toBe('<span class="hl-c">// hi</span>')
		expect(html("/* a\nb */")).toBe('<span class="hl-c">/* a\nb */</span>')
		expect(html('"x"')).toBe('<span class="hl-s">"x"</span>')
		expect(html("12.5")).toBe('<span class="hl-n">12.5</span>')
		expect(html("const")).toBe('<span class="hl-k">const</span>')
	})
	it("marks calls, properties and builtins", () => {
		expect(html("circle(0)")).toContain('<span class="hl-f">circle</span>')
		expect(html("face.hourAngle")).toContain('<span class="hl-b">face</span>')
		expect(html("face.hourAngle")).toContain('<span class="hl-p">hourAngle</span>')
		expect(html("a.b(1)")).toContain('<span class="hl-f">b</span>')
	})
	it("does not color inside strings or comments", () => {
		expect(html('"const 1 // x"')).toBe('<span class="hl-s">"const 1 // x"</span>')
		expect(html("// const draw()")).toBe('<span class="hl-c">// const draw()</span>')
	})
	it("escapes HTML so source can never inject markup", () => {
		const h = html("a < b && c > d; // <script>alert(1)</script>")
		expect(h).not.toContain("<script>")
		expect(h).toContain("&lt;")
		expect(h).toContain("&amp;&amp;")
	})
	it("survives unterminated strings and comments mid-typing", () => {
		for (const s of ['"abc', "'abc", "`abc", "/* open", "1.", "a.", "."]) expect(textOf(html(s))).toBe(s)
	})
	it("keeps every character in order (so it lines up under the text box) for real code", () => {
		const files = ["public/starter-face.js", "public/default-face.js", ...readdirSync("seed/faces").map((f) => `seed/faces/${f}`)]
		for (const f of files) {
			const src = readFileSync(f, "utf8")
			expect(textOf(html(src)), f).toBe(src)
		}
	})
})
