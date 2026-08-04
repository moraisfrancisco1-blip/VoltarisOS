# VoltarisOS Edge Gateway

Polls physical devices and pushes normalised readings to the VoltarisOS backend.

## Protocols supported

| Protocol     | Library    | Notes |
|-------------|-----------|-------|
| SolarEdge API | httpx     | Cloud REST, read-only |
| Fronius JSON  | httpx     | Local LAN |
| Huawei FusionSolar | httpx | Local or cloud |
| SMA Sunny Portal | httpx  | Local LAN |
| Modbus TCP   | pymodbus   | SunSpec registers |
| Modbus RTU   | pymodbus   | RS-485 serial |
| OPC-UA       | asyncua    | Wind farm SCADAs |

## Setup

```bash
pip install -r requirements.txt
```

## Run

```bash
# Against local backend
python -m gateway.gateway --api http://localhost:8000 --interval 30

# Against Railway/cloud backend
python -m gateway.gateway --api https://your-app.up.railway.app --interval 60
```

## Docker (edge device / Raspberry Pi)

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY gateway/ ./gateway/
RUN pip install -r gateway/requirements.txt
CMD ["python", "-m", "gateway.gateway", "--api", "https://your-backend.com"]
```

## Adding a new device

1. Go to **Integrations** page in VoltarisOS
2. Click **+ Add Device**
3. Fill in protocol, host/port, credentials
4. Click **Test Connection**
5. Gateway picks it up on next poll cycle

## Config examples per protocol

### SolarEdge
```json
{ "api_key": "XXXXXXXX", "site_id": "123456" }
```

### Modbus TCP
```json
{ "host": "192.168.1.100", "port": 502, "unit_id": 1 }
```

### Modbus RTU
```json
{ "port": "/dev/ttyUSB0", "baudrate": 9600, "unit_id": 1 }
```

### OPC-UA
```json
{
  "url": "opc.tcp://scada.site:4840",
  "username": "admin",
  "password": "pass",
  "node_power": "ns=2;i=1001",
  "node_energy": "ns=2;i=1002",
  "node_temp":   "ns=2;i=1003"
}
```
