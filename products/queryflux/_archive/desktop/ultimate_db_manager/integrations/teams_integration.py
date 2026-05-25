"""
Microsoft Teams Integration for PostgreSQL Database Management
Revolutionary enterprise integration for database operations in Teams
"""

import asyncio
import json
import base64
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, asdict
import requests
import aiohttp
from urllib.parse import urlencode, parse_qs

from .base import BaseIntegration, IntegrationType, EventType, IntegrationEvent, rate_limit, retry
from ..health_monitor import HealthReport, HealthAlert


@dataclass
class TeamsChannel:
    """Teams channel configuration"""
    team_id: str
    channel_id: str
    name: str
    webhook_url: Optional[str] = None
    alert_types: List[str] = None


@dataclass
class TeamsMessage:
    """Teams message structure"""
    title: str
    text: str
    summary: str = ""
    theme_color: str = "0078D4"
    sections: List[Dict] = None
    potential_actions: List[Dict] = None


@dataclass
class AdaptiveCard:
    """Teams Adaptive Card structure"""
    type: str = "AdaptiveCard"
    version: str = "1.4"
    body: List[Dict] = None
    actions: List[Dict] = None


class TeamsIntegration(BaseIntegration):
    """Revolutionary Microsoft Teams integration for database management"""

    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)

        # Teams configuration
        self.tenant_id = config.get('tenant_id')
        self.client_id = config.get('client_id')
        self.client_secret = config.get('client_secret')
        self.scope = config.get('scope', 'https://graph.microsoft.com/.default')

        # Channels configuration
        self.channels = {}
        for channel_config in config.get('channels', []):
            channel = TeamsChannel(**channel_config)
            self.channels[channel.name] = channel

        # Bot configuration
        self.bot_name = config.get('bot_name', 'PostgreSQL Database Assistant')
        self.bot_app_id = config.get('bot_app_id')
        self.bot_app_password = config.get('bot_app_password')

        # Authentication
        self.access_token = None
        self.token_expires_at = None

        # Dashboard configuration
        self.dashboard_config = config.get('dashboard', {})

        # Meeting integration
        self.meeting_config = config.get('meeting_integration', {})

        # Command handlers
        self._setup_command_handlers()

    def get_integration_type(self) -> IntegrationType:
        return IntegrationType.COMMUNICATION

    async def connect(self) -> bool:
        """Connect to Microsoft Teams via Graph API"""
        try:
            # Get OAuth token
            success = await self._authenticate()
            if not success:
                return False

            # Test connection
            health = await self.health_check()
            self.is_connected = health.get('healthy', False)

            # Set up event handlers
            self._register_event_handlers()

            # Initialize webhooks for bot commands
            await self._setup_bot_webhooks()

            # Send welcome message
            await self._send_welcome_message()

            return self.is_connected

        except Exception as e:
            self.logger.error(f"Failed to connect to Teams: {e}")
            return False

    async def disconnect(self):
        """Disconnect from Teams"""
        try:
            # Send disconnect message
            await self._send_disconnect_message()

            # Clean up webhooks
            await self._cleanup_webhooks()

            self.is_connected = False

        except Exception as e:
            self.logger.error(f"Error disconnecting from Teams: {e}")

    @retry(max_attempts=3, delay=1.0)
    async def _authenticate(self) -> bool:
        """Authenticate with Microsoft Graph API"""
        try:
            auth_url = f"https://login.microsoftonline.com/{self.tenant_id}/oauth2/v2.0/token"

            data = {
                'grant_type': 'client_credentials',
                'client_id': self.client_id,
                'client_secret': self.client_secret,
                'scope': self.scope
            }

            async with aiohttp.ClientSession() as session:
                async with session.post(auth_url, data=data) as response:
                    if response.status == 200:
                        token_data = await response.json()
                        self.access_token = token_data['access_token']
                        expires_in = token_data.get('expires_in', 3600)
                        self.token_expires_at = datetime.utcnow() + timedelta(seconds=expires_in)
                        return True
                    else:
                        error_data = await response.text()
                        self.logger.error(f"Authentication failed: {error_data}")
                        return False

        except Exception as e:
            self.logger.error(f"Authentication error: {e}")
            return False

    async def _ensure_token_valid(self):
        """Ensure access token is valid"""
        if not self.access_token or (self.token_expires_at and datetime.utcnow() >= self.token_expires_at):
            await self._authenticate()

    @rate_limit(calls_per_minute=60)
    async def _make_graph_request(self, method: str, endpoint: str, data: Dict = None) -> Optional[Dict]:
        """Make request to Microsoft Graph API"""
        await self._ensure_token_valid()

        url = f"https://graph.microsoft.com/v1.0{endpoint}"
        headers = {
            'Authorization': f'Bearer {self.access_token}',
            'Content-Type': 'application/json'
        }

        try:
            async with aiohttp.ClientSession() as session:
                async with session.request(method, url, headers=headers, json=data) as response:
                    if response.status in [200, 201, 202]:
                        return await response.json()
                    else:
                        error_text = await response.text()
                        self.logger.error(f"Graph API error ({response.status}): {error_text}")
                        return None

        except Exception as e:
            self.logger.error(f"Graph API request error: {e}")
            return None

    async def health_check(self) -> Dict[str, Any]:
        """Check Teams integration health"""
        try:
            # Test Graph API access
            result = await self._make_graph_request('GET', '/me')

            healthy = result is not None

            return {
                'healthy': healthy,
                'last_check': datetime.utcnow().isoformat(),
                'channels_configured': len(self.channels),
                'token_valid': bool(self.access_token and self.token_expires_at and datetime.utcnow() < self.token_expires_at)
            }

        except Exception as e:
            return {
                'healthy': False,
                'error': str(e),
                'last_check': datetime.utcnow().isoformat()
            }

    def _register_event_handlers(self):
        """Register event handlers for database events"""

        @self.on_event(EventType.PERFORMANCE_ALERT)
        async def handle_performance_alert(event: IntegrationEvent):
            await self._send_performance_alert(event)

        @self.on_event(EventType.CONNECTION_FAILED)
        async def handle_connection_failed(event: IntegrationEvent):
            await self._send_connection_alert(event)

        @self.on_event(EventType.QUERY_FAILED)
        async def handle_query_failed(event: IntegrationEvent):
            await self._send_query_alert(event)

        @self.on_event(EventType.SECURITY_INCIDENT)
        async def handle_security_incident(event: IntegrationEvent):
            await self._send_security_alert(event)

        @self.on_event(EventType.BACKUP_COMPLETED)
        async def handle_backup_completed(event: IntegrationEvent):
            await self._send_backup_notification(event)

        @self.on_event(EventType.BACKUP_FAILED)
        async def handle_backup_failed(event: IntegrationEvent):
            await self._send_backup_alert(event)

        @self.on_event(EventType.SCHEMA_CHANGED)
        async def handle_schema_changed(event: IntegrationEvent):
            await self._send_schema_change_notification(event)

    async def _send_performance_alert(self, event: IntegrationEvent):
        """Send performance alert to Teams"""
        alert_data = event.data
        severity = event.severity

        # Create adaptive card for performance alert
        card = self._create_performance_alert_card(alert_data, severity)

        # Determine appropriate channels
        channels = self._get_channels_for_event('performance_alert')

        # Send to channels
        for channel in channels:
            await self._send_adaptive_card_to_channel(channel, card)

    async def _send_connection_alert(self, event: IntegrationEvent):
        """Send connection failure alert"""
        connection_data = event.data

        card = self._create_connection_alert_card(connection_data)
        channels = self._get_channels_for_event('connection_alert')

        for channel in channels:
            await self._send_adaptive_card_to_channel(channel, card)

    async def _send_query_alert(self, event: IntegrationEvent):
        """Send query failure alert"""
        query_data = event.data

        card = self._create_query_alert_card(query_data)
        channels = self._get_channels_for_event('query_alert')

        for channel in channels:
            await self._send_adaptive_card_to_channel(channel, card)

    async def _send_security_alert(self, event: IntegrationEvent):
        """Send security incident alert"""
        security_data = event.data

        card = self._create_security_alert_card(security_data)
        channels = self._get_channels_for_event('security_alert')

        for channel in channels:
            await self._send_adaptive_card_to_channel(channel, card)

    async def _send_backup_notification(self, event: IntegrationEvent):
        """Send backup completion notification"""
        backup_data = event.data

        card = self._create_backup_notification_card(backup_data, success=True)
        channels = self._get_channels_for_event('backup_notification')

        for channel in channels:
            await self._send_adaptive_card_to_channel(channel, card)

    async def _send_backup_alert(self, event: IntegrationEvent):
        """Send backup failure alert"""
        backup_data = event.data

        card = self._create_backup_notification_card(backup_data, success=False)
        channels = self._get_channels_for_event('backup_alert')

        for channel in channels:
            await self._send_adaptive_card_to_channel(channel, card)

    async def _send_schema_change_notification(self, event: IntegrationEvent):
        """Send schema change notification"""
        schema_data = event.data

        card = self._create_schema_change_card(schema_data)
        channels = self._get_channels_for_event('schema_change')

        for channel in channels:
            await self._send_adaptive_card_to_channel(channel, card)

    def _create_performance_alert_card(self, alert_data: Dict, severity: str) -> AdaptiveCard:
        """Create adaptive card for performance alerts"""

        # Color based on severity
        colors = {
            'critical': 'attention',
            'high': 'warning',
            'medium': 'accent',
            'low': 'good'
        }

        color = colors.get(severity, 'accent')

        body = [
            {
                "type": "Container",
                "style": color,
                "items": [
                    {
                        "type": "TextBlock",
                        "text": f"🚨 Performance Alert - {severity.upper()}",
                        "weight": "Bolder",
                        "size": "Medium",
                        "color": "light" if color == 'attention' else "default"
                    }
                ]
            },
            {
                "type": "FactSet",
                "facts": [
                    {"title": "Database", "value": alert_data.get('database', 'Unknown')},
                    {"title": "Metric", "value": alert_data.get('metric_name', 'Unknown')},
                    {"title": "Current Value", "value": str(alert_data.get('current_value', 'N/A'))},
                    {"title": "Threshold", "value": str(alert_data.get('threshold', 'N/A'))},
                    {"title": "Time", "value": datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}
                ]
            }
        ]

        # Add suggestions if available
        suggestions = alert_data.get('suggestions', [])
        if suggestions:
            body.append({
                "type": "TextBlock",
                "text": "**Recommended Actions:**",
                "weight": "Bolder",
                "spacing": "Medium"
            })

            for suggestion in suggestions[:3]:  # Limit to 3 suggestions
                body.append({
                    "type": "TextBlock",
                    "text": f"• {suggestion}",
                    "wrap": True
                })

        actions = [
            {
                "type": "Action.OpenUrl",
                "title": "View Dashboard",
                "url": self._get_dashboard_url()
            },
            {
                "type": "Action.OpenUrl",
                "title": "View Logs",
                "url": self._get_logs_url()
            }
        ]

        return AdaptiveCard(body=body, actions=actions)

    def _create_connection_alert_card(self, connection_data: Dict) -> AdaptiveCard:
        """Create adaptive card for connection alerts"""

        body = [
            {
                "type": "Container",
                "style": "attention",
                "items": [
                    {
                        "type": "TextBlock",
                        "text": "🔌 Database Connection Failed",
                        "weight": "Bolder",
                        "size": "Medium",
                        "color": "light"
                    }
                ]
            },
            {
                "type": "FactSet",
                "facts": [
                    {"title": "Host", "value": connection_data.get('host', 'Unknown')},
                    {"title": "Database", "value": connection_data.get('database', 'Unknown')},
                    {"title": "User", "value": connection_data.get('user', 'Unknown')},
                    {"title": "Error", "value": connection_data.get('error', 'Unknown error')},
                    {"title": "Time", "value": datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}
                ]
            }
        ]

        actions = [
            {
                "type": "Action.OpenUrl",
                "title": "Check Connection",
                "url": self._get_dashboard_url()
            }
        ]

        return AdaptiveCard(body=body, actions=actions)

    def _create_query_alert_card(self, query_data: Dict) -> AdaptiveCard:
        """Create adaptive card for query alerts"""

        body = [
            {
                "type": "Container",
                "style": "warning",
                "items": [
                    {
                        "type": "TextBlock",
                        "text": "⚠️ Query Execution Failed",
                        "weight": "Bolder",
                        "size": "Medium"
                    }
                ]
            },
            {
                "type": "FactSet",
                "facts": [
                    {"title": "Database", "value": query_data.get('database', 'Unknown')},
                    {"title": "User", "value": query_data.get('user', 'Unknown')},
                    {"title": "Error", "value": query_data.get('error', 'Unknown error')},
                    {"title": "Duration", "value": f"{query_data.get('duration', 0):.2f}s"},
                    {"title": "Time", "value": datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}
                ]
            }
        ]

        # Add query snippet (truncated)
        query = query_data.get('query', '')
        if query:
            query_snippet = query[:200] + '...' if len(query) > 200 else query
            body.append({
                "type": "TextBlock",
                "text": f"**Query:**\n```sql\n{query_snippet}\n```",
                "wrap": True,
                "spacing": "Medium"
            })

        actions = [
            {
                "type": "Action.OpenUrl",
                "title": "Query Analyzer",
                "url": self._get_query_analyzer_url()
            }
        ]

        return AdaptiveCard(body=body, actions=actions)

    def _create_security_alert_card(self, security_data: Dict) -> AdaptiveCard:
        """Create adaptive card for security alerts"""

        body = [
            {
                "type": "Container",
                "style": "attention",
                "items": [
                    {
                        "type": "TextBlock",
                        "text": "🛡️ SECURITY INCIDENT DETECTED",
                        "weight": "Bolder",
                        "size": "Large",
                        "color": "light"
                    }
                ]
            },
            {
                "type": "FactSet",
                "facts": [
                    {"title": "Incident Type", "value": security_data.get('incident_type', 'Unknown')},
                    {"title": "Source IP", "value": security_data.get('source_ip', 'Unknown')},
                    {"title": "User", "value": security_data.get('user', 'Unknown')},
                    {"title": "Database", "value": security_data.get('database', 'Unknown')},
                    {"title": "Severity", "value": security_data.get('severity', 'Unknown')},
                    {"title": "Time", "value": datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}
                ]
            }
        ]

        actions = [
            {
                "type": "Action.OpenUrl",
                "title": "Security Dashboard",
                "url": self._get_security_dashboard_url()
            },
            {
                "type": "Action.OpenUrl",
                "title": "Incident Response",
                "url": self._get_incident_response_url()
            }
        ]

        return AdaptiveCard(body=body, actions=actions)

    def _create_backup_notification_card(self, backup_data: Dict, success: bool) -> AdaptiveCard:
        """Create adaptive card for backup notifications"""

        if success:
            container_style = "good"
            icon = "✅"
            title = "Backup Completed Successfully"
            color = "good"
        else:
            container_style = "attention"
            icon = "❌"
            title = "Backup Failed"
            color = "attention"

        body = [
            {
                "type": "Container",
                "style": container_style,
                "items": [
                    {
                        "type": "TextBlock",
                        "text": f"{icon} {title}",
                        "weight": "Bolder",
                        "size": "Medium",
                        "color": "light" if not success else "default"
                    }
                ]
            },
            {
                "type": "FactSet",
                "facts": [
                    {"title": "Database", "value": backup_data.get('database', 'Unknown')},
                    {"title": "Type", "value": backup_data.get('backup_type', 'Unknown')},
                    {"title": "Size", "value": backup_data.get('size', 'Unknown')},
                    {"title": "Duration", "value": f"{backup_data.get('duration', 0):.1f}s"},
                    {"title": "Time", "value": datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}
                ]
            }
        ]

        if not success:
            body.append({
                "type": "TextBlock",
                "text": f"**Error:** {backup_data.get('error', 'Unknown error')}",
                "color": "attention",
                "wrap": True,
                "spacing": "Medium"
            })

        actions = [
            {
                "type": "Action.OpenUrl",
                "title": "Backup Manager",
                "url": self._get_backup_manager_url()
            }
        ]

        return AdaptiveCard(body=body, actions=actions)

    def _create_schema_change_card(self, schema_data: Dict) -> AdaptiveCard:
        """Create adaptive card for schema changes"""

        body = [
            {
                "type": "Container",
                "style": "accent",
                "items": [
                    {
                        "type": "TextBlock",
                        "text": "🔄 Database Schema Changed",
                        "weight": "Bolder",
                        "size": "Medium"
                    }
                ]
            },
            {
                "type": "FactSet",
                "facts": [
                    {"title": "Database", "value": schema_data.get('database', 'Unknown')},
                    {"title": "Change Type", "value": schema_data.get('change_type', 'Unknown')},
                    {"title": "Object", "value": schema_data.get('object_name', 'Unknown')},
                    {"title": "User", "value": schema_data.get('user', 'Unknown')},
                    {"title": "Time", "value": datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}
                ]
            }
        ]

        # Add change details if available
        changes = schema_data.get('changes', [])
        if changes:
            body.append({
                "type": "TextBlock",
                "text": "**Changes:**",
                "weight": "Bolder",
                "spacing": "Medium"
            })

            for change in changes[:5]:  # Limit to 5 changes
                body.append({
                    "type": "TextBlock",
                    "text": f"• {change}",
                    "wrap": True
                })

        actions = [
            {
                "type": "Action.OpenUrl",
                "title": "Schema Viewer",
                "url": self._get_schema_viewer_url()
            },
            {
                "type": "Action.OpenUrl",
                "title": "Change Log",
                "url": self._get_change_log_url()
            }
        ]

        return AdaptiveCard(body=body, actions=actions)

    async def _send_adaptive_card_to_channel(self, channel: TeamsChannel, card: AdaptiveCard):
        """Send adaptive card to Teams channel"""

        if channel.webhook_url:
            # Use webhook URL for direct posting
            await self._send_webhook_message(channel.webhook_url, card)
        else:
            # Use Graph API
            await self._send_graph_message(channel, card)

    async def _send_webhook_message(self, webhook_url: str, card: AdaptiveCard):
        """Send message via webhook"""
        try:
            message_data = {
                "type": "message",
                "attachments": [
                    {
                        "contentType": "application/vnd.microsoft.card.adaptive",
                        "contentUrl": None,
                        "content": asdict(card)
                    }
                ]
            }

            async with aiohttp.ClientSession() as session:
                async with session.post(webhook_url, json=message_data) as response:
                    if response.status not in [200, 202]:
                        error_text = await response.text()
                        self.logger.error(f"Webhook error ({response.status}): {error_text}")

        except Exception as e:
            self.logger.error(f"Error sending webhook message: {e}")

    async def _send_graph_message(self, channel: TeamsChannel, card: AdaptiveCard):
        """Send message via Graph API"""
        try:
            endpoint = f"/teams/{channel.team_id}/channels/{channel.channel_id}/messages"

            message_data = {
                "body": {
                    "contentType": "html",
                    "content": "<attachment id=\"1\"></attachment>"
                },
                "attachments": [
                    {
                        "id": "1",
                        "contentType": "application/vnd.microsoft.card.adaptive",
                        "content": asdict(card)
                    }
                ]
            }

            await self._make_graph_request('POST', endpoint, message_data)

        except Exception as e:
            self.logger.error(f"Error sending Graph message: {e}")

    def _get_channels_for_event(self, event_type: str) -> List[TeamsChannel]:
        """Get appropriate channels for event type"""
        matching_channels = []

        for channel in self.channels.values():
            if not channel.alert_types or event_type in channel.alert_types:
                matching_channels.append(channel)

        return matching_channels

    def _setup_command_handlers(self):
        """Setup bot command handlers"""
        self.command_handlers = {
            'status': self._handle_status_command,
            'health': self._handle_health_command,
            'connections': self._handle_connections_command,
            'queries': self._handle_queries_command,
            'performance': self._handle_performance_command,
            'backup': self._handle_backup_command,
            'help': self._handle_help_command
        }

    async def _setup_bot_webhooks(self):
        """Setup webhooks for bot commands"""
        try:
            # Register webhook endpoint for bot messages
            self.webhook_handler.register_endpoint(
                '/teams/messages',
                self._handle_bot_message,
                ['POST']
            )

            # Register webhook for meeting events
            self.webhook_handler.register_endpoint(
                '/teams/meetings',
                self._handle_meeting_event,
                ['POST']
            )

        except Exception as e:
            self.logger.error(f"Error setting up bot webhooks: {e}")

    async def _handle_bot_message(self, data: Dict, headers: Dict) -> Dict:
        """Handle incoming bot messages"""
        try:
            message_type = data.get('type')

            if message_type == 'message':
                text = data.get('text', '').strip()

                # Parse command
                if text.startswith(f'@{self.bot_name}') or text.startswith('/db'):
                    command_text = text.replace(f'@{self.bot_name}', '').replace('/db', '').strip()
                    command_parts = command_text.split()

                    if command_parts:
                        command = command_parts[0].lower()
                        args = command_parts[1:] if len(command_parts) > 1 else []

                        if command in self.command_handlers:
                            response = await self.command_handlers[command](args, data)

                            # Send response
                            await self._send_bot_response(data, response)

            return {"status": "ok"}

        except Exception as e:
            self.logger.error(f"Error handling bot message: {e}")
            return {"error": str(e)}

    async def _send_bot_response(self, original_message: Dict, response: AdaptiveCard):
        """Send bot response"""
        try:
            # Extract conversation reference
            conversation_id = original_message.get('conversation', {}).get('id')
            service_url = original_message.get('serviceUrl')

            if not conversation_id or not service_url:
                return

            # Send response via Bot Framework
            response_data = {
                "type": "message",
                "attachments": [
                    {
                        "contentType": "application/vnd.microsoft.card.adaptive",
                        "content": asdict(response)
                    }
                ]
            }

            # Use Bot Framework API
            await self._send_bot_framework_message(service_url, conversation_id, response_data)

        except Exception as e:
            self.logger.error(f"Error sending bot response: {e}")

    async def _send_bot_framework_message(self, service_url: str, conversation_id: str, message_data: Dict):
        """Send message via Bot Framework"""
        try:
            # Get Bot Framework token
            token = await self._get_bot_framework_token()

            if not token:
                return

            url = f"{service_url}/v3/conversations/{conversation_id}/activities"
            headers = {
                'Authorization': f'Bearer {token}',
                'Content-Type': 'application/json'
            }

            async with aiohttp.ClientSession() as session:
                async with session.post(url, headers=headers, json=message_data) as response:
                    if response.status not in [200, 201]:
                        error_text = await response.text()
                        self.logger.error(f"Bot Framework error ({response.status}): {error_text}")

        except Exception as e:
            self.logger.error(f"Error sending Bot Framework message: {e}")

    async def _get_bot_framework_token(self) -> Optional[str]:
        """Get Bot Framework authentication token"""
        try:
            auth_url = "https://login.microsoftonline.com/botframework.com/oauth2/v2.0/token"

            data = {
                'grant_type': 'client_credentials',
                'client_id': self.bot_app_id,
                'client_secret': self.bot_app_password,
                'scope': 'https://api.botframework.com/.default'
            }

            async with aiohttp.ClientSession() as session:
                async with session.post(auth_url, data=data) as response:
                    if response.status == 200:
                        token_data = await response.json()
                        return token_data['access_token']
                    else:
                        error_data = await response.text()
                        self.logger.error(f"Bot Framework auth failed: {error_data}")
                        return None

        except Exception as e:
            self.logger.error(f"Bot Framework auth error: {e}")
            return None

    async def _handle_status_command(self, args: List[str], context: Dict) -> AdaptiveCard:
        """Handle status command"""
        try:
            # Get current database status
            status_data = await self._get_database_status()

            body = [
                {
                    "type": "TextBlock",
                    "text": "📊 Database Status",
                    "weight": "Bolder",
                    "size": "Large"
                },
                {
                    "type": "FactSet",
                    "facts": [
                        {"title": "Active Connections", "value": str(status_data.get('active_connections', 'N/A'))},
                        {"title": "Running Queries", "value": str(status_data.get('running_queries', 'N/A'))},
                        {"title": "Database Size", "value": status_data.get('database_size', 'N/A')},
                        {"title": "Cache Hit Ratio", "value": f"{status_data.get('cache_hit_ratio', 0):.1f}%"},
                        {"title": "Last Backup", "value": status_data.get('last_backup', 'N/A')}
                    ]
                }
            ]

            actions = [
                {
                    "type": "Action.OpenUrl",
                    "title": "Full Dashboard",
                    "url": self._get_dashboard_url()
                }
            ]

            return AdaptiveCard(body=body, actions=actions)

        except Exception as e:
            return self._create_error_card(f"Error getting status: {e}")

    async def _handle_health_command(self, args: List[str], context: Dict) -> AdaptiveCard:
        """Handle health command"""
        try:
            # Get health report
            health_data = await self._get_health_report()

            # Determine health status
            overall_score = health_data.get('overall_score', 0)
            if overall_score >= 90:
                status_icon = "✅"
                status_text = "Excellent"
                status_color = "good"
            elif overall_score >= 70:
                status_icon = "⚠️"
                status_text = "Good"
                status_color = "warning"
            elif overall_score >= 50:
                status_icon = "⚠️"
                status_text = "Fair"
                status_color = "attention"
            else:
                status_icon = "❌"
                status_text = "Poor"
                status_color = "attention"

            body = [
                {
                    "type": "Container",
                    "style": status_color,
                    "items": [
                        {
                            "type": "TextBlock",
                            "text": f"{status_icon} Database Health: {status_text}",
                            "weight": "Bolder",
                            "size": "Large",
                            "color": "light" if status_color == "attention" else "default"
                        }
                    ]
                },
                {
                    "type": "FactSet",
                    "facts": [
                        {"title": "Overall Score", "value": f"{overall_score:.0f}/100"},
                        {"title": "Active Alerts", "value": str(len(health_data.get('alerts', [])))},
                        {"title": "Critical Issues", "value": str(len([a for a in health_data.get('alerts', []) if a.get('severity') == 'critical']))},
                        {"title": "Last Check", "value": datetime.utcnow().strftime('%H:%M:%S UTC')}
                    ]
                }
            ]

            # Add recent alerts
            alerts = health_data.get('alerts', [])[:3]  # Show last 3 alerts
            if alerts:
                body.append({
                    "type": "TextBlock",
                    "text": "**Recent Alerts:**",
                    "weight": "Bolder",
                    "spacing": "Medium"
                })

                for alert in alerts:
                    body.append({
                        "type": "TextBlock",
                        "text": f"• {alert.get('message', 'Unknown alert')}",
                        "wrap": True
                    })

            actions = [
                {
                    "type": "Action.OpenUrl",
                    "title": "Health Dashboard",
                    "url": self._get_health_dashboard_url()
                }
            ]

            return AdaptiveCard(body=body, actions=actions)

        except Exception as e:
            return self._create_error_card(f"Error getting health: {e}")

    def _create_error_card(self, error_message: str) -> AdaptiveCard:
        """Create error card"""
        body = [
            {
                "type": "Container",
                "style": "attention",
                "items": [
                    {
                        "type": "TextBlock",
                        "text": "❌ Error",
                        "weight": "Bolder",
                        "size": "Medium",
                        "color": "light"
                    }
                ]
            },
            {
                "type": "TextBlock",
                "text": error_message,
                "wrap": True
            }
        ]

        return AdaptiveCard(body=body)

    # URL helper methods
    def _get_dashboard_url(self) -> str:
        return self.dashboard_config.get('base_url', 'https://localhost:8080/dashboard')

    def _get_logs_url(self) -> str:
        return f"{self._get_dashboard_url()}/logs"

    def _get_query_analyzer_url(self) -> str:
        return f"{self._get_dashboard_url()}/query-analyzer"

    def _get_security_dashboard_url(self) -> str:
        return f"{self._get_dashboard_url()}/security"

    def _get_incident_response_url(self) -> str:
        return f"{self._get_dashboard_url()}/incidents"

    def _get_backup_manager_url(self) -> str:
        return f"{self._get_dashboard_url()}/backups"

    def _get_schema_viewer_url(self) -> str:
        return f"{self._get_dashboard_url()}/schema"

    def _get_change_log_url(self) -> str:
        return f"{self._get_dashboard_url()}/changes"

    def _get_health_dashboard_url(self) -> str:
        return f"{self._get_dashboard_url()}/health"

    # Data retrieval methods (to be implemented with actual database connections)
    async def _get_database_status(self) -> Dict:
        """Get current database status"""
        # This would connect to the actual database and retrieve status
        return {
            'active_connections': 15,
            'running_queries': 3,
            'database_size': '2.3 GB',
            'cache_hit_ratio': 94.5,
            'last_backup': '2 hours ago'
        }

    async def _get_health_report(self) -> Dict:
        """Get health report"""
        # This would get the actual health report from the health monitor
        return {
            'overall_score': 85,
            'alerts': [
                {'severity': 'medium', 'message': 'Connection pool 80% full'},
                {'severity': 'low', 'message': 'Index maintenance recommended'}
            ]
        }

    async def _send_welcome_message(self):
        """Send welcome message when integration starts"""
        try:
            welcome_card = AdaptiveCard(
                body=[
                    {
                        "type": "Container",
                        "style": "good",
                        "items": [
                            {
                                "type": "TextBlock",
                                "text": "🚀 PostgreSQL Database Assistant Connected",
                                "weight": "Bolder",
                                "size": "Large"
                            }
                        ]
                    },
                    {
                        "type": "TextBlock",
                        "text": "I'm now monitoring your database and will alert you of any issues. Type `@PostgreSQL Database Assistant help` for available commands.",
                        "wrap": True,
                        "spacing": "Medium"
                    }
                ],
                actions=[
                    {
                        "type": "Action.OpenUrl",
                        "title": "Dashboard",
                        "url": self._get_dashboard_url()
                    }
                ]
            )

            # Send to all configured channels
            for channel in self.channels.values():
                await self._send_adaptive_card_to_channel(channel, welcome_card)

        except Exception as e:
            self.logger.error(f"Error sending welcome message: {e}")

    async def _send_disconnect_message(self):
        """Send disconnect message"""
        try:
            disconnect_card = AdaptiveCard(
                body=[
                    {
                        "type": "Container",
                        "style": "attention",
                        "items": [
                            {
                                "type": "TextBlock",
                                "text": "🔌 PostgreSQL Database Assistant Disconnected",
                                "weight": "Bolder",
                                "size": "Large",
                                "color": "light"
                            }
                        ]
                    },
                    {
                        "type": "TextBlock",
                        "text": "Database monitoring has been paused. I will no longer send alerts until reconnected.",
                        "wrap": True,
                        "spacing": "Medium"
                    }
                ]
            )

            # Send to all configured channels
            for channel in self.channels.values():
                await self._send_adaptive_card_to_channel(channel, disconnect_card)

        except Exception as e:
            self.logger.error(f"Error sending disconnect message: {e}")

    async def _cleanup_webhooks(self):
        """Clean up registered webhooks"""
        try:
            # Clean up any registered webhooks
            pass
        except Exception as e:
            self.logger.error(f"Error cleaning up webhooks: {e}")

    # Meeting integration methods
    async def _handle_meeting_event(self, data: Dict, headers: Dict) -> Dict:
        """Handle Teams meeting events"""
        try:
            event_type = data.get('eventType')

            if event_type == 'meetingStarted':
                await self._handle_meeting_started(data)
            elif event_type == 'meetingEnded':
                await self._handle_meeting_ended(data)

            return {"status": "ok"}

        except Exception as e:
            self.logger.error(f"Error handling meeting event: {e}")
            return {"error": str(e)}

    async def _handle_meeting_started(self, meeting_data: Dict):
        """Handle meeting started event"""
        try:
            meeting_id = meeting_data.get('meetingId')
            meeting_title = meeting_data.get('subject', 'Database Review Meeting')

            # Check if this is a database review meeting
            if 'database' in meeting_title.lower() or 'db' in meeting_title.lower():
                # Prepare meeting materials
                await self._prepare_meeting_materials(meeting_id, meeting_title)

        except Exception as e:
            self.logger.error(f"Error handling meeting started: {e}")

    async def _prepare_meeting_materials(self, meeting_id: str, meeting_title: str):
        """Prepare database materials for meeting"""
        try:
            # Get current status and health
            status_data = await self._get_database_status()
            health_data = await self._get_health_report()

            # Create meeting summary card
            meeting_card = AdaptiveCard(
                body=[
                    {
                        "type": "TextBlock",
                        "text": f"📋 Database Summary for: {meeting_title}",
                        "weight": "Bolder",
                        "size": "Large"
                    },
                    {
                        "type": "ColumnSet",
                        "columns": [
                            {
                                "type": "Column",
                                "width": "stretch",
                                "items": [
                                    {
                                        "type": "TextBlock",
                                        "text": "**Current Status**",
                                        "weight": "Bolder"
                                    },
                                    {
                                        "type": "FactSet",
                                        "facts": [
                                            {"title": "Health Score", "value": f"{health_data.get('overall_score', 0):.0f}/100"},
                                            {"title": "Active Connections", "value": str(status_data.get('active_connections', 'N/A'))},
                                            {"title": "Cache Hit Ratio", "value": f"{status_data.get('cache_hit_ratio', 0):.1f}%"}
                                        ]
                                    }
                                ]
                            },
                            {
                                "type": "Column",
                                "width": "stretch",
                                "items": [
                                    {
                                        "type": "TextBlock",
                                        "text": "**Recent Alerts**",
                                        "weight": "Bolder"
                                    },
                                    {
                                        "type": "TextBlock",
                                        "text": f"• {len(health_data.get('alerts', []))} active alerts\n• Last backup: {status_data.get('last_backup', 'N/A')}",
                                        "wrap": True
                                    }
                                ]
                            }
                        ]
                    }
                ],
                actions=[
                    {
                        "type": "Action.OpenUrl",
                        "title": "Full Report",
                        "url": f"{self._get_dashboard_url()}/reports/meeting-{meeting_id}"
                    }
                ]
            )

            # Send to meeting chat
            # This would require additional Graph API calls to post to meeting chat

        except Exception as e:
            self.logger.error(f"Error preparing meeting materials: {e}")


# Configuration example
def create_teams_integration_config() -> Dict[str, Any]:
    """Create example Teams integration configuration"""
    return {
        'tenant_id': 'your-tenant-id',
        'client_id': 'your-client-id',
        'client_secret': 'your-client-secret',
        'bot_name': 'PostgreSQL Database Assistant',
        'bot_app_id': 'your-bot-app-id',
        'bot_app_password': 'your-bot-app-password',
        'channels': [
            {
                'team_id': 'team-1-id',
                'channel_id': 'channel-1-id',
                'name': 'database-alerts',
                'webhook_url': 'https://outlook.office.com/webhook/...',
                'alert_types': ['performance_alert', 'security_alert', 'backup_alert']
            },
            {
                'team_id': 'team-2-id',
                'channel_id': 'channel-2-id',
                'name': 'database-ops',
                'alert_types': ['schema_change', 'backup_notification']
            }
        ],
        'dashboard': {
            'base_url': 'https://your-domain.com/postgres-dashboard'
        },
        'meeting_integration': {
            'enabled': True,
            'auto_prepare_materials': True
        }
    }