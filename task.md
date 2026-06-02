# Integrations Feature — Task Plan

## Backend
- [x] models.py → Device + DeviceReading tables
- [x] schemas.py → DeviceCreate, DeviceOut, DeviceReadingOut
- [x] routers/devices.py → CRUD + /test-connection + /readings
- [x] main.py → include devices router

## Gateway (new folder /gateway)
- [x] connectors/solaredge.py     — REST polling
- [x] connectors/modbus_tcp.py    — pymodbus TCP
- [x] connectors/modbus_rtu.py    — pymodbus RTU serial
- [x] connectors/opcua_client.py  — asyncua
- [x] normalizer.py               — → DeviceReading schema
- [x] gateway.py                  — main loop: poll all devices → POST to FastAPI
- [x] requirements.txt

## Frontend
- [x] pages/Integrations.jsx      — full page
  - DeviceList (table with live status badges)
  - AddDeviceModal (form: type, protocol, host/port/key)
  - TestConnectionModal (spinner + result)
  - ReadingsPreview (last 10 readings per device)
- [x] App.jsx → add integrations route
- [x] Sidebar.jsx → add nav item
- [x] translations.js → all keys PT/EN/FR/ES/NL

## Build + deploy
- [ ] pip install pymodbus asyncua
- [ ] npm run build
- [ ] restart server
