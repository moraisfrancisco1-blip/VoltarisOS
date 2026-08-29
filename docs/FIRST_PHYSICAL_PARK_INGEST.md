# VoltarisOS — First Physical Park Ingest

Guia técnico para ligar o **primeiro parque solar físico** ao VoltarisOS sem inventar
o protocolo do fabricante. A fronteira é clara: o **adaptador/gateway externo** traduz
equipamento → leituras normalizadas Voltaris; a **API** valida, isola por tenant,
persiste, alerta e monitoriza.

> Este documento não contém segredos reais. Todas as credenciais vêm do ambiente.

---

## 1. Pré-requisitos de runtime

- API FastAPI (`backend.main:app`).
- **Celery worker** (`backend.tasks.celery_app`) — processa tasks assíncronas.
- **Celery beat** — agenda tasks periódicas (forecasting, optimization, **deteção offline**).
- **Redis** como broker/result-backend (ver `REDIS_URL`).
- Base de dados (Postgres em produção, SQLite em dev).

## 2. Variáveis de ambiente necessárias

| Var | Obrigatória | Exemplo | Uso |
|---|---|---|---|
| `SECRET_KEY` | sim | — | assinatura JWT |
| `DATABASE_URL` | sim (prod) | `postgresql://...` | DB |
| `REDIS_URL` | sim (worker) | `redis://...` | broker/result Celery |
| `RUN_CELERY` | não | `1` (default) / `0` | desliga worker+beat |
| `DEVICE_OFFLINE_AFTER_MINUTES` | não | `30` | threshold de offline |
| `GATEWAY_API_KEYS` | sim (gateway) | JSON `{"<key>": tenant_id}` | gateway tenant-scoped |
| `GATEWAY_API_KEY` | sim (alerts fire) | — | chave de serviço |
| `OPENAI_API_KEY` | não | — | copilot |
| `ENTSOE_API_KEY` | não | — | preços |
| `CO2_PER_KWH_KG` | não | `0.233` | CO2 |

Nunca pôr credenciais no código. O broker do Celery é lido de `REDIS_URL` (default local).

## 3. Serviços que devem estar ativos

1. `backend.main:app` (API/uvicorn).
2. `celery -A backend.tasks.celery_app worker`.
3. `celery -A backend.tasks.celery_app beat`.
4. Redis.

`start.sh` lança uvicorn (foreground) + worker/beat (background) quando `RUN_CELERY != "0"`.

## 4. Fluxo de ingestão

```
EQUIPMENT
  → Manufacturer/Protocol Adapter (externo)
  → Normalized Voltaris Reading
  → Gateway Authentication (JWT ou gateway key tenant-scoped)
  → POST /api/devices/ingest/batch  (ou /api/devices/{id}/ingest)
  → validação → persistência (DeviceReading)
  → avaliação de regras (alertas) → monitoring/carbon/maintenance
```

## 5. Exemplo de payload individual

`POST /api/devices/{device_id}/ingest` com Bearer JWT ou gateway key:

```json
{
  "timestamp": "2026-08-29T10:00:00+00:00",
  "power_kw": 120.5,
  "energy_kwh": 0.75,
  "energy_mode": "interval_delta",
  "temp_c": 42.0,
  "soc_pct": null
}
```

## 6. Exemplo de batch

`POST /api/devices/ingest/batch` (máx. 10.000 leituras, responde 202):

```json
{
  "readings": [
    {"device_id": 1001, "timestamp": "2026-08-29T10:00:00+00:00", "power_kw": 120.5, "energy_kwh": 0.75, "energy_mode": "interval_delta"},
    {"device_id": 1001, "timestamp": "2026-08-29T10:05:00+00:00", "power_kw": 118.0, "energy_kwh": 0.70, "energy_mode": "interval_delta"}
  ]
}
```

## 7. Semântica de `energy_kwh`

- **`energy_mode` (padrão) = `interval_delta`**: `energy_kwh` é a energia **produzida no intervalo** (delta). É esta a semântica usada por Carbon/forecast/maintenance (soma de deltas).
- **`cumulative_total` NÃO é suportado** e é **rejeitado com erro explícito** — para não tratar um contador cumulativo como delta e corromper os dados.
- **O gateway é responsável por converter** um contador cumulativo (se o equipamento o fornecer) para delta de intervalo antes de enviar.

## 8. Requisitos de timestamp

- ISO 8601, com ou sem timezone. Se tiver timezone, é normalizado para **UTC naive** no ingest (não crasha).
- Timestamps no **futuro** são rejeitados.
- Armazenamento em UTC.

## 9. Como identificar devices

- `Device.id` (inteiro interno) é o `device_id` usado no payload.
- Recomendado: registar o **serial/número de série** do equipamento em `Device.config` (ex.: `{"serial": "SN-..."}`).
- O adaptador externo mapeia o identificador físico → `device_id`.

## 10. Autenticação

- **JWT** de utilizador autenticado, ou
- **Gateway key tenant-scoped**: `GATEWAY_API_KEYS` liga cada chave a **exatamente um tenant**.
- O tenant é **sempre derivado da identidade autenticada / do device**, nunca do payload.
- Um gateway de um tenant **não consegue** escrever num device de outro tenant (403/rejeição).

## 11. O que o gateway deve fazer

- Autenticar com a gateway key do tenant.
- Traduzir unidades para **kW / kWh**.
- Normalizar o timestamp para ISO/UTC.
- Converter energia **cumulativa → delta** antes de enviar (`energy_mode="interval_delta"`).
- Mapear o identificador físico → `device_id`.
- Gerir **retries de rede** (ver idempotência).

## 12. O que o gateway não deve assumir

- Não assumir que `energy_kwh` pode ser um contador cumulativo (é rejeitado).
- Não enviar leituras com timestamp no futuro.
- Não enviar `power_kw` negativo (rejeitado) nem > 100.000 kW.
- Não assumir controlo físico (o Voltaris **gera schedules/recomendações**, não envia comandos nesta fase).

## 13. Como validar o primeiro device

1. Criar tenant/site/device (admin/onboarding).
2. Configurar `GATEWAY_API_KEYS` para o tenant.
3. Enviar uma leitura de teste (`energy_mode=interval_delta`, timestamp recente, power/energy reais).
4. Confirmar `accepted=1` e `POST /api/devices/{id}/readings` devolve a leitura.
5. Confirmar `maintenance /assets` marca o device `online`.

## 14. Como confirmar alertas

1. Criar uma regra (`POST /api/alert-rules`, ex.: `temp_c > 45`).
2. Enviar uma leitura que ultrapasse o threshold.
3. Confirmar `GET /api/alerts` mostra o alerta (deduplicado).
4. Enviar outra leitura igual → **sem duplicado**.

## 15. Como testar offline / reconexão

1. Após o device ter comunicado, deixar de enviar por > `DEVICE_OFFLINE_AFTER_MINUTES`.
2. Correr `detect_offline_devices` (ou aguardar o beat de 5 min).
3. Confirmar `Device.status = "offline"` e **um** alerta `metric="communication"`.
4. Reenviar uma leitura → device volta a `online`, `last_seen` atualizado e o alerta de comunicação é **automaticamente reconhecido** (outros alertas mantêm-se).

## 16. Checklist do primeiro parque

- [ ] Redis provisionado e `REDIS_URL` configurada.
- [ ] `RUN_CELERY` ativo; worker+beat a correr; `detect_offline_devices` no beat (cron */5).
- [ ] Tenant/site/device criados.
- [ ] `GATEWAY_API_KEYS` configurada para o tenant do parque.
- [ ] Adaptador externo mapeia físico→`device_id` e converte energia para delta.
- [ ] Primeira leitura aceite e visível.
- [ ] Regras de alerta criadas e disparo confirmado (sem duplicados).
- [ ] Teste de offline/reconexão validado.
- [ ] Confirmado que nenhum outro tenant vê os dados do parque.

