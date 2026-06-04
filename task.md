# VoltarisOS — Full Feature Build

## BATCH 1 — Backend (fazer tudo em paralelo)
- [ ] Multi-tenancy: tenant_id em todos os models, middleware de isolamento
- [ ] WebSockets: /ws/alerts endpoint, broadcast de alarmes em tempo real
- [ ] PDF Reports: WeasyPrint ou reportlab, rota /api/reports/generate
- [ ] VPP: routers/vpp.py — aggregate sites, bid to market
- [ ] Alerts engine: routers/alerts.py — regras configuráveis + histórico

## BATCH 2 — Frontend
- [ ] VPP page: Virtualpowerplant.jsx
- [ ] PDF Reports page: melhorar ReportsAnalytics.jsx
- [ ] Real-time alerts: WebSocket hook + live toast
- [ ] Onboarding wizard: 5 minutos, liga primeiro device
- [ ] Swagger UI link na sidebar

## BATCH 3 — Deploy + Infra
- [ ] requirements.txt atualizado
- [ ] build + push
