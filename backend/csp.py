"""csp.py — the Content-Security-Policy sent with every response.

The point of a CSP here is XSS containment: the session token lives in
localStorage, so any injected script could read it. `script-src 'self'` means
the browser refuses inline scripts, `javascript:` URLs and eval, whatever gets
injected. The Vite production build needs none of them (checked: no inline
scripts, no eval; the few `Function("return this")` shims are try/catch-guarded).

`style-src` keeps 'unsafe-inline' because React renders style="" attributes
everywhere; styles cannot run code, so that is an accepted, documented gap.
"""
import os
import re

_HOST_RE = re.compile(r"^[A-Za-z0-9.\-]+(:\d{1,5})?$")
STRIPE_API = "https://api.stripe.com"
SWAGGER_CDN = "https://cdn.jsdelivr.net"


def report_only() -> bool:
    """CSP_REPORT_ONLY=true sends the policy as Report-Only (violations are
    logged by the browser, nothing is blocked): a rollback lever that needs no
    code change if a screen turns out to depend on something the policy forbids."""
    return os.getenv("CSP_REPORT_ONLY", "").strip().lower() in ("1", "true", "yes", "on")


def header_name() -> str:
    return "Content-Security-Policy-Report-Only" if report_only() else "Content-Security-Policy"


def is_api_docs(path: str) -> bool:
    return path in ("/docs", "/redoc") or path.startswith(("/docs/", "/redoc/"))


def build_csp(host: str = "", *, api_docs: bool = False, secure: bool = False) -> str:
    """`host` is the public host the page is served from; WebSockets are allowed
    to that host only (a bare `wss:` would let injected code exfiltrate to anywhere)."""
    connect = ["'self'", STRIPE_API]
    if host and _HOST_RE.match(host):  # never put an unvalidated header value into a header
        connect.append(f"wss://{host}")
        if not secure:
            connect.append(f"ws://{host}")
    if api_docs:
        # Swagger UI / ReDoc load their bundle from a CDN and start with an inline
        # script. Only these two pages, and only when FastAPI docs are enabled.
        script_src = f"'self' 'unsafe-inline' {SWAGGER_CDN}"
        style_src = f"'self' 'unsafe-inline' {SWAGGER_CDN} https://fonts.googleapis.com"
        img_src = "'self' data: https:"
        font_src = "'self' data: https://fonts.gstatic.com"
        worker_src = "blob:"
        connect.append(SWAGGER_CDN)
    else:
        script_src = "'self'"
        style_src = "'self' 'unsafe-inline'"
        img_src = "'self' data: https:"
        font_src = "'self' data:"
        worker_src = ""
    directives = [
        "default-src 'self'",
        f"script-src {script_src}",
        f"style-src {style_src}",
        f"img-src {img_src}",
        f"font-src {font_src}",
        f"connect-src {' '.join(connect)}",
        "frame-src 'none'",
        "frame-ancestors 'none'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
    ]
    if worker_src:
        directives.append(f"worker-src {worker_src}")
    if secure:
        directives.append("upgrade-insecure-requests")
    return "; ".join(directives)
