"""
Slack Enterprise Integration
Fortune 500-grade Slack integration with real-time notifications, query sharing, and automated workflows
"""

import asyncio
import json
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional
from dataclasses import dataclass

import aiohttp
from slack_sdk.web.async_client import AsyncWebClient
from slack_sdk.socket_mode.async_client import AsyncSocketModeClient
from slack_sdk.socket_mode.listener.async_listener import AsyncSocketModeListener
from slack_sdk.models.events import MessageEvent

from ..base import BaseIntegration, IntegrationType, EventType, IntegrationEvent, rate_limit, retry

logger = logging.getLogger(__name__)

@dataclass
class SlackChannel:
    """Represents a Slack channel configuration"""
    id: str
    name: str
    purpose: str
    is_private: bool = False
    members: List[str] = None

@dataclass
class SlackWorkspace:
    """Represents a Slack workspace"""
    team_id: str
    team_name: str
    bot_user_id: str
    channels: List[SlackChannel] = None

class SlackIntegration(BaseIntegration):
    """
    Enterprise Slack Integration

    Features:
    - Real-time database notifications
    - Query result sharing with interactive previews
    - Alert escalation and incident management
    - Database performance dashboards in Slack
    - Natural language query interface
    - Automated report distribution
    - Security incident notifications
    - Schema change notifications
    """

    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)

        # Slack configuration
        self.bot_token = config.get('bot_token')
        self.app_token = config.get('app_token')
        self.signing_secret = config.get('signing_secret')
        self.verification_token = config.get('verification_token')

        # Channel configurations
        self.alerts_channel = config.get('alerts_channel', '#database-alerts')
        self.reports_channel = config.get('reports_channel', '#database-reports')
        self.incidents_channel = config.get('incidents_channel', '#database-incidents')
        self.general_channel = config.get('general_channel', '#database-general')

        # Client instances
        self.web_client = None
        self.socket_client = None
        self.workspace_info = None

        # Message formatting
        self.enable_rich_formatting = config.get('enable_rich_formatting', True)
        self.enable_threading = config.get('enable_threading', True)

        # Rate limiting
        self.rate_limit_calls = config.get('rate_limit_calls', 50)  # Per minute

        # Interactive components
        self.enable_interactive_queries = config.get('enable_interactive_queries', True)
        self.enable_approval_workflows = config.get('enable_approval_workflows', True)

    def get_integration_type(self) -> IntegrationType:
        return IntegrationType.COMMUNICATION

    async def connect(self) -> bool:
        """Establish connection to Slack"""
        try:
            if not self.bot_token:
                raise ValueError("Bot token is required for Slack integration")

            # Initialize web client
            self.web_client = AsyncWebClient(token=self.bot_token)

            # Test connection
            auth_response = await self.web_client.auth_test()
            if not auth_response["ok"]:
                raise Exception(f"Slack auth failed: {auth_response['error']}")

            self.workspace_info = SlackWorkspace(
                team_id=auth_response["team_id"],
                team_name=auth_response["team"],
                bot_user_id=auth_response["user_id"]
            )

            # Initialize Socket Mode if app token provided
            if self.app_token:
                self.socket_client = AsyncSocketModeClient(
                    app_token=self.app_token,
                    web_client=self.web_client
                )

                # Set up event listeners
                self._setup_event_listeners()

                # Start socket connection
                await self.socket_client.connect()

            # Verify channels exist and create if needed
            await self._setup_channels()

            # Send startup notification
            await self._send_startup_notification()

            self.is_connected = True
            self.logger.info(f"Connected to Slack workspace: {self.workspace_info.team_name}")
            return True

        except Exception as e:
            self.logger.error(f"Failed to connect to Slack: {e}")
            return False

    async def disconnect(self):
        """Disconnect from Slack"""
        try:
            if self.socket_client:
                await self.socket_client.disconnect()

            # Send shutdown notification
            if self.is_connected:
                await self._send_shutdown_notification()

            self.is_connected = False
            self.logger.info("Disconnected from Slack")

        except Exception as e:
            self.logger.error(f"Error disconnecting from Slack: {e}")

    async def health_check(self) -> Dict[str, Any]:
        """Check Slack integration health"""
        try:
            if not self.web_client:
                return {"healthy": False, "error": "Not connected"}

            # Test API call
            response = await self.web_client.auth_test()

            return {
                "healthy": response["ok"],
                "workspace": self.workspace_info.team_name if self.workspace_info else None,
                "bot_user_id": self.workspace_info.bot_user_id if self.workspace_info else None,
                "socket_connected": self.socket_client.is_connected() if self.socket_client else False,
                "last_check": datetime.utcnow().isoformat()
            }

        except Exception as e:
            return {"healthy": False, "error": str(e)}

    def _setup_event_listeners(self):
        """Set up Slack event listeners"""
        @self.socket_client.socket_mode_request_listeners.append
        async def handle_socket_mode_request(client, req):
            if req.type == "events_api":
                # Handle app mentions and direct messages
                if req.payload.get("event", {}).get("type") == "app_mention":
                    await self._handle_app_mention(req.payload["event"])
                elif req.payload.get("event", {}).get("type") == "message":
                    await self._handle_direct_message(req.payload["event"])

            elif req.type == "interactive":
                # Handle button clicks and interactive components
                await self._handle_interactive_component(req.payload)

            elif req.type == "slash_commands":
                # Handle slash commands
                await self._handle_slash_command(req.payload)

            # Acknowledge the request
            response = {"envelope_id": req.envelope_id}
            await client.send_socket_mode_response(response)

    async def _handle_app_mention(self, event: Dict):
        """Handle app mentions for natural language queries"""
        try:
            text = event.get("text", "").replace(f"<@{self.workspace_info.bot_user_id}>", "").strip()
            channel = event.get("channel")
            user = event.get("user")
            ts = event.get("ts")

            if self.enable_interactive_queries:
                # Parse natural language query
                query_result = await self._process_natural_language_query(text, user)

                if query_result:
                    await self._send_query_result(channel, query_result, ts)
                else:
                    await self._send_help_message(channel, ts)

        except Exception as e:
            self.logger.error(f"Error handling app mention: {e}")

    async def _handle_direct_message(self, event: Dict):
        """Handle direct messages to the bot"""
        try:
            if event.get("channel_type") == "im":
                text = event.get("text", "")
                user = event.get("user")
                channel = event.get("channel")

                # Process as natural language query
                query_result = await self._process_natural_language_query(text, user)

                if query_result:
                    await self._send_query_result(channel, query_result)
                else:
                    await self._send_help_message(channel)

        except Exception as e:
            self.logger.error(f"Error handling direct message: {e}")

    async def _handle_interactive_component(self, payload: Dict):
        """Handle interactive component interactions"""
        try:
            action_type = payload.get("type")

            if action_type == "block_actions":
                actions = payload.get("actions", [])
                for action in actions:
                    if action.get("action_id") == "approve_query":
                        await self._handle_query_approval(payload, action)
                    elif action.get("action_id") == "execute_query":
                        await self._handle_query_execution(payload, action)
                    elif action.get("action_id") == "view_details":
                        await self._handle_view_details(payload, action)

        except Exception as e:
            self.logger.error(f"Error handling interactive component: {e}")

    async def _handle_slash_command(self, payload: Dict):
        """Handle slash commands"""
        try:
            command = payload.get("command")
            text = payload.get("text", "")
            user_id = payload.get("user_id")
            channel_id = payload.get("channel_id")

            if command == "/db-status":
                await self._send_database_status(channel_id, user_id)
            elif command == "/db-query":
                await self._handle_slash_query(channel_id, text, user_id)
            elif command == "/db-help":
                await self._send_help_message(channel_id)

        except Exception as e:
            self.logger.error(f"Error handling slash command: {e}")

    # Event handlers for database events
    async def handle_event(self, event: IntegrationEvent):
        """Handle database events and send appropriate Slack notifications"""
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

    @rate_limit(50)  # 50 calls per minute
    @retry(max_attempts=3)
    async def _send_message(self, channel: str, blocks: List[Dict] = None, text: str = None,
                           thread_ts: str = None, ephemeral_user: str = None) -> Dict:
        """Send message to Slack with rate limiting and retry"""
        try:
            kwargs = {
                "channel": channel,
                "blocks": blocks,
                "text": text or "Database Manager Notification"
            }

            if thread_ts and self.enable_threading:
                kwargs["thread_ts"] = thread_ts

            if ephemeral_user:
                kwargs["user"] = ephemeral_user
                response = await self.web_client.chat_postEphemeral(**kwargs)
            else:
                response = await self.web_client.chat_postMessage(**kwargs)

            return response

        except Exception as e:
            self.logger.error(f"Failed to send Slack message: {e}")
            raise

    async def _notify_connection_failure(self, event: IntegrationEvent):
        """Notify about database connection failures"""
        severity_emoji = "🔴" if event.severity == "critical" else "🟡"

        blocks = [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": f"{severity_emoji} Database Connection Failed"
                }
            },
            {
                "type": "section",
                "fields": [
                    {
                        "type": "mrkdwn",
                        "text": f"*Database:* {event.data.get('database', 'Unknown')}"
                    },
                    {
                        "type": "mrkdwn",
                        "text": f"*Host:* {event.data.get('host', 'Unknown')}"
                    },
                    {
                        "type": "mrkdwn",
                        "text": f"*Error:* {event.data.get('error', 'Unknown error')}"
                    },
                    {
                        "type": "mrkdwn",
                        "text": f"*Time:* {event.timestamp.strftime('%Y-%m-%d %H:%M:%S')}"
                    }
                ]
            }
        ]

        if self.enable_interactive_queries:
            blocks.append({
                "type": "actions",
                "elements": [
                    {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": "Test Connection"
                        },
                        "action_id": "test_connection",
                        "value": json.dumps(event.data)
                    },
                    {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": "View Details"
                        },
                        "action_id": "view_details",
                        "value": json.dumps(event.data)
                    }
                ]
            })

        await self._send_message(self.alerts_channel, blocks=blocks)

    async def _notify_performance_alert(self, event: IntegrationEvent):
        """Notify about database performance issues"""
        alert_data = event.data
        severity_color = {
            "info": "#36a64f",
            "warning": "#ff9500",
            "error": "#ff0000",
            "critical": "#8b0000"
        }.get(event.severity, "#36a64f")

        blocks = [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": f"⚡ Performance Alert - {event.severity.upper()}"
                }
            },
            {
                "type": "section",
                "fields": [
                    {
                        "type": "mrkdwn",
                        "text": f"*Metric:* {alert_data.get('metric', 'Unknown')}"
                    },
                    {
                        "type": "mrkdwn",
                        "text": f"*Current Value:* {alert_data.get('current_value', 'N/A')}"
                    },
                    {
                        "type": "mrkdwn",
                        "text": f"*Threshold:* {alert_data.get('threshold', 'N/A')}"
                    },
                    {
                        "type": "mrkdwn",
                        "text": f"*Database:* {alert_data.get('database', 'Unknown')}"
                    }
                ]
            }
        ]

        # Add chart if available
        if alert_data.get('chart_url'):
            blocks.append({
                "type": "image",
                "title": {
                    "type": "plain_text",
                    "text": "Performance Chart"
                },
                "image_url": alert_data['chart_url'],
                "alt_text": "Performance metrics chart"
            })

        await self._send_message(self.alerts_channel, blocks=blocks)

    async def _notify_security_incident(self, event: IntegrationEvent):
        """Notify about security incidents"""
        incident_data = event.data

        blocks = [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": "🚨 SECURITY INCIDENT DETECTED"
                }
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*Incident Type:* {incident_data.get('incident_type', 'Unknown')}\n*Severity:* {event.severity.upper()}\n*Description:* {incident_data.get('description', 'No description available')}"
                }
            },
            {
                "type": "section",
                "fields": [
                    {
                        "type": "mrkdwn",
                        "text": f"*User:* {incident_data.get('user', 'Unknown')}"
                    },
                    {
                        "type": "mrkdwn",
                        "text": f"*IP Address:* {incident_data.get('ip_address', 'Unknown')}"
                    },
                    {
                        "type": "mrkdwn",
                        "text": f"*Database:* {incident_data.get('database', 'Unknown')}"
                    },
                    {
                        "type": "mrkdwn",
                        "text": f"*Time:* {event.timestamp.strftime('%Y-%m-%d %H:%M:%S')}"
                    }
                ]
            }
        ]

        if self.enable_approval_workflows:
            blocks.append({
                "type": "actions",
                "elements": [
                    {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": "Investigate"
                        },
                        "style": "danger",
                        "action_id": "investigate_incident",
                        "value": json.dumps(incident_data)
                    },
                    {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": "False Positive"
                        },
                        "action_id": "mark_false_positive",
                        "value": json.dumps(incident_data)
                    }
                ]
            })

        await self._send_message(self.incidents_channel, blocks=blocks)

    async def _send_query_result(self, channel: str, query_result: Dict, thread_ts: str = None):
        """Send query results with rich formatting"""
        try:
            query = query_result.get('query', '')
            results = query_result.get('results', [])
            execution_time = query_result.get('execution_time', 0)
            row_count = len(results)

            blocks = [
                {
                    "type": "header",
                    "text": {
                        "type": "plain_text",
                        "text": "📊 Query Results"
                    }
                },
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": f"```sql\n{query}\n```"
                    }
                },
                {
                    "type": "section",
                    "fields": [
                        {
                            "type": "mrkdwn",
                            "text": f"*Rows:* {row_count}"
                        },
                        {
                            "type": "mrkdwn",
                            "text": f"*Execution Time:* {execution_time:.2f}ms"
                        }
                    ]
                }
            ]

            # Add preview of results
            if results and len(results) > 0:
                preview_rows = results[:5]  # Show first 5 rows

                if isinstance(preview_rows[0], dict):
                    # Format as table
                    headers = list(preview_rows[0].keys())
                    table_text = "```\n"

                    # Headers
                    table_text += " | ".join(f"{h:<15}" for h in headers) + "\n"
                    table_text += "-" * (len(headers) * 17) + "\n"

                    # Rows
                    for row in preview_rows:
                        values = [str(row.get(h, ''))[:15] for h in headers]
                        table_text += " | ".join(f"{v:<15}" for v in values) + "\n"

                    if row_count > 5:
                        table_text += f"... and {row_count - 5} more rows\n"

                    table_text += "```"

                    blocks.append({
                        "type": "section",
                        "text": {
                            "type": "mrkdwn",
                            "text": table_text
                        }
                    })

            # Add action buttons
            if self.enable_interactive_queries:
                blocks.append({
                    "type": "actions",
                    "elements": [
                        {
                            "type": "button",
                            "text": {
                                "type": "plain_text",
                                "text": "Export CSV"
                            },
                            "action_id": "export_csv",
                            "value": json.dumps(query_result)
                        },
                        {
                            "type": "button",
                            "text": {
                                "type": "plain_text",
                                "text": "Create Chart"
                            },
                            "action_id": "create_chart",
                            "value": json.dumps(query_result)
                        }
                    ]
                })

            await self._send_message(channel, blocks=blocks, thread_ts=thread_ts)

        except Exception as e:
            self.logger.error(f"Error sending query result: {e}")

    async def _setup_channels(self):
        """Set up required Slack channels"""
        try:
            channels_to_create = [
                (self.alerts_channel, "Database alerts and notifications"),
                (self.reports_channel, "Automated database reports"),
                (self.incidents_channel, "Security incidents and issues"),
                (self.general_channel, "General database discussions")
            ]

            for channel_name, purpose in channels_to_create:
                # Remove # if present
                clean_name = channel_name.lstrip('#')

                try:
                    # Try to create the channel
                    response = await self.web_client.conversations_create(
                        name=clean_name,
                        is_private=False
                    )

                    if response["ok"]:
                        # Set channel purpose
                        await self.web_client.conversations_setPurpose(
                            channel=response["channel"]["id"],
                            purpose=purpose
                        )
                        self.logger.info(f"Created Slack channel: #{clean_name}")

                except Exception as e:
                    # Channel might already exist
                    if "name_taken" not in str(e):
                        self.logger.warning(f"Could not create channel #{clean_name}: {e}")

        except Exception as e:
            self.logger.error(f"Error setting up channels: {e}")

    async def _send_startup_notification(self):
        """Send startup notification"""
        try:
            blocks = [
                {
                    "type": "header",
                    "text": {
                        "type": "plain_text",
                        "text": "🚀 Database Manager Online"
                    }
                },
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": f"Ultimate Database Manager is now connected to *{self.workspace_info.team_name}*"
                    }
                },
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": "Available commands:\n• `/db-status` - Check database health\n• `/db-query <sql>` - Execute SQL queries\n• `/db-help` - Show help\n• Mention @Database Manager for natural language queries"
                    }
                }
            ]

            await self._send_message(self.general_channel, blocks=blocks)

        except Exception as e:
            self.logger.error(f"Error sending startup notification: {e}")

    async def _send_shutdown_notification(self):
        """Send shutdown notification"""
        try:
            await self._send_message(
                self.general_channel,
                text="🔌 Database Manager is going offline"
            )
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

    async def _send_help_message(self, channel: str, thread_ts: str = None):
        """Send help message"""
        blocks = [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": "🤖 Database Manager Help"
                }
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": "*Slash Commands:*\n• `/db-status` - Check database health\n• `/db-query <sql>` - Execute SQL queries\n• `/db-help` - Show this help"
                }
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": "*Natural Language Queries:*\nMention @Database Manager followed by your question:\n• \"How many users are active?\"\n• \"Show me sales data for last month\"\n• \"What tables contain customer data?\""
                }
            }
        ]

        await self._send_message(channel, blocks=blocks, thread_ts=thread_ts)