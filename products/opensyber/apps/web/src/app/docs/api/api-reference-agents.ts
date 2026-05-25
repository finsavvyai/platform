/** Agent monitoring, team, sessions, risk, and reporting endpoints */
export const agentMonitorSection = {
  title: 'Agent Monitoring',
  description: 'Activity tracking, sessions, and risk trends',
  endpoints: [
    {
      method: 'POST',
      path: '/api/agents/activity/sync',
      auth: 'bearer (cloudSync plan)',
      description: 'Sync agent activity data from local to cloud',
      requestBody: { events: 'AgentEvent[]' },
      response: { data: '{ synced: number }' },
    },
    {
      method: 'GET',
      path: '/api/agents/activity',
      auth: 'bearer',
      description: 'List agent activity events',
      queryParams: { limit: 'number?', cursor: 'string?' },
      response: { data: 'AgentEvent[]' },
    },
    {
      method: 'GET',
      path: '/api/agents/activity/summary',
      auth: 'bearer',
      description: 'Get activity summary statistics',
      response: { data: '{ totalEvents, riskScore, topFindings }' },
    },
    {
      method: 'DELETE',
      path: '/api/agents/activity',
      auth: 'bearer',
      description: 'Clear all activity data for the user',
      response: 'null (204)',
    },
    {
      method: 'GET',
      path: '/api/agents/activity/sessions',
      auth: 'bearer',
      description: 'List agent coding sessions',
      response: { data: 'Session[]' },
    },
    {
      method: 'GET',
      path: '/api/agents/activity/sessions/:sessionId',
      auth: 'bearer',
      description: 'Get session detail with events',
      response: { data: '{ session, events }' },
    },
    {
      method: 'GET',
      path: '/api/agents/risk-trend',
      auth: 'bearer',
      description: 'Get personal risk score trend over time',
      queryParams: { days: 'number?' },
      response: { data: 'TrendEntry[]' },
    },
    {
      method: 'GET',
      path: '/api/activity/findings',
      auth: 'bearer',
      description: 'List security findings from agent activity',
      queryParams: { severity: 'string?', type: 'string?' },
      response: { data: 'Finding[]' },
    },
  ],
} as const;

export const agentTeamSection = {
  title: 'Agent Team Dashboard',
  description: 'Team-wide agent activity and risk (requires teamDashboard plan)',
  endpoints: [
    {
      method: 'GET',
      path: '/api/agents/team/activity',
      auth: 'bearer (agent.policy.read, teamDashboard plan)',
      description: 'List team-wide agent activity',
      response: { data: 'AgentEvent[]' },
    },
    {
      method: 'GET',
      path: '/api/agents/team/summary',
      auth: 'bearer (agent.policy.read)',
      description: 'Get team activity summary',
      response: { data: '{ members, totalEvents, avgRisk }' },
    },
    {
      method: 'GET',
      path: '/api/agents/team/members',
      auth: 'bearer (agent.policy.read)',
      description: 'List team members with activity metrics',
      response: { data: 'TeamMember[]' },
    },
    {
      method: 'GET',
      path: '/api/agents/team/risk-score',
      auth: 'bearer (agent.policy.read)',
      description: 'Get team aggregate risk score',
      response: { data: '{ score, trend }' },
    },
    {
      method: 'GET',
      path: '/api/agents/team/risk-trend',
      auth: 'bearer (agent.policy.read)',
      description: 'Get team risk trend over time',
      response: { data: 'TrendEntry[]' },
    },
    {
      method: 'GET',
      path: '/api/agents/team/:userId/activity',
      auth: 'bearer (agent.policy.read)',
      description: 'Get a specific team member activity',
      response: { data: 'AgentEvent[]' },
    },
    {
      method: 'GET',
      path: '/api/agents/team/:userId/risk-trend',
      auth: 'bearer (agent.policy.read)',
      description: 'Get risk trend for a specific team member',
      response: { data: 'TrendEntry[]' },
    },
  ],
} as const;

