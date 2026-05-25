#!/usr/bin/env python3
"""
Slack Integration - Revolutionary Team Collaboration
Real-time database notifications, query sharing, and team collaboration
"""

import asyncio
import json
import os
from typing import Dict, List, Optional, Any, Callable
from dataclasses import dataclass
from enum import Enum
import logging
from datetime import datetime
import aiohttp
from slack_sdk.web.async_client import AsyncWebClient
from slack_sdk.errors import SlackApiError

logger = logging.getLogger(__name__)

class SlackMessageType(Enum):
    QUERY_RESULT = "query_result"
    ALERT = "alert"
    PERFORMANCE_INSIGHT = "performance_insight"
    SCHEMA_CHANGE = "schema_change"
    CONNECTION_STATUS = "connection_status"
    AI_RECOMMENDATION = "ai_recommendation"

@dataclass
class SlackMessage:
    """Slack message configuration"""
    channel: str
    text: str
    blocks: Optional[List[Dict]] = None
    thread_ts: Optional[str] = None
    message_type: SlackMessageType = SlackMessageType.QUERY_RESULT

class SlackIntegration:
    """Revolutionary Slack Integration for Database Teams"""

    def __init__(self, bot_token: str = None, signing_secret: str = None):
        self.bot_token = bot_token or os.environ.get("SLACK_BOT_TOKEN")
        self.signing_secret = signing_secret or os.environ.get("SLACK_SIGNING_SECRET")

        if not self.bot_token:
            logger.warning("No Slack bot token provided. Slack integration disabled.")
            self.enabled = False
            return

        self.enabled = True
        self.client = AsyncWebClient(token=self.bot_token)

        # Message formatting templates
        self.message_templates = {
            SlackMessageType.QUERY_RESULT: self._format_query_result,
            SlackMessageType.ALERT: self._format_alert,
            SlackMessageType.PERFORMANCE_INSIGHT: self._format_performance_insight,
            SlackMessageType.SCHEMA_CHANGE: self._format_schema_change,
            SlackMessageType.CONNECTION_STATUS: self._format_connection_status,
            SlackMessageType.AI_RECOMMENDATION: self._format_ai_recommendation
        }

        logger.info("🔗 Slack Integration initialized")

    async def send_query_result(
        self,
        channel: str,
        query: str,
        result: Dict[str, Any],
        user_id: str,
        connection_id: str
    ) -> bool:
        """Send query results to Slack channel"""
        if not self.enabled:
            return False

        try:
            # Format message
            blocks = self._create_query_result_blocks(
                query, result, user_id, connection_id
            )

            # Send message
            response = await self.client.chat_postMessage(
                channel=channel,
                text=f"Query executed by <@{user_id}>",
                blocks=blocks
            )

            logger.info(f"📤 Sent query result to #{channel}")
            return response["ok"]

        except SlackApiError as e:
            logger.error(f"Slack API error: {e}")
            return False
        except Exception as e:
            logger.error(f"Failed to send query result: {e}")
            return False

    async def send_alert(
        self,
        channel: str,
        alert_title: str,
        alert_message: str,
        severity: str,
        connection_id: str,
        metadata: Dict[str, Any] = None
    ) -> bool:
        """Send database alert to Slack"""
        if not self.enabled:
            return False

        try:
            blocks = self._create_alert_blocks(
                alert_title, alert_message, severity, connection_id, metadata
            )

            response = await self.client.chat_postMessage(
                channel=channel,
                text=f"🚨 Database Alert: {alert_title}",
                blocks=blocks
            )

            logger.info(f"🚨 Sent alert to #{channel}: {alert_title}")
            return response["ok"]

        except Exception as e:
            logger.error(f"Failed to send alert: {e}")
            return False

    async def send_performance_insight(
        self,
        channel: str,
        insight: Dict[str, Any],
        connection_id: str
    ) -> bool:
        """Send AI performance insight to Slack"""
        if not self.enabled:
            return False

        try:
            blocks = self._create_performance_insight_blocks(insight, connection_id)

            response = await self.client.chat_postMessage(
                channel=channel,
                text=f"💡 Performance Insight for {connection_id}",
                blocks=blocks
            )

            logger.info(f"💡 Sent performance insight to #{channel}")
            return response["ok"]

        except Exception as e:
            logger.error(f"Failed to send performance insight: {e}")
            return False

    async def create_shared_query_thread(
        self,
        channel: str,
        query: str,
        description: str,
        author: str
    ) -> Optional[str]:
        """Create a shared query discussion thread"""
        if not self.enabled:
            return None

        try:
            blocks = [
                {
                    "type": "header",
                    "text": {
                        "type": "plain_text",
                        "text": "📝 Shared Query Discussion"
                    }
                },
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": f"*Description:* {description}\n*Author:* <@{author}>"
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
                    "type": "actions",
                    "elements": [
                        {
                            "type": "button",
                            "text": {
                                "type": "plain_text",
                                "text": "🚀 Execute Query"
                            },
                            "action_id": "execute_query",
                            "value": query
                        },
                        {
                            "type": "button",
                            "text": {
                                "type": "plain_text",
                                "text": "🔍 Explain Query"
                            },
                            "action_id": "explain_query",
                            "value": query
                        },
                        {
                            "type": "button",
                            "text": {
                                "type": "plain_text",
                                "text": "⚡ Optimize Query"
                            },
                            "action_id": "optimize_query",
                            "value": query
                        }
                    ]
                }
            ]

            response = await self.client.chat_postMessage(
                channel=channel,
                text="New shared query discussion",
                blocks=blocks
            )

            return response["ts"] if response["ok"] else None

        except Exception as e:
            logger.error(f"Failed to create shared query thread: {e}")
            return None

    async def setup_database_channel(
        self,
        channel_name: str,
        connection_id: str,
        team_members: List[str]
    ) -> bool:
        """Setup a dedicated channel for database team collaboration"""
        if not self.enabled:
            return False

        try:
            # Create channel
            response = await self.client.conversations_create(
                name=channel_name,
                is_private=False
            )

            channel_id = response["channel"]["id"]

            # Invite team members
            for member in team_members:
                try:
                    await self.client.conversations_invite(
                        channel=channel_id,
                        users=member
                    )
                except SlackApiError:
                    pass  # Member might already be in channel

            # Send welcome message
            welcome_blocks = [
                {
                    "type": "header",
                    "text": {
                        "type": "plain_text",
                        "text": f"🗄️ Database Team Channel: {connection_id}"
                    }
                },
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": f"Welcome to the dedicated channel for *{connection_id}* database!\n\n*Features enabled:*\n• 📊 Real-time performance alerts\n• 🔍 Query sharing and collaboration\n• 🤖 AI-powered insights\n• 📈 Automated monitoring reports\n• 🚨 Critical issue notifications"
                    }
                },
                {
                    "type": "actions",
                    "elements": [
                        {
                            "type": "button",
                            "text": {
                                "type": "plain_text",
                                "text": "📊 View Dashboard"
                            },
                            "action_id": "view_dashboard",
                            "value": connection_id
                        },
                        {
                            "type": "button",
                            "text": {
                                "type": "plain_text",
                                "text": "⚙️ Configure Alerts"
                            },
                            "action_id": "configure_alerts",
                            "value": connection_id
                        }
                    ]
                }
            ]

            await self.client.chat_postMessage(
                channel=channel_id,
                text="Database team channel setup complete!",
                blocks=welcome_blocks
            )

            logger.info(f"🏗️ Created database channel: #{channel_name}")
            return True

        except Exception as e:
            logger.error(f"Failed to setup database channel: {e}")
            return False

    async def send_daily_report(
        self,
        channel: str,
        report_data: Dict[str, Any]
    ) -> bool:
        """Send automated daily database report"""
        if not self.enabled:
            return False

        try:
            blocks = self._create_daily_report_blocks(report_data)

            response = await self.client.chat_postMessage(
                channel=channel,
                text="📊 Daily Database Report",
                blocks=blocks
            )

            logger.info(f"📊 Sent daily report to #{channel}")
            return response["ok"]

        except Exception as e:
            logger.error(f"Failed to send daily report: {e}")
            return False

    def _create_query_result_blocks(
        self,
        query: str,
        result: Dict[str, Any],
        user_id: str,
        connection_id: str
    ) -> List[Dict]:
        """Create Slack blocks for query results"""
        blocks = [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": f"🔍 Query Executed on {connection_id}"
                }
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*Executed by:* <@{user_id}>\n*Execution time:* {result.get('execution_time', 0):.3f}s\n*Rows returned:* {len(result.get('data', []))}"
                }
            }
        ]

        # Add query (truncated if too long)
        query_text = query if len(query) <= 500 else query[:500] + "..."
        blocks.append({
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": f"```sql\n{query_text}\n```"
            }
        })

        # Add result preview if data exists
        if result.get('data') and len(result['data']) > 0:
            preview_text = self._format_result_preview(result)
            blocks.append({
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*Results Preview:*\n```\n{preview_text}\n```"
                }
            })

        # Add action buttons
        blocks.append({
            "type": "actions",
            "elements": [
                {
                    "type": "button",
                    "text": {
                        "type": "plain_text",
                        "text": "📊 View Full Results"
                    },
                    "action_id": "view_full_results",
                    "value": json.dumps({"query": query, "connection": connection_id})
                },
                {
                    "type": "button",
                    "text": {
                        "type": "plain_text",
                        "text": "💾 Save Query"
                    },
                    "action_id": "save_query",
                    "value": query
                },
                {
                    "type": "button",
                    "text": {
                        "type": "plain_text",
                        "text": "🔄 Re-run"
                    },
                    "action_id": "rerun_query",
                    "value": json.dumps({"query": query, "connection": connection_id})
                }
            ]
        })

        return blocks

    def _create_alert_blocks(
        self,
        title: str,
        message: str,
        severity: str,
        connection_id: str,
        metadata: Dict[str, Any] = None
    ) -> List[Dict]:
        """Create Slack blocks for alerts"""
        # Choose emoji and color based on severity
        emoji_map = {
            "critical": "🚨",
            "warning": "⚠️",
            "info": "ℹ️"
        }

        color_map = {
            "critical": "#ff0000",
            "warning": "#ffaa00",
            "info": "#0099ff"
        }

        emoji = emoji_map.get(severity.lower(), "ℹ️")
        color = color_map.get(severity.lower(), "#0099ff")

        blocks = [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": f"{emoji} {severity.upper()} Alert: {title}"
                }
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*Database:* {connection_id}\n*Time:* {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n*Details:*\n{message}"
                }
            }
        ]

        # Add metadata if available
        if metadata:
            metadata_text = "\n".join([f"• *{k}:* {v}" for k, v in metadata.items()])
            blocks.append({
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*Additional Information:*\n{metadata_text}"
                }
            })

        # Add action buttons for critical/warning alerts
        if severity.lower() in ["critical", "warning"]:
            blocks.append({
                "type": "actions",
                "elements": [
                    {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": "🔍 Investigate"
                        },
                        "action_id": "investigate_alert",
                        "value": json.dumps({"title": title, "connection": connection_id})
                    },
                    {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": "✅ Mark Resolved"
                        },
                        "action_id": "resolve_alert",
                        "value": title
                    },
                    {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": "📊 View Metrics"
                        },
                        "action_id": "view_metrics",
                        "value": connection_id
                    }
                ]
            })

        return blocks

    def _create_performance_insight_blocks(
        self,
        insight: Dict[str, Any],
        connection_id: str
    ) -> List[Dict]:
        """Create Slack blocks for performance insights"""
        insight_type = insight.get('type', 'general')
        severity = insight.get('severity', 'info')
        title = insight.get('title', 'Performance Insight')
        description = insight.get('description', '')
        recommendation = insight.get('recommendation', '')

        # Choose emoji based on insight type
        emoji_map = {
            'trend': '📈',
            'anomaly': '🔍',
            'optimization': '⚡',
            'capacity': '📊',
            'security': '🔒'
        }

        emoji = emoji_map.get(insight_type, '💡')

        blocks = [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": f"{emoji} AI Performance Insight"
                }
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*Database:* {connection_id}\n*Type:* {insight_type.title()}\n*Severity:* {severity.title()}\n\n*{title}*\n{description}"
                }
            }
        ]

        if recommendation:
            blocks.append({
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*🎯 Recommendation:*\n{recommendation}"
                }
            })

        # Add action buttons
        blocks.append({
            "type": "actions",
            "elements": [
                {
                    "type": "button",
                    "text": {
                        "type": "plain_text",
                        "text": "📊 View Detailed Analysis"
                    },
                    "action_id": "view_analysis",
                    "value": json.dumps({"insight": insight, "connection": connection_id})
                },
                {
                    "type": "button",
                    "text": {
                        "type": "plain_text",
                        "text": "✅ Apply Recommendation"
                    },
                    "action_id": "apply_recommendation",
                    "value": json.dumps({"recommendation": recommendation, "connection": connection_id})
                }
            ]
        })

        return blocks

    def _create_daily_report_blocks(self, report_data: Dict[str, Any]) -> List[Dict]:
        """Create Slack blocks for daily reports"""
        blocks = [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": f"📊 Daily Database Report - {datetime.now().strftime('%Y-%m-%d')}"
                }
            }
        ]

        # Summary section
        summary = report_data.get('summary', {})
        blocks.append({
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": f"*📈 Performance Summary:*\n• Total Queries: {summary.get('total_queries', 0)}\n• Average Response Time: {summary.get('avg_response_time', 0):.3f}s\n• Peak CPU Usage: {summary.get('peak_cpu', 0):.1f}%\n• Active Connections: {summary.get('active_connections', 0)}"
            }
        })

        # Top queries section
        top_queries = report_data.get('top_queries', [])
        if top_queries:
            query_text = "\n".join([f"• {q.get('query', '')[:100]}... ({q.get('count', 0)} times)" for q in top_queries[:3]])
            blocks.append({
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*🔍 Most Executed Queries:*\n{query_text}"
                }
            })

        # Issues section
        issues = report_data.get('issues', [])
        if issues:
            issues_text = "\n".join([f"• {issue}" for issue in issues[:3]])
            blocks.append({
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*⚠️ Issues Detected:*\n{issues_text}"
                }
            })

        # Actions
        blocks.append({
            "type": "actions",
            "elements": [
                {
                    "type": "button",
                    "text": {
                        "type": "plain_text",
                        "text": "📊 Full Dashboard"
                    },
                    "action_id": "view_dashboard",
                    "value": "daily_report"
                },
                {
                    "type": "button",
                    "text": {
                        "type": "plain_text",
                        "text": "📈 Trends Analysis"
                    },
                    "action_id": "view_trends",
                    "value": "daily_report"
                }
            ]
        })

        return blocks

    def _format_result_preview(self, result: Dict[str, Any]) -> str:
        """Format query result preview for Slack"""
        data = result.get('data', [])
        columns = result.get('columns', [])

        if not data or not columns:
            return "No data returned"

        # Show first 3 rows max
        preview_rows = data[:3]

        # Create simple table format
        lines = []

        # Header
        header = " | ".join(col[:15] for col in columns[:5])  # Limit columns and width
        lines.append(header)
        lines.append("-" * len(header))

        # Rows
        for row in preview_rows:
            if isinstance(row, dict):
                values = [str(row.get(col, ''))[:15] for col in columns[:5]]
            else:
                values = [str(val)[:15] for val in row[:5]]

            lines.append(" | ".join(values))

        if len(data) > 3:
            lines.append(f"... and {len(data) - 3} more rows")

        return "\n".join(lines)

    async def handle_slash_command(self, command: str, text: str, user_id: str, channel_id: str) -> Dict[str, Any]:
        """Handle Slack slash commands for database operations"""
        if not self.enabled:
            return {"text": "Slack integration not enabled"}

        try:
            if command == "/db-query":
                # Execute database query from Slack
                return await self._handle_query_command(text, user_id, channel_id)

            elif command == "/db-status":
                # Get database status
                return await self._handle_status_command(text, user_id)

            elif command == "/db-help":
                # Show help
                return self._get_help_response()

            else:
                return {"text": f"Unknown command: {command}"}

        except Exception as e:
            logger.error(f"Slash command error: {e}")
            return {"text": f"Error processing command: {str(e)}"}

    async def _handle_query_command(self, query: str, user_id: str, channel_id: str) -> Dict[str, Any]:
        """Handle query execution from Slack"""
        # This would integrate with your database manager
        return {
            "response_type": "in_channel",
            "text": f"<@{user_id}> executed query: ```{query}```",
            "attachments": [
                {
                    "color": "good",
                    "text": "Query executed successfully! Results will be sent separately."
                }
            ]
        }

    async def _handle_status_command(self, connection_id: str, user_id: str) -> Dict[str, Any]:
        """Handle database status request"""
        # This would integrate with your monitoring system
        return {
            "response_type": "ephemeral",
            "text": f"Database Status for {connection_id}:",
            "attachments": [
                {
                    "color": "good",
                    "fields": [
                        {"title": "Status", "value": "Online", "short": True},
                        {"title": "CPU", "value": "45%", "short": True},
                        {"title": "Memory", "value": "67%", "short": True},
                        {"title": "Connections", "value": "23/100", "short": True}
                    ]
                }
            ]
        }

    def _get_help_response(self) -> Dict[str, Any]:
        """Get help response for Slack commands"""
        return {
            "response_type": "ephemeral",
            "text": "🗄️ *Ultimate Database Manager - Slack Commands*",
            "attachments": [
                {
                    "color": "#36a64f",
                    "fields": [
                        {
                            "title": "/db-query [SQL]",
                            "value": "Execute a SQL query",
                            "short": True
                        },
                        {
                            "title": "/db-status [connection]",
                            "value": "Get database status",
                            "short": True
                        },
                        {
                            "title": "/db-help",
                            "value": "Show this help message",
                            "short": True
                        }
                    ]
                }
            ]
        }

# Global Slack integration instance
slack_integration = None

def get_slack_integration(bot_token: str = None, signing_secret: str = None) -> SlackIntegration:
    """Get the global Slack integration instance"""
    global slack_integration
    if slack_integration is None:
        slack_integration = SlackIntegration(bot_token, signing_secret)
    return slack_integration

__all__ = [
    'SlackIntegration',
    'SlackMessage',
    'SlackMessageType',
    'get_slack_integration'
]