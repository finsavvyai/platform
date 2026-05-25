/** Organizations, members, invitations, SSO, and RBAC endpoints */
export const orgSection = {
  title: 'Organizations',
  description: 'Create and manage organizations',
  endpoints: [
    {
      method: 'POST',
      path: '/api/organizations',
      auth: 'bearer',
      description: 'Create a new organization',
      requestBody: { name: 'string', slug: 'string' },
      response: { data: 'Organization' },
    },
    {
      method: 'GET',
      path: '/api/organizations',
      auth: 'bearer',
      description: 'List organizations the user belongs to',
      response: { data: 'Organization[]' },
    },
    {
      method: 'GET',
      path: '/api/organizations/:orgId',
      auth: 'bearer',
      description: 'Get organization details',
      response: { data: 'Organization' },
    },
    {
      method: 'PATCH',
      path: '/api/organizations/:orgId',
      auth: 'bearer (org.update)',
      description: 'Update organization name or settings',
      requestBody: { name: 'string?' },
      response: { data: 'Organization' },
    },
    {
      method: 'DELETE',
      path: '/api/organizations/:orgId',
      auth: 'bearer (org.delete)',
      description: 'Delete organization and cascade resources',
      response: 'null (204)',
    },
  ],
} as const;

export const orgMemberSection = {
  title: 'Organization Members',
  description: 'Manage members and roles within organizations',
  endpoints: [
    {
      method: 'PATCH',
      path: '/api/organizations/:orgId/members/:memberId',
      auth: 'bearer (member.changeRole)',
      description: 'Change a member role',
      requestBody: { role: 'string (owner|admin|member|viewer)' },
      response: { data: 'OrgMember' },
    },
    {
      method: 'DELETE',
      path: '/api/organizations/:orgId/members/:memberId',
      auth: 'bearer (member.remove)',
      description: 'Remove a member from the organization',
      response: 'null (204)',
    },
    {
      method: 'POST',
      path: '/api/organizations/:orgId/members/leave',
      auth: 'bearer',
      description: 'Leave an organization (non-owners)',
      response: 'null (204)',
    },
  ],
} as const;

export const invitationSection = {
  title: 'Invitations',
  description: 'Invite team members to an organization',
  endpoints: [
    {
      method: 'POST',
      path: '/api/organizations/:orgId/invitations',
      auth: 'bearer (member.invite)',
      description: 'Send an invitation email',
      requestBody: { email: 'string', role: 'string?' },
      response: { data: 'Invitation' },
    },
    {
      method: 'GET',
      path: '/api/organizations/:orgId/invitations',
      auth: 'bearer',
      description: 'List pending invitations',
      response: { data: 'Invitation[]' },
    },
    {
      method: 'DELETE',
      path: '/api/organizations/:orgId/invitations/:id',
      auth: 'bearer (member.invite)',
      description: 'Cancel a pending invitation',
      response: 'null (204)',
    },
    {
      method: 'POST',
      path: '/api/organizations/invitations/:token/accept',
      auth: 'bearer',
      description: 'Accept an invitation using its token',
      response: { data: '{ orgId, role }' },
    },
  ],
} as const;


export const customRoleSection = {
  title: 'Custom Roles',
  description: 'Define custom RBAC roles per organization',
  endpoints: [
    {
      method: 'GET',
      path: '/api/organizations/:orgId/roles',
      auth: 'bearer (member.view)',
      description: 'List custom roles for the organization',
      response: { data: 'CustomRole[]' },
    },
    {
      method: 'POST',
      path: '/api/organizations/:orgId/roles',
      auth: 'bearer (member.view)',
      description: 'Create a custom role with specific permissions',
      requestBody: { name: 'string', permissions: 'string[]' },
      response: { data: 'CustomRole' },
    },
    {
      method: 'PATCH',
      path: '/api/organizations/:orgId/roles/:id',
      auth: 'bearer (member.view)',
      description: 'Update a custom role',
      response: { data: 'CustomRole' },
    },
    {
      method: 'DELETE',
      path: '/api/organizations/:orgId/roles/:id',
      auth: 'bearer (member.view)',
      description: 'Delete a custom role',
      response: 'null (204)',
    },
  ],
} as const;

