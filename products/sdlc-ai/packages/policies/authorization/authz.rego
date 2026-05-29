package sdlc.authz

# Default deny policy
default allow = false

# Allow access if user has valid authentication and appropriate permissions
allow {
    # Authentication check
    input.auth.valid
    input.auth.expires_at > time.now_ns() / 1000000

    # Tenant check
    input.tenant.status == "active"
    input.user.tenant_id == input.tenant.id

    # Basic authorization
    has_permission(input.user, input.action, input.resource)

    # Resource-specific checks
    resource_access_allowed(input.user, input.resource, input.action)

    # Rate limiting check
    not rate_limited(input.user, input.action)
}

# Permission check function
has_permission(user, action, resource) {
    some permission in user.permissions
    permission.action == action
    permission.resource_type == resource.type
    permission.resource_id == "*"  # Wildcard for all resources
}

has_permission(user, action, resource) {
    some permission in user.permissions
    permission.action == action
    permission.resource_type == resource.type
    permission.resource_id == resource.id
}

# Role-based permissions
has_permission(user, action, resource) {
    role_permissions[user.role][action][resource.type]
}

# Role permissions matrix
role_permissions = {
    "admin": {
        "read": "*",
        "write": "*",
        "delete": "*",
        "manage": "*"
    },
    "data_scientist": {
        "read": "*",
        "write": ["documents", "queries"],
        "analyze": ["documents", "models"]
    },
    "analyst": {
        "read": ["documents", "reports"],
        "query": ["documents"]
    },
    "viewer": {
        "read": ["documents", "reports"]
    }
}

# Resource-specific access control
resource_access_allowed(user, resource, action) {
    # Document access control
    resource.type == "document"
    document_access_allowed(user, resource, action)
}

resource_access_allowed(user, resource, action) {
    # Query access control
    resource.type == "query"
    query_access_allowed(user, resource, action)
}

resource_access_allowed(user, resource, action) {
    # Admin resource access
    resource.type == "admin"
    user.role == "admin"
}

# Document access control
document_access_allowed(user, document, action) {
    # User can access documents they created
    document.created_by == user.id
}

document_access_allowed(user, document, action) {
    # User can access documents in their department
    some department in user.departments
    document.department == department
}

document_access_allowed(user, document, action) {
    # User can access public documents
    document.classification == "public"
}

document_access_allowed(user, document, action) {
    # Users with appropriate clearance can access classified documents
    document.classification != "public"
    user.clearance_level >= classification_levels[document.classification]
}

# Classification levels
classification_levels = {
    "public": 0,
    "internal": 1,
    "confidential": 2,
    "secret": 3,
    "top_secret": 4
}

# Query access control
query_access_allowed(user, query, action) {
    # All authenticated users can make read queries
    action == "read"
}

query_access_allowed(user, query, action) {
    # Data scientists and admins can make write queries
    action == "write"
    user.role in ["data_scientist", "admin"]
}

query_access_allowed(user, query, action) {
    # Only admins can execute admin queries
    action == "admin"
    user.role == "admin"
}

# Rate limiting check
rate_limited(user, action) {
    rate_limits[user.role][action] > 0
    user.usage[action] >= rate_limits[user.role][action]
}

# Role-based rate limits
rate_limits = {
    "admin": {
        "read": 10000,
        "write": 5000,
        "delete": 1000
    },
    "data_scientist": {
        "read": 1000,
        "write": 500,
        "analyze": 200
    },
    "analyst": {
        "read": 500,
        "query": 100
    },
    "viewer": {
        "read": 100
    }
}

# Purpose-based access control
purpose_based_access(user, resource, action) {
    # Check if user has legitimate purpose for access
    some purpose in user.purposes
    resource.allowed_purposes[_] == purpose
}

# Time-based access control
time_based_access(user, resource, action) {
    # Check business hours for sensitive operations
    sensitive_actions = {"delete", "admin", "export"}
    action in sensitive_actions

    current_hour := time.hour(time.now_ns())
    business_hours = {9, 10, 11, 12, 13, 14, 15, 16, 17}
    current_hour in business_hours
}

# Location-based access control
location_based_access(user, resource, action) {
    # Require specific locations for sensitive operations
    sensitive_resources = {"admin", "user_management", "system_config"}
    resource.type in sensitive_resources

    some location in user.allowed_locations
    user.current_location == location
}

# Multi-factor authentication requirement
mfa_required(user, resource, action) {
    # Require MFA for sensitive operations
    sensitive_actions = {"delete", "admin", "export_all", "system_config"}
    action in sensitive_actions

    not user.mfa_verified
}

# Consent check for data processing
consent_check(user, resource, action) {
    # Check user consent for data processing
    action == "process_data"

    some consent in user.consents
    consent.type == "data_processing"
    consent.granted == true
    consent.expires_at > time.now_ns() / 1000000
}

# Policy decision explanation
decision_reason[reason] {
    allow
    reason := "Access granted: user has valid permissions and meets all security requirements"
}

decision_reason[reason] {
    not allow
    reason := "Access denied: insufficient permissions or security requirements not met"
}
