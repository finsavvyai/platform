/**
 * OpenAPI 3.0 Spec — Path definitions for all API routes
 */

const ok = (desc: string, schema?: any) => ({
  200: { description: desc, content: schema ? { 'application/json': { schema } } : undefined },
});

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const arr = (name: string) => ({ type: 'object', properties: { data: { type: 'array', items: ref(name) } } });
const obj = (name: string) => ({ type: 'object', properties: { data: ref(name) } });

export const openApiPaths: Record<string, any> = {
  '/api/agents/activity/sync': {
    post: {
      tags: ['Agent Activity'], summary: 'Sync agent activity events',
      requestBody: { content: { 'application/json': { schema: { type: 'object' } } } },
      responses: { 201: { description: 'Events synced' } },
    },
  },
  '/api/agents/team': {
    get: { tags: ['Agent Activity'], summary: 'List team agent activity', responses: ok('Team activity', arr('AgentActivity')) },
  },
  '/api/agents/policies': {
    get: { tags: ['Agent Policies'], summary: 'List agent policies', responses: ok('Policies', arr('AgentPolicy')) },
    post: { tags: ['Agent Policies'], summary: 'Create agent policy', responses: { 201: { description: 'Policy created' } } },
  },
  '/api/cloud/accounts': {
    get: { tags: ['Cloud Security'], summary: 'List cloud accounts', responses: ok('Cloud accounts', arr('CloudAccount')) },
    post: { tags: ['Cloud Security'], summary: 'Connect cloud account', responses: { 201: { description: 'Account connected' } } },
  },
  '/api/cloud/findings': {
    get: { tags: ['Cloud Security'], summary: 'List CSPM findings', responses: ok('CSPM findings', arr('CspmFinding')) },
  },
  '/api/assets': {
    get: { tags: ['Attack Graph'], summary: 'List assets', responses: ok('Assets', arr('Asset')) },
    post: { tags: ['Attack Graph'], summary: 'Create asset', responses: { 201: { description: 'Asset created' } } },
  },
  '/api/attack-paths/query': {
    post: { tags: ['Attack Graph'], summary: 'Query attack paths from entry point', responses: ok('Attack paths') },
  },
  '/api/attack-paths/crown-jewels': {
    get: { tags: ['Attack Graph'], summary: 'List crown jewel assets', responses: ok('Crown jewels', arr('Asset')) },
  },
  '/api/oasf/assessments': {
    get: { tags: ['OASF Compliance'], summary: 'List OASF assessments', responses: ok('Assessments', arr('OasfAssessment')) },
    post: { tags: ['OASF Compliance'], summary: 'Run OASF assessment', responses: { 201: { description: 'Assessment completed' } } },
  },
  '/api/oasf/controls': {
    get: { tags: ['OASF Compliance'], summary: 'Get OASF control definitions', responses: ok('15 OASF controls') },
  },
  '/api/oasf/framework-mapping': {
    get: { tags: ['OASF Compliance'], summary: 'Get SOC2/ISO/NIST mapping table', responses: ok('Framework mappings') },
  },
  '/api/marketplace': {
    get: { tags: ['Marketplace'], summary: 'Browse marketplace skills', responses: ok('Skills', arr('Skill')) },
  },
  '/api/marketplace/{id}/install': {
    post: { tags: ['Marketplace'], summary: 'Install a skill', responses: { 201: { description: 'Skill installed' } } },
    delete: { tags: ['Marketplace'], summary: 'Uninstall a skill', responses: ok('Skill uninstalled') },
  },
  '/api/alert-channels': {
    get: { tags: ['Alert Channels'], summary: 'List alert channels', responses: ok('Alert channels', arr('AlertChannel')) },
    post: { tags: ['Alert Channels'], summary: 'Create alert channel', responses: { 201: { description: 'Channel created' } } },
  },
  '/api/organizations': {
    get: { tags: ['Organizations'], summary: 'List organizations', responses: ok('Organizations') },
    post: { tags: ['Organizations'], summary: 'Create organization', responses: { 201: { description: 'Organization created' } } },
  },
  '/api/instances': {
    get: { tags: ['Instances'], summary: 'List agent instances', responses: ok('Instances', arr('Instance')) },
    post: { tags: ['Instances'], summary: 'Create agent instance', responses: { 201: { description: 'Instance created' } } },
  },
  '/api/scim/v2/Users': {
    get: { tags: ['SCIM'], summary: 'List SCIM users', responses: ok('SCIM user list') },
    post: { tags: ['SCIM'], summary: 'Create SCIM user', responses: { 201: { description: 'User provisioned' } } },
  },
  '/api/scim/v2/Users/{id}': {
    get: { tags: ['SCIM'], summary: 'Get SCIM user', responses: ok('SCIM user') },
    put: { tags: ['SCIM'], summary: 'Update SCIM user', responses: ok('User updated') },
    delete: { tags: ['SCIM'], summary: 'Delete SCIM user', responses: { 204: { description: 'User deprovisioned' } } },
  },
  '/api/scim/v2/Groups': {
    get: { tags: ['SCIM'], summary: 'List SCIM groups', responses: ok('SCIM group list') },
  },
  '/api/soc2': {
    get: { tags: ['SOC2'], summary: 'Get SOC2 readiness status', responses: ok('SOC2 readiness') },
  },
  '/api/soc2/mappings': {
    get: { tags: ['SOC2'], summary: 'Get OASF-to-SOC2 TSC mappings', responses: ok('SOC2 mappings') },
  },
  '/api/soc2/evidence': {
    get: { tags: ['SOC2'], summary: 'Get SOC2 evidence snapshot', responses: ok('Evidence') },
  },
  '/api/sla': {
    get: { tags: ['SLA'], summary: 'Get SLA compliance status', responses: ok('SLA status') },
  },
  '/api/sla/metrics': {
    get: { tags: ['SLA'], summary: 'Get SLA metrics with daily breakdown', responses: ok('SLA metrics') },
  },
  '/api/admin/data-room': {
    get: { tags: ['Data Room'], summary: 'Get investor metrics', responses: ok('Data room') },
  },
  '/api/admin/data-room/export': {
    get: { tags: ['Data Room'], summary: 'Export data room JSON bundle', responses: ok('Export') },
  },
};
