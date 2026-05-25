#!/usr/bin/env python3
"""
Mobile Push Notifications Service
Handles push notifications for mobile companion apps
"""

import os
import json
import asyncio
import logging
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict
from enum import Enum
import aiohttp
import asyncio
from concurrent.futures import ThreadPoolExecutor

logger = logging.getLogger(__name__)

class NotificationType(Enum):
    """Types of push notifications"""
    CONNECTION_LOST = "connection_lost"
    CONNECTION_RESTORED = "connection_restored"
    HIGH_CPU_USAGE = "high_cpu_usage"
    HIGH_MEMORY_USAGE = "high_memory_usage"
    SLOW_QUERY_DETECTED = "slow_query_detected"
    CONTAINER_STOPPED = "container_stopped"
    CONTAINER_STARTED = "container_started"
    SYSTEM_ERROR = "system_error"
    BACKUP_COMPLETED = "backup_completed"
    BACKUP_FAILED = "backup_failed"

class NotificationPriority(Enum):
    """Priority levels for notifications"""
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    CRITICAL = "critical"

@dataclass
class PushNotification:
    """Push notification data structure"""
    id: str
    type: NotificationType
    priority: NotificationPriority
    title: str
    body: str
    data: Dict[str, Any]
    timestamp: datetime
    connection_id: Optional[str] = None
    container_id: Optional[str] = None
    expires_at: Optional[datetime] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        result = asdict(self)
        result['type'] = self.type.value
        result['priority'] = self.priority.value
        result['timestamp'] = self.timestamp.isoformat()
        if self.expires_at:
            result['expires_at'] = self.expires_at.isoformat()
        return result

@dataclass
class DeviceToken:
    """Mobile device token for push notifications"""
    token: str
    platform: str  # 'ios' or 'android'
    user_id: str
    registered_at: datetime
    last_used: Optional[datetime] = None
    active: bool = True

class PushNotificationService:
    """Service for managing push notifications to mobile devices"""
    
    def __init__(self):
        self.device_tokens: Dict[str, DeviceToken] = {}
        self.notification_queue: List[PushNotification] = []
        self.notification_history: List[PushNotification] = []
        self.max_history_size = 1000
        self.executor = ThreadPoolExecutor(max_workers=4)
        
        # Configuration
        self.fcm_server_key = os.environ.get("FCM_SERVER_KEY")
        self.apns_key_id = os.environ.get("APNS_KEY_ID")
        self.apns_team_id = os.environ.get("APNS_TEAM_ID")
        self.apns_bundle_id = os.environ.get("APNS_BUNDLE_ID", "com.ultimatedbmanager.mobile")
        
        # Rate limiting
        self.rate_limit_window = timedelta(minutes=5)
        self.max_notifications_per_window = 10
        self.notification_timestamps: Dict[str, List[datetime]] = {}
    
    def register_device(self, token: str, platform: str, user_id: str) -> bool:
        """Register a mobile device for push notifications"""
        try:
            device_token = DeviceToken(
                token=token,
                platform=platform.lower(),
                user_id=user_id,
                registered_at=datetime.utcnow()
            )
            
            self.device_tokens[token] = device_token
            logger.info(f"Registered {platform} device for user {user_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to register device: {e}")
            return False
    
    def unregister_device(self, token: str) -> bool:
        """Unregister a mobile device"""
        try:
            if token in self.device_tokens:
                device = self.device_tokens[token]
                device.active = False
                logger.info(f"Unregistered device for user {device.user_id}")
                return True
            return False
            
        except Exception as e:
            logger.error(f"Failed to unregister device: {e}")
            return False
    
    def create_notification(
        self,
        notification_type: NotificationType,
        title: str,
        body: str,
        priority: NotificationPriority = NotificationPriority.NORMAL,
        connection_id: Optional[str] = None,
        container_id: Optional[str] = None,
        data: Optional[Dict[str, Any]] = None,
        expires_in_hours: int = 24
    ) -> PushNotification:
        """Create a new push notification"""
        notification_id = f"{notification_type.value}_{int(datetime.utcnow().timestamp())}"
        
        notification = PushNotification(
            id=notification_id,
            type=notification_type,
            priority=priority,
            title=title,
            body=body,
            data=data or {},
            timestamp=datetime.utcnow(),
            connection_id=connection_id,
            container_id=container_id,
            expires_at=datetime.utcnow() + timedelta(hours=expires_in_hours)
        )
        
        return notification
    
    def should_send_notification(self, user_id: str, notification: PushNotification) -> bool:
        """Check if notification should be sent based on rate limiting"""
        now = datetime.utcnow()
        
        # Initialize user's notification history if not exists
        if user_id not in self.notification_timestamps:
            self.notification_timestamps[user_id] = []
        
        # Clean old timestamps outside the rate limit window
        cutoff_time = now - self.rate_limit_window
        self.notification_timestamps[user_id] = [
            ts for ts in self.notification_timestamps[user_id] 
            if ts > cutoff_time
        ]
        
        # Check rate limit
        if len(self.notification_timestamps[user_id]) >= self.max_notifications_per_window:
            # Allow critical notifications to bypass rate limit
            if notification.priority != NotificationPriority.CRITICAL:
                logger.warning(f"Rate limit exceeded for user {user_id}")
                return False
        
        # Add current timestamp
        self.notification_timestamps[user_id].append(now)
        return True
    
    async def send_notification(self, notification: PushNotification) -> Dict[str, Any]:
        """Send push notification to all registered devices"""
        results = {
            "notification_id": notification.id,
            "sent_count": 0,
            "failed_count": 0,
            "errors": []
        }
        
        # Add to queue and history
        self.notification_queue.append(notification)
        self.notification_history.append(notification)
        
        # Maintain history size limit
        if len(self.notification_history) > self.max_history_size:
            self.notification_history = self.notification_history[-self.max_history_size:]
        
        # Send to all active devices
        for token, device in self.device_tokens.items():
            if not device.active:
                continue
            
            # Check rate limiting
            if not self.should_send_notification(device.user_id, notification):
                continue
            
            try:
                if device.platform == "android":
                    success = await self._send_fcm_notification(device, notification)
                elif device.platform == "ios":
                    success = await self._send_apns_notification(device, notification)
                else:
                    logger.warning(f"Unknown platform: {device.platform}")
                    continue
                
                if success:
                    results["sent_count"] += 1
                    device.last_used = datetime.utcnow()
                else:
                    results["failed_count"] += 1
                    
            except Exception as e:
                logger.error(f"Failed to send notification to {token}: {e}")
                results["failed_count"] += 1
                results["errors"].append(str(e))
        
        logger.info(f"Sent notification {notification.id}: {results['sent_count']} sent, {results['failed_count']} failed")
        return results
    
    async def _send_fcm_notification(self, device: DeviceToken, notification: PushNotification) -> bool:
        """Send notification via Firebase Cloud Messaging (Android)"""
        if not self.fcm_server_key:
            logger.warning("FCM server key not configured")
            return False
        
        try:
            url = "https://fcm.googleapis.com/fcm/send"
            headers = {
                "Authorization": f"key={self.fcm_server_key}",
                "Content-Type": "application/json"
            }
            
            payload = {
                "to": device.token,
                "notification": {
                    "title": notification.title,
                    "body": notification.body,
                    "icon": "ic_notification",
                    "sound": "default"
                },
                "data": {
                    **notification.data,
                    "notification_id": notification.id,
                    "type": notification.type.value,
                    "priority": notification.priority.value,
                    "timestamp": notification.timestamp.isoformat()
                },
                "priority": "high" if notification.priority in [NotificationPriority.HIGH, NotificationPriority.CRITICAL] else "normal"
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.post(url, headers=headers, json=payload) as response:
                    if response.status == 200:
                        result = await response.json()
                        if result.get("success", 0) > 0:
                            return True
                        else:
                            logger.error(f"FCM error: {result}")
                            return False
                    else:
                        logger.error(f"FCM HTTP error: {response.status}")
                        return False
                        
        except Exception as e:
            logger.error(f"FCM send error: {e}")
            return False
    
    async def _send_apns_notification(self, device: DeviceToken, notification: PushNotification) -> bool:
        """Send notification via Apple Push Notification Service (iOS)"""
        # For now, return True as a placeholder
        # In production, implement proper APNS integration
        logger.info(f"APNS notification would be sent to {device.token}")
        return True
    
    def get_notification_history(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Get recent notification history"""
        recent_notifications = sorted(
            self.notification_history, 
            key=lambda x: x.timestamp, 
            reverse=True
        )[:limit]
        
        return [notification.to_dict() for notification in recent_notifications]
    
    def get_pending_notifications(self) -> List[Dict[str, Any]]:
        """Get notifications that haven't expired"""
        now = datetime.utcnow()
        pending = [
            notification for notification in self.notification_queue
            if not notification.expires_at or notification.expires_at > now
        ]
        
        return [notification.to_dict() for notification in pending]
    
    def clear_expired_notifications(self):
        """Remove expired notifications from queue"""
        now = datetime.utcnow()
        self.notification_queue = [
            notification for notification in self.notification_queue
            if not notification.expires_at or notification.expires_at > now
        ]
    
    def get_device_count(self) -> Dict[str, int]:
        """Get count of registered devices by platform"""
        active_devices = [device for device in self.device_tokens.values() if device.active]
        
        return {
            "total": len(active_devices),
            "android": len([d for d in active_devices if d.platform == "android"]),
            "ios": len([d for d in active_devices if d.platform == "ios"])
        }

# Global push notification service instance
push_service = PushNotificationService()

# Convenience functions for creating common notifications
async def notify_connection_lost(connection_id: str, connection_name: str, error_message: str):
    """Send notification for lost database connection"""
    notification = push_service.create_notification(
        NotificationType.CONNECTION_LOST,
        "Database Connection Lost",
        f"Connection to {connection_name} has been lost: {error_message}",
        NotificationPriority.HIGH,
        connection_id=connection_id,
        data={"error_message": error_message}
    )
    return await push_service.send_notification(notification)

async def notify_connection_restored(connection_id: str, connection_name: str):
    """Send notification for restored database connection"""
    notification = push_service.create_notification(
        NotificationType.CONNECTION_RESTORED,
        "Database Connection Restored",
        f"Connection to {connection_name} has been restored",
        NotificationPriority.NORMAL,
        connection_id=connection_id
    )
    return await push_service.send_notification(notification)

async def notify_high_cpu_usage(connection_id: str, connection_name: str, cpu_usage: float):
    """Send notification for high CPU usage"""
    notification = push_service.create_notification(
        NotificationType.HIGH_CPU_USAGE,
        "High CPU Usage Alert",
        f"{connection_name} CPU usage is {cpu_usage:.1f}%",
        NotificationPriority.HIGH,
        connection_id=connection_id,
        data={"cpu_usage": cpu_usage}
    )
    return await push_service.send_notification(notification)

async def notify_container_stopped(container_id: str, container_name: str):
    """Send notification for stopped container"""
    notification = push_service.create_notification(
        NotificationType.CONTAINER_STOPPED,
        "Container Stopped",
        f"Database container {container_name} has stopped",
        NotificationPriority.HIGH,
        container_id=container_id
    )
    return await push_service.send_notification(notification)

async def notify_slow_query(connection_id: str, connection_name: str, query_time: float):
    """Send notification for slow query"""
    notification = push_service.create_notification(
        NotificationType.SLOW_QUERY_DETECTED,
        "Slow Query Detected",
        f"Query on {connection_name} took {query_time:.2f}s to execute",
        NotificationPriority.NORMAL,
        connection_id=connection_id,
        data={"query_time": query_time}
    )
    return await push_service.send_notification(notification)