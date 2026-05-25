---
name: ll-monitor
displayName: Luna Monitoring & Observability
description: Set up comprehensive monitoring, dashboards, and alerts
version: 1.0.0
category: operations
agent: luna-monitoring-observability
parameters:
  - name: scope
    type: string
    description: Project or feature scope for monitoring
    required: true
    prompt: true
workflow:
  - configure_monitoring_tools
  - create_dashboards
  - setup_alerts
  - configure_log_aggregation
  - generate_monitoring_report
output:
  - .luna/{current-project}/monitoring-observability-report.md (project-level)
  - .luna/{current-project}/{feature}/monitoring-observability-report.md (feature-level)
prerequisites:
  - .luna/{current-project}/deployment-report.md
  - .luna/{current-project}/design.md
  - .luna/{current-project}/requirements.md
  - production_application_running
---

# Luna Monitoring & Observability

Sets up comprehensive monitoring, dashboards, and alerts for your deployed application.

## What This Command Does

This command configures monitoring tools (Sentry, CloudWatch, etc.), creates health, performance, and business dashboards, sets up alerts with different severity levels, configures log aggregation, and generates a comprehensive monitoring and observability report.

## Prerequisites

Requires in your current project:
- `.luna/{current-project}/deployment-report.md`
- `.luna/{current-project}/design.md`
- `.luna/{current-project}/requirements.md`
- Production application running

If you haven't deployed yet, complete the workflow:
```bash
/luna-requirements
/luna-design
/luna-plan
/luna-execute  # Until all tasks complete
/luna-review
/luna-test
/luna-deploy
/luna-docs
```

## Usage Instructions

When you run this command, you'll be prompted for the scope:
- Press **ENTER** for project-level monitoring
- Type **feature-name** for feature-specific monitoring

## Execution Steps

1. **Tool Configuration**: Configures monitoring tools (Sentry, CloudWatch, DataDog, etc.)
2. **Dashboard Creation**: Creates health, performance, and business dashboards
3. **Alert Setup**: Sets up alerts with critical, warning, and info severity levels
4. **Log Aggregation**: Configures centralized log collection and analysis
5. **Report Generation**: Generates comprehensive monitoring-observability-report.md

## Output Files

Creates in your current project:
- `.luna/{current-project}/monitoring-observability-report.md` for project-level monitoring
- `.luna/{current-project}/{feature}/monitoring-observability-report.md` for feature-level monitoring

The monitoring report includes:
- Monitoring tools configuration details and credentials
- Dashboard URLs and access information
- Alert configurations with escalation procedures
- Current system health and performance metrics
- SLO/SLA status and compliance tracking
- Monitoring optimization recommendations

## Monitoring Setup

**Health Monitoring:**
- Application uptime and availability
- Service dependency health checks
- Infrastructure resource utilization

**Performance Monitoring:**
- Response times and throughput
- Error rates and patterns
- Database performance metrics

**Business Monitoring:**
- User activity and engagement
- Feature usage statistics
- Revenue and conversion metrics

**Alert Configuration:**
- Critical alerts (immediate notification)
- Warning alerts (within 15 minutes)
- Info alerts (daily digest)

## Next Steps in Workflow

After 7 days in production with monitoring running, perform post-launch review:
```
/luna-postlaunch
```

## Tips

- Monitor your dashboards regularly to detect issues early
- Adjust alert thresholds to reduce noise and catch real issues
- Review log patterns to identify potential improvements
- Good monitoring helps you maintain system reliability and user satisfaction