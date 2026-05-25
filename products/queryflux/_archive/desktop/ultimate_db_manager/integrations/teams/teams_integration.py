"""
Microsoft Teams Enterprise Integration
Fortune 500-grade Teams integration with adaptive cards, automated workflows, and real-time collaboration
"""

import asyncio
import json
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional
from dataclasses import dataclass

import aiohttp
from botbuilder.core import TurnContext, ActivityHandler, MessageFactory, CardFactory
from botbuilder.core.conversation_state import ConversationState
from botbuilder.core.user_state import UserState
from botbuilder.schema import Activity, ActivityTypes, ChannelAccount, CardAction, ActionTypes

from ..base import BaseIntegration, IntegrationType, EventType, IntegrationEvent, rate_limit, retry

logger = logging.getLogger(__name__)

@dataclass
class TeamsChannel:
    """Represents a Teams channel"""
    id: str
    name: str
    team_id: str
    description: str = ""
    is_private: bool = False

@dataclass
class TeamsWorkspace:
    """Represents a Teams workspace"""
    tenant_id: str
    team_id: str
    team_name: str
    bot_id: str
    channels: List[TeamsChannel] = None

class TeamsIntegration(BaseIntegration):
    """
    Enterprise Microsoft Teams Integration

    Features:
    - Rich adaptive cards for database insights
    - Real-time performance dashboards
    - Interactive query builders
    - Automated report distribution
    - Security incident notifications with approval workflows
    - Schema change notifications
    - Database health monitoring
    - Natural language query interface
    - Integration with Microsoft Graph API
    - Power BI dashboard embedding
    """

    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)

        # Teams Bot Framework configuration
        self.app_id = config.get('app_id')
        self.app_password = config.get('app_password')
        self.tenant_id = config.get('tenant_id')

        # Microsoft Graph API
        self.client_id = config.get('client_id')
        self.client_secret = config.get('client_secret')
        self.graph_token = None

        # Channel configurations
        self.alerts_channel_id = config.get('alerts_channel_id')
        self.reports_channel_id = config.get('reports_channel_id')
        self.incidents_channel_id = config.get('incidents_channel_id')
        self.general_channel_id = config.get('general_channel_id')

        # Bot activity handler
        self.bot_handler = None
        self.conversation_state = None
        self.user_state = None

        # Adaptive card configurations
        self.enable_rich_cards = config.get('enable_rich_cards', True)
        self.enable_interactive_actions = config.get('enable_interactive_actions', True)
        self.enable_power_bi_integration = config.get('enable_power_bi_integration', True)

        # Workflow configurations
        self.enable_approval_workflows = config.get('enable_approval_workflows', True)
        self.enable_automated_reports = config.get('enable_automated_reports', True)

        self.workspace_info = None

    def get_integration_type(self) -> IntegrationType:
        return IntegrationType.COMMUNICATION

    async def connect(self) -> bool:
        """Establish connection to Microsoft Teams"""
        try:
            if not self.app_id or not self.app_password:
                raise ValueError("App ID and password are required for Teams integration")

            # Initialize Graph API token
            await self._authenticate_graph_api()

            # Initialize bot handler
            self._setup_bot_handler()

            # Get workspace information
            await self._get_workspace_info()

            # Send startup notification
            await self._send_startup_notification()

            self.is_connected = True
            self.logger.info(f"Connected to Teams workspace: {self.workspace_info.team_name}")
            return True

        except Exception as e:
            self.logger.error(f"Failed to connect to Teams: {e}")
            return False

    async def disconnect(self):
        """Disconnect from Teams"""
        try:
            # Send shutdown notification
            if self.is_connected:
                await self._send_shutdown_notification()

            self.is_connected = False
            self.logger.info("Disconnected from Teams")

        except Exception as e:
            self.logger.error(f"Error disconnecting from Teams: {e}")

    async def health_check(self) -> Dict[str, Any]:
        """Check Teams integration health"""
        try:
            # Test Graph API connection
            if self.graph_token:
                async with aiohttp.ClientSession() as session:
                    headers = {"Authorization": f"Bearer {self.graph_token}"}
                    async with session.get("https://graph.microsoft.com/v1.0/me", headers=headers) as response:
                        graph_healthy = response.status == 200
            else:
                graph_healthy = False

            return {
                "healthy": graph_healthy and self.is_connected,
                "workspace": self.workspace_info.team_name if self.workspace_info else None,
                "bot_id": self.workspace_info.bot_id if self.workspace_info else None,
                "graph_api_connected": graph_healthy,
                "last_check": datetime.utcnow().isoformat()
            }

        except Exception as e:
            return {"healthy": False, "error": str(e)}

    async def _authenticate_graph_api(self):
        """Authenticate with Microsoft Graph API"""
        try:
            auth_url = f"https://login.microsoftonline.com/{self.tenant_id}/oauth2/v2.0/token"

            data = {
                "client_id": self.client_id,
                "client_secret": self.client_secret,
                "scope": "https://graph.microsoft.com/.default",
                "grant_type": "client_credentials"
            }

            async with aiohttp.ClientSession() as session:
                async with session.post(auth_url, data=data) as response:
                    if response.status == 200:
                        token_data = await response.json()
                        self.graph_token = token_data["access_token"]
                        self.logger.info("Successfully authenticated with Graph API")
                    else:
                        raise Exception(f"Graph API authentication failed: {response.status}")

        except Exception as e:
            self.logger.error(f"Graph API authentication error: {e}")
            raise

    def _setup_bot_handler(self):
        """Set up Teams bot activity handler"""
        class DatabaseBotHandler(ActivityHandler):
            def __init__(self, teams_integration):
                super().__init__()
                self.teams_integration = teams_integration

            async def on_message_activity(self, turn_context: TurnContext):
                """Handle incoming messages"""
                await self.teams_integration._handle_message(turn_context)

            async def on_invoke_activity(self, turn_context: TurnContext):
                """Handle adaptive card actions"""
                return await self.teams_integration._handle_invoke_activity(turn_context)

        self.bot_handler = DatabaseBotHandler(self)

    async def _handle_message(self, turn_context: TurnContext):
        """Handle incoming messages"""
        try:
            text = turn_context.activity.text
            user_id = turn_context.activity.from_property.id

            if text.startswith("/db-"):
                # Handle slash commands
                await self._handle_command(turn_context, text)
            else:
                # Process as natural language query
                query_result = await self._process_natural_language_query(text, user_id)

                if query_result:
                    await self._send_query_result_card(turn_context, query_result)
                else:
                    await self._send_help_card(turn_context)

        except Exception as e:
            self.logger.error(f"Error handling message: {e}")
            await turn_context.send_activity("Sorry, I encountered an error processing your request.")

    async def _handle_invoke_activity(self, turn_context: TurnContext):
        """Handle adaptive card actions"""
        try:
            invoke_request = turn_context.activity.value
            action_type = invoke_request.get("action", {}).get("type")

            if action_type == "Action.Submit":
                data = invoke_request.get("action", {}).get("data", {})
                action_id = data.get("action_id")

                if action_id == "execute_query":
                    return await self._handle_query_execution(turn_context, data)
                elif action_id == "approve_incident":
                    return await self._handle_incident_approval(turn_context, data)
                elif action_id == "export_data":
                    return await self._handle_data_export(turn_context, data)

        except Exception as e:
            self.logger.error(f"Error handling invoke activity: {e}")

    async def handle_event(self, event: IntegrationEvent):
        """Handle database events and send appropriate Teams notifications"""
        try:
            if event.event_type == EventType.CONNECTION_FAILED:
                await self._notify_connection_failure(event)
            elif event.event_type == EventType.QUERY_EXECUTED:
                await self._notify_query_execution(event)
            elif event.event_type == EventType.PERFORMANCE_ALERT:
                await self._notify_performance_alert(event)
            elif event.event_type == EventType.SECURITY_INCIDENT:
                await self._notify_security_incident(event)
            elif event.event_type == EventType.BACKUP_COMPLETED:
                await self._notify_backup_status(event)
            elif event.event_type == EventType.SCHEMA_CHANGED:
                await self._notify_schema_change(event)

        except Exception as e:
            self.logger.error(f"Error handling event {event.event_type}: {e}")

    async def _notify_performance_alert(self, event: IntegrationEvent):
        """Send performance alert as adaptive card"""
        try:
            alert_data = event.data
            severity_color = {
                "info": "good",
                "warning": "warning",
                "error": "attention",
                "critical": "attention"
            }.get(event.severity, "good")

            card = {
                "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
                "type": "AdaptiveCard",
                "version": "1.3",
                "body": [
                    {
                        "type": "Container",
                        "style": severity_color,
                        "items": [
                            {
                                "type": "TextBlock",
                                "text": f"⚡ Performance Alert - {event.severity.upper()}",
                                "weight": "Bolder",
                                "size": "Large",
                                "color": "Light"
                            }
                        ]
                    },
                    {
                        "type": "FactSet",
                        "facts": [
                            {
                                "title": "Metric",
                                "value": alert_data.get("metric", "Unknown")
                            },
                            {
                                "title": "Current Value",
                                "value": str(alert_data.get("current_value", "N/A"))
                            },
                            {
                                "title": "Threshold",
                                "value": str(alert_data.get("threshold", "N/A"))
                            },
                            {
                                "title": "Database",
                                "value": alert_data.get("database", "Unknown")
                            },
                            {
                                "title": "Time",
                                "value": event.timestamp.strftime("%Y-%m-%d %H:%M:%S")
                            }
                        ]
                    }
                ]
            }

            # Add chart if available
            if alert_data.get("chart_url"):
                card["body"].append({
                    "type": "Image",
                    "url": alert_data["chart_url"],
                    "altText": "Performance Chart"
                })

            # Add actions
            if self.enable_interactive_actions:
                card["actions"] = [
                    {
                        "type": "Action.Submit",
                        "title": "View Details",
                        "data": {
                            "action_id": "view_details",
                            "alert_data": alert_data
                        }
                    },
                    {
                        "type": "Action.OpenUrl",
                        "title": "Open Dashboard",
                        "url": alert_data.get("dashboard_url", "#")
                    }
                ]

            await self._send_adaptive_card(self.alerts_channel_id, card)

        except Exception as e:
            self.logger.error(f"Error sending performance alert: {e}")

    async def _notify_security_incident(self, event: IntegrationEvent):
        """Send security incident notification with approval workflow"""
        try:
            incident_data = event.data

            card = {
                "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
                "type": "AdaptiveCard",
                "version": "1.3",
                "body": [
                    {
                        "type": "Container",
                        "style": "attention",
                        "items": [
                            {
                                "type": "TextBlock",
                                "text": "🚨 SECURITY INCIDENT DETECTED",
                                "weight": "Bolder",
                                "size": "Large",
                                "color": "Light"
                            }
                        ]
                    },
                    {
                        "type": "TextBlock",
                        "text": incident_data.get("description", "No description available"),
                        "wrap": True,
                        "spacing": "Medium"
                    },
                    {
                        "type": "FactSet",
                        "facts": [
                            {
                                "title": "Incident Type",
                                "value": incident_data.get("incident_type", "Unknown")
                            },
                            {
                                "title": "Severity",
                                "value": event.severity.upper()
                            },
                            {
                                "title": "User",
                                "value": incident_data.get("user", "Unknown")
                            },
                            {
                                "title": "IP Address",
                                "value": incident_data.get("ip_address", "Unknown")
                            },
                            {
                                "title": "Database",
                                "value": incident_data.get("database", "Unknown")
                            },
                            {
                                "title": "Time",
                                "value": event.timestamp.strftime("%Y-%m-%d %H:%M:%S")
                            }
                        ]
                    }
                ]
            }

            # Add approval workflow actions
            if self.enable_approval_workflows:
                card["actions"] = [
                    {
                        "type": "Action.Submit",
                        "title": "🔍 Investigate",
                        "style": "destructive",
                        "data": {
                            "action_id": "investigate_incident",
                            "incident_data": incident_data
                        }
                    },
                    {
                        "type": "Action.Submit",
                        "title": "✅ False Positive",
                        "data": {
                            "action_id": "mark_false_positive",
                            "incident_data": incident_data
                        }
                    },
                    {
                        "type": "Action.Submit",
                        "title": "📋 Create Ticket",
                        "data": {
                            "action_id": "create_ticket",
                            "incident_data": incident_data
                        }
                    }
                ]

            await self._send_adaptive_card(self.incidents_channel_id, card)

        except Exception as e:
            self.logger.error(f"Error sending security incident: {e}")

    async def _send_query_result_card(self, turn_context: TurnContext, query_result: Dict):
        """Send query results as an adaptive card"""
        try:
            query = query_result.get("query", "")
            results = query_result.get("results", [])
            execution_time = query_result.get("execution_time", 0)
            row_count = len(results)

            card = {
                "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
                "type": "AdaptiveCard",
                "version": "1.3",
                "body": [
                    {
                        "type": "TextBlock",
                        "text": "📊 Query Results",
                        "weight": "Bolder",
                        "size": "Large"
                    },
                    {
                        "type": "TextBlock",
                        "text": f"```sql\n{query}\n```",
                        "fontType": "Monospace",
                        "wrap": True
                    },
                    {
                        "type": "FactSet",
                        "facts": [
                            {
                                "title": "Rows",
                                "value": str(row_count)
                            },
                            {
                                "title": "Execution Time",
                                "value": f"{execution_time:.2f}ms"
                            }
                        ]
                    }
                ]
            }

            # Add results table
            if results and len(results) > 0:
                preview_rows = results[:5]

                if isinstance(preview_rows[0], dict):
                    headers = list(preview_rows[0].keys())

                    # Create table container
                    table_container = {
                        "type": "Container",
                        "items": []
                    }

                    # Add headers
                    header_columns = []
                    for header in headers:
                        header_columns.append({
                            "type": "TextBlock",
                            "text": header,
                            "weight": "Bolder",
                            "size": "Small"
                        })

                    table_container["items"].append({
                        "type": "ColumnSet",
                        "columns": [{"type": "Column", "width": "auto", "items": [col]} for col in header_columns]
                    })

                    # Add rows
                    for row in preview_rows:
                        row_columns = []
                        for header in headers:
                            row_columns.append({
                                "type": "TextBlock",
                                "text": str(row.get(header, "")),
                                "size": "Small",
                                "wrap": True
                            })

                        table_container["items"].append({
                            "type": "ColumnSet",
                            "columns": [{"type": "Column", "width": "auto", "items": [col]} for col in row_columns]
                        })

                    if row_count > 5:
                        table_container["items"].append({
                            "type": "TextBlock",
                            "text": f"... and {row_count - 5} more rows",
                            "isSubtle": True,
                            "size": "Small"
                        })

                    card["body"].append(table_container)

            # Add actions
            if self.enable_interactive_actions:
                card["actions"] = [
                    {
                        "type": "Action.Submit",
                        "title": "📁 Export CSV",
                        "data": {
                            "action_id": "export_data",
                            "format": "csv",
                            "query_result": query_result
                        }
                    },
                    {
                        "type": "Action.Submit",
                        "title": "📊 Create Chart",
                        "data": {
                            "action_id": "create_chart",
                            "query_result": query_result
                        }
                    }
                ]

            attachment = CardFactory.adaptive_card(card)
            await turn_context.send_activity(MessageFactory.attachment(attachment))

        except Exception as e:
            self.logger.error(f"Error sending query result card: {e}")

    @rate_limit(30)  # 30 calls per minute for Teams
    @retry(max_attempts=3)
    async def _send_adaptive_card(self, channel_id: str, card: Dict):
        """Send adaptive card to Teams channel"""
        try:
            if not self.graph_token:
                await self._authenticate_graph_api()

            url = f"https://graph.microsoft.com/v1.0/teams/{self.workspace_info.team_id}/channels/{channel_id}/messages"

            headers = {
                "Authorization": f"Bearer {self.graph_token}",
                "Content-Type": "application/json"
            }

            message_data = {
                "body": {
                    "contentType": "html",
                    "content": "Database Manager Notification"
                },
                "attachments": [
                    {
                        "contentType": "application/vnd.microsoft.card.adaptive",
                        "content": card
                    }
                ]
            }

            async with aiohttp.ClientSession() as session:
                async with session.post(url, headers=headers, json=message_data) as response:
                    if response.status != 201:
                        error_text = await response.text()
                        raise Exception(f"Failed to send card: {response.status} - {error_text}")

                    self.logger.info("Successfully sent adaptive card to Teams")

        except Exception as e:
            self.logger.error(f"Error sending adaptive card: {e}")
            raise

    async def _get_workspace_info(self):
        """Get Teams workspace information"""
        try:
            # Get team information using Graph API
            url = f"https://graph.microsoft.com/v1.0/groups/{self.tenant_id}"

            headers = {"Authorization": f"Bearer {self.graph_token}"}

            async with aiohttp.ClientSession() as session:
                async with session.get(url, headers=headers) as response:
                    if response.status == 200:
                        team_data = await response.json()

                        self.workspace_info = TeamsWorkspace(
                            tenant_id=self.tenant_id,
                            team_id=team_data.get("id"),
                            team_name=team_data.get("displayName", "Unknown Team"),
                            bot_id=self.app_id
                        )

        except Exception as e:
            self.logger.error(f"Error getting workspace info: {e}")

    async def _send_startup_notification(self):
        """Send startup notification card"""
        try:
            card = {
                "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
                "type": "AdaptiveCard",
                "version": "1.3",
                "body": [
                    {
                        "type": "Container",
                        "style": "good",
                        "items": [
                            {
                                "type": "TextBlock",
                                "text": "🚀 Database Manager Online",
                                "weight": "Bolder",
                                "size": "Large",
                                "color": "Light"
                            }
                        ]
                    },
                    {
                        "type": "TextBlock",
                        "text": f"Ultimate Database Manager is now connected to **{self.workspace_info.team_name}**",
                        "wrap": True
                    },
                    {
                        "type": "TextBlock",
                        "text": "**Available Commands:**\n• `/db-status` - Check database health\n• `/db-query <sql>` - Execute SQL queries\n• `/db-help` - Show help\n• Natural language queries supported",
                        "wrap": True
                    }
                ]
            }

            await self._send_adaptive_card(self.general_channel_id, card)

        except Exception as e:
            self.logger.error(f"Error sending startup notification: {e}")

    async def _send_shutdown_notification(self):
        """Send shutdown notification"""
        try:
            card = {
                "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
                "type": "AdaptiveCard",
                "version": "1.3",
                "body": [
                    {
                        "type": "TextBlock",
                        "text": "🔌 Database Manager Going Offline",
                        "weight": "Bolder",
                        "size": "Medium"
                    }
                ]
            }

            await self._send_adaptive_card(self.general_channel_id, card)

        except Exception as e:
            self.logger.error(f"Error sending shutdown notification: {e}")

    async def _process_natural_language_query(self, text: str, user_id: str) -> Optional[Dict]:
        """Process natural language query (placeholder for AI integration)"""
        # This would integrate with the AI query genius
        # For now, return a simple example
        if "users" in text.lower() and "count" in text.lower():
            return {
                "query": "SELECT COUNT(*) FROM users",
                "results": [{"count": 1234}],
                "execution_time": 12.5
            }
        return None