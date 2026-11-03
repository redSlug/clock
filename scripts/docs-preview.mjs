// Browse all project docs in your browser, with Mermaid diagrams drawn.
// Usage: npm run docs                       (opens at the README)
//        npm run docs -- docs/auth-flow.md  (opens at a specific doc)
// Builds one HTML file in your temp folder and opens it. Features: sidebar, Previous/Next,
// working links between docs, keyboard arrows. The page loads `marked` and `mermaid` from the
// jsdelivr CDN in your browser; your document text is not sent anywhere.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const walk = (dir) =>
	fs.existsSync(dir)
		? fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
				e.isDirectory() ? walk(path.join(dir, e.name)) : e.name.endsWith(".md") ? [path.join(dir, e.name)] : [],
			)
		: [];

// Reading order: the README first, then guides, the design doc, ADRs, ops records.
const preferred = ["README.md"];
const rest = walk("docs").filter((f) => !preferred.includes(f)).sort();
const files = [...preferred, ...rest].filter((f) => fs.existsSync(f));

const docs = Object.fromEntries(files.map((f) => [f.split(path.sep).join("/"), fs.readFileSync(f, "utf8")]));
const order = Object.keys(docs);
const start = (process.argv[2] ?? "README.md").split(path.sep).join("/");
const data = JSON.stringify({ docs, order, start }).replace(/</g, "\\u003c");

const out = path.join(os.tmpdir(), "docs-preview.html");
fs.writeFileSync(
	out,
	`<!doctype html>
<html><head><meta charset="utf-8"><title>Project docs</title>
<style>
 *{box-sizing:border-box} body{margin:0;font:16px/1.55 -apple-system,system-ui,sans-serif;color:#1f2328;display:flex;min-height:100vh}
 nav{width:270px;flex:none;background:#f6f8fa;border-right:1px solid #d0d7de;padding:1rem;position:sticky;top:0;height:100vh;overflow:auto}
 nav h2{font-size:12px;text-transform:uppercase;color:#656d76;margin:1rem 0 .3rem;border:none}
 nav a{display:block;padding:4px 8px;border-radius:6px;color:#1f2328;text-decoration:none;font-size:14px}
 nav a:hover{background:#eaeef2} nav a.active{background:#ddf4ff;font-weight:600}
 main{flex:1;max-width:980px;padding:1rem 2.5rem 4rem}
 table{border-collapse:collapse;margin:1rem 0} th,td{border:1px solid #d0d7de;padding:6px 12px;text-align:left;vertical-align:top}
 th{background:#f6f8fa} code{background:#eff1f3;padding:.1em .35em;border-radius:4px;font-size:90%}
 pre{background:#f6f8fa;padding:1rem;overflow:auto;border-radius:6px} pre code{background:none;padding:0}
 .mermaid{margin:1.5rem 0;text-align:center} main h1,main h2{border-bottom:1px solid #d0d7de;padding-bottom:.3em}
 .pager{display:flex;justify-content:space-between;margin-top:3rem;padding-top:1rem;border-top:1px solid #d0d7de}
 .pager a{color:#0969da;text-decoration:none;cursor:pointer}
 .path{color:#656d76;font-size:13px;margin:.5rem 0 0}
</style></head><body>
<nav id="nav"></nav><main><div class="path" id="path"></div><div id="out"></div><div class="pager" id="pager"></div></main>
<script type="module">
import { marked } from "https://cdn.jsdelivr.net/npm/marked/lib/marked.esm.js";
import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";
const { docs, order, start } = ${data};
mermaid.initialize({ startOnLoad: false });

const title = (p) => (docs[p].match(/^#\\s+(.+)$/m)?.[1] ?? p).replace(/\`/g, "");
const groups = { "Start": (p) => p === "README.md", "Guides": (p) => /^docs\\/[^/]+\\.md$/.test(p),
  "Decisions (ADRs)": (p) => p.startsWith("docs/adr/"), "Ops records": (p) => p.startsWith("docs/ops/"), "Other": () => true };
const nav = document.getElementById("nav");
const used = new Set();
nav.innerHTML = "<strong>Project docs</strong>";
for (const [name, test] of Object.entries(groups)) {
  const items = order.filter((p) => !used.has(p) && test(p));
  if (!items.length) continue;
  nav.insertAdjacentHTML("beforeend", "<h2>" + name + "</h2>");
  for (const p of items) {
    used.add(p);
    const a = document.createElement("a");
    a.href = "#" + p; a.textContent = p.endsWith("README.md") && p !== "README.md" ? p : title(p); a.dataset.p = p;
    nav.append(a);
  }
}

const slug = (t) => t.toLowerCase().replace(/[^\\w\\s-]/g, "").trim().replace(/\\s+/g, "-");
const norm = (base, href) => {
  const parts = (base.split("/").slice(0, -1).join("/") + "/" + href).split("/");
  const stack = [];
  for (const s of parts) { if (s === "..") stack.pop(); else if (s && s !== ".") stack.push(s); }
  return stack.join("/");
};

async function show(path, frag) {
  if (!docs[path]) path = order[0];
  const out = document.getElementById("out");
  out.innerHTML = marked.parse(docs[path]);
  document.getElementById("path").textContent = path;
  document.title = title(path);
  for (const h of out.querySelectorAll("h1,h2,h3,h4")) h.id = slug(h.textContent);
  for (const code of out.querySelectorAll("pre > code.language-mermaid")) {
    const div = document.createElement("div");
    div.className = "mermaid"; div.textContent = code.textContent;
    code.parentElement.replaceWith(div);
  }
  for (const a of out.querySelectorAll("a[href]")) {
    const href = a.getAttribute("href");
    if (/^(https?:|mailto:)/.test(href)) { a.target = "_blank"; continue; }
    const [file, hash] = href.split("#");
    if (!file && hash) { a.onclick = (e) => { e.preventDefault(); document.getElementById(hash)?.scrollIntoView(); }; continue; }
    const target = norm(path, file);
    if (docs[target]) a.href = "#" + target + (hash ? "|" + hash : "");
  }
  for (const a of nav.querySelectorAll("a")) a.classList.toggle("active", a.dataset.p === path);
  const i = order.indexOf(path);
  const pager = document.getElementById("pager");
  pager.innerHTML = "";
  const link = (p, label) => { const a = document.createElement("a"); a.href = "#" + p; a.textContent = label; return a; };
  pager.append(i > 0 ? link(order[i - 1], "\\u2190 " + title(order[i - 1])) : document.createElement("span"));
  pager.append(i < order.length - 1 ? link(order[i + 1], title(order[i + 1]) + " \\u2192") : document.createElement("span"));
  await mermaid.run({ querySelector: ".mermaid" });
  if (frag) document.getElementById(frag)?.scrollIntoView(); else window.scrollTo(0, 0);
}

const route = () => { const [p, frag] = decodeURIComponent(location.hash.slice(1) || start).split("|"); show(p, frag); };
addEventListener("hashchange", route);
addEventListener("keydown", (e) => {
  if (e.altKey || e.metaKey || e.ctrlKey || e.shiftKey) return;
  const cur = nav.querySelector("a.active")?.dataset.p; const i = order.indexOf(cur);
  if (e.key === "ArrowRight" && i < order.length - 1) location.hash = "#" + order[i + 1];
  if (e.key === "ArrowLeft" && i > 0) location.hash = "#" + order[i - 1];
});
route();
</script></body></html>`,
);
console.log(out);
execFileSync("open", [out]);
