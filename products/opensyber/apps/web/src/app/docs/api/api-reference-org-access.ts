/** Organization access control: SSO, residency, SLAs */
export const ssoSection = {
  title: 'SSO Configuration',
  description: 'SAML 2.0 and OIDC single sign-on per organization',
  endpoints: [
    {
      method: 'GET',
      path: '/api/organizations/:orgId/sso',
      auth: 'bearer (org.update)',
      description: 'Get SSO configuration for an org',
      response: { data: 'SsoConfig' },
    },
    {
      method: 'PUT',
      path: '/api/organizations/:orgId/sso',
      auth: 'bearer (org.update)',
      description: 'Create or update SSO configuration',
      requestBody: { provider: 'string', metadataUrl: 'string?' },
      response: { data: 'SsoConfig' },
    },
    {
      method: 'DELETE',
      path: '/api/organizations/:orgId/sso',
      auth: 'bearer (org.update)',
      description: 'Remove SSO configuration',
      response: 'null (204)',
    },
    {
      method: 'POST',
      path: '/api/organizations/:orgId/sso/test',
      auth: 'bearer (org.update)',
      description: 'Test SSO configuration connectivity',
      response: { data: '{ success, message }' },
    },
    {
      method: 'GET',
      path: '/api/sso/:orgSlug/saml/metadata',
      auth: 'none',
      description: 'SAML SP metadata XML for the org',
      response: 'XML (application/xml)',
    },
    {
      method: 'GET',
      path: '/api/sso/:orgSlug/saml/login',
      auth: 'none',
      description: 'Initiate SAML login redirect',
      response: 'Redirect (302)',
    },
    {
      method: 'POST',
      path: '/api/sso/:orgSlug/saml/acs',
      auth: 'none',
      description: 'SAML Assertion Consumer Service callback',
      response: 'Redirect with session token',
    },
    {
      method: 'GET',
      path: '/api/sso/:orgSlug/oidc/login',
      auth: 'none',
      description: 'Initiate OIDC login redirect',
      response: 'Redirect (302)',
    },
    {
      method: 'GET',
      path: '/api/sso/:orgSlug/oidc/callback',
      auth: 'none',
      description: 'OIDC authorization code callback',
      response: 'Redirect with session token',
    },
  ],
} as const;
export const dataResidencySection = {
  title: 'Data Residency',
  description: 'Configure data storage region per organization',
  endpoints: [
    {
      method: 'GET',
      path: '/api/organizations/:orgId/residency',
      auth: 'bearer',
      description: 'Get data residency configuration',
      response: { data: '{ region, provider }' },
    },
    {
      method: 'PUT',
      path: '/api/organizations/:orgId/residency',
      auth: 'bearer (org.update)',
      description: 'Set data residency region',
      requestBody: { region: 'string (eu|us|ap)' },
      response: { data: '{ region }' },
    },
  ],
} as const;
export const slaSection = {
  title: 'SLA Configuration',
  description: 'Service level agreement settings per organization',
  endpoints: [
    {
      method: 'GET',
      path: '/api/organizations/:orgId/sla',
      auth: 'bearer',
      description: 'Get SLA configuration',
      response: { data: 'SlaConfig' },
    },
    {
      method: 'PUT',
      path: '/api/organizations/:orgId/sla',
      auth: 'bearer (org.update)',
      description: 'Update SLA targets and response times',
      requestBody: { uptimeTarget: 'number', responseTime: 'number' },
      response: { data: 'SlaConfig' },
    },
    {
      method: 'GET',
      path: '/api/sla',
      auth: 'bearer',
      description: 'Get SLA monitoring dashboard data',
      response: { data: 'SlaMetrics' },
    },
    {
      method: 'GET',
      path: '/api/sla/metrics',
      auth: 'bearer',
      description: 'Get SLA performance metrics',
      response: { data: 'SlaPerformance' },
    },
  ],
} as const;
