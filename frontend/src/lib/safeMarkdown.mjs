// Minimal, XSS-safe "markdown" for chat bubbles that are rendered with
// dangerouslySetInnerHTML.
//
// The text shown in the copilot comes from places an attacker can influence:
// LLM output (steerable by prompt injection) and strings containing user or
// tenant data (site/device names, typed commands). It must therefore never
// reach the DOM as raw HTML. The rule here is: escape EVERYTHING first, and
// only then turn **bold** / *italic* into tags. The tags are added after
// escaping, so they are the only markup that can ever appear.

const HTML_ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);
}

export function renderMarkdownLite(text, { italic = true } = {}) {
  let html = escapeHtml(text).replace(
    /\*\*(.*?)\*\*/g,
    '<strong style="color:var(--text)">$1</strong>',
  );
  if (italic) html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");
  return html;
}
