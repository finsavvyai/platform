/**
 * Static catalog of every connector shipped in
 * services/gateway/internal/connectors/<name>/.
 *
 * Source of truth: this file mirrors the connector sub-packages.
 * Update both when adding a new connector.
 */

export interface ConnectorCatalogEntry {
  /** Canonical id matching the Go `Name()` constant. */
  name: string
  displayName: string
  vendor: string
  category: 'productivity' | 'communication' | 'crm' | 'support' | 'devtools'
  description: string
  /** Emoji or short text used as the marketplace card glyph. */
  icon: string
  docsUrl: string
}

export const CONNECTOR_CATALOG: ConnectorCatalogEntry[] = [
  {
    name: 'google_workspace',
    displayName: 'Google Workspace',
    vendor: 'Google',
    category: 'productivity',
    description: 'Index Drive, Docs, and Sheets via read-only OAuth scopes.',
    icon: 'G',
    docsUrl: 'https://developers.google.com/workspace',
  },
  {
    name: 'microsoft365',
    displayName: 'Microsoft 365',
    vendor: 'Microsoft',
    category: 'productivity',
    description: 'SharePoint, OneDrive, and Teams chat via Microsoft Graph (admin consent required).',
    icon: 'M',
    docsUrl: 'https://learn.microsoft.com/en-us/graph/overview',
  },
  {
    name: 'slack',
    displayName: 'Slack',
    vendor: 'Slack',
    category: 'communication',
    description: 'Channel + group history. Private channels require workspace admin opt-in.',
    icon: 'S',
    docsUrl: 'https://api.slack.com/',
  },
  {
    name: 'github',
    displayName: 'GitHub',
    vendor: 'GitHub',
    category: 'devtools',
    description: 'Repo contents, issues, and PRs via a GitHub App (no PATs).',
    icon: 'GH',
    docsUrl: 'https://docs.github.com/en/rest',
  },
  {
    name: 'atlassian',
    displayName: 'Atlassian',
    vendor: 'Atlassian',
    category: 'devtools',
    description: 'Jira + Confluence on Cloud (OAuth) and Server / Data Center (PAT).',
    icon: 'A',
    docsUrl: 'https://developer.atlassian.com/',
  },
  {
    name: 'notion',
    displayName: 'Notion',
    vendor: 'Notion',
    category: 'productivity',
    description: 'Pages, databases, and blocks via the Notion v1 API.',
    icon: 'N',
    docsUrl: 'https://developers.notion.com/',
  },
  {
    name: 'salesforce',
    displayName: 'Salesforce',
    vendor: 'Salesforce',
    category: 'crm',
    description: 'CRM objects via REST + Bulk API. Field-Level Security strictly enforced.',
    icon: 'SF',
    docsUrl: 'https://developer.salesforce.com/docs',
  },
  {
    name: 'zendesk',
    displayName: 'Zendesk',
    vendor: 'Zendesk',
    category: 'support',
    description: 'Tickets and comments via OAuth + Zendesk Webhooks.',
    icon: 'Z',
    docsUrl: 'https://developer.zendesk.com/',
  },
  {
    name: 'servicenow',
    displayName: 'ServiceNow',
    vendor: 'ServiceNow',
    category: 'support',
    description: 'Incidents, problems, and knowledge via the Table API; ACLs enforced server-side.',
    icon: 'SN',
    docsUrl: 'https://developer.servicenow.com/',
  },
  {
    name: 'hubspot',
    displayName: 'HubSpot',
    vendor: 'HubSpot',
    category: 'crm',
    description: 'CRM contacts, companies, and deals via CRM v3 API.',
    icon: 'HB',
    docsUrl: 'https://developers.hubspot.com/',
  },
]
