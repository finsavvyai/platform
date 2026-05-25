"""
WebSocket Connection Manager for Real-Time Collaboration

Manages WebSocket connections for:
- Real-time workflow collaboration
- Live execution monitoring
- Multi-user presence
- Event broadcasting
"""

import json
import logging
from typing import Dict, List, Set
from fastapi import WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)

class ConnectionManager:
    """Manages WebSocket connections for real-time features"""

    def __init__(self):
        # Active connections by room (workflow_id)
        self.active_connections: Dict[str, Dict[str, WebSocket]] = {}
        # User metadata by room
        self.user_metadata: Dict[str, Dict[str, Dict[str, any]]] = {}
        # Connection metadata
        self.connection_metadata: Dict[str, Dict[str, any]] = {}

    async def connect(self, websocket: WebSocket, room_id: str, user_id: str, metadata: Dict[str, any] = None):
        """Connect a user to a room"""
        try:
            await websocket.accept()

            if room_id not in self.active_connections:
                self.active_connections[room_id] = {}
                self.user_metadata[room_id] = {}

            self.active_connections[room_id][user_id] = websocket
            self.user_metadata[room_id][user_id] = metadata or {}

            # Store connection metadata
            connection_key = f"{room_id}:{user_id}"
            self.connection_metadata[connection_key] = {
                "connected_at": datetime.utcnow().isoformat(),
                "last_activity": datetime.utcnow().isoformat(),
                "metadata": metadata or {},
            }

            logger.info(f"User {user_id} connected to room {room_id}")
            return True

        except Exception as e:
            logger.error(f"Error connecting user {user_id} to room {room_id}: {e}")
            return False

    def disconnect(self, room_id: str, user_id: str):
        """Disconnect a user from a room"""
        try:
            if room_id in self.active_connections:
                self.active_connections[room_id].pop(user_id, None)

                # Clean up empty rooms
                if not self.active_connections[room_id]:
                    del self.active_connections[room_id]

            if room_id in self.user_metadata:
                self.user_metadata[room_id].pop(user_id, None)

                # Clean up empty rooms
                if not self.user_metadata[room_id]:
                    del self.user_metadata[room_id]

            # Clean up connection metadata
            connection_key = f"{room_id}:{user_id}"
            self.connection_metadata.pop(connection_key, None)

            logger.info(f"User {user_id} disconnected from room {room_id}")

        except Exception as e:
            logger.error(f"Error disconnecting user {user_id} from room {room_id}: {e}")

    async def send_personal_message(self, message: Dict[str, any], websocket: WebSocket):
        """Send message to a specific WebSocket connection"""
        try:
            await websocket.send_text(json.dumps(message))
        except Exception as e:
            logger.error(f"Error sending personal message: {e}")

    async def send_to_user(self, room_id: str, user_id: str, message: Dict[str, any]):
        """Send message to a specific user in a room"""
        try:
            if (room_id in self.active_connections and
                user_id in self.active_connections[room_id]):

                websocket = self.active_connections[room_id][user_id]
                await self.send_personal_message(message, websocket)

                # Update last activity
                connection_key = f"{room_id}:{user_id}"
                if connection_key in self.connection_metadata:
                    self.connection_metadata[connection_key]["last_activity"] = datetime.utcnow().isoformat()

        except Exception as e:
            logger.error(f"Error sending message to user {user_id} in room {room_id}: {e}")

    async def broadcast_to_room(self, room_id: str, message: Dict[str, any], exclude_user_id: str = None):
        """Broadcast message to all users in a room"""
        try:
            if room_id not in self.active_connections:
                return

            disconnected_users = []

            for user_id, websocket in self.active_connections[room_id].items():
                if user_id == exclude_user_id:
                    continue

                try:
                    await websocket.send_text(json.dumps(message))

                    # Update last activity
                    connection_key = f"{room_id}:{user_id}"
                    if connection_key in self.connection_metadata:
                        self.connection_metadata[connection_key]["last_activity"] = datetime.utcnow().isoformat()

                except Exception as e:
                    logger.warning(f"Failed to send message to user {user_id} in room {room_id}: {e}")
                    disconnected_users.append(user_id)

            # Clean up disconnected users
            for user_id in disconnected_users:
                self.disconnect(room_id, user_id)

        except Exception as e:
            logger.error(f"Error broadcasting to room {room_id}: {e}")

    async def broadcast_to_all_rooms(self, message: Dict[str, any]):
        """Broadcast message to all active connections"""
        try:
            disconnected_rooms = []

            for room_id in list(self.active_connections.keys()):
                try:
                    await self.broadcast_to_room(room_id, message)
                except Exception as e:
                    logger.warning(f"Failed to broadcast to room {room_id}: {e}")
                    disconnected_rooms.append(room_id)

            # Clean up disconnected rooms
            for room_id in disconnected_rooms:
                if room_id in self.active_connections:
                    del self.active_connections[room_id]

        except Exception as e:
            logger.error(f"Error broadcasting to all rooms: {e}")

    def get_room_users(self, room_id: str) -> List[Dict[str, any]]:
        """Get list of users in a room with their metadata"""
        try:
            users = []
            if room_id in self.user_metadata:
                for user_id, metadata in self.user_metadata[room_id].items():
                    users.append({
                        "id": user_id,
                        **metadata
                    })
            return users

        except Exception as e:
            logger.error(f"Error getting users for room {room_id}: {e}")
            return []

    def get_user_rooms(self, user_id: str) -> List[str]:
        """Get list of rooms a user is connected to"""
        try:
            rooms = []
            for room_id, connections in self.active_connections.items():
                if user_id in connections:
                    rooms.append(room_id)
            return rooms

        except Exception as e:
            logger.error(f"Error getting rooms for user {user_id}: {e}")
            return []

    def get_room_count(self, room_id: str) -> int:
        """Get number of connected users in a room"""
        try:
            return len(self.active_connections.get(room_id, {}))

        except Exception as e:
            logger.error(f"Error getting room count for {room_id}: {e}")
            return 0

    def get_total_connections(self) -> int:
        """Get total number of active connections"""
        try:
            total = 0
            for connections in self.active_connections.values():
                total += len(connections)
            return total

        except Exception as e:
            logger.error(f"Error getting total connections: {e}")
            return 0

    async def ping_room(self, room_id: str):
        """Send ping to all users in a room to check connection health"""
        try:
            if room_id not in self.active_connections:
                return False

            ping_message = {
                "type": "ping",
                "timestamp": datetime.utcnow().isoformat()
            }

            await self.broadcast_to_room(room_id, ping_message)
            return True

        except Exception as e:
            logger.error(f"Error pinging room {room_id}: {e}")
            return False

    async def cleanup_inactive_connections(self, max_inactive_minutes: int = 30):
        """Clean up inactive connections"""
        try:
            from datetime import datetime, timedelta

            cutoff_time = datetime.utcnow() - timedelta(minutes=max_inactive_minutes)
            disconnected_rooms = []
            disconnected_users = []

            for room_id, connections in self.active_connections.items():
                room_disconnected_users = []

                for user_id in list(connections.keys()):
                    connection_key = f"{room_id}:{user_id}"

                    if connection_key in self.connection_metadata:
                        last_activity_str = self.connection_metadata[connection_key]["last_activity"]
                        try:
                            last_activity = datetime.fromisoformat(last_activity_str.replace('Z', '+00:00'))

                            if last_activity < cutoff_time:
                                # Connection is inactive
                                room_disconnected_users.append(user_id)

                                # Try to send disconnect message
                                try:
                                    websocket = connections[user_id]
                                    await websocket.close(code=1000, reason="Connection timeout")
                                except:
                                    pass

                        except ValueError:
                            # Invalid date format, consider as inactive
                            room_disconnected_users.append(user_id)
                    else:
                        # No metadata, consider as inactive
                        room_disconnected_users.append(user_id)

                # Remove inactive users from room
                for user_id in room_disconnected_users:
                    self.disconnect(room_id, user_id)
                    disconnected_users.append((room_id, user_id))

                if not connections:  # Room is now empty
                    disconnected_rooms.append(room_id)

            # Clean up empty rooms
            for room_id in disconnected_rooms:
                if room_id in self.active_connections:
                    del self.active_connections[room_id]
                if room_id in self.user_metadata:
                    del self.user_metadata[room_id]

            logger.info(f"Cleaned up {len(disconnected_users)} inactive connections")

        except Exception as e:
            logger.error(f"Error during cleanup: {e}")

    def get_connection_stats(self) -> Dict[str, any]:
        """Get connection statistics"""
        try:
            stats = {
                "total_connections": 0,
                "total_rooms": len(self.active_connections),
                "rooms": {},
                "active_in_last_hour": 0,
            }

            from datetime import datetime, timedelta
            one_hour_ago = datetime.utcnow() - timedelta(hours=1)

            for room_id, connections in self.active_connections.items():
                room_stats = {
                    "user_count": len(connections),
                    "active_users": [],
                }

                for user_id in connections:
                    connection_key = f"{room_id}:{user_id}"

                    if connection_key in self.connection_metadata:
                        last_activity_str = self.connection_metadata[connection_key]["last_activity"]
                        try:
                            last_activity = datetime.fromisoformat(last_activity_str.replace('Z', '+00:00'))

                            if last_activity > one_hour_ago:
                                stats["active_in_last_hour"] += 1
                                room_stats["active_users"].append(user_id)

                        except ValueError:
                            pass

                stats["rooms"][room_id] = room_stats
                stats["total_connections"] += len(connections)

            return stats

        except Exception as e:
            logger.error(f"Error getting connection stats: {e}")
            return {
                "total_connections": 0,
                "total_rooms": 0,
                "rooms": {},
                "active_in_last_hour": 0,
            }

# Global connection manager instance
connection_manager = ConnectionManager()

# Import for datetime
from datetime import datetime