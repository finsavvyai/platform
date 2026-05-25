---
name: ll-postlaunch
displayName: Luna Post-Launch Review
description: Analyze launch metrics and provide recommendations for improvement
version: 1.0.0
category: analysis
agent: luna-post-launch-review
parameters:
  - name: scope
    type: string
    description: Project or feature scope for post-launch review
    required: true
    prompt: true
workflow:
  - collect_launch_metrics
  - review_incidents_issues
  - analyze_user_feedback_adoption
  - compare_against_requirements
  - generate_post_launch_review
output:
  - .luna/{current-project}/post-launch-review.md (project-level)
  - .luna/{current-project}/{feature}/post-launch-review.md (feature-level)
prerequisites:
  - .luna/{current-project}/deployment-report.md
  - .luna/{current-project}/monitoring-observability-report.md
  - .luna/{current-project}/test-validation-report.md
  - .luna/{current-project}/requirements.md
  - 7_days_of_production_data
---

# Luna Post-Launch Review

Analyzes launch metrics from the first 7 days and provides recommendations for continuous improvement.

## What This Command Does

This command collects metrics from your first 7 days in production, reviews incidents and issues, analyzes user feedback and adoption, compares results against original requirements, and generates a comprehensive post-launch review with actionable recommendations.

## Prerequisites

Requires in your current project:
- `.luna/{current-project}/deployment-report.md`
- `.luna/{current-project}/monitoring-observability-report.md`
- `.luna/{current-project}/test-validation-report.md`
- `.luna/{current-project}/requirements.md`
- 7 days of production data

**Important**: Run this command **7 days after launch** for meaningful metrics and analysis.

## Usage Instructions

When you run this command, you'll be prompted for the scope:
- Press **ENTER** for project-level review
- Type **feature-name** for feature-specific review

## Execution Steps

1. **Metrics Collection**: Collects metrics from first 7 days in production
2. **Incident Review**: Reviews incidents, outages, and issues encountered
3. **User Analysis**: Analyzes user feedback, adoption rates, and behavior
4. **Requirements Comparison**: Compares actual performance against original requirements
5. **Review Generation**: Generates comprehensive post-launch-review.md

## Output Files

Creates in your current project:
- `.luna/{current-project}/post-launch-review.md` for project-level review
- `.luna/{current-project}/{feature}/post-launch-review.md` for feature-level review

The post-launch review includes:
- Launch objectives review and achievement status
- Performance metrics analysis (response times, uptime, error rates)
- User adoption metrics and engagement statistics
- Incident summary with root cause analysis
- What went well and areas for improvement
- Lessons learned from the launch process
- Actionable recommendations for next 30 days
- Success metrics and KPIs for ongoing tracking

## Review Analysis

**Performance Analysis:**
- Actual vs. expected performance metrics
- Bottlenecks and optimization opportunities
- Scalability assessment under real load

**User Adoption:**
- User registration and activation rates
- Feature usage patterns and popularity
- User feedback sentiment analysis

**Operational Insights:**
- Incident frequency and resolution times
- Monitoring effectiveness and alert accuracy
- Support ticket volume and types

## Continuous Improvement

Schedule regular reviews to track progress:
- **Week 2-4**: Run this command again to track early improvements
- **Monthly**: Track progress against recommendations and adjust strategy
- **Quarterly**: Major feature reviews and strategic planning

## Tips

- Wait the full 7 days to get meaningful metrics and patterns
- Use the recommendations to prioritize your next development cycle
- Share key insights with your team and stakeholders
- This review helps you learn from real-world usage and improve continuously