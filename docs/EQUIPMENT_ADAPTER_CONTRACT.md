# EQUIPMENT ADAPTER CONTRACT

Documento da fronteira de integração de equipamentos físicos no Voltaris.

```
EQUIPAMENTO REAL
  → MANUFACTURER ADAPTER (futuro, específico)
  → NormalizedReading (contrato interno único)
  → ingest_adapter_payload() → pipeline de ingestão existente
```

Esta fase implementa apenas a **fundação reutilizável**. Nenhum fabricante real
(Sungrow, Huawei, SolarEdge, Fronius, SMA, Modbus, MQTT…) é emulado aqui. O
primeiro adapter de fabricante só deve ser criado com documentação técnica real
e verificável (ver checklist no fim).

---

## 1. Arquitetura

- `backend/equipment/contract.py` — `NormalizedReading` (contrato único) + `NormalizationError`.
- `backend/equipment/base.py` — `EquipmentAdapter` (interface abstrata).
- `backend/equipment/generic.py` — `GenericEquipmentAdapter` (adapter de referência/teste; **não** é fabricante).
- `backend/equipment/service.py` — `ingest_adapter_payload(adapter, raw_payload, identity, db)`.

O pipeline de ingestão existente (`_ingest_readings_batch` em `backend/routers/devices.py`)
é **reutilizado** — não há validação, deduplicação, alertas, `last_seen`, carbon
ou maintenance duplicados. Os readings normalizados convergem no mesmo caminho do
`POST /api/devices/ingest/batch`.

## 2. Responsabilidade do adapter

- Converter um payload específico do equipamento em `NormalizedReading`.
- Garantir unidades normalizadas e `external_id` físico.
- Falhar explicitamente (`NormalizationError`) em dados ambíguos.
- **NÃO** conter lógica de rede, API do fabricante, credenciais ou controlo físico.
- **NÃO** escolher o tenant — o tenant vem da identidade autenticada do gateway.

## 3. Formato interno normalizado (`NormalizedReading`)

Reutiliza `backend.schemas.DeviceReadingBase` + identificador:

| Campo | Tipo | Obrigatório | Notas |
|-------|------|-------------|-------|
| `external_id` | str | sim (ou `device_id`) | físico, único por tenant |
| `device_id` | int | alternativo | id interno já conhecido |
| `timestamp` | datetime/ISO | opcional | normalizado para UTC |
| `power_kw` | float | opcional | ≥ 0, ≤ 100000 |
| `energy_kwh` | float | opcional | ≥ 0 |
| `energy_mode` | str | opcional | `interval_delta` (ou omisso) |
| `soc_pct` | float | opcional | 0–100 |
| `temp_c` / `voltage_v` / `current_a` / `frequency_hz` | float | opcional | |
| `raw` | dict | opcional | payload original (segredos mascarados) |

Campos desconhecidos → rejeitados (`extra="forbid"`).

## 4. external_id mapping

`external_id` → device resolvido **estritamente dentro do tenant autenticado**.
Nunca é feita resolução global sem tenant. Um gateway do tenant A **nunca**
resolve nem ingere device do tenant B. Se ambos `device_id` e `external_id`
vierem, `device_id` tem prioridade.

## 5. Unidades

O adapter é responsável por produzir unidades já normalizadas (kW, kWh, °C, V,
A, Hz). Conversão de unidades de fabricante (ex.: W→kW, contador acumulado→delta)
é responsabilidade do adapter específico, antes do `NormalizedReading`.

## 6. Timezone

- `timestamp` pode ser timezone-aware; o pipeline converte para **UTC** interno.
- `timestamp` no futuro é rejeitado.
- `timestamp` omisso → usa "agora" (UTC).

## 7. energy_mode

- `interval_delta` (padrão): `energy_kwh` é a energia do intervalo.
- `cumulative_total`: **rejeitado** (deve ser convertido a delta antes).
- Qualquer outro valor → rejeitado como `unsupported energy_mode`.

## 8. Idempotência

Uma leitura é única por `(device_id, timestamp)` (resolvido por `external_id`).
Retry com o mesmo par → `duplicated`; não duplica energia, não re-dispara alertas.
O resultado do pipeline expõe `accepted` / `duplicated` / `rejected`.

## 9. Tratamento de erros

`NormalizationError` (distinta de erros de ingestão):

- `external_id`/`device_id` ausentes.
- payload não é dict/list.
- `timestamp` inválido (não analisável).
- `energy_mode` desconhecido / `cumulative_total`.
- campo desconhecido (payload incompatível).
- valor fora dos limites (ex.: `power_kw < 0`, `soc_pct > 100`).

Erros de ingestão (device não encontrado, tenant mismatch, duplicado) são
devolvidos no resultado do pipeline (`rejected`/`duplicated`), não como
`NormalizationError`.

## 10. raw payload

- `raw` é opcional e preserva o payload original.
- Segredos (token, api_key, password, secret, authorization, etc.) são **mascarados**
  antes de persistir (`***REDACTED***`), inclusive em objetos aninhados.
- A normalização não depende de armazenar `raw`.

## 11. Como adicionar um fabricante real

1. Criar `backend/equipment/<fabricante>.py` com `class <Fab>Adapter(EquipmentAdapter)`.
2. Implementar `normalize(payload) -> List[NormalizedReading]`:
   - mapear campos do fabricante → unidades normalizadas;
   - converter energia acumulada → `interval_delta` quando aplicável;
   - falhar (`NormalizationError`) em dados ambíguos.
3. Não fazer chamadas de rede nem controlo físico no `normalize`.
4. Testar com payloads reais fornecidos pela documentação do fabricante.

## 12. Informação necessária antes do primeiro adapter real

Ver **FIRST MANUFACTURER INTEGRATION CHECKLIST** abaixo. Sem estes dados
verificáveis, **não** implementar um adapter de fabricante.

---

## FIRST MANUFACTURER INTEGRATION CHECKLIST

Antes de escrever o primeiro adapter real, recolher e confirmar com o fabricante/operador:

- [ ] **Fabricante** (nome oficial)
- [ ] **Modelo** (referência exata do equipamento)
- [ ] **Firmware** (versão)
- [ ] **Logger / Gateway** (dispositivo intermédio e sua versão)
- [ ] **Protocolo** (REST, MQTT, Modbus, proprietário…)
- [ ] **Documentação oficial** (link/PDF verificável)
- [ ] **Payload real** (exemplo anonimizado de telemetria)
- [ ] **Frequência de telemetria** (intervalo de envio)
- [ ] **Unidade de potência** (W vs kW)
- [ ] **Semântica da energia** (`interval_delta` vs acumulado; reset de contador)
- [ ] **Timestamp / timezone** (formato e fuso; se é UTC ou local)
- [ ] **Método de autenticação** (token, API key, OAuth…)
- [ ] **Limites de API** (rate limit, paginação, batch máximo)
- [ ] **Capabilities de leitura** (que métricas são expostas)
- [ ] **Capabilities de escrita** (se o gateway pode receber comandos — fora do âmbito atual)

Sem esses dados confirmados, o adapter não deve ser implementado.

