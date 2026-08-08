"""
websocket.py — WebSocket endpoints for real-time dashboard updates.

Provides:
- /ws/dashboard — Real-time VPP metrics (power, SOC, prices)
- /ws/alerts — Live alert notifications
- /ws/optimization — Optimization decision updates

Usage (frontend):
    const ws = new WebSocket("ws://localhost:8000/ws/dashboard?token=<jwt>");
    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        updateDashboard(data);
    };
"""
import asyncio
import json
import logging
from datetime import datetime
from typing import Dict, Set
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, Depends
from sqlalchemy.orm import joinedload
from backend.security import decode_token

logger = logging.getLogger(__name__)

router = APIRouter(tags=["websocket"])


# ─── Connection Manager ──────────────────────────────────────────────────────

class ConnectionManager:
    """Manages WebSocket connections for real-time updates."""
    
    def __init__(self):
        # Active connections: {channel: {connection_id: websocket}}
        self._connections: Dict[str, Dict[int, WebSocket]] = {}
        self._next_id = 0
    
    async def connect(self, channel: str, websocket: WebSocket) -> int:
        """Accept a new WebSocket connection."""
        await websocket.accept()
        conn_id = self._next_id
        self._next_id += 1
        
        if channel not in self._connections:
            self._connections[channel] = {}
        
        self._connections[channel][conn_id] = websocket
        logger.info(f"WebSocket connected: channel={channel}, id={conn_id}")
        return conn_id
    
    def disconnect(self, channel: str, conn_id: int):
        """Remove a WebSocket connection."""
        if channel in self._connections and conn_id in self._connections[channel]:
            del self._connections[channel][conn_id]
            logger.info(f"WebSocket disconnected: channel={channel}, id={conn_id}")
    
    async def broadcast(self, channel: str, message: dict):
        """Broadcast a message to all connections in a channel."""
        if channel not in self._connections:
            return
        
        dead_connections = []
        for conn_id, ws in self._connections[channel].items():
            try:
                await ws.send_json(message)
            except Exception:
                dead_connections.append(conn_id)
        
        # Clean up dead connections
        for conn_id in dead_connections:
            self.disconnect(channel, conn_id)
    
    def get_connection_count(self, channel: str) -> int:
        """Get number of active connections in a channel."""
        return len(self._connections.get(channel, {}))


# Global connection manager
manager = ConnectionManager()


# ─── WebSocket Endpoints ─────────────────────────────────────────────────────

@router.websocket("/ws/dashboard")
async def websocket_dashboard(
    websocket: WebSocket,
    token: str = Query(default=""),
):
    """
    Real-time dashboard WebSocket.
    
    Sends updates every 5 seconds:
    - Total VPP power
    - Battery SOC
    - Current spot price
    - Optimization status
    
    Requires valid JWT token.
    """
    # Validate token
    try:
        user_data = decode_token(token)
        tenant_id = user_data.get("tenant_id")
    except Exception:
        await websocket.close(code=4001, reason="Invalid token")
        return
    
    conn_id = await manager.connect("dashboard", websocket)
    
    try:
        while True:
            # Send dashboard update
            from backend.database import SessionLocal
            from backend import models
            
            db = SessionLocal()
            try:
                # Get latest metrics
                total_power = 0.0
                avg_soc = 0.5
                device_count = 0
                
                # Get devices with latest readings in one optimized query
                from sqlalchemy import and_, desc
                
                # Get all device IDs for this tenant first
                device_ids = [d.id for d in db.query(models.Device.id).filter(
                    models.Device.tenant_id == tenant_id,
                    models.Device.enabled == True,
                ).all()]
                
                if device_ids:
                    # Get latest reading for each device using a correlated subquery
                    from sqlalchemy import select, func
                    subq = (
                        select(
                            models.DeviceReading.device_id,
                            func.max(models.DeviceReading.timestamp).label('max_ts')
                        )
                        .where(models.DeviceReading.device_id.in_(device_ids))
                        .group_by(models.DeviceReading.device_id)
                        .subquery()
                    )
                    
                    latest_readings = db.query(models.DeviceReading).join(
                        subq,
                        and_(
                            models.DeviceReading.device_id == subq.c.device_id,
                            models.DeviceReading.timestamp == subq.c.max_ts
                        )
                    ).all()
                    
                    for reading in latest_readings:
                        if reading.power_kw:
                            total_power += reading.power_kw
                            device_count += 1
                        if reading.soc_pct:
                            avg_soc += reading.soc_pct
                
                if device_count > 0:
                    avg_soc = avg_soc / device_count / 100  # Convert to 0-1
                
                # Get latest VPP bid status
                latest_bid = db.query(models.VPPBid).filter(
                    models.VPPBid.tenant_id == tenant_id
                ).order_by(models.VPPBid.submitted_at.desc()).first()
                
                # Build update message
                update = {
                    "type": "dashboard_update",
                    "timestamp": datetime.utcnow().isoformat(),
                    "data": {
                        "total_power_kw": round(total_power, 2),
                        "avg_soc_pct": round(avg_soc * 100, 1),
                        "device_count": device_count,
                        "active_bids": 1 if latest_bid and latest_bid.status == "pending" else 0,
                        "last_bid_status": latest_bid.status if latest_bid else None,
                    }
                }
                
                await websocket.send_json(update)
            
            finally:
                db.close()
            
            # Wait before next update
            await asyncio.sleep(5)
    
    except WebSocketDisconnect:
        manager.disconnect("dashboard", conn_id)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect("dashboard", conn_id)


@router.websocket("/ws/alerts")
async def websocket_alerts(
    websocket: WebSocket,
    token: str = Query(default=""),
):
    """
    Real-time alerts WebSocket.
    
    Pushes new alerts immediately when fired.
    Requires valid JWT token.
    """
    # Validate token
    try:
        user_data = decode_token(token)
        tenant_id = user_data.get("tenant_id")
    except Exception:
        await websocket.close(code=4001, reason="Invalid token")
        return
    
    conn_id = await manager.connect("alerts", websocket)
    
    try:
        last_alert_id = 0
        
        while True:
            # Check for new alerts
            from backend.database import SessionLocal
            from backend import models
            
            db = SessionLocal()
            try:
                new_alerts = db.query(models.Alert).filter(
                    models.Alert.tenant_id == tenant_id,
                    models.Alert.id > last_alert_id,
                ).order_by(models.Alert.fired_at.asc()).all()
                
                for alert in new_alerts:
                    message = {
                        "type": "new_alert",
                        "timestamp": alert.fired_at.isoformat() if alert.fired_at else datetime.utcnow().isoformat(),
                        "data": {
                            "id": alert.id,
                            "severity": alert.severity,
                            "title": alert.title,
                            "message": alert.message,
                            "device_name": alert.device_name,
                        }
                    }
                    await websocket.send_json(message)
                    last_alert_id = alert.id
            
            finally:
                db.close()
            
            # Check every 2 seconds
            await asyncio.sleep(2)
    
    except WebSocketDisconnect:
        manager.disconnect("alerts", conn_id)
    except Exception as e:
        logger.error(f"Alerts WebSocket error: {e}")
        manager.disconnect("alerts", conn_id)


@router.websocket("/ws/optimization")
async def websocket_optimization(
    websocket: WebSocket,
    token: str = Query(default=""),
):
    """
    Real-time optimization updates WebSocket.
    
    Pushes optimization decisions when they change.
    Requires valid JWT token.
    """
    # Validate token
    try:
        user_data = decode_token(token)
        tenant_id = user_data.get("tenant_id")
    except Exception:
        await websocket.close(code=4001, reason="Invalid token")
        return
    
    conn_id = await manager.connect("optimization", websocket)
    
    try:
        last_decision = None
        
        while True:
            # Check for optimization updates (from cache or DB)
            from backend.cache import cache
            
            # Check if there's a new optimization result
            opt_key = f"optimization_result:{tenant_id}"
            result = cache.get(opt_key)
            
            if result and result != last_decision:
                message = {
                    "type": "optimization_update",
                    "timestamp": datetime.utcnow().isoformat(),
                    "data": result
                }
                await websocket.send_json(message)
                last_decision = result
            
            # Check every 10 seconds
            await asyncio.sleep(10)
    
    except WebSocketDisconnect:
        manager.disconnect("optimization", conn_id)
    except Exception as e:
        logger.error(f"Optimization WebSocket error: {e}")
        manager.disconnect("optimization", conn_id)


# ─── Helper Functions ────────────────────────────────────────────────────────

async def broadcast_alert(tenant_id: int, alert_data: dict):
    """Broadcast a new alert to all connected dashboard clients."""
    message = {
        "type": "new_alert",
        "timestamp": datetime.utcnow().isoformat(),
        "data": alert_data,
    }
    await manager.broadcast("alerts", message)


async def broadcast_optimization(tenant_id: int, optimization_data: dict):
    """Broadcast optimization update to connected clients."""
    message = {
        "type": "optimization_update",
        "timestamp": datetime.utcnow().isoformat(),
        "data": optimization_data,
    }
    await manager.broadcast("optimization", message)


def get_active_connections() -> dict:
    """Get count of active WebSocket connections per channel."""
    return {
        "dashboard": manager.get_connection_count("dashboard"),
        "alerts": manager.get_connection_count("alerts"),
        "optimization": manager.get_connection_count("optimization"),
    }