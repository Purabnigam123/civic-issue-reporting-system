"""
WebSocket Router: live real-time connection manager for complaint status updates,
escalations, and user notifications.
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Dict, List, Set
import json
import logging

logger = logging.getLogger(__name__)

router = APIRouter(tags=["WebSocket"])


class ConnectionManager:
    def __init__(self):
        # Maps user_id -> set of active WebSockets
        self.active_connections: Dict[str, Set[WebSocket]] = {}
        # Global connections (all listeners)
        self.global_connections: Set[WebSocket] = set()
        # Role-based connections
        self.role_connections: Dict[str, Set[WebSocket]] = {
            "SUPER_ADMIN": set(),
            "ZONAL_ADMIN": set(),
            "WORKER": set(),
            "CITIZEN": set(),
        }

    async def connect(self, websocket: WebSocket, user_id: str = "anonymous", role: str = None):
        await websocket.accept()
        self.global_connections.add(websocket)
        if user_id != "anonymous":
            if user_id not in self.active_connections:
                self.active_connections[user_id] = set()
            self.active_connections[user_id].add(websocket)
        
        if role and role in self.role_connections:
            self.role_connections[role].add(websocket)

    def disconnect(self, websocket: WebSocket, user_id: str = "anonymous", role: str = None):
        self.global_connections.discard(websocket)
        if user_id in self.active_connections:
            self.active_connections[user_id].discard(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
                
        if role and role in self.role_connections:
            self.role_connections[role].discard(websocket)

    async def broadcast(self, message: dict):
        """Broadcast message to all connected clients."""
        payload = json.dumps(message)
        dead = []
        for ws in self.global_connections:
            try:
                await ws.send_text(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.global_connections.discard(ws)

    async def send_personal_message(self, message: dict, user_id: str):
        """Send message only to a specific user's connections."""
        if user_id not in self.active_connections:
            return
        payload = json.dumps(message)
        dead = []
        for ws in self.active_connections[user_id]:
            try:
                await ws.send_text(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.active_connections[user_id].discard(ws)

    async def broadcast_to_role(self, message: dict, role: str):
        """Send message to all users with a specific role."""
        if role not in self.role_connections:
            return
        payload = json.dumps(message)
        dead = []
        for ws in self.role_connections[role]:
            try:
                await ws.send_text(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.role_connections[role].discard(ws)


manager = ConnectionManager()


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str = "anonymous"):
    user_id = "anonymous"
    role = None
    # Basic token extraction if provided
    try:
        if token and token != "anonymous":
            from jose import jwt
            from ..config.env import env
            payload = jwt.decode(token, env.JWT_SECRET, algorithms=[env.JWT_ALGORITHM])
            user_id = payload.get("id") or payload.get("sub") or "anonymous"
            role = payload.get("role")
    except Exception:
        user_id = "anonymous"
        role = None

    await manager.connect(websocket, user_id, role)
    try:
        while True:
            data = await websocket.receive_text()
            # Respond to heartbeat or client events
            try:
                parsed = json.loads(data)
                if parsed.get("type") == "PING":
                    await websocket.send_text(json.dumps({"type": "PONG"}))
            except Exception:
                pass
    except WebSocketDisconnect:
        manager.disconnect(websocket, user_id, role)
