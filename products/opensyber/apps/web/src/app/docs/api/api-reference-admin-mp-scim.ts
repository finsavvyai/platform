/** Marketplace admin moderation + SCIM provisioning */
export const marketplaceAdminSection = {
  title: 'Marketplace Admin',
  description: 'Manage skill submissions and curation',
  endpoints: [
    {
      method: 'GET',
      path: '/api/admin/marketplace/submissions',
      auth: 'bearer (marketplace.admin)',
      description: 'List skill submissions pending review',
      response: { data: 'Submission[]' },
    },
    {
      method: 'PATCH',
      path: '/api/admin/marketplace/submissions/:id',
      auth: 'bearer (marketplace.admin)',
      description: 'Approve or reject a submission',
      requestBody: { action: 'approve | reject', reason: 'string?' },
      response: { data: 'Submission' },
    },
    {
      method: 'POST',
      path: '/api/admin/marketplace/submissions/:id/scan',
      auth: 'bearer (marketplace.admin)',
      description: 'Trigger security scan on a skill submission',
      response: { data: '{ scanId, status }' },
    },
    {
      method: 'PATCH',
      path: '/api/admin/marketplace/skills/:id/featured',
      auth: 'bearer (marketplace.admin)',
      description: 'Toggle featured status on a skill',
      requestBody: { featured: 'boolean' },
      response: { data: '{ id, featured }' },
    },
  ],
} as const;

export const scimSection = {
  title: 'SCIM Provisioning',
  description: 'SCIM 2.0 user and group provisioning (Bearer SCIM token)',
  endpoints: [
    {
      method: 'GET',
      path: '/api/scim/v2/Users',
      auth: 'scim-token',
      description: 'List SCIM users',
      response: 'SCIM ListResponse',
    },
    {
      method: 'GET',
      path: '/api/scim/v2/Users/:id',
      auth: 'scim-token',
      description: 'Get SCIM user by ID',
      response: 'SCIM User resource',
    },
    {
      method: 'POST',
      path: '/api/scim/v2/Users',
      auth: 'scim-token',
      description: 'Create a SCIM user (provision)',
      response: 'SCIM User resource (201)',
    },
    {
      method: 'PUT',
      path: '/api/scim/v2/Users/:id',
      auth: 'scim-token',
      description: 'Replace a SCIM user',
      response: 'SCIM User resource',
    },
    {
      method: 'DELETE',
      path: '/api/scim/v2/Users/:id',
      auth: 'scim-token',
      description: 'Deprovision a SCIM user',
      response: 'null (204)',
    },
    {
      method: 'GET',
      path: '/api/scim/v2/Groups',
      auth: 'scim-token',
      description: 'List SCIM groups',
      response: 'SCIM ListResponse',
    },
    {
      method: 'GET',
      path: '/api/scim/v2/Groups/:id',
      auth: 'scim-token',
      description: 'Get SCIM group by ID',
      response: 'SCIM Group resource',
    },
  ],
} as const;
