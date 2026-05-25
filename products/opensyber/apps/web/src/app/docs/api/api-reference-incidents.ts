/** Security incident endpoints */
export const incidentSection = {
  title: 'Incidents',
  description: 'Security incident lifecycle management',
  endpoints: [
    {
      method: 'GET',
      path: '/api/security/instances/:instanceId/incidents',
      auth: 'bearer',
      description: 'List incidents for an instance',
      response: { data: 'Incident[]' },
    },
    {
      method: 'POST',
      path: '/api/security/instances/:instanceId/incidents',
      auth: 'bearer (incident.create)',
      description: 'Create a new security incident',
      requestBody: { title: 'string', severity: 'string', description: 'string' },
      response: { data: 'Incident' },
    },
    {
      method: 'PATCH',
      path: '/api/security/instances/:instanceId/incidents/:incidentId',
      auth: 'bearer (incident.update)',
      description: 'Update incident status or details',
      requestBody: { status: 'string?', assigneeId: 'string?' },
      response: { data: 'Incident' },
    },
    {
      method: 'GET',
      path: '/api/security/instances/:instanceId/incidents/:incidentId',
      auth: 'bearer',
      description: 'Get incident detail with timeline events',
      response: { data: '{ incident, events }' },
    },
    {
      method: 'POST',
      path: '/api/security/instances/:instanceId/incidents/:incidentId/events',
      auth: 'bearer (incident.update)',
      description: 'Add a timeline event to an incident',
      requestBody: { type: 'string', content: 'string' },
      response: { data: 'IncidentEvent' },
    },
    {
      method: 'POST',
      path: '/api/security/instances/:instanceId/incidents/:incidentId/assign',
      auth: 'bearer (incident.update)',
      description: 'Assign an incident to a team member',
      requestBody: { assigneeId: 'string' },
      response: { data: 'Incident' },
    },
  ],
} as const;
