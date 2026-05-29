package sdlc.data_access

# Default deny policy
default allow = false

# Allow data access based on multiple factors
allow {
    # User authentication and tenant verification
    input.auth.valid
    input.user.tenant_id == input.tenant.id
    input.tenant.status == "active"

    # Data access permissions
    has_data_access_permission(input.user, input.data)

    # Data classification check
    classification_check(input.user, input.data)

    # Purpose-based access control
    purpose_check(input.user, input.data, input.purpose)

    # Geographic restrictions
    geographic_check(input.user, input.data)

    # Time-based restrictions
    time_based_check(input.user, input.data)

    # Consent verification
    consent_check(input.user, input.data)
}

# Data access permission check
has_data_access_permission(user, data) {
    some permission in user.data_permissions
    permission.data_type == data.type
    permission.action == "read"
    permission.scope == data.scope
}

has_data_access_permission(user, data) {
    user.role == "admin"
}

# Data classification check
classification_check(user, data) {
    # User can access data at or below their clearance level
    user.clearance_level >= classification_levels[data.classification]
}

classification_check(user, data) {
    # User is data owner
    data.owner_id == user.id
}

# Classification levels with numeric values
classification_levels = {
    "public": 0,
    "internal": 1,
    "confidential": 2,
    "secret": 3,
    "top_secret": 4
}

# Purpose-based access control
purpose_check(user, data, purpose) {
    # Check if the purpose is allowed for this data type
    some allowed_purpose in data.allowed_purposes
    allowed_purpose == purpose
}

purpose_check(user, data, purpose) {
    # Check if user has this purpose in their profile
    some user_purpose in user.purposes
    user_purpose == purpose
}

# Geographic restrictions
geographic_check(user, data) {
    # Data without geographic restrictions
    not data.geographic_restrictions
}

geographic_check(user, data) {
    # User location is allowed for this data
    some restriction in data.geographic_restrictions
    user.location.country in restriction.allowed_countries
}

geographic_check(user, data) {
    # Data residency compliance
    data.residency_requirement == user.location.country
}

# Time-based restrictions
time_based_check(user, data) {
    # No time-based restrictions
    not data.time_restrictions
}

time_based_check(user, data) {
    # Check access window
    current_time := time.now_ns() / 1000000
    current_time >= data.time_restrictions.access_start
    current_time <= data.time_restrictions.access_end
}

time_based_check(user, data) {
    # Check business hours for sensitive data
    data.classification in {"confidential", "secret", "top_secret"}
    business_hours_check()
}

business_hours_check() {
    current_hour := time.hour(time.now_ns())
    business_hours := {9, 10, 11, 12, 13, 14, 15, 16, 17}
    current_hour in business_hours
}

business_hours_check() {
    # Allow weekend access for emergency situations
    current_day := time.weekday(time.now_ns())
    weekend_days := {0, 6}  # Sunday=0, Saturday=6
    current_day in weekend_days
    input.emergency_access == true
}

# Consent verification
consent_check(user, data) {
    # Public data doesn't require consent
    data.classification == "public"
}

consent_check(user, data) {
    # User is the data owner
    data.owner_id == user.id
}

consent_check(user, data) {
    # Check for explicit consent
    some consent in data.consents
    consent.user_id == user.id
    consent.granted == true
    consent.expires_at > time.now_ns() / 1000000
    consent.purpose == input.purpose
}

consent_check(user, data) {
    # Check for implied consent through role
    implied_consent_roles[data.type][user.role]
}

# Implied consent by role and data type
implied_consent_roles = {
    "customer_data": {
        "customer_service": true,
        "sales": true,
        "marketing": true
    },
    "financial_data": {
        "finance": true,
        "accounting": true,
        "audit": true
    },
    "hr_data": {
        "hr": true,
        "management": true
    },
    "operational_data": {
        "operations": true,
        "management": true,
        "analyst": true
    }
}

# Field-level access control
field_access_allowed(user, data, field) {
    # User can access all fields
    user.role == "admin"
}

field_access_allowed(user, data, field) {
    # User is data owner
    data.owner_id == user.id
}

field_access_allowed(user, data, field) {
    # Field is not restricted
    not field_restricted[field]
}

field_access_allowed(user, data, field) {
    # User has explicit field access
    some field_permission in user.field_permissions
    field_permission.data_type == data.type
    field_permission.field == field
    field_permission.access == true
}

# Restricted fields by classification
field_restricted = {
    "ssn": {"classification": "confidential"},
    "credit_card": {"classification": "confidential"},
    "medical_record": {"classification": "secret"},
    "salary": {"classification": "confidential"},
    "performance_review": {"classification": "secret"}
}

# Data masking requirements
should_mask_field(user, data, field) {
    field_access_allowed(user, data, field)
    not should_show_full_data(user, data, field)
}

should_show_full_data(user, data, field) {
    # Users with full access privileges
    user.role in {"admin", "data_owner"}
}

should_show_full_data(user, data, field) {
    # User is the data owner
    data.owner_id == user.id
}

should_show_full_data(user, data, field) {
    # Explicit full access permission
    some permission in user.field_permissions
    permission.data_type == data.type
    permission.field == field
    permission.full_access == true
}

# Data retention policy
data_retention_check(data) {
    # Data is within retention period
    current_time := time.now_ns() / 1000000
    retention_end := data.created_at + (data.retention_period_days * 24 * 60 * 60 * 1000)
    current_time <= retention_end
}

data_retention_check(data) {
    # Legal hold overrides retention
    data.legal_hold == true
}

data_retention_check(data) {
    # Essential business data
    data.essential_business_data == true
}

# Data minimization principle
data_minimization_check(user, requested_fields) {
    # Only request necessary fields for the purpose
    necessary_fields := required_fields_for_purpose[input.purpose]
    count(requested_fields) <= count(necessary_fields)

    # All requested fields are necessary
    every field in requested_fields {
        field in necessary_fields
    }
}

# Required fields by purpose
required_fields_for_purpose = {
    "customer_service": ["name", "email", "account_id", "support_history"],
    "marketing": ["name", "email", "preferences", "marketing_consent"],
    "analytics": ["usage_data", "demographics", "behavior_data"],
    "compliance": ["all"],  # Full access for compliance purposes
    "research": ["anonymized_data", "usage_patterns", "statistics"]
}

# Audit trail requirements
audit_required(user, data, action) {
    # High classification data access
    data.classification in {"confidential", "secret", "top_secret"}
}

audit_required(user, data, action) {
    # Sensitive actions
    action in {"export", "download", "share", "delete"}
}

audit_required(user, data, action) {
    # Admin actions
    user.role == "admin"
}

# Policy decision explanation
decision_reason[reason] {
    allow
    reason := "Data access granted: user has appropriate permissions and meets all access requirements"
}

decision_reason[reason] {
    not allow
    not input.auth.valid
    reason := "Access denied: invalid authentication"
}

decision_reason[reason] {
    not allow
    input.user.tenant_id != input.tenant.id
    reason := "Access denied: tenant mismatch"
}

decision_reason[reason] {
    not allow
    not has_data_access_permission(input.user, input.data)
    reason := "Access denied: insufficient data access permissions"
}

decision_reason[reason] {
    not allow
    not classification_check(input.user, input.data)
    reason := "Access denied: insufficient clearance level for data classification"
}

decision_reason[reason] {
    not allow
    not purpose_check(input.user, input.data, input.purpose)
    reason := "Access denied: purpose not authorized for this data"
}
