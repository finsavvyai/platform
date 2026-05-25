export const coreToolDefinitions = [
	{
		name: 'query_users',
		description:
			'Search and filter users in the Microsoft 365 tenant. Returns user details including sign-in activity, licenses, and group membership.',
		input_schema: {
			type: 'object' as const,
			properties: {
				filter: {
					type: 'string',
					description:
						'Filter criteria: "inactive", "guests", "admins", "no-mfa", or a search term for display name/email'
				},
				inactiveDays: { type: 'number', description: 'Number of days of inactivity to filter by (default: 30)' },
				limit: { type: 'number', description: 'Maximum number of results to return (default: 20)' }
			},
			required: ['filter']
		}
	},
	{
		name: 'query_licenses',
		description:
			'Get license allocation and usage information. Shows which SKUs are assigned, how many are in use, and identifies waste.',
		input_schema: {
			type: 'object' as const,
			properties: {
				includeWasteAnalysis: { type: 'boolean', description: 'Include per-user waste analysis (default: false)' }
			}
		}
	},
	{
		name: 'query_alerts',
		description: 'Get current alerts and recommendations for the tenant.',
		input_schema: {
			type: 'object' as const,
			properties: {
				severity: {
					type: 'string',
					enum: ['critical', 'high', 'medium', 'low'],
					description: 'Filter by severity level'
				},
				category: {
					type: 'string',
					enum: ['security', 'optimization', 'compliance', 'operational'],
					description: 'Filter by category'
				},
				status: {
					type: 'string',
					enum: ['active', 'acknowledged', 'resolved', 'dismissed'],
					description: 'Filter by status (default: active)'
				}
			}
		}
	},
	{
		name: 'query_security',
		description: 'Get the tenant security posture including Secure Score, risky users, and MFA adoption rate.',
		input_schema: { type: 'object' as const, properties: {} }
	},
	{
		name: 'query_groups',
		description: 'Search and filter groups in the tenant.',
		input_schema: {
			type: 'object' as const,
			properties: { filter: { type: 'string', description: 'Filter: "empty" (no members), "no-owner", or a search term' } },
			required: ['filter']
		}
	},
	{
		name: 'query_audit_log',
		description: 'Search the audit history for actions taken on the tenant.',
		input_schema: {
			type: 'object' as const,
			properties: {
				actor: { type: 'string', description: 'Filter by who performed the action' },
				action: { type: 'string', description: 'Filter by action type' },
				days: { type: 'number', description: 'Number of days to look back (default: 7)' }
			}
		}
	},
	{
		name: 'execute_remediation',
		description:
			'Execute a remediation action. IMPORTANT: Always explain what you are about to do and ask for confirmation before calling this tool.',
		input_schema: {
			type: 'object' as const,
			properties: {
				actionId: { type: 'string', description: 'The remediation action ID (e.g., REM-001, REM-004)' },
				resourceIds: {
					type: 'array',
					items: { type: 'string' },
					description: 'Array of resource IDs to act on (user IDs, policy IDs, etc.)'
				},
				dryRun: { type: 'boolean', description: 'If true, preview changes without executing (default: true)' }
			},
			required: ['actionId', 'resourceIds']
		}
	},
	{
		name: 'assign_license',
		description: 'Assign or change a license for a user.',
		input_schema: {
			type: 'object' as const,
			properties: {
				userId: { type: 'string', description: 'The user ID' },
				addSkuId: { type: 'string', description: 'SKU ID to assign' },
				removeSkuId: { type: 'string', description: 'SKU ID to remove (for downgrade)' }
			},
			required: ['userId']
		}
	},
	{
		name: 'create_group',
		description: 'Create a new security or Microsoft 365 group.',
		input_schema: {
			type: 'object' as const,
			properties: {
				displayName: { type: 'string', description: 'Group display name' },
				type: { type: 'string', enum: ['security', 'microsoft365'], description: 'Group type' },
				memberIds: { type: 'array', items: { type: 'string' }, description: 'User IDs to add as members' }
			},
			required: ['displayName', 'type']
		}
	},
	{
		name: 'analyze_cost_optimization',
		description:
			'Analyze license costs and identify savings opportunities. Returns detailed recommendations for reducing M365 spend including unused licenses, inactive users, and downgrade opportunities.',
		input_schema: {
			type: 'object' as const,
			properties: {
				includeInactiveUsers: {
					type: 'boolean',
					description: 'Include analysis of inactive users with licenses (default: true)'
				},
				inactivityThreshold: { type: 'number', description: 'Days of inactivity to flag users (default: 60)' },
				includeDowngradeAnalysis: {
					type: 'boolean',
					description: 'Analyze opportunities to downgrade from E5 to E3 (default: true)'
				}
			}
		}
	},
	{
		name: 'generate_onboarding_plan',
		description:
			'Generate intelligent user onboarding plan based on role, department, and peer analysis. Recommends licenses, groups, applications, and security settings with cost estimates and timeline.',
		input_schema: {
			type: 'object' as const,
			properties: {
				userName: { type: 'string', description: 'Full name of the new employee' },
				email: { type: 'string', description: 'Email address for the new employee' },
				role: {
					type: 'string',
					description: 'Job title/role (e.g., "Senior Developer", "Marketing Manager", "Sales Executive")'
				},
				department: { type: 'string', description: 'Department name (e.g., "Engineering", "Marketing", "Sales")' },
				startDate: { type: 'string', description: 'Start date in YYYY-MM-DD format' },
				manager: { type: 'string', description: 'Manager email for approval workflow (optional)' },
				similarUserEmail: {
					type: 'string',
					description: 'Email of existing user with similar role for peer analysis (optional)'
				}
			},
			required: ['userName', 'email', 'role', 'department', 'startDate']
		}
	},
	{
		name: 'compute_health_score',
		description:
			'Compute a comprehensive tenant health score (0-100) across 6 dimensions: security, cost optimization, compliance, adoption, operational, and governance. Returns grade, percentile benchmarking, improvement plan, and shareable report card.',
		input_schema: {
			type: 'object' as const,
			properties: {
				includeRecommendations: {
					type: 'boolean',
					description: 'Include actionable improvement recommendations (default: true)'
				}
			}
		}
	}
];
