# VoltarisOS

Multi-tenant Virtual Power Plant (VPP) platform: forecasts load/price/solar,
runs a rolling-horizon MILP optimizer over a tenant's battery/EV/heat-pump/
industrial-load portfolio, and persists every forecast and optimization run
for audit. FastAPI backend, Celery/Redis for the scheduled pipeline,
PostgreSQL, React frontend.

## Repository layout

| Path | What it is |
|------|------------|
| `backend/` | FastAPI app: routers, models, auth, billing, startup validation |
| `forecasting/` | Load/price/solar forecast providers + freshness/staleness enforcement (`health.py`) |
| `optimization/` | MILP asset optimizer, rolling horizon, canonical forecast→optimize pipeline, run persistence |
| `simulation/` | Economic-consistency and scenario tests for the optimizer (used as a calculation correctness gate) |
| `control/` | Translates optimizer output into device setpoints. Physical writes are intentionally not implemented — dry-run only. |
| `gateway/` | Standalone edge process (on-prem/Raspberry Pi) that polls real equipment (SolarEdge, Modbus TCP/RTU, OPC-UA — see `gateway/README.md` for per-protocol status) and pushes readings to the backend. |
| `frontend/` | React dashboard |
| `docs/` | Deployment checklist, equipment adapter contract, onboarding guides |

## Running tests

```bash
pip install -r requirements.txt
python -m pytest backend forecasting optimization simulation control gateway
```

CI (`.github/workflows/tests.yml`) runs this same suite on every push/PR to
`main` and `master`. **`main` is the branch Railway deploys from** — target
PRs at `main`, not `master`, unless you're intentionally working on the
older line.

## Local environment

Copy `.env.example` and set at minimum `SECRET_KEY` (see
`docs/DEPLOYMENT_CHECKLIST.md` for the full list and what's required vs
optional). SQLite is fine for local dev; production blocks SQLite at
startup and requires `DATABASE_URL` to point at PostgreSQL.

## Deployment

See `docs/DEPLOYMENT_CHECKLIST.md` for the full pre-deploy checklist
(required env vars, startup sequence, health endpoints, post-deploy
verification steps).

## Known limitations (current, not aspirational)

- No physical control of equipment yet — `control/dispatch_executor.py`
  only produces a dry-run setpoint plan.
- Two edge-gateway connectors (SMA, Huawei) authenticate and fetch real
  vendor data but don't parse it into `power_kw`/`energy_kwh` yet; see
  `gateway/README.md`.
- Load forecasting is historical median-based (no uncertainty
  quantification in the live pipeline yet); see
  `forecasting/architecture_review.md` for the fuller picture and
  priorities.

---
All rights reserved, Francisco Morais.
