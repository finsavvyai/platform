"""
Notification system for Universal Dependency Platform.

Supports Slack, email, and webhook notifications for dependency alerts,
approval requests, and compliance violations.
"""

import asyncio
import json
import logging
import smtplib
from datetime import datetime
from email.mime.multipart import MimeMultipart
from email.mime.text import MimeText
from typing import Any, Dict, List, Optional
from uuid import UUID

import httpx

logger = logging.getLogger(__name__)


class NotificationService:
    """Centralized notification service for UDP."""

    def __init__(self, organization_id: UUID):
        self.organization_id = organization_id
        self.slack_webhook_url = None
        self.email_config = None
        self.webhook_endpoints = []

    async def send_vulnerability_alert(
        self,
        vulnerabilities: List[Dict[str, Any]],
        project_name: str,
        channels: List[str] = None,
    ) -> Dict[str, bool]:
        """
        Send vulnerability alert notifications.

        Args:
            vulnerabilities: List of vulnerability details
            project_name: Name of the project
            channels: List of notification channels to use

        Returns:
            Dictionary of channel success status
        """
        if channels is None:
            channels = ["slack", "email"]

        results = {}

        # Prepare message content
        message = self._prepare_vulnerability_message(vulnerabilities, project_name)

        # Send to each channel
        for channel in channels:
            try:
                if channel == "slack":
                    results["slack"] = await self._send_slack_notification(message)
                elif channel == "email":
                    results["email"] = await self._send_email_notification(
                        subject=f"🚨 Security Alert: {project_name}", message=message
                    )
                elif channel == "webhook":
                    results["webhook"] = await self._send_webhook_notification(message)
            except Exception as e:
                logger.error(f"Failed to send {channel} notification: {e}")
                results[channel] = False

        return results

    async def send_approval_request(
        self, approval_data: Dict[str, Any], channels: List[str] = None
    ) -> Dict[str, bool]:
        """
        Send approval request notifications.

        Args:
            approval_data: Approval request details
            channels: List of notification channels to use

        Returns:
            Dictionary of channel success status
        """
        if channels is None:
            channels = ["slack", "email"]

        results = {}

        # Prepare message content
        message = self._prepare_approval_message(approval_data)

        # Send to each channel
        for channel in channels:
            try:
                if channel == "slack":
                    results["slack"] = await self._send_slack_notification(message)
                elif channel == "email":
                    results["email"] = await self._send_email_notification(
                        subject=f"📋 Approval Request: {approval_data.get('package_name', 'Unknown')}",
                        message=message,
                    )
                elif channel == "webhook":
                    results["webhook"] = await self._send_webhook_notification(message)
            except Exception as e:
                logger.error(f"Failed to send {channel} notification: {e}")
                results[channel] = False

        return results

    async def send_compliance_report(
        self, compliance_data: Dict[str, Any], channels: List[str] = None
    ) -> Dict[str, bool]:
        """
        Send compliance report notifications.

        Args:
            compliance_data: Compliance report details
            channels: List of notification channels to use

        Returns:
            Dictionary of channel success status
        """
        if channels is None:
            channels = ["email"]

        results = {}

        # Prepare message content
        message = self._prepare_compliance_message(compliance_data)

        # Send to each channel
        for channel in channels:
            try:
                if channel == "slack":
                    results["slack"] = await self._send_slack_notification(message)
                elif channel == "email":
                    results["email"] = await self._send_email_notification(
                        subject="📊 Monthly Compliance Report", message=message
                    )
                elif channel == "webhook":
                    results["webhook"] = await self._send_webhook_notification(message)
            except Exception as e:
                logger.error(f"Failed to send {channel} notification: {e}")
                results[channel] = False

        return results

    def _prepare_vulnerability_message(
        self, vulnerabilities: List[Dict[str, Any]], project_name: str
    ) -> str:
        """Prepare vulnerability alert message."""
        critical_count = len(
            [v for v in vulnerabilities if v.get("severity") == "critical"]
        )
        high_count = len([v for v in vulnerabilities if v.get("severity") == "high"])

        message = f"""🚨 **Security Alert: {project_name}**

**Summary:**
- Total vulnerabilities: {len(vulnerabilities)}
- Critical: {critical_count}
- High: {high_count}

**Top Vulnerabilities:**
"""

        # Add top 5 vulnerabilities
        for vuln in vulnerabilities[:5]:
            severity_emoji = {
                "critical": "🔴",
                "high": "🟠",
                "medium": "🟡",
                "low": "🟢",
            }.get(vuln.get("severity", "unknown"), "⚪")

            message += f"{severity_emoji} **{vuln.get('package_name', 'Unknown')}@{vuln.get('package_version', 'Unknown')}**\n"
            message += f"   - CVE: {vuln.get('cve_id', 'N/A')}\n"
            message += f"   - Severity: {vuln.get('severity', 'Unknown').upper()}\n"
            message += f"   - Description: {vuln.get('description', 'No description')[:100]}...\n\n"

        if len(vulnerabilities) > 5:
            message += f"... and {len(vulnerabilities) - 5} more vulnerabilities\n"

        message += f"\n**Action Required:** Please review and update vulnerable dependencies.\n"
        message += f"*Generated by Universal Dependency Platform at {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC*"

        return message

    def _prepare_approval_message(self, approval_data: Dict[str, Any]) -> str:
        """Prepare approval request message."""
        message = f"""📋 **Approval Request**

**Package:** {approval_data.get("package_name", "Unknown")}@{approval_data.get("package_version", "Unknown")}
**Request Type:** {approval_data.get("request_type", "Unknown")}
**Requester:** {approval_data.get("requester_name", "Unknown")}
**Reason:** {approval_data.get("reason", "No reason provided")}

**Request Details:**
- Organization: {approval_data.get("organization_name", "Unknown")}
- Project: {approval_data.get("project_name", "Unknown")}
- Requested: {approval_data.get("requested_at", "Unknown")}

**Next Steps:**
Please review and approve/reject this request in the UDP dashboard.

*Generated by Universal Dependency Platform at {datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")} UTC*"""

        return message

    def _prepare_compliance_message(self, compliance_data: Dict[str, Any]) -> str:
        """Prepare compliance report message."""
        message = f"""📊 **Compliance Report**

**Period:** {compliance_data.get("period", "Unknown")}
**Organization:** {compliance_data.get("organization_name", "Unknown")}

**Summary:**
- Total packages scanned: {compliance_data.get("total_packages", 0)}
- Policy violations: {compliance_data.get("policy_violations", 0)}
- License violations: {compliance_data.get("license_violations", 0)}
- Security vulnerabilities: {compliance_data.get("security_violations", 0)}

**Compliance Status:** {compliance_data.get("compliance_status", "Unknown")}

**Top Issues:**
"""

        # Add top issues
        for issue in compliance_data.get("top_issues", [])[:5]:
            message += f"- {issue.get('type', 'Unknown')}: {issue.get('description', 'No description')}\n"

        message += f"\n**Recommendations:**\n"
        message += "- Review and address policy violations\n"
        message += "- Update vulnerable dependencies\n"
        message += "- Ensure license compliance\n\n"
        message += f"*Generated by Universal Dependency Platform at {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC*"

        return message

    async def _send_slack_notification(self, message: str) -> bool:
        """Send notification to Slack."""
        if not self.slack_webhook_url:
            logger.warning("Slack webhook URL not configured")
            return False

        try:
            payload = {"text": message, "username": "UDP Bot", "icon_emoji": ":shield:"}

            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self.slack_webhook_url, json=payload, timeout=10.0
                )

                if response.status_code == 200:
                    logger.info("Slack notification sent successfully")
                    return True
                else:
                    logger.error(f"Slack notification failed: {response.status_code}")
                    return False

        except Exception as e:
            logger.error(f"Failed to send Slack notification: {e}")
            return False

    async def _send_email_notification(self, subject: str, message: str) -> bool:
        """Send email notification."""
        if not self.email_config:
            logger.warning("Email configuration not set")
            return False

        try:
            # Create message
            msg = MimeMultipart()
            msg["From"] = self.email_config["from_email"]
            msg["To"] = ", ".join(self.email_config["to_emails"])
            msg["Subject"] = subject

            # Add body
            msg.attach(MimeText(message, "html"))

            # Send email
            with smtplib.SMTP(
                self.email_config["smtp_host"], self.email_config["smtp_port"]
            ) as server:
                if self.email_config.get("use_tls"):
                    server.starttls()

                if self.email_config.get("username"):
                    server.login(
                        self.email_config["username"], self.email_config["password"]
                    )

                server.send_message(msg)

            logger.info("Email notification sent successfully")
            return True

        except Exception as e:
            logger.error(f"Failed to send email notification: {e}")
            return False

    async def _send_webhook_notification(self, message: str) -> bool:
        """Send webhook notification."""
        if not self.webhook_endpoints:
            logger.warning("No webhook endpoints configured")
            return False

        results = []

        for endpoint in self.webhook_endpoints:
            try:
                payload = {
                    "message": message,
                    "timestamp": datetime.utcnow().isoformat(),
                    "organization_id": str(self.organization_id),
                    "source": "udp",
                }

                async with httpx.AsyncClient() as client:
                    response = await client.post(
                        endpoint["url"],
                        json=payload,
                        headers=endpoint.get("headers", {}),
                        timeout=10.0,
                    )

                    if response.status_code in [200, 201, 202]:
                        logger.info(f"Webhook notification sent to {endpoint['url']}")
                        results.append(True)
                    else:
                        logger.error(
                            f"Webhook notification failed to {endpoint['url']}: {response.status_code}"
                        )
                        results.append(False)

            except Exception as e:
                logger.error(f"Failed to send webhook to {endpoint['url']}: {e}")
                results.append(False)

        return all(results)

    def configure_slack(self, webhook_url: str) -> None:
        """Configure Slack webhook."""
        self.slack_webhook_url = webhook_url
        logger.info("Slack webhook configured")

    def configure_email(
        self,
        smtp_host: str,
        smtp_port: int,
        from_email: str,
        to_emails: List[str],
        username: str = None,
        password: str = None,
        use_tls: bool = True,
    ) -> None:
        """Configure email notifications."""
        self.email_config = {
            "smtp_host": smtp_host,
            "smtp_port": smtp_port,
            "from_email": from_email,
            "to_emails": to_emails,
            "username": username,
            "password": password,
            "use_tls": use_tls,
        }
        logger.info("Email configuration set")

    def configure_webhook(self, url: str, headers: Dict[str, str] = None) -> None:
        """Configure webhook endpoint."""
        self.webhook_endpoints.append({"url": url, "headers": headers or {}})
        logger.info(f"Webhook endpoint configured: {url}")

    async def send_test_notification(self, channel: str = "slack") -> bool:
        """Send test notification to verify configuration."""
        test_message = f"""🧪 **Test Notification**

This is a test message from Universal Dependency Platform.

**Configuration:**
- Organization: {self.organization_id}
- Channel: {channel}
- Timestamp: {datetime.utcnow().isoformat()}

If you receive this message, your notification configuration is working correctly!"""

        if channel == "slack":
            return await self._send_slack_notification(test_message)
        elif channel == "email":
            return await self._send_email_notification(
                subject="🧪 UDP Test Notification", message=test_message
            )
        elif channel == "webhook":
            return await self._send_webhook_notification(test_message)
        else:
            logger.error(f"Unknown notification channel: {channel}")
            return False
