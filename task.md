# Task: Security hardening before real beta testers

## Done (previous commit b6e17c5)
- JWT required on all data endpoints
- bcrypt password hashing w/ auto-migration from legacy sha256
- Unified SECRET_KEY across auth.py + alerts_ws.py
- CORS restricted to production domain
- Frontend axios/fetch interceptor auto-attaches token

## This round — 6 points before beta testers (verified 2026-09-01, all resolved)
1. [DONE] Change-password endpoint added (/api/auth/change-password).
   ACTION STILL NEEDED FROM USER: confirm the default admin123 password
   was actually changed via this endpoint/UI on the production account.
2. [DONE] Rate limiting via slowapi — register: 5/minute, login: 10/minute.
3. [DONE] /api/alerts/fire protected by Depends(require_gateway_key) in
   alerts_ws.py (fails closed with 503 if GATEWAY_API_KEY is unset, 401 on
   a wrong key).
4. [DONE] Copilot fallback responses set "simulated": true and "model":
   "fallback" in the API response, plus a visible "⚠️ Dados simulados"
   prefix in the fallback text itself (backend/routers/copilot.py).
5. [DONE] React ErrorBoundary wraps <App /> in frontend/src/main.jsx.
6. [DONE] No "demo" token bypass exists in backend/routers/websocket.py or
   alerts_ws.py — all three WS endpoints require a real JWT via
   decode_token() and close with code 4001 on failure.

All 6 points confirmed complete by reading the current code on `main`.
This file is kept as a record; no further action needed here except the
admin password check in point 1.
