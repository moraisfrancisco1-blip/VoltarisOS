# FIRST PHYSICAL PARK — PRODUCTION ONBOARDING

Guia operacional para preparar o primeiro parque solar físico no Voltaris sem
inserções manuais na base de dados. Todo o fluxo (tenant → site → device →
gateway auth → ingest → monitoring) é configurável via API e verificado com o
`production-readiness` check.

> Nenhum segredo real é aqui incluído. Substitua os placeholders (`<...>`).

---

## 1. Pré-requisitos

- Backend a correr com `SECRET_KEY` definida (obrigatória).
- `ENVIRONMENT=production` em produção.
- Base de dados acessível (`DATABASE_URL`).
- (Recomendado) Redis + Celery worker/beat para offline detection automático —
  ver secção 2.

## 2. Redis / RUN_CELERY

O offline detection (`detect_offline_devices`) é uma tarefa Celery agendada pelo
beat a cada 5 minutos. Para o ter ativo em produção:

```env
REDIS_URL=redis://<host>:6379/0
RUN_CELERY=1
```

- `start.sh` lança worker+beat quando `RUN_CELERY=1` (defina `RUN_CELERY=0` para
  desativar).
- Se Redis/Celery **não** estiverem disponíveis, o readiness check reporta
  `degraded`/`not_configured` — **nunca** `healthy`, porque o offline detection
  não estaria operacional.

## 3. Migrations

As migrations são aplicadas automaticamente no arranque (`backend/migrations/runner.py`),
idempotentes e ordenadas. As relevantes para este onboarding:

| Migration | O que faz |
|-----------|-----------|
| `add_device_reading_unique` | índice único `(device_id, timestamp)` — idempotência de leituras |
| `add_site_timezone` | coluna nullable `sites.timezone` (IANA) |
| `add_device_external_id` | coluna nullable `devices.external_id` + índice único parcial por tenant |

Para verificar se estão aplicadas: consultar a tabela `schema_migrations` ou o
readiness check (`components.migrations.status`).

## 4. Criar Tenant / Site / Device

### Tenant
Criado através do registo de organização (`/api/auth/register`). Em produção o
primeiro parque pertence ao tenant da empresa operadora.

### Site
```
POST /api/sites
Authorization: Bearer <JWT TENANT_ADMIN>
{
  "name": "PV Lisboa Norte",
  "location": "Lisboa",
  "lat": 38.7,
  "lng": -9.1,
  "timezone": "Europe/Lisbon",
  "solar_kw": 500.0,
  "battery_kwh": 0.0,
  "ev_chargers": 0,
  "owner": "ParkCo",
  "status": "active"
}
```

### Device
```
POST /api/devices
Authorization: Bearer <JWT TENANT_ADMIN>
{
  "name": "INV-01",
  "site_id": <site_id>,
  "protocol": "solaredge",
  "device_type": "inverter",
  "external_id": "SN-<serial físico>",
  "enabled": true
}
```

## 5. Timezone (Site)

- Coluna `sites.timezone` valida **IANA** (`Europe/Lisbon`, `Europe/Amsterdam`, …).
- Timezones inválidos → **422**.
- Internamente o sistema continua em **UTC**; o timezone é metadado de operação
  (forecast solar, reporting diário, operação local).
- Não é derivado de latitude/longitude — é fornecido explicitamente.
- Sites existentes sem valor: `NULL` (sem backfill inventado).

## 6. external_id (identificador físico)

Mapeia o equipamento físico (serial) para o `device_id` interno:

- `devices.external_id` é **único dentro do tenant** e **pode repetir entre
  tenants diferentes**.
- É `NULL`-able: devices existentes ficam sem valor até configuração.
- **Nunca substitui** o `device_id` interno — é um mapping adicional.
- Resolvido **estritamente dentro do tenant autenticado** (não há vazamento
  cross-tenant).
- `POST /api/devices` devolve **409** se o `external_id` já existir no tenant.

O endpoint de ingestão continua a aceitar `device_id`. Além disso, o batch aceita
`external_id` como alternativa. Quando ambos são enviados, `device_id` tem
prioridade.

## 8. Payload de ingestão

### Via device_id
```
POST /api/devices/ingest/batch
Authorization: Bearer <gateway key>
{
  "readings": [
    {"device_id": 123, "timestamp": "2026-09-01T10:00:00+00:00", "power_kw": 120.0, "energy_kwh": 0.5}
  ]
}
```

### Via external_id
```
{
  "readings": [
    {"external_id": "SN-<serial>", "timestamp": "2026-09-01T10:00:00+00:00", "power_kw": 120.0, "energy_kwh": 0.5}
  ]
}
```

O `timestamp` pode ser timezone-aware (é normalizado para UTC). Leituras sem
`device_id` **nem** `external_id` são rejeitadas.

## 9. energy_mode

- `interval_delta` (padrão): `energy_kwh` é a energia do intervalo.
- `cumulative_total`: **rejeitado** — o gateway deve converter o contador
  acumulado em delta de intervalo antes de enviar.

## 10. Idempotência

Uma leitura é única por `(device_id, timestamp)` (ou o device resolvido por
`external_id` + `timestamp`):

- Primeira leitura válida → `accepted`.
- Retry com o mesmo `(device, timestamp)` → `duplicated` (não cria nova leitura,
  não soma energia de novo, não re-dispara alertas).
- A resposta do batch distingue `accepted` / `duplicated` / `rejected`.

## 11. Primeiro teste de telemetria

Envie uma leitura real (dados controlados) via batch. Depois confirme:

- Resposta `202` com `accepted >= 1`.
- Device fica `online` (`GET /api/devices/<id>`).
- A leitura está persistida (telemetry / readings do device).

## 12. Como verificar

- **Online**: `GET /api/devices/<id>` → `status == "online"`, `last_seen` atualizado.
- **Carbon**: `GET /api/carbon/overview` → `solar_today_kwh` reflecte a energia.
- **Maintenance**: `GET /api/maintenance/assets` → o device aparece.
- **Alerts**: criar uma `AlertRule` (ex.: `temp_c > 45`) e verificar que uma
  leitura persistida gera o alerta (não duplicado em retries).
- **Offline detection**: `GET /api/admin/production-readiness` →
  `components.celery.offline_detection_beat == "configured"` e `redis == "healthy"`.
  Com o worker ativo, um device silencioso por `DEVICE_OFFLINE_AFTER_MINUTES`
  (padrão 30) fica `offline` com alerta de comunicação.

## 13. Production readiness check

Endpoint admin (SUPER_ADMIN):

```
GET /api/admin/production-readiness
Authorization: Bearer <JWT SUPER_ADMIN>
```

Resposta:

```json
{
  "status": "healthy" | "degraded" | "not_configured",
  "environment": "production",
  "run_celery": true,
  "components": {
    "database": {"status": "healthy", "type": "postgresql"},
    "redis": {"status": "healthy" | "not_configured" | "unavailable", "required": true},
    "celery": {"status": "healthy" | "no_workers", "workers": [...],
               "offline_detection_beat": "configured" | "missing"},
    "ingest_auth": {"status": "configured" | "not_configured"},
    "migrations": {"status": "up_to_date" | "pending", "applied_count": N}
  },
  "issues": [...]
}
```

- `healthy`: todas as dependências exigidas operacionais.
- `degraded`: algo configurado mas não operacional (ex.: Redis inalcançável,
  workers ausentes, migration pendente, DB em baixo).
- `not_configured`: dependência exigida totalmente por configurar (ex.:
  `RUN_CELERY != 1`, `GATEWAY_API_KEYS` ausente).
- **Não expõe segredos** — apenas estados, contagens e booleans.

## 14. Troubleshooting

| Sintoma | Causa provável | Solução |
|---------|----------------|---------|
| `422` ao criar site com timezone | timezone não-IANA | usar `Europe/Lisbon` |
| `409` ao criar device | `external_id` duplicado no tenant | escolher serial único |
| Batch `rejected=1` com `external_id` | device não encontrado **no tenant autenticado** | confirmar `external_id` e a chave de gateway do tenant correto |
| `rejected` por `cumulative_total` | payload usa modo cumulativo | converter para `interval_delta` |
| Readiness `not_configured` | `RUN_CELERY=0` e/ou `GATEWAY_API_KEYS` vazio | definir env e reiniciar |
| Readiness `degraded` (redis) | Redis inalcançável | verificar `REDIS_URL` / conectividade |
| Readiness `degraded` (migrations) | migrations não aplicadas | reiniciar o backend (aplica automaticamente) |

