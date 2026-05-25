// @ts-nocheck
/**
 * Security rule snippets for the Rego Editor
 */

export const securitySnippets = [
  {
    label: 'Authentication Check',
    insertText: `package authz

default allow = false

allow {
    input.user.authenticated
    input.user.mfa_verified
    time.now_ns() - input.user.last_login < 86400000000000
}`,
    documentation: 'Basic authentication check with MFA requirement'
  },
  {
    label: 'Role-Based Access Control',
    insertText: `package rbac

default allow = false

allow {
    user_roles := data.roles[input.user.id]
    required_roles := data.resources[input.resource.id].roles
    count(user_roles & required_roles) > 0
}`,
    documentation: 'RBAC implementation with role checking'
  },
  {
    label: 'Data Access Control',
    insertText: `package data_access

default allow = false

allow {
    input.user.clearance >= input.data.classification
    data.purpose_allowed[input.context.purpose]
    not data.restricted_data[input.data.type]
}`,
    documentation: 'Data access control with clearance levels'
  },
  {
    label: 'API Rate Limiting',
    insertText: `package rate_limit

default allow = true

deny {
    count(requests[input.user.id][time.now_ns() // 1000000000]) > 100
}

requests[user_id][t] := req {
    req := input.requests[_]
    req.user.id == user_id
    req.timestamp // 1000000000 == t
}`,
    documentation: 'API rate limiting implementation'
  },
  {
    label: 'Compliance Check',
    insertText: `package compliance

default compliant = false

compliant {
    data.controls.gdpr.data_protection.enabled
    data.controls.sox.access_logs.enabled
    data.controls.pci.encryption_enabled
}`,
    documentation: 'Multi-framework compliance check'
  }
];
