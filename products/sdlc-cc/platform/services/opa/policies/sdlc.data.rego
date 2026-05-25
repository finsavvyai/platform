package sdlc.data

# Default deny for data access
default allow = false

# Allow data access if all conditions are met
allow {
    # User is authenticated
    input.user_id != ""

    # Tenant isolation is respected
    tenant_isolation_check(input.tenant_id, input.resource)

    # User has appropriate data access permissions
    has_data_access_permissions(input.user_id, input.action, input.resource, input.data)

    # Purpose-based access control
    purpose_based_access_check(input.purpose, input.data, input.user_role)

    # Data classification and clearance level
    classification_clearance_check(input.user_id, input.data)

    # Field-level access control
    field_access_control(input.user_id, input.action, input.data)

    # Time-based access controls
    time_based_access_check(input.user_id, input.resource)

    # Data residency compliance
    data_residency_check(input.data, input.user_location)

    # Multi-factor authentication for sensitive data
    mfa_requirement_check(input.user_id, input.data)

    # Audit logging requirements
    audit_logging_check(input.action, input.data)
}

# Tenant isolation enforcement
tenant_isolation_check(tenant_id, resource) {
    # Resource belongs to the tenant
    resource_tenant_id := extract_tenant_id(resource)
    resource_tenant_id == tenant_id
}

tenant_isolation_check(tenant_id, resource) {
    # Super admin can access cross-tenant resources for administrative purposes
    user := data.users[input.user_id]
    user.role == "super_admin"
    input.action in ["read", "audit"]
}

# Data access permissions
has_data_access_permissions(user_id, action, resource, data) {
    # Check user's role-based permissions
    user := data.users[user_id]
    role_permissions := data.role_permissions[user.role]

    # Map resource and action to permission
    required_permission := get_data_permission(action, resource)
    required_permission in role_permissions
}

has_data_access_permissions(user_id, action, resource, data) {
    # Check user's specific permissions (overrides role permissions)
    user := data.users[user_id]
    required_permission := get_data_permission(action, resource)
    required_permission in user.specific_permissions
}

# Purpose-based access control
purpose_based_access_check(purpose, data, user_role) {
    # Data has no purpose restrictions
    count(data.purpose_restrictions) == 0
}

purpose_based_access_check(purpose, data, user_role) {
    # Purpose is explicitly allowed for this data
    purpose in data.purpose_restrictions.allowed_purposes
}

purpose_based_access_check(purpose, data, user_role) {
    # User role can override purpose restrictions for emergency situations
    user_role in ["super_admin", "compliance_officer"]
    purpose in ["emergency", "legal_compliance", "security_investigation"]
}

# Classification and clearance
classification_clearance_check(user_id, data) {
    # User has sufficient clearance for data classification
    user := data.users[user_id]
    data_classification := get_data_classification(data)
    user.clearance_level >= classification_clearance_levels[data_classification]
}

# Field-level access control
field_access_control(user_id, action, data) {
    # No field restrictions for this user/action combination
    not has_field_restrictions(user_id, action, data)
}

field_access_control(user_id, action, data) {
    # User has access to all requested fields
    user := data.users[user_id]
    requested_fields := get_requested_fields(data)

    # Check each requested field
    count(requested_fields) == count({field |
        field := requested_fields[_]
        field_accessible(user, field, action, data)
    })
}

# Time-based access controls
time_based_access_check(user_id, resource) {
    # No time restrictions for this resource
    not has_time_restrictions(resource)
}

time_based_access_check(user_id, resource) {
    # Current time is within allowed access window
    restrictions := data.time_restrictions[resource]
    current_time := time.now_ns()

    # Check day of week
    day_of_week := time.weekday(current_time)
    day_of_week in restrictions.allowed_days

    # Check time range
    hour_of_day := time.hour(current_time)
    hour_of_day >= restrictions.start_hour
    hour_of_day <= restrictions.end_hour
}

# Data residency compliance
data_residency_check(data, user_location) {
    # Data has no residency restrictions
    not has_residency_restrictions(data)
}

data_residency_check(data, user_location) {
    # User location complies with data residency requirements
    residency_requirements := get_data_residency_requirements(data)
    user_location.country in residency_requirements.allowed_countries
}

# MFA requirement check
mfa_requirement_check(user_id, data) {
    # MFA not required for this data sensitivity level
    data_classification := get_data_classification(data)
    data_classification not in ["confidential", "secret", "top_secret"]
}

mfa_requirement_check(user_id, data) {
    # User has completed MFA for sensitive data access
    data_classification := get_data_classification(data)
    data_classification in ["confidential", "secret", "top_secret"]

    # Check MFA status
    mfa_session := data.mfa_sessions[user_id]
    mfa_session.valid == true
    mfa_session.expires_at > time.now_ns()
}

# Audit logging check
audit_logging_check(action, data) {
    # Action requires audit logging
    requires_audit_logging(action, data)

    # Ensure audit log entry will be created
    # This is a policy check - actual logging happens in the application layer
    true
}

# Helper functions

# Extract tenant ID from resource identifier
extract_tenant_id(resource) = tenant_id {
    parts := split(resource, ":")
    tenant_id := parts[0]
}

# Get data permission based on action and resource type
get_data_permission(action, resource) = permission {
    resource_type := extract_resource_type(resource)
    permission_map := {
        ("read", "documents"): "data:documents:read",
        ("write", "documents"): "data:documents:write",
        ("delete", "documents"): "data:documents:delete",
        ("share", "documents"): "data:documents:share",
        ("read", "users"): "data:users:read",
        ("write", "users"): "data:users:write",
        ("delete", "users"): "data:users:delete",
        ("read", "analytics"): "data:analytics:read",
        ("write", "analytics"): "data:analytics:write",
    }
    permission := permission_map[(action, resource_type)]
}

extract_resource_type(resource) = resource_type {
    parts := split(resource, ":")
    resource_type := parts[1]
}

# Data classification
get_data_classification(data) = classification {
    # Classification specified in data
    classification := data.classification
}

get_data_classification(data) = classification {
    # Infer classification from content
    has_sensitive_fields(data) -> "confidential"
    has_pii_fields(data) -> "secret"
    has_financial_data(data) -> "top_secret"
    _ -> "public"
}

# Classification clearance levels
classification_clearance_levels := {
    "public": 0,
    "internal": 1,
    "confidential": 2,
    "secret": 3,
    "top_secret": 4,
}

# Field access checking
has_field_restrictions(user_id, action, data) {
    # User has field restrictions for this action
    user := data.users[user_id]
    count(user.field_restrictions) > 0
}

get_requested_fields(data) = fields {
    # Extract field names from data structure
    fields := {field | data[field]}
}

field_accessible(user, field, action, data) {
    # Field is not restricted for this user
    field not in user.field_restrictions
}

field_accessible(user, field, action, data) {
    # User has explicit access to this restricted field
    field := user.field_restrictions[_]
    field.accessible == true
    field.actions[allowed_action] == true
    allowed_action := action
}

# Time restriction checking
has_time_restrictions(resource) {
    count(data.time_restrictions[resource]) > 0
}

# Data residency checking
has_residency_restrictions(data) {
    data.residency_required == true
}

get_data_residency_requirements(data) = requirements {
    requirements := data.residency_requirements
}

# MFA and sensitive data checking
has_sensitive_fields(data) {
    # Check for sensitive content patterns
    sensitive_patterns := ["confidential", "internal use only", "proprietary"]
    some pattern in sensitive_patterns
    contains(data.content, pattern)
}

has_pii_fields(data) {
    # Check for PII patterns
    pii_patterns := ["ssn", "credit card", "social security", "driver license"]
    some pattern in pii_patterns
    contains(lower(data.content), pattern)
}

has_financial_data(data) {
    # Check for financial data patterns
    financial_patterns := ["bank account", "routing number", "investment", "portfolio"]
    some pattern in financial_patterns
    contains(lower(data.content), pattern)
}

# Audit logging requirements
requires_audit_logging(action, data) {
    # All actions on sensitive data require audit logging
    get_data_classification(data) != "public"
}

requires_audit_logging(action, data) {
    # High-risk actions always require audit logging
    action in ["delete", "share", "export", "download"]
}

# Decision reason explanations
decision_reason[reason] {
    allow
    reasons := [
        "User is authenticated",
        "Tenant isolation is respected",
        "User has appropriate data access permissions",
        "Purpose-based access control passed",
        "Classification and clearance requirements met",
        "Field-level access control passed",
        "Time-based access controls satisfied",
        "Data residency requirements met",
        "MFA requirements satisfied",
        "Audit logging requirements will be met",
    ]
    reason := concat("; ", reasons)
}

decision_reason[reason] {
    not allow
    reasons := [
        tenant_isolation_denied_reason,
        permissions_denied_reason,
        purpose_denied_reason,
        clearance_denied_reason,
        field_access_denied_reason,
        time_access_denied_reason,
        residency_denied_reason,
        mfa_denied_reason,
    ]
    reason := concat("; ", [r | r := reasons[_]; r != ""])
}

# Denial reasons
tenant_isolation_denied_reason = "Tenant isolation violation - resource belongs to different tenant" {
    not tenant_isolation_check(input.tenant_id, input.resource)
}

permissions_denied_reason = "User lacks required data access permissions" {
    not has_data_access_permissions(input.user_id, input.action, input.resource, input.data)
}

purpose_denied_reason = "Purpose-based access control violation - insufficient purpose justification" {
    not purpose_based_access_check(input.purpose, input.data, input.user_role)
}

clearance_denied_reason = "Insufficient clearance level for data classification" {
    not classification_clearance_check(input.user_id, input.data)
}

field_access_denied_reason = "Field-level access control violation - access to restricted fields denied" {
    not field_access_control(input.user_id, input.action, input.data)
}

time_access_denied_reason = "Time-based access control violation - access outside allowed time window" {
    not time_based_access_check(input.user_id, input.resource)
}

residency_denied_reason = "Data residency compliance violation - user location not allowed for this data" {
    not data_residency_check(input.data, input.user_location)
}

mfa_denied_reason = "Multi-factor authentication requirement not met for sensitive data access" {
    not mfa_requirement_check(input.user_id, input.data)
}
