export const advancedToolDefinitions = [
	{
		name: 'generate_executive_report',
		description:
			'Generate a boardroom-ready executive report with KPIs, trends, security posture, financial overview, and recommended actions. Returns HTML email-ready format with shareable link.',
		input_schema: {
			type: 'object' as const,
			properties: {
				reportPeriod: {
					type: 'string',
					enum: ['weekly', 'monthly', 'quarterly'],
					description: 'Report period (default: monthly)'
				},
				includeFinancials: { type: 'boolean', description: 'Include financial/cost data (default: true)' },
				includeSecurity: { type: 'boolean', description: 'Include security posture (default: true)' },
				includeCompliance: { type: 'boolean', description: 'Include compliance data (default: true)' }
			}
		}
	},
	{
		name: 'run_anomaly_detection',
		description:
			'Detect anomalies in tenant activity including impossible travel, brute force attacks, cost spikes, shadow IT, data exfiltration, and unusual admin activity. Returns risk score and smart digest for notifications.',
		input_schema: {
			type: 'object' as const,
			properties: {
				includeLoginAnalysis: { type: 'boolean', description: 'Analyze login events for anomalies (default: true)' },
				includeActivityAnalysis: {
					type: 'boolean',
					description: 'Analyze activity metrics for anomalies (default: true)'
				}
			}
		}
	},
	{
		name: 'run_license_autopilot',
		description:
			'Analyze all licenses and identify reclamation candidates — unused licenses to remove, expensive licenses to downgrade (E5→E3), and inactive users to clean up. Returns a reclamation plan with estimated savings and approval workflow.',
		input_schema: {
			type: 'object' as const,
			properties: {
				inactivityThreshold: { type: 'number', description: 'Days of inactivity to flag users (default: 60)' },
				maxActions: { type: 'number', description: 'Maximum reclamation actions per run (default: 50)' },
				dryRun: { type: 'boolean', description: 'Preview only without executing (default: true)' }
			}
		}
	},
	{
		name: 'assess_compliance_posture',
		description:
			'Run a compliance posture assessment against CIS Microsoft 365 Benchmark. Returns control-level pass/fail scoring, critical gaps, audit readiness, and remediation recommendations.',
		input_schema: { type: 'object' as const, properties: {} }
	},
	{
		name: 'compare_tenants',
		description:
			'Compare multiple M365 tenants side-by-side (MSP portfolio view). Returns rankings, standardization gaps, best practice propagation, risk matrix, and portfolio-wide recommendations.',
		input_schema: {
			type: 'object' as const,
			properties: {
				tenantIds: {
					type: 'array',
					items: { type: 'string' },
					description: 'IDs of tenants to compare (minimum 2)'
				}
			},
			required: ['tenantIds']
		}
	},
	{
		name: 'generate_usage_heatmap',
		description:
			'Generate M365 service adoption heatmap showing per-service usage rates (Teams, SharePoint, Exchange, OneDrive, etc.), department-level adoption, time patterns, and license right-sizing recommendations.',
		input_schema: {
			type: 'object' as const,
			properties: {
				period: { type: 'string', description: 'Analysis period (default: "Last 30 days")' }
			}
		}
	},
	{
		name: 'get_savings_leaderboard',
		description:
			'Get the gamified savings leaderboard showing tenant rankings, achievement badges, ROI metrics, active challenges, and shareable savings certificates.',
		input_schema: {
			type: 'object' as const,
			properties: {
				period: {
					type: 'string',
					enum: ['monthly', 'quarterly', 'all-time'],
					description: 'Leaderboard period (default: monthly)'
				}
			}
		}
	}
];
