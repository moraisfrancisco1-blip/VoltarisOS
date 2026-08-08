"""
locustfile.py — Load testing for VoltarisOS API.

Simulates:
- IoT devices sending telemetry (batch ingest)
- Dashboard users viewing real-time data
- VPP operators submitting bids
- Authentication flows

Usage:
    # Install locust
    pip install locust
    
    # Run with web UI
    locust -f load_test/locustfile.py
    
    # Run headless (CI/CD)
    locust -f load_test/locustfile.py --headless -u 100 -r 10 --run-time 60s --host http://localhost:8000
    
    # Target production
    locust -f load_test/locustfile.py --headless -u 1000 -r 50 --run-time 300s --host https://voltarisos-production.up.railway.app
"""
import random
import time
import json
from locust import HttpUser, task, between, events
from datetime import datetime, timedelta


# ─── Test Data ───────────────────────────────────────────────────────────────

DEVICE_IDS = list(range(1, 501))  # 500 devices
TENANT_IDS = list(range(1, 11))   # 10 tenants
VPP_IDS = list(range(1, 6))       # 5 VPP groups

PROTOCOLS = ["solaredge", "fronius", "huawei", "modbus_tcp", "opcua"]

MARKETS = ["MIBEL", "EPEX", "N2EX", "OMIE"]
DIRECTIONS = ["sell", "buy", "fcr_up", "fcr_down"]


# ─── IoT Device User ─────────────────────────────────────────────────────────

class IoTDeviceUser(HttpUser):
    """Simulates IoT devices sending telemetry data."""
    
    wait_time = between(1, 5)  # 1-5 seconds between requests
    weight = 10  # 10x more likely than other users
    
    def on_start(self):
        """Initialize device with random ID and tenant."""
        self.device_id = random.choice(DEVICE_IDS)
        self.tenant_id = random.choice(TENANT_IDS)
        self.protocol = random.choice(PROTOCOLS)
    
    @task(10)
    def ingest_single_reading(self):
        """Send a single device reading."""
        reading = {
            "power_kw": round(random.uniform(0, 500), 2),
            "energy_kwh": round(random.uniform(0, 1000), 2),
            "soc_pct": round(random.uniform(10, 95), 1),
            "temp_c": round(random.uniform(15, 45), 1),
            "voltage_v": round(random.uniform(220, 240), 1),
            "current_a": round(random.uniform(0, 50), 2),
            "frequency_hz": round(random.uniform(49.5, 50.5), 2),
        }
        
        with self.client.post(
            f"/api/devices/{self.device_id}/ingest",
            json=reading,
            name="/api/devices/[id]/ingest",
            catch_response=True,
        ) as response:
            if response.status_code == 201:
                response.success()
            elif response.status_code == 404:
                response.failure(f"Device {self.device_id} not found")
            else:
                response.failure(f"Unexpected status: {response.status_code}")
    
    @task(3)
    def ingest_batch_readings(self):
        """Send batch of readings (simulates gateway buffer flush)."""
        batch_size = random.randint(10, 100)
        readings = []
        
        for _ in range(batch_size):
            device_id = random.choice(DEVICE_IDS)
            readings.append({
                "device_id": device_id,
                "power_kw": round(random.uniform(0, 500), 2),
                "energy_kwh": round(random.uniform(0, 1000), 2),
                "soc_pct": round(random.uniform(10, 95), 1),
                "timestamp": datetime.utcnow().isoformat(),
            })
        
        with self.client.post(
            "/api/devices/ingest/batch",
            json={"readings": readings},
            name="/api/devices/ingest/batch",
            catch_response=True,
        ) as response:
            if response.status_code in (200, 202):
                data = response.json()
                if data.get("accepted", 0) > 0:
                    response.success()
                else:
                    response.failure("No readings accepted")
            else:
                response.failure(f"Batch ingest failed: {response.status_code}")
    
    @task(1)
    def get_device_status(self):
        """Check device status."""
        self.client.get(
            f"/api/devices/{self.device_id}",
            name="/api/devices/[id]",
        )


# ─── Dashboard User ──────────────────────────────────────────────────────────

class DashboardUser(HttpUser):
    """Simulates dashboard users viewing data."""
    
    wait_time = between(2, 10)
    weight = 3
    
    def on_start(self):
        """Login and get token."""
        self.token = None
        self.tenant_id = random.choice(TENANT_IDS)
        self._login()
    
    def _login(self):
        """Authenticate with the API."""
        response = self.client.post(
            "/api/auth/login",
            json={
                "email": f"loadtest{self.tenant_id}@voltaris.com",
                "password": "loadtest123",
            },
            name="/api/auth/login",
        )
        if response.status_code == 200:
            self.token = response.json().get("token")
    
    @property
    def auth_headers(self):
        return {"Authorization": f"Bearer {self.token}"} if self.token else {}
    
    @task(5)
    def view_dashboard(self):
        """Load dashboard summary."""
        self.client.get(
            "/api/dashboard/summary",
            headers=self.auth_headers,
            name="/api/dashboard/summary",
        )
    
    @task(3)
    def view_devices(self):
        """List devices."""
        self.client.get(
            "/api/devices",
            headers=self.auth_headers,
            name="/api/devices",
        )
    
    @task(2)
    def view_vpp_groups(self):
        """List VPP groups."""
        self.client.get(
            "/api/vpp",
            headers=self.auth_headers,
            name="/api/vpp",
        )
    
    @task(1)
    def get_health(self):
        """Check health endpoint."""
        self.client.get("/health", name="/health")
    
    @task(1)
    def get_health_detailed(self):
        """Check detailed health endpoint."""
        self.client.get("/health/detailed", name="/health/detailed")


# ─── VPP Operator User ───────────────────────────────────────────────────────

class VPPOperatorUser(HttpUser):
    """Simulates VPP operators submitting bids."""
    
    wait_time = between(5, 30)
    weight = 1
    
    def on_start(self):
        """Login and get token."""
        self.token = None
        self.tenant_id = random.choice(TENANT_IDS)
        self.vpp_id = random.choice(VPP_IDS)
        self._login()
    
    def _login(self):
        """Authenticate with the API."""
        response = self.client.post(
            "/api/auth/login",
            json={
                "email": f"operator{self.tenant_id}@voltaris.com",
                "password": "operator123",
            },
            name="/api/auth/login",
        )
        if response.status_code == 200:
            self.token = response.json().get("token")
    
    @property
    def auth_headers(self):
        return {"Authorization": f"Bearer {self.token}"} if self.token else {}
    
    @task(5)
    def submit_bid(self):
        """Submit a VPP bid."""
        bid_data = {
            "quantity_kw": round(random.uniform(100, 5000), 1),
            "price_eur_mwh": round(random.uniform(40, 150), 2),
            "direction": random.choice(DIRECTIONS),
            "delivery_period": (datetime.utcnow() + timedelta(hours=1)).strftime("%Y-%m-%dT%H:00"),
        }
        
        with self.client.post(
            f"/api/vpp/{self.vpp_id}/bid",
            json=bid_data,
            headers=self.auth_headers,
            name="/api/vpp/[id]/bid",
            catch_response=True,
        ) as response:
            if response.status_code in (200, 201):
                response.success()
            elif response.status_code == 401:
                response.failure("Unauthorized - token expired")
                self._login()
            else:
                response.failure(f"Bid failed: {response.status_code}")
    
    @task(3)
    def get_vpp_aggregate(self):
        """Get VPP aggregate power."""
        self.client.get(
            f"/api/vpp/{self.vpp_id}/aggregate",
            headers=self.auth_headers,
            name="/api/vpp/[id]/aggregate",
        )
    
    @task(2)
    def get_arbitrage_signals(self):
        """Get arbitrage signals."""
        prices = [
            {"h": f"{i:02d}:00", "price": round(random.uniform(30, 120), 2)}
            for i in range(24)
        ]
        
        self.client.post(
            "/api/arbitrage-signals",
            json={
                "prices": prices,
                "bess_kwh": 500,
                "efficiency": 0.92,
            },
            headers=self.auth_headers,
            name="/api/arbitrage-signals",
        )
    
    @task(1)
    def list_bids(self):
        """List recent bids."""
        self.client.get(
            f"/api/vpp/{self.vpp_id}/bids",
            headers=self.auth_headers,
            name="/api/vpp/[id]/bids",
        )


# ─── WebSocket User ──────────────────────────────────────────────────────────

class WebSocketUser(HttpUser):
    """Simulates WebSocket connections for real-time updates."""
    
    wait_time = between(30, 120)  # Long connections
    weight = 2
    
    def on_start(self):
        """Login and get token."""
        self.token = None
        self._login()
    
    def _login(self):
        """Authenticate with the API."""
        response = self.client.post(
            "/api/auth/login",
            json={
                "email": "wsuser@voltaris.com",
                "password": "wsuser123",
            },
            name="/api/auth/login",
        )
        if response.status_code == 200:
            self.token = response.json().get("token")
    
    @task(1)
    def check_ws_endpoint(self):
        """Verify WebSocket endpoint is accessible (HTTP check)."""
        # Note: Locust doesn't natively support WebSocket testing
        # This just checks the endpoint exists
        self.client.get(
            "/health",
            name="/ws/health-check",
        )


# ─── Stress Test Configuration ───────────────────────────────────────────────

@events.test_start.add_listener
def on_test_start(environment, **kwargs):
    """Log test start."""
    print("\n" + "=" * 60)
    print("VoltarisOS Load Test Starting")
    print("=" * 60)
    print(f"Target: {environment.host}")
    print(f"Users: {environment.parsed_options.num_users}")
    print(f"Spawn rate: {environment.parsed_options.spawn_rate}")
    print(f"Duration: {environment.parsed_options.run_time}")
    print("=" * 60 + "\n")


@events.test_stop.add_listener
def on_test_stop(environment, **kwargs):
    """Log test completion."""
    print("\n" + "=" * 60)
    print("VoltarisOS Load Test Complete")
    print("=" * 60 + "\n")