# Task: Security hardening before real beta testers

## Done (previous commit b6e17c5)
- JWT required on all data endpoints
- bcrypt password hashing w/ auto-migration from legacy sha256
- Unified SECRET_KEY across auth.py + alerts_ws.py
- CORS restricted to production domain
- Frontend axios/fetch interceptor auto-attaches token

## This round — 6 points before beta testers
1. [DONE] Change-password endpoint added (/api/auth/change-password) — need to actually
   change admin123 password via this endpoint once deployed, or tell user to do it in UI
2. [DONE] Rate limiting via slowapi — shared `limiter` instance in backend/security.py,
   imported in main.py (app.state.limiter) and auth.py (@limiter.limit decorators)
   - register: 5/minute, login: 10/minute
3. [IN PROGRESS] /api/alerts/fire — was fully public, now needs require_gateway_key
   dependency (GATEWAY_API_KEY env var, fail-closed if not set). Added helper in
   security.py. STILL NEED: apply Depends(require_gateway_key) to the fire_alert route
   in alerts_ws.py, and generate+tell user the GATEWAY_API_KEY value for Railway.
4. [TODO] Copilot fallback responses are fake/static but don't disclose it — add
   a `"simulated": true` flag in response + a visible note in the fallback text.
5. [TODO] React ErrorBoundary — wrap App in an error boundary component so one
   crashing page doesn't white-screen the whole app.
6. [TODO] WebSocket /ws/alerts accepts token=="demo" as valid → returns tenant "1".
   Remove that shortcut, require real JWT always (except maybe explicit dev flag).

## Next steps
- Finish alerts_ws.py fire_alert protection
- Copilot honesty flag
- ErrorBoundary component
- Remove "demo" WS bypass
- pip install slowapi already done locally; added to requirements.txt
- Test locally (spin up on a free port, curl all critical paths, rate-limit test)
- Build frontend, commit, push (token already in .env.github, remote already configured with it)
- Give user: GATEWAY_API_KEY value + reminder to set SECRET_KEY, GATEWAY_API_KEY in Railway
- Tell user to change admin password via new endpoint or ask them to pick one now
