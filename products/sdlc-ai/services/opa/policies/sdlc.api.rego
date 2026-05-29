package sdlc.api

# Default deny for API access
default allow = false

# Allow API access if all conditions are met
allow {
    # Authentication is valid
    authentication_valid(input.authentication)

    # User has API access permissions
    api_access_authorized(input.user_id, input.api_key, input.endpoint)

    # Rate limits are not exceeded
    api_rate_limits_ok(input.user_id, input.tenant_id, input.endpoint)

    # API version is supported
    api_version_supported(input.api_version)

    # Request format is valid
    request_format_valid(input.request)

    # Content security policies are satisfied
    content_security_check(input.request)

    # Endpoint-specific authorization
    endpoint_authorized(input.user_id, input.endpoint, input.method)

    # Request size limits are respected
    request_size_ok(input.request_size)

    # Time-based restrictions are satisfied
    api_time_restrictions_ok(input.user_id, input.endpoint)

    # Geographic access controls are satisfied
    api_geo_restrictions_ok(input.user_id, input.client_ip)

    # Audit and monitoring requirements are met
    audit_requirements_met(input.endpoint, input.method)
}

# Authentication validation
authentication_valid(auth) {
    # Authentication token is valid
    auth.token_valid == true

    # User is active
    user := data.users[auth.user_id]
    user.status == "active"

    # Session is valid
    auth.session_valid == true

    # Multi-factor authentication if required
    mfa_requirement_satisfied(auth.user_id, input.endpoint)
}

# API access authorization
api_access_authorized(user_id, api_key, endpoint) {
    # API key is valid and active
    key := data.api_keys[api_key]
    key.active == true
    key.user_id == user_id

    # API key has permission for this endpoint
    endpoint_permissions := get_endpoint_permissions(endpoint)
    key.permissions >= endpoint_permissions
}

api_access_authorized(user_id, api_key, endpoint) {
    # User has direct endpoint permissions (no API key required)
    user := data.users[user_id]
    endpoint_permissions := get_endpoint_permissions(endpoint)
    user.api_permissions >= endpoint_permissions
}

# Rate limiting
api_rate_limits_ok(user_id, tenant_id, endpoint) {
    # User-level rate limits
    user_rate_limit := get_user_rate_limit(user_id, endpoint)
    current_user_requests := get_current_user_requests(user_id, endpoint)
    current_user_requests < user_rate_limit
}

api_rate_limits_ok(user_id, tenant_id, endpoint) {
    # Tenant-level rate limits
    tenant_rate_limit := get_tenant_rate_limit(tenant_id, endpoint)
    current_tenant_requests := get_current_tenant_requests(tenant_id, endpoint)
    current_tenant_requests < tenant_rate_limit
}

api_rate_limits_ok(user_id, tenant_id, endpoint) {
    # Global API rate limits
    global_rate_limit := data.global_rate_limits[endpoint]
    current_global_requests := get_current_global_requests(endpoint)
    current_global_requests < global_rate_limit
}

# API version support
api_version_supported(version) {
    version in data.supported_api_versions
}

# Request format validation
request_format_valid(request) {
    # Content type is supported
    request.content_type in data.supported_content_types

    # Required headers are present
    required_headers := data.required_headers[request.endpoint]
    required_headers <= {header | request.headers[header]}

    # Request body is valid JSON (if applicable)
    is_json_request(request) -> json_valid(request.body)
}

# Content security
content_security_check(request) {
    # No malicious content detected
    not contains_malicious_content(request.body)

    # No SQL injection attempts
    not contains_sql_injection(request.body)

    # No XSS attempts
    not contains_xss_patterns(request.body)

    # File upload security (if applicable)
    file_upload_security_ok(request)
}

# Endpoint authorization
endpoint_authorized(user_id, endpoint, method) {
    # User has permission for this endpoint and method
    user := data.users[user_id]
    endpoint_method_permission := sprintf("%s:%s", [endpoint, method])
    endpoint_method_permission in user.endpoint_permissions
}

endpoint_authorized(user_id, endpoint, method) {
    # User's role grants permission
    user := data.users[user_id]
    role_permissions := data.role_endpoint_permissions[user.role]
    endpoint_method_permission := sprintf("%s:%s", [endpoint, method])
    endpoint_method_permission in role_permissions
}

# Request size limits
request_size_ok(request_size) {
    # Request size is within allowed limits
    request_size <= data.max_request_size
}

# Time-based restrictions
api_time_restrictions_ok(user_id, endpoint) {
    # No time restrictions for this endpoint
    not has_time_restrictions(endpoint)
}

api_time_restrictions_ok(user_id, endpoint) {
    # Current time is within allowed window
    restrictions := data.api_time_restrictions[endpoint]
    current_time := time.now_ns()

    # Check day of week
    day_of_week := time.weekday(current_time)
    day_of_week in restrictions.allowed_days

    # Check time range
    hour_of_day := time.hour(current_time)
    hour_of_day >= restrictions.start_hour
    hour_of_day <= restrictions.end_hour
}

# Geographic access controls
api_geo_restrictions_ok(user_id, client_ip) {
    # No geographic restrictions for this user
    user := data.users[user_id]
    count(user.geo_restrictions) == 0
}

api_geo_restrictions_ok(user_id, client_ip) {
    # Client location is allowed
    user := data.users[user_id]
    client_country := geoip_lookup(client_ip)
    client_country in user.geo_restrictions.allowed_countries
}

# Audit requirements
audit_requirements_met(endpoint, method) {
    # High-risk operations require audit logging
    is_high_risk_operation(endpoint, method)
    true
}

# Helper functions

# MFA requirement check
mfa_requirement_satisfied(user_id, endpoint) {
    # MFA not required for this endpoint
    not mfa_required_for_endpoint(endpoint)
}

mfa_requirement_satisfied(user_id, endpoint) {
    # User has completed MFA
    mfa_required_for_endpoint(endpoint)
    mfa_session := data.mfa_sessions[user_id]
    mfa_session.valid == true
    mfa_session.expires_at > time.now_ns()
}

# Get endpoint permissions
get_endpoint_permissions(endpoint) = permissions {
    permissions := data.endpoint_permissions[endpoint]
}

# Rate limit helpers
get_user_rate_limit(user_id, endpoint) = limit {
    user := data.users[user_id]
    limit := user.rate_limits[endpoint]
}

get_tenant_rate_limit(tenant_id, endpoint) = limit {
    limit := data.tenant_rate_limits[tenant_id][endpoint]
}

get_current_user_requests(user_id, endpoint) = count {
    count := data.api_metrics.user_requests[user_id][endpoint][time.hour_now()]
}

get_current_tenant_requests(tenant_id, endpoint) = count {
    count := data.api_metrics.tenant_requests[tenant_id][endpoint][time.hour_now()]
}

get_current_global_requests(endpoint) = count {
    count := data.api_metrics.global_requests[endpoint][time.hour_now()]
}

# Request validation helpers
is_json_request(request) = true {
    request.content_type == "application/json"
}

json_valid(body) = valid {
    # Simple JSON validation
    # In a real implementation, you'd parse and validate the JSON
    contains(body, "{") and contains(body, "}")
}

# Security content checks
contains_malicious_content(body) = malicious {
    malicious_patterns := data.security.malicious_patterns
    some pattern in malicious_patterns
    contains(lower(body), lower(pattern))
}

contains_sql_injection(body) = injection {
    sql_patterns := ["'", "\"", "--", "/*", "*/", "xp_", "sp_", "SELECT", "INSERT", "UPDATE", "DELETE"]
    some pattern in sql_patterns
    contains(upper(body), pattern)
}

contains_xss_patterns(body) = xss {
    xss_patterns := ["<script", "</script>", "javascript:", "onload=", "onerror=", "onclick="]
    some pattern in xss_patterns
    contains(lower(body), pattern)
}

file_upload_security_ok(request) = secure {
    # No file upload
    not has_file_upload(request)
}

file_upload_security_ok(request) = secure {
    # File upload with security checks
    has_file_upload(request)
    file_type_allowed(request.file_type)
    file_size_ok(request.file_size)
    virus_scan_passed(request.file_hash)
}

has_file_upload(request) = true {
    request.content_type == "multipart/form-data"
}

file_type_allowed(file_type) = allowed {
    allowed_types := data.security.allowed_file_types
    file_type in allowed_types
}

file_size_ok(file_size) = ok {
    file_size <= data.security.max_file_size
}

virus_scan_passed(file_hash) = clean {
    # Check against virus scan results
    data.virus_scan_results[file_hash].clean == true
}

# Time restriction helpers
has_time_restrictions(endpoint) = restricted {
    count(data.api_time_restrictions[endpoint]) > 0
}

mfa_required_for_endpoint(endpoint) = required {
    endpoint in data.security.mfa_required_endpoints
}

# High-risk operation detection
is_high_risk_operation(endpoint, method) = high_risk {
    high_risk_operations := data.security.high_risk_operations
    operation := sprintf("%s:%s", [endpoint, method])
    operation in high_risk_operations
}

# GeoIP lookup (mock implementation)
geoip_lookup(ip_address) = country {
    country := data.geoip[ip_address]
}

# Time utilities
time.hour_now() = hour {
    now := time.now_ns()
    hour := (now / 1000000000 / 3600) % 24
}

# Decision reason explanations
decision_reason[reason] {
    allow
    reasons := [
        "Authentication is valid",
        "User has API access permissions",
        "Rate limits are within acceptable bounds",
        "API version is supported",
        "Request format is valid",
        "Content security checks passed",
        "Endpoint authorization successful",
        "Request size limits are respected",
        "Time-based restrictions are satisfied",
        "Geographic access controls are satisfied",
        "Audit requirements will be met",
    ]
    reason := concat("; ", [r | r := reasons[_]; r != ""])
}

decision_reason[reason] {
    not allow
    reasons := [
        auth_invalid_reason,
        api_access_denied_reason,
        rate_limit_exceeded_reason,
        api_version_unsupported_reason,
        request_format_invalid_reason,
        content_security_violation_reason,
        endpoint_unauthorized_reason,
        request_size_exceeded_reason,
        time_restriction_violation_reason,
        geo_restriction_violation_reason,
    ]
    reason := concat("; ", [r | r := reasons[_]; r != ""])
}

# Denial reasons
auth_invalid_reason = "Authentication is invalid or expired" {
    not authentication_valid(input.authentication)
}

api_access_denied_reason = "User lacks API access permissions or API key is invalid" {
    not api_access_authorized(input.user_id, input.api_key, input.endpoint)
}

rate_limit_exceeded_reason = "API rate limits have been exceeded" {
    not api_rate_limits_ok(input.user_id, input.tenant_id, input.endpoint)
}

api_version_unsupported_reason = "API version is not supported" {
    not api_version_supported(input.api_version)
}

request_format_invalid_reason = "Request format is invalid or missing required headers" {
    not request_format_valid(input.request)
}

content_security_violation_reason = "Request content violates security policies" {
    not content_security_check(input.request)
}

endpoint_unauthorized_reason = "User is not authorized to access this endpoint with this method" {
    not endpoint_authorized(input.user_id, input.endpoint, input.method)
}

request_size_exceeded_reason = "Request size exceeds allowed limits" {
    not request_size_ok(input.request_size)
}

time_restriction_violation_reason = "API access is not allowed at this time" {
    not api_time_restrictions_ok(input.user_id, input.endpoint)
}

geo_restriction_violation_reason = "Geographic access restrictions prevent API access" {
    not api_geo_restrictions_ok(input.user_id, input.client_ip)
}
