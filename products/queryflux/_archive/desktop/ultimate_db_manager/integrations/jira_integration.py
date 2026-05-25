"""
Jira Integration for PostgreSQL Database Management
Revolutionary enterprise integration for database issue tracking and project management
"""

import asyncio
import json
import base64
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, asdict
import requests
import aiohttp
from urllib.parse import urlencode

from .base import BaseIntegration, IntegrationType, EventType, IntegrationEvent, rate_limit, retry
from ..health_monitor import HealthReport, HealthAlert


@dataclass
class JiraProject:
    """Jira project configuration"""
    key: str
    name: str
    issue_types: Dict[str, str]  # event_type -> jira_issue_type
    components: List[str] = None
    priority_mapping: Dict[str, str] = None


@dataclass
class JiraIssue:
    """Jira issue structure"""
    key: str
    summary: str
    description: str
    issue_type: str
    priority: str
    assignee: Optional[str] = None
    reporter: Optional[str] = None
    labels: List[str] = None
    components: List[str] = None
    custom_fields: Dict[str, Any] = None


@dataclass
class DatabaseMetric:
    """Database performance metric for Jira integration"""
    name: str
    current_value: float
    threshold: float
    trend: str  # increasing, decreasing, stable
    impact: str  # low, medium, high, critical


class JiraIntegration(BaseIntegration):
    """Revolutionary Jira integration for database management and issue tracking"""

    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)

        # Jira configuration
        self.base_url = config.get('base_url', '').rstrip('/')
        self.username = config.get('username')
        self.api_token = config.get('api_token')
        self.auth_header = None

        # Project configuration
        self.projects = {}
        for project_config in config.get('projects', []):
            project = JiraProject(**project_config)
            self.projects[project.key] = project

        # Issue tracking
        self.auto_create_issues = config.get('auto_create_issues', True)
        self.auto_resolve_issues = config.get('auto_resolve_issues', False)
        self.issue_cache = {}  # Cache to avoid duplicate issues

        # Performance tracking
        self.performance_tracking = config.get('performance_tracking', {})
        self.sprint_integration = config.get('sprint_integration', {})

        # Custom field mappings
        self.custom_fields = config.get('custom_fields', {})

        # Initialize authentication
        self._setup_authentication()

    def get_integration_type(self) -> IntegrationType:
        return IntegrationType.PROJECT_MANAGEMENT

    def _setup_authentication(self):
        """Setup Jira authentication"""
        if self.username and self.api_token:
            auth_string = f"{self.username}:{self.api_token}"
            encoded_auth = base64.b64encode(auth_string.encode()).decode()
            self.auth_header = f"Basic {encoded_auth}"

    async def connect(self) -> bool:
        """Connect to Jira instance"""
        try:
            # Test connection
            health = await self.health_check()
            self.is_connected = health.get('healthy', False)

            if self.is_connected:
                # Register event handlers
                self._register_event_handlers()

                # Setup webhooks
                await self._setup_webhooks()

                # Create initial sprint for database performance tracking
                await self._setup_performance_tracking()

                self.logger.info("Successfully connected to Jira")

            return self.is_connected

        except Exception as e:
            self.logger.error(f"Failed to connect to Jira: {e}")
            return False

    async def disconnect(self):
        """Disconnect from Jira"""
        try:
            # Clean up webhooks
            await self._cleanup_webhooks()

            # Update any open database issues
            await self._update_disconnect_status()

            self.is_connected = False
            self.logger.info("Disconnected from Jira")

        except Exception as e:
            self.logger.error(f"Error disconnecting from Jira: {e}")

    @retry(max_attempts=3, delay=1.0)
    async def _make_jira_request(self, method: str, endpoint: str, data: Dict = None, params: Dict = None) -> Optional[Dict]:
        """Make request to Jira REST API"""
        if not self.auth_header:
            self.logger.error("No authentication configured")
            return None

        url = f"{self.base_url}/rest/api/3{endpoint}"
        headers = {
            'Authorization': self.auth_header,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }

        try:
            async with aiohttp.ClientSession() as session:
                async with session.request(method, url, headers=headers, json=data, params=params) as response:
                    if response.status in [200, 201, 202, 204]:
                        if response.status == 204:  # No content
                            return {}
                        return await response.json()
                    else:
                        error_text = await response.text()
                        self.logger.error(f"Jira API error ({response.status}): {error_text}")
                        return None

        except Exception as e:
            self.logger.error(f"Jira API request error: {e}")
            return None

    async def health_check(self) -> Dict[str, Any]:
        """Check Jira integration health"""
        try:
            # Test API access
            result = await self._make_jira_request('GET', '/myself')
            healthy = result is not None

            # Get additional info if healthy
            info = {}
            if healthy and result:
                info = {
                    'user': result.get('displayName', 'Unknown'),
                    'account_id': result.get('accountId'),
                    'projects_configured': len(self.projects)
                }

            return {
                'healthy': healthy,
                'last_check': datetime.utcnow().isoformat(),
                'jira_url': self.base_url,
                **info
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
            await self._create_performance_issue(event)

        @self.on_event(EventType.CONNECTION_FAILED)
        async def handle_connection_failed(event: IntegrationEvent):
            await self._create_connection_issue(event)

        @self.on_event(EventType.QUERY_FAILED)
        async def handle_query_failed(event: IntegrationEvent):
            await self._create_query_issue(event)

        @self.on_event(EventType.SECURITY_INCIDENT)
        async def handle_security_incident(event: IntegrationEvent):
            await self._create_security_issue(event)

        @self.on_event(EventType.BACKUP_FAILED)
        async def handle_backup_failed(event: IntegrationEvent):
            await self._create_backup_issue(event)

        @self.on_event(EventType.SCHEMA_CHANGED)
        async def handle_schema_changed(event: IntegrationEvent):
            await self._create_schema_change_task(event)

        @self.on_event(EventType.HEALTH_CHECK)
        async def handle_health_check(event: IntegrationEvent):
            await self._update_performance_metrics(event)

    async def _create_performance_issue(self, event: IntegrationEvent):
        """Create performance-related Jira issue"""
        try:
            alert_data = event.data
            severity = event.severity

            # Check if we already have an open issue for this metric
            cache_key = f"performance_{alert_data.get('metric_name', 'unknown')}"
            if cache_key in self.issue_cache:
                # Update existing issue instead
                await self._update_existing_issue(self.issue_cache[cache_key], event)
                return

            # Determine project and issue type
            project = self._get_project_for_event('performance_alert')
            if not project:
                return

            issue_type = project.issue_types.get('performance_alert', 'Bug')
            priority = self._map_severity_to_priority(severity, project)

            # Create issue
            issue_data = {
                'fields': {
                    'project': {'key': project.key},
                    'summary': f"Database Performance Alert: {alert_data.get('metric_name', 'Unknown Metric')}",
                    'description': self._create_performance_description(alert_data, event),
                    'issuetype': {'name': issue_type},
                    'priority': {'name': priority},
                    'labels': ['database', 'performance', 'auto-generated', severity],
                }
            }

            # Add components if configured
            if project.components:
                issue_data['fields']['components'] = [{'name': comp} for comp in project.components]

            # Add custom fields
            if self.custom_fields:
                self._add_custom_fields(issue_data, event, 'performance')

            # Create the issue
            result = await self._make_jira_request('POST', '/issue', issue_data)

            if result:
                issue_key = result['key']
                self.issue_cache[cache_key] = issue_key
                self.logger.info(f"Created performance issue: {issue_key}")

                # Add performance data as attachment
                await self._attach_performance_data(issue_key, alert_data)

                # Create subtasks for recommendations
                await self._create_recommendation_subtasks(issue_key, alert_data, project)

        except Exception as e:
            self.logger.error(f"Error creating performance issue: {e}")

    async def _create_connection_issue(self, event: IntegrationEvent):
        """Create connection failure issue"""
        try:
            connection_data = event.data

            project = self._get_project_for_event('connection_failure')
            if not project:
                return

            issue_type = project.issue_types.get('connection_failure', 'Incident')
            priority = self._map_severity_to_priority('high', project)

            issue_data = {
                'fields': {
                    'project': {'key': project.key},
                    'summary': f"Database Connection Failure: {connection_data.get('host', 'Unknown Host')}",
                    'description': self._create_connection_description(connection_data, event),
                    'issuetype': {'name': issue_type},
                    'priority': {'name': priority},
                    'labels': ['database', 'connection', 'incident', 'auto-generated'],
                }
            }

            if project.components:
                issue_data['fields']['components'] = [{'name': comp} for comp in project.components]

            self._add_custom_fields(issue_data, event, 'connection')

            result = await self._make_jira_request('POST', '/issue', issue_data)

            if result:
                issue_key = result['key']
                self.logger.info(f"Created connection issue: {issue_key}")

                # Add troubleshooting steps as comments
                await self._add_troubleshooting_steps(issue_key, 'connection')

        except Exception as e:
            self.logger.error(f"Error creating connection issue: {e}")

    async def _create_query_issue(self, event: IntegrationEvent):
        """Create query failure issue"""
        try:
            query_data = event.data

            project = self._get_project_for_event('query_failure')
            if not project:
                return

            issue_type = project.issue_types.get('query_failure', 'Bug')
            priority = self._map_severity_to_priority('medium', project)

            issue_data = {
                'fields': {
                    'project': {'key': project.key},
                    'summary': f"Query Execution Failed: {query_data.get('database', 'Unknown DB')}",
                    'description': self._create_query_description(query_data, event),
                    'issuetype': {'name': issue_type},
                    'priority': {'name': priority},
                    'labels': ['database', 'query', 'error', 'auto-generated'],
                }
            }

            if project.components:
                issue_data['fields']['components'] = [{'name': comp} for comp in project.components]

            self._add_custom_fields(issue_data, event, 'query')

            result = await self._make_jira_request('POST', '/issue', issue_data)

            if result:
                issue_key = result['key']
                self.logger.info(f"Created query issue: {issue_key}")

                # Attach query and execution plan if available
                await self._attach_query_details(issue_key, query_data)

                # Add optimization suggestions
                await self._add_query_optimization_suggestions(issue_key, query_data)

        except Exception as e:
            self.logger.error(f"Error creating query issue: {e}")

    async def _create_security_issue(self, event: IntegrationEvent):
        """Create security incident issue"""
        try:
            security_data = event.data

            project = self._get_project_for_event('security_incident')
            if not project:
                return

            issue_type = project.issue_types.get('security_incident', 'Security')
            priority = self._map_severity_to_priority('critical', project)

            issue_data = {
                'fields': {
                    'project': {'key': project.key},
                    'summary': f"Security Incident: {security_data.get('incident_type', 'Unknown Type')}",
                    'description': self._create_security_description(security_data, event),
                    'issuetype': {'name': issue_type},
                    'priority': {'name': priority},
                    'labels': ['database', 'security', 'incident', 'critical', 'auto-generated'],
                }
            }

            # Set high priority security fields
            if 'security_level' in self.custom_fields:
                issue_data['fields'][self.custom_fields['security_level']] = {'value': 'High'}

            if project.components:
                issue_data['fields']['components'] = [{'name': comp} for comp in project.components]

            self._add_custom_fields(issue_data, event, 'security')

            result = await self._make_jira_request('POST', '/issue', issue_data)

            if result:
                issue_key = result['key']
                self.logger.info(f"Created security issue: {issue_key}")

                # Add incident response checklist
                await self._add_incident_response_checklist(issue_key, security_data)

                # Auto-assign to security team if configured
                await self._assign_to_security_team(issue_key)

        except Exception as e:
            self.logger.error(f"Error creating security issue: {e}")

    async def _create_backup_issue(self, event: IntegrationEvent):
        """Create backup failure issue"""
        try:
            backup_data = event.data

            project = self._get_project_for_event('backup_failure')
            if not project:
                return

            issue_type = project.issue_types.get('backup_failure', 'Task')
            priority = self._map_severity_to_priority('high', project)

            issue_data = {
                'fields': {
                    'project': {'key': project.key},
                    'summary': f"Backup Failed: {backup_data.get('database', 'Unknown DB')}",
                    'description': self._create_backup_description(backup_data, event),
                    'issuetype': {'name': issue_type},
                    'priority': {'name': priority},
                    'labels': ['database', 'backup', 'failure', 'auto-generated'],
                }
            }

            if project.components:
                issue_data['fields']['components'] = [{'name': comp} for comp in project.components]

            self._add_custom_fields(issue_data, event, 'backup')

            result = await self._make_jira_request('POST', '/issue', issue_data)

            if result:
                issue_key = result['key']
                self.logger.info(f"Created backup issue: {issue_key}")

                # Add backup recovery steps
                await self._add_backup_recovery_steps(issue_key, backup_data)

        except Exception as e:
            self.logger.error(f"Error creating backup issue: {e}")

    async def _create_schema_change_task(self, event: IntegrationEvent):
        """Create schema change tracking task"""
        try:
            schema_data = event.data

            project = self._get_project_for_event('schema_change')
            if not project:
                return

            issue_type = project.issue_types.get('schema_change', 'Task')
            priority = self._map_severity_to_priority('medium', project)

            issue_data = {
                'fields': {
                    'project': {'key': project.key},
                    'summary': f"Schema Change: {schema_data.get('change_type', 'Unknown')} on {schema_data.get('object_name', 'Unknown')}",
                    'description': self._create_schema_change_description(schema_data, event),
                    'issuetype': {'name': issue_type},
                    'priority': {'name': priority},
                    'labels': ['database', 'schema', 'change', 'tracking', 'auto-generated'],
                }
            }

            if project.components:
                issue_data['fields']['components'] = [{'name': comp} for comp in project.components]

            self._add_custom_fields(issue_data, event, 'schema_change')

            result = await self._make_jira_request('POST', '/issue', issue_data)

            if result:
                issue_key = result['key']
                self.logger.info(f"Created schema change task: {issue_key}")

                # Attach schema diff if available
                await self._attach_schema_diff(issue_key, schema_data)

                # Add review checklist
                await self._add_schema_review_checklist(issue_key, schema_data)

        except Exception as e:
            self.logger.error(f"Error creating schema change task: {e}")

    async def _update_performance_metrics(self, event: IntegrationEvent):
        """Update performance metrics in sprint planning"""
        try:
            if not self.sprint_integration.get('enabled', False):
                return

            health_data = event.data.get('health_status', {})

            # Create performance report for current sprint
            await self._update_sprint_performance_report(health_data)

            # Check if performance goals are being met
            await self._check_performance_goals(health_data)

        except Exception as e:
            self.logger.error(f"Error updating performance metrics: {e}")

    def _create_performance_description(self, alert_data: Dict, event: IntegrationEvent) -> str:
        """Create detailed description for performance issues"""
        metric_name = alert_data.get('metric_name', 'Unknown')
        current_value = alert_data.get('current_value', 'N/A')
        threshold = alert_data.get('threshold', 'N/A')
        suggestions = alert_data.get('suggestions', [])

        description = f"""
h2. Performance Alert Details

*Metric:* {metric_name}
*Current Value:* {current_value}
*Threshold:* {threshold}
*Severity:* {event.severity.upper()}
*Database:* {alert_data.get('database', 'Unknown')}
*Timestamp:* {event.timestamp.strftime('%Y-%m-%d %H:%M:%S UTC')}

h3. Impact Assessment
{self._assess_performance_impact(alert_data)}

h3. Recommended Actions
"""

        for i, suggestion in enumerate(suggestions, 1):
            description += f"{i}. {suggestion}\n"

        description += f"""

h3. Monitoring Links
* [Performance Dashboard|{self._get_dashboard_url()}/performance]
* [Metric History|{self._get_dashboard_url()}/metrics/{metric_name}]
* [Real-time Monitoring|{self._get_dashboard_url()}/realtime]

h3. Related Documentation
* [Performance Tuning Guide|{self._get_docs_url()}/performance]
* [Troubleshooting Runbook|{self._get_docs_url()}/troubleshooting]
"""

        return description

    def _create_connection_description(self, connection_data: Dict, event: IntegrationEvent) -> str:
        """Create description for connection issues"""
        return f"""
h2. Database Connection Failure

*Host:* {connection_data.get('host', 'Unknown')}
*Database:* {connection_data.get('database', 'Unknown')}
*User:* {connection_data.get('user', 'Unknown')}
*Port:* {connection_data.get('port', 'Unknown')}
*Error:* {connection_data.get('error', 'Unknown error')}
*Timestamp:* {event.timestamp.strftime('%Y-%m-%d %H:%M:%S UTC')}

h3. Immediate Actions Required
1. Verify database server status
2. Check network connectivity
3. Validate connection parameters
4. Review authentication settings

h3. Troubleshooting Steps
1. Test connection from database server
2. Check firewall rules
3. Verify PostgreSQL service status
4. Review log files for additional errors

h3. Monitoring Links
* [Connection Monitor|{self._get_dashboard_url()}/connections]
* [Server Health|{self._get_dashboard_url()}/health]
"""

    def _create_query_description(self, query_data: Dict, event: IntegrationEvent) -> str:
        """Create description for query issues"""
        query = query_data.get('query', 'Not available')
        query_snippet = query[:500] + '...' if len(query) > 500 else query

        return f"""
h2. Query Execution Failure

*Database:* {query_data.get('database', 'Unknown')}
*User:* {query_data.get('user', 'Unknown')}
*Duration:* {query_data.get('duration', 0):.2f}s
*Error:* {query_data.get('error', 'Unknown error')}
*Timestamp:* {event.timestamp.strftime('%Y-%m-%d %H:%M:%S UTC')}

h3. Query
{{code:sql}}
{query_snippet}
{{code}}

h3. Analysis Required
1. Review query execution plan
2. Check for missing indexes
3. Analyze table statistics
4. Validate query syntax and logic

h3. Optimization Opportunities
* [Query Analyzer|{self._get_dashboard_url()}/query-analyzer]
* [Index Advisor|{self._get_dashboard_url()}/index-advisor]
* [Execution Plans|{self._get_dashboard_url()}/explain]
"""

    def _create_security_description(self, security_data: Dict, event: IntegrationEvent) -> str:
        """Create description for security incidents"""
        return f"""
h1. ⚠️ SECURITY INCIDENT - IMMEDIATE ATTENTION REQUIRED

*Incident Type:* {security_data.get('incident_type', 'Unknown')}
*Severity:* {security_data.get('severity', 'Unknown')}
*Source IP:* {security_data.get('source_ip', 'Unknown')}
*User:* {security_data.get('user', 'Unknown')}
*Database:* {security_data.get('database', 'Unknown')}
*Timestamp:* {event.timestamp.strftime('%Y-%m-%d %H:%M:%S UTC')}

h2. Incident Details
{security_data.get('details', 'No additional details available')}

h2. CRITICAL ACTIONS REQUIRED
1. *ISOLATE:* Verify if incident is ongoing
2. *ASSESS:* Determine scope of potential compromise
3. *CONTAIN:* Block malicious activity if detected
4. *INVESTIGATE:* Gather forensic evidence
5. *REMEDIATE:* Fix vulnerabilities and restore systems
6. *COMMUNICATE:* Notify stakeholders per incident response plan

h2. Security Team Contacts
* Security Operations Center: [SOC Contact]
* Incident Response Team: [IR Team Contact]
* Database Security Lead: [DB Security Contact]

h2. Monitoring Links
* [Security Dashboard|{self._get_dashboard_url()}/security]
* [Audit Logs|{self._get_dashboard_url()}/audit]
* [Incident Response|{self._get_dashboard_url()}/incidents]
"""

    def _create_backup_description(self, backup_data: Dict, event: IntegrationEvent) -> str:
        """Create description for backup failures"""
        return f"""
h2. Database Backup Failure

*Database:* {backup_data.get('database', 'Unknown')}
*Backup Type:* {backup_data.get('backup_type', 'Unknown')}
*Scheduled Time:* {backup_data.get('scheduled_time', 'Unknown')}
*Error:* {backup_data.get('error', 'Unknown error')}
*Last Successful Backup:* {backup_data.get('last_successful', 'Unknown')}
*Timestamp:* {event.timestamp.strftime('%Y-%m-%d %H:%M:%S UTC')}

h3. Impact Assessment
* *Business Impact:* {self._assess_backup_impact(backup_data)}
* *Recovery Point Risk:* {self._assess_recovery_risk(backup_data)}

h3. Immediate Actions
1. Verify backup infrastructure status
2. Check available disk space
3. Review backup job configuration
4. Test backup recovery if needed

h3. Recovery Options
* [Backup Manager|{self._get_dashboard_url()}/backups]
* [Recovery Procedures|{self._get_docs_url()}/recovery]
"""

    def _create_schema_change_description(self, schema_data: Dict, event: IntegrationEvent) -> str:
        """Create description for schema changes"""
        changes = schema_data.get('changes', [])
        change_list = '\n'.join([f"* {change}" for change in changes[:10]])

        return f"""
h2. Database Schema Change Detected

*Database:* {schema_data.get('database', 'Unknown')}
*Change Type:* {schema_data.get('change_type', 'Unknown')}
*Object:* {schema_data.get('object_name', 'Unknown')}
*User:* {schema_data.get('user', 'Unknown')}
*Timestamp:* {event.timestamp.strftime('%Y-%m-%d %H:%M:%S UTC')}

h3. Changes Made
{change_list}

h3. Review Required
1. Verify change approval and documentation
2. Assess impact on dependent objects
3. Check application compatibility
4. Validate performance implications
5. Update documentation

h3. Schema Management
* [Schema Viewer|{self._get_dashboard_url()}/schema]
* [Change History|{self._get_dashboard_url()}/changes]
* [Documentation|{self._get_docs_url()}/schema]
"""

    def _get_project_for_event(self, event_type: str) -> Optional[JiraProject]:
        """Get appropriate Jira project for event type"""
        # Return the first project that handles this event type
        for project in self.projects.values():
            if event_type in project.issue_types:
                return project

        # Return the first project as fallback
        return next(iter(self.projects.values())) if self.projects else None

    def _map_severity_to_priority(self, severity: str, project: JiraProject) -> str:
        """Map event severity to Jira priority"""
        if project.priority_mapping:
            return project.priority_mapping.get(severity, 'Medium')

        # Default mapping
        mapping = {
            'critical': 'Highest',
            'high': 'High',
            'medium': 'Medium',
            'low': 'Low'
        }
        return mapping.get(severity, 'Medium')

    def _add_custom_fields(self, issue_data: Dict, event: IntegrationEvent, event_category: str):
        """Add custom fields to issue"""
        if not self.custom_fields:
            return

        fields = issue_data['fields']

        # Add database-specific custom fields
        if 'database_name' in self.custom_fields:
            fields[self.custom_fields['database_name']] = event.data.get('database', 'Unknown')

        if 'event_source' in self.custom_fields:
            fields[self.custom_fields['event_source']] = event.source

        if 'event_category' in self.custom_fields:
            fields[self.custom_fields['event_category']] = {'value': event_category}

        if 'severity_level' in self.custom_fields:
            fields[self.custom_fields['severity_level']] = {'value': event.severity}

        # Add timestamp custom field
        if 'incident_timestamp' in self.custom_fields:
            fields[self.custom_fields['incident_timestamp']] = event.timestamp.isoformat()

    async def _attach_performance_data(self, issue_key: str, alert_data: Dict):
        """Attach performance data to issue"""
        try:
            # Create performance report
            performance_report = self._generate_performance_report(alert_data)

            # Create attachment
            attachment_data = {
                'filename': f'performance_data_{datetime.utcnow().strftime("%Y%m%d_%H%M%S")}.json',
                'content': json.dumps(performance_report, indent=2)
            }

            # Note: Actual file attachment would require multipart/form-data
            # For now, add as comment
            comment_data = {
                'body': f"""Performance Data Report:

{{code:json}}
{json.dumps(performance_report, indent=2)}
{{code}}
"""
            }

            await self._make_jira_request('POST', f'/issue/{issue_key}/comment', comment_data)

        except Exception as e:
            self.logger.error(f"Error attaching performance data: {e}")

    async def _create_recommendation_subtasks(self, parent_key: str, alert_data: Dict, project: JiraProject):
        """Create subtasks for performance recommendations"""
        try:
            suggestions = alert_data.get('suggestions', [])

            for i, suggestion in enumerate(suggestions[:3], 1):  # Limit to 3 subtasks
                subtask_data = {
                    'fields': {
                        'project': {'key': project.key},
                        'parent': {'key': parent_key},
                        'summary': f"Recommendation {i}: {suggestion[:60]}...",
                        'description': f"Implement the following recommendation:\n\n{suggestion}",
                        'issuetype': {'name': 'Sub-task'},
                        'labels': ['database', 'optimization', 'recommendation'],
                    }
                }

                result = await self._make_jira_request('POST', '/issue', subtask_data)
                if result:
                    self.logger.info(f"Created recommendation subtask: {result['key']}")

        except Exception as e:
            self.logger.error(f"Error creating recommendation subtasks: {e}")

    async def _add_troubleshooting_steps(self, issue_key: str, issue_type: str):
        """Add troubleshooting steps as comments"""
        try:
            steps = self._get_troubleshooting_steps(issue_type)

            comment_data = {
                'body': f"""Troubleshooting Steps:

{steps}

Please follow these steps in order and update this issue with your findings.
"""
            }

            await self._make_jira_request('POST', f'/issue/{issue_key}/comment', comment_data)

        except Exception as e:
            self.logger.error(f"Error adding troubleshooting steps: {e}")

    def _get_troubleshooting_steps(self, issue_type: str) -> str:
        """Get troubleshooting steps for different issue types"""
        steps = {
            'connection': """
1. Verify PostgreSQL service is running: `systemctl status postgresql`
2. Check if port is listening: `netstat -tlnp | grep 5432`
3. Test local connection: `psql -h localhost -U postgres`
4. Check PostgreSQL logs: `tail -f /var/log/postgresql/postgresql-*.log`
5. Verify authentication settings in pg_hba.conf
6. Check firewall rules: `iptables -L` or `firewall-cmd --list-all`
7. Test network connectivity: `telnet <host> 5432`
""",
            'performance': """
1. Check current connections: `SELECT count(*) FROM pg_stat_activity;`
2. Identify blocking queries: `SELECT * FROM pg_blocking_pids(<pid>);`
3. Review slow queries: `SELECT * FROM pg_stat_statements ORDER BY mean_time DESC;`
4. Check cache hit ratio: `SELECT sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read)) FROM pg_statio_user_tables;`
5. Analyze query plans: `EXPLAIN (ANALYZE, BUFFERS) <query>;`
6. Check index usage: `SELECT * FROM pg_stat_user_indexes WHERE idx_scan = 0;`
""",
            'backup': """
1. Check backup job status: Review backup script logs
2. Verify disk space: `df -h /backup/path`
3. Test backup integrity: `pg_verifybackup <backup_path>`
4. Check backup permissions: `ls -la /backup/path`
5. Verify backup configuration
6. Test restore procedure on non-production system
"""
        }

        return steps.get(issue_type, "1. Check system logs\n2. Verify configuration\n3. Test connectivity")

    async def _add_incident_response_checklist(self, issue_key: str, security_data: Dict):
        """Add incident response checklist"""
        try:
            checklist = f"""
h3. Incident Response Checklist

h4. Phase 1: Identification & Assessment
- [ ] Confirm incident is legitimate (not false positive)
- [ ] Classify incident type and severity
- [ ] Identify affected systems and data
- [ ] Estimate potential impact
- [ ] Document initial findings

h4. Phase 2: Containment
- [ ] Isolate affected systems if necessary
- [ ] Block malicious IP addresses: {security_data.get('source_ip', 'N/A')}
- [ ] Disable compromised accounts
- [ ] Preserve evidence for forensic analysis
- [ ] Implement temporary security measures

h4. Phase 3: Investigation
- [ ] Collect and analyze logs
- [ ] Determine attack vector and timeline
- [ ] Identify extent of compromise
- [ ] Document evidence chain of custody
- [ ] Coordinate with law enforcement if required

h4. Phase 4: Remediation
- [ ] Fix vulnerabilities that enabled attack
- [ ] Update security controls
- [ ] Restore systems from clean backups
- [ ] Implement additional monitoring
- [ ] Update security policies and procedures

h4. Phase 5: Communication
- [ ] Notify internal stakeholders
- [ ] Update management and executives
- [ ] Communicate with customers if required
- [ ] Coordinate with external partners
- [ ] Prepare incident summary report

h4. Phase 6: Lessons Learned
- [ ] Conduct post-incident review
- [ ] Update incident response procedures
- [ ] Implement preventive measures
- [ ] Schedule follow-up security assessment
- [ ] Update security training materials
"""

            comment_data = {'body': checklist}
            await self._make_jira_request('POST', f'/issue/{issue_key}/comment', comment_data)

        except Exception as e:
            self.logger.error(f"Error adding incident response checklist: {e}")

    async def _assign_to_security_team(self, issue_key: str):
        """Auto-assign security issues to security team"""
        try:
            security_assignee = self.config.get('security_team_assignee')
            if security_assignee:
                assign_data = {
                    'fields': {
                        'assignee': {'accountId': security_assignee}
                    }
                }
                await self._make_jira_request('PUT', f'/issue/{issue_key}', assign_data)

        except Exception as e:
            self.logger.error(f"Error assigning to security team: {e}")

    # Sprint and performance tracking methods
    async def _setup_performance_tracking(self):
        """Setup performance tracking in sprints"""
        try:
            if not self.sprint_integration.get('enabled', False):
                return

            # Create performance tracking epic if it doesn't exist
            await self._create_performance_epic()

            # Setup automated performance stories
            await self._create_performance_stories()

        except Exception as e:
            self.logger.error(f"Error setting up performance tracking: {e}")

    async def _create_performance_epic(self):
        """Create epic for database performance tracking"""
        try:
            project = list(self.projects.values())[0] if self.projects else None
            if not project:
                return

            epic_data = {
                'fields': {
                    'project': {'key': project.key},
                    'summary': f"Database Performance Optimization - {datetime.utcnow().strftime('%Y Q%m')}",
                    'description': """
This epic tracks database performance optimization efforts for the current quarter.

h3. Goals
* Maintain 95%+ database uptime
* Keep query response time under 100ms average
* Achieve 95%+ cache hit ratio
* Zero critical performance alerts

h3. Key Metrics
* Active connections
* Query performance
* Cache efficiency
* Resource utilization
* Backup success rate

h3. Success Criteria
All performance SLAs met consistently throughout the quarter.
""",
                    'issuetype': {'name': 'Epic'},
                    'priority': {'name': 'High'},
                    'labels': ['database', 'performance', 'sla', 'tracking'],
                }
            }

            # Add epic link custom field if available
            if 'epic_name' in self.custom_fields:
                epic_data['fields'][self.custom_fields['epic_name']] = f"DB Performance Q{datetime.utcnow().month//3 + 1}"

            result = await self._make_jira_request('POST', '/issue', epic_data)
            if result:
                self.performance_epic_key = result['key']
                self.logger.info(f"Created performance epic: {self.performance_epic_key}")

        except Exception as e:
            self.logger.error(f"Error creating performance epic: {e}")

    async def _update_sprint_performance_report(self, health_data: Dict):
        """Update sprint with performance metrics"""
        try:
            if not hasattr(self, 'performance_epic_key'):
                return

            # Create weekly performance story
            current_week = datetime.utcnow().strftime('%Y-W%U')
            story_key = f"perf_report_{current_week}"

            if story_key not in self.issue_cache:
                await self._create_weekly_performance_story(health_data, current_week)

            # Update existing story with latest metrics
            await self._update_performance_story_metrics(health_data)

        except Exception as e:
            self.logger.error(f"Error updating sprint performance report: {e}")

    async def _create_weekly_performance_story(self, health_data: Dict, week: str):
        """Create weekly performance tracking story"""
        try:
            project = list(self.projects.values())[0] if self.projects else None
            if not project:
                return

            story_data = {
                'fields': {
                    'project': {'key': project.key},
                    'summary': f"Database Performance Review - Week {week}",
                    'description': f"""
Weekly database performance tracking and optimization story.

h3. Performance Metrics (Week {week})
This story tracks key database performance indicators and optimization efforts.

h4. Key Performance Indicators
* Overall Health Score: TBD
* Active Alerts: TBD
* Average Response Time: TBD
* Cache Hit Ratio: TBD
* Connection Pool Usage: TBD

h4. Optimization Tasks
- [ ] Review performance alerts
- [ ] Analyze slow queries
- [ ] Check index utilization
- [ ] Monitor resource usage
- [ ] Update performance baselines

h4. Goals for Week
* Zero critical performance issues
* 95%+ cache hit ratio
* <100ms average query time
* 95%+ database uptime
""",
                    'issuetype': {'name': 'Story'},
                    'priority': {'name': 'Medium'},
                    'labels': ['database', 'performance', 'weekly-review', week],
                }
            }

            # Link to performance epic
            if hasattr(self, 'performance_epic_key') and 'epic_link' in self.custom_fields:
                story_data['fields'][self.custom_fields['epic_link']] = self.performance_epic_key

            result = await self._make_jira_request('POST', '/issue', story_data)
            if result:
                story_key = f"perf_report_{week}"
                self.issue_cache[story_key] = result['key']
                self.logger.info(f"Created weekly performance story: {result['key']}")

        except Exception as e:
            self.logger.error(f"Error creating weekly performance story: {e}")

    # Utility methods
    def _assess_performance_impact(self, alert_data: Dict) -> str:
        """Assess performance impact of alert"""
        metric_name = alert_data.get('metric_name', '')
        current_value = alert_data.get('current_value', 0)
        threshold = alert_data.get('threshold', 0)

        if 'connections' in metric_name.lower():
            return "High connection usage may lead to application timeouts and user impact."
        elif 'cache' in metric_name.lower():
            return "Low cache hit ratio indicates increased disk I/O and slower query performance."
        elif 'query' in metric_name.lower():
            return "Slow queries may affect user experience and application responsiveness."
        elif 'lock' in metric_name.lower():
            return "Blocking queries may cause application deadlocks and user frustration."
        else:
            return "Performance degradation may impact user experience and system stability."

    def _assess_backup_impact(self, backup_data: Dict) -> str:
        """Assess impact of backup failure"""
        backup_type = backup_data.get('backup_type', '').lower()
        last_successful = backup_data.get('last_successful', '')

        if 'full' in backup_type:
            return "CRITICAL - Full backup failure affects complete disaster recovery capability."
        elif 'incremental' in backup_type:
            return "HIGH - Incremental backup failure affects point-in-time recovery options."
        else:
            return "MEDIUM - Backup failure reduces data protection and recovery options."

    def _assess_recovery_risk(self, backup_data: Dict) -> str:
        """Assess recovery point risk"""
        # This would calculate based on last successful backup time
        return "Risk assessment based on backup frequency and last successful backup time."

    def _generate_performance_report(self, alert_data: Dict) -> Dict:
        """Generate detailed performance report"""
        return {
            'alert_summary': alert_data,
            'timestamp': datetime.utcnow().isoformat(),
            'recommendations': alert_data.get('suggestions', []),
            'impact_assessment': self._assess_performance_impact(alert_data),
            'related_metrics': self._get_related_metrics(alert_data),
            'historical_trends': self._get_historical_trends(alert_data),
            'escalation_path': self._get_escalation_path(alert_data)
        }

    def _get_related_metrics(self, alert_data: Dict) -> List[str]:
        """Get related metrics to monitor"""
        metric_name = alert_data.get('metric_name', '').lower()

        if 'connection' in metric_name:
            return ['idle_connections', 'connection_pool_usage', 'query_duration']
        elif 'cache' in metric_name:
            return ['buffer_usage', 'shared_buffers', 'query_performance']
        elif 'query' in metric_name:
            return ['index_usage', 'table_scans', 'lock_waits']
        else:
            return ['cpu_usage', 'memory_usage', 'disk_io']

    def _get_historical_trends(self, alert_data: Dict) -> Dict:
        """Get historical trend information"""
        return {
            'trend_direction': 'increasing',  # This would be calculated from historical data
            'frequency': 'daily',
            'severity_progression': 'stable',
            'correlation_with_load': 'high'
        }

    def _get_escalation_path(self, alert_data: Dict) -> List[str]:
        """Get escalation path for alert"""
        severity = alert_data.get('severity', 'medium')

        if severity == 'critical':
            return ['Database Team Lead', 'Site Reliability Engineer', 'VP Engineering']
        elif severity == 'high':
            return ['Database Administrator', 'Database Team Lead']
        else:
            return ['Database Administrator']

    # URL helper methods
    def _get_dashboard_url(self) -> str:
        return self.config.get('dashboard_url', 'https://localhost:8080/dashboard')

    def _get_docs_url(self) -> str:
        return self.config.get('docs_url', 'https://localhost:8080/docs')

    async def _setup_webhooks(self):
        """Setup Jira webhooks for two-way integration"""
        try:
            # This would register webhooks with Jira to receive updates
            # when issues are updated, resolved, etc.
            pass
        except Exception as e:
            self.logger.error(f"Error setting up webhooks: {e}")

    async def _cleanup_webhooks(self):
        """Clean up registered webhooks"""
        try:
            # Clean up any registered webhooks
            pass
        except Exception as e:
            self.logger.error(f"Error cleaning up webhooks: {e}")

    async def _update_disconnect_status(self):
        """Update status of open issues when disconnecting"""
        try:
            # Add comment to open database issues about integration disconnect
            comment_text = f"""
Database integration disconnected at {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}.

Automated monitoring and updates from the database management system are paused.
Manual monitoring and updates will be required until integration is restored.
"""

            # This would query for open issues and add comments
            # Implementation depends on having tracking of created issues

        except Exception as e:
            self.logger.error(f"Error updating disconnect status: {e}")


# Configuration example
def create_jira_integration_config() -> Dict[str, Any]:
    """Create example Jira integration configuration"""
    return {
        'base_url': 'https://your-company.atlassian.net',
        'username': 'your-email@company.com',
        'api_token': 'your-api-token',
        'projects': [
            {
                'key': 'DBOPS',
                'name': 'Database Operations',
                'issue_types': {
                    'performance_alert': 'Bug',
                    'connection_failure': 'Incident',
                    'query_failure': 'Bug',
                    'security_incident': 'Security',
                    'backup_failure': 'Task',
                    'schema_change': 'Task'
                },
                'components': ['Database', 'PostgreSQL'],
                'priority_mapping': {
                    'critical': 'Highest',
                    'high': 'High',
                    'medium': 'Medium',
                    'low': 'Low'
                }
            }
        ],
        'auto_create_issues': True,
        'auto_resolve_issues': False,
        'custom_fields': {
            'database_name': 'customfield_10001',
            'event_source': 'customfield_10002',
            'event_category': 'customfield_10003',
            'severity_level': 'customfield_10004',
            'incident_timestamp': 'customfield_10005',
            'epic_link': 'customfield_10006',
            'epic_name': 'customfield_10007',
            'security_level': 'customfield_10008'
        },
        'sprint_integration': {
            'enabled': True,
            'auto_create_performance_stories': True,
            'weekly_reviews': True
        },
        'performance_tracking': {
            'enabled': True,
            'sla_monitoring': True,
            'goal_tracking': True
        },
        'security_team_assignee': 'security-team-account-id',
        'dashboard_url': 'https://your-domain.com/postgres-dashboard',
        'docs_url': 'https://your-domain.com/docs'
    }