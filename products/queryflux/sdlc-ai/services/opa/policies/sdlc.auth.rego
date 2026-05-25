package sdlc.auth

# Default deny for authentication
default allow = false

# Allow if authentication is valid and user has appropriate permissions
allow {
    # JWT token is valid and not expired
    is_token_valid(input.authentication)

    # User is active and not locked
    is_user_active(input.authentication.user_id)

    # Device fingerprint is valid (if present)
    device_fingerprint_valid(input.authentication)

    # Session is valid and not expired
    is_session_valid(input.authentication.session_id)

    # Tenant is active and in good standing
    is_tenant_active(input.authentication.tenant_id)

    # User has required permissions for the requested action
    has_required_permissions(input.authentication, input.action, input.resource)

    # Rate limits are not exceeded
    within_rate_limits(input.authentication.user_id, input.tenant_id)

    # IP address is not blacklisted
    ip_address_allowed(input.authentication.ip_address)

    # Geographic compliance
    geographic_compliance(input.authentication)
}

# Token validation
is_token_valid(auth) {
    # Token exists and is properly formatted
    auth.token_id != ""

    # Token signature is valid (verified by JWT service)
    auth.token_signature_valid == true

    # Token is not expired
    auth.expires_at > time.now_ns()

    # Token is issued by trusted authority
    auth.issuer in valid_issuers

    # Token is not revoked
    not token_revoked(auth.token_id)
}

# User status validation
is_user_active(user_id) {
    # User exists in system
    user := data.users[user_id]

    # User is active
    user.status == "active"

    # User is not locked
    user.locked != true

    # User email is verified
    user.email_verified == true

    # User is not suspended
    user.suspended != true
}

# Device fingerprint validation
device_fingerprint_valid(auth) {
    # No device fingerprint required for this user type
    not requires_device_fingerprint(auth.user_id)
}

device_fingerprint_valid(auth) {
    # Device fingerprint is required and matches
    requires_device_fingerprint(auth.user_id)
    auth.device_fingerprint == user_devices[auth.user_id][auth.device_id].fingerprint
}

# Session validation
is_session_valid(session_id) {
    # Session exists
    session := data.sessions[session_id]

    # Session is active
    session.status == "active"

    # Session is not expired
    session.expires_at > time.now_ns()

    # Session has not been revoked
    session.revoked != true
}

# Tenant validation
is_tenant_active(tenant_id) {
    # Tenant exists
    tenant := data.tenants[tenant_id]

    # Tenant is active
    tenant.status == "active"

    # Tenant is not suspended
    tenant.suspended != true

    # Tenant subscription is valid
    tenant.subscription_status in ["active", "trial"]

    # Tenant is in good compliance standing
    tenant.compliance_status == "good"
}

# Permission validation
has_required_permissions(auth, action, resource) {
    # Super admins have all permissions
    auth.role == "super_admin"
}

has_required_permissions(auth, action, resource) {
    # Tenant admins have tenant-wide permissions
    auth.role == "tenant_admin"
    resource_tenant_id := split(resource, ":")[0]
    auth.tenant_id == resource_tenant_id
}

has_required_permissions(auth, action, resource) {
    # Check specific permissions
    required_permission := get_required_permission(action, resource)
    required_permission in auth.permissions
}

# Rate limit validation
within_rate_limits(user_id, tenant_id) {
    # User rate limits
    user_rate_limit := data.rate_limits.users[user_id]
    current_user_requests := data.metrics.user_requests[user_id][time.hour_now()]
    current_user_requests <= user_rate_limit.requests_per_hour
}

within_rate_limits(user_id, tenant_id) {
    # Tenant rate limits
    tenant_rate_limit := data.rate_limits.tenants[tenant_id]
    current_tenant_requests := data.metrics.tenant_requests[tenant_id][time.hour_now()]
    current_tenant_requests <= tenant_rate_limit.requests_per_hour
}

# IP address validation
ip_address_allowed(ip_address) {
    # IP is not in blacklist
    not ip_address in data.security.blacklisted_ips
}

ip_address_allowed(ip_address) {
    # IP is in whitelist (if whitelist is configured)
    count(data.security.whitelisted_ips) == 0
}

ip_address_allowed(ip_address) {
    # IP is in whitelist
    count(data.security.whitelisted_ips) > 0
    ip_address in data.security.whitelisted_ips
}

# Geographic compliance
geographic_compliance(auth) {
    # No geographic restrictions for this tenant
    count(data.tenants[auth.tenant_id].allowed_countries) == 0
}

geographic_compliance(auth) {
    # User location is in allowed countries
    user_country := geoip_lookup(auth.ip_address)
    user_country in data.tenants[auth.tenant_id].allowed_countries
}

# Token revocation check
token_revoked(token_id) {
    token_id in data.security.revoked_tokens
}

# Device fingerprint requirement
requires_device_fingerprint(user_id) {
    data.users[user_id].security_level in ["high", "maximum"]
}

# Permission mapping
get_required_permission(action, resource) = permission {
    # Map actions and resources to permissions
    permission_map := {
        # Data permissions
        ("read", "data:documents"): "documents:read",
        ("write", "data:documents"): "documents:write",
        ("delete", "data:documents"): "documents:delete",
        ("share", "data:documents"): "documents:share",

        # User permissions
        ("read", "users"): "users:read",
        ("write", "users"): "users:write",
        ("delete", "users"): "users:delete",

        # Policy permissions
        ("read", "policies"): "policies:read",
        ("write", "policies"): "policies:write",
        ("delete", "policies"): "policies:delete",

        # System permissions
        ("read", "system:metrics"): "system:metrics:read",
        ("write", "system:config"): "system:config:write",
    }

    permission := permission_map[(action, resource)]
}

# Helper functions
valid_issuers := {"sdlc-auth", "sdlc-platform"}

# Time utilities
time.hour_now() = hour {
    now := time.now_ns()
    hour := (now / 1000000000 / 3600) % 24
}

# Geographic IP lookup (mock implementation)
geoip_lookup(ip_address) = country {
    # In a real implementation, this would use a GeoIP database
    # For now, return a default or look up from data
    country := data.geoip[ip_address]
}

# Decision reason explanation
decision_reason[reason] {
    allow
    reasons := [
        token_valid_reason,
        user_active_reason,
        session_valid_reason,
        tenant_active_reason,
        permissions_reason,
        rate_limit_reason,
        ip_allowed_reason,
        geo_compliance_reason,
    ]
    reason := concat(", ", [r | r := reasons[_]; r != ""])
}

decision_reason[reason] {
    not allow
    reasons := [
        token_invalid_reason,
        user_inactive_reason,
        session_invalid_reason,
        tenant_inactive_reason,
        permissions_denied_reason,
        rate_limit_exceeded_reason,
        ip_blocked_reason,
        geo_compliance_failed_reason,
    ]
    reason := concat(", ", [r | r := reasons[_]; r != ""])
}

# Reason components
token_valid_reason = "Token is valid and not expired" {
    is_token_valid(input.authentication)
}

user_active_reason = "User is active and not locked" {
    is_user_active(input.authentication.user_id)
}

session_valid_reason = "Session is valid and not expired" {
    is_session_valid(input.authentication.session_id)
}

tenant_active_reason = "Tenant is active and in good standing" {
    is_tenant_active(input.authentication.tenant_id)
}

permissions_reason = "User has required permissions" {
    has_required_permissions(input.authentication, input.action, input.resource)
}

rate_limit_reason = "Rate limits are within acceptable bounds" {
    within_rate_limits(input.authentication.user_id, input.tenant_id)
}

ip_allowed_reason = "IP address is allowed" {
    ip_address_allowed(input.authentication.ip_address)
}

geo_compliance_reason = "Geographic compliance requirements are met" {
    geographic_compliance(input.authentication)
}

# Negative reasons
token_invalid_reason = "Token is invalid, expired, or revoked" {
    not is_token_valid(input.authentication)
}

user_inactive_reason = "User is inactive, locked, or suspended" {
    not is_user_active(input.authentication.user_id)
}

session_invalid_reason = "Session is invalid, expired, or revoked" {
    not is_session_valid(input.authentication.session_id)
}

tenant_inactive_reason = "Tenant is inactive or suspended" {
    not is_tenant_active(input.authentication.tenant_id)
}

permissions_denied_reason = "User lacks required permissions" {
    not has_required_permissions(input.authentication, input.action, input.resource)
}

rate_limit_exceeded_reason = "Rate limits have been exceeded" {
    not within_rate_limits(input.authentication.user_id, input.tenant_id)
}

ip_blocked_reason = "IP address is blocked or not allowed" {
    not ip_address_allowed(input.authentication.ip_address)
}

geo_compliance_failed_reason = "Geographic compliance requirements are not met" {
    not geographic_compliance(input.authentication)
}
