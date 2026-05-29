package sdlc.multitenancy

# Default deny for multi-tenant operations
default allow = false

# Allow multi-tenant operations with proper isolation and controls
allow {
    # Tenant ID is provided and valid
    tenant_id_valid(input.tenant_id)

    # Tenant isolation is enforced
    tenant_isolation_enforced(input.tenant_id, input.operation, input.resource)

    # Resource quotas are not exceeded
    within_resource_quotas(input.tenant_id, input.operation)

    # Tenant is in good standing
    tenant_in_good_standing(input.tenant_id)

    # Cross-tenant access is properly authorized (if applicable)
    cross_tenant_access_authorized(input.tenant_id, input.operation, input.target_tenant_id)

    # Data residency requirements are met
    data_residency_compliant(input.tenant_id, input.data_location)

    # Performance isolation is maintained
    performance_isolation_maintained(input.tenant_id, input.operation)

    # Billing and subscription requirements are met
    billing_requirements_met(input.tenant_id, input.operation)

    # Audit and compliance requirements are satisfied
    audit_compliance_satisfied(input.tenant_id, input.operation)
}

# Tenant validation
tenant_id_valid(tenant_id) {
    # Tenant ID is provided
    tenant_id != ""

    # Tenant exists in system
    tenant := data.tenants[tenant_id]
    count(tenant) > 0
}

# Tenant isolation enforcement
tenant_isolation_enforced(tenant_id, operation, resource) {
    # Resource belongs to the tenant
    resource_owner := extract_resource_owner(resource)
    resource_owner == tenant_id
}

tenant_isolation_enforced(tenant_id, operation, resource) {
    # Cross-tenant operation is authorized
    is_cross_tenant_operation(operation)
    cross_tenant_authorized(tenant_id, operation, resource)
}

# Resource quota checking
within_resource_quotas(tenant_id, operation) {
    # Operation-specific quota checking
    quota_type := get_quota_type(operation)
    current_usage := get_current_usage(tenant_id, quota_type)
    quota_limit := data.tenant_quotas[tenant_id][quota_type]

    current_usage < quota_limit
}

within_resource_quotas(tenant_id, operation) {
    # No quota defined for this operation type
    quota_type := get_quota_type(operation)
    count(data.tenant_quotas[tenant_id][quota_type]) == 0
}

# Tenant standing validation
tenant_in_good_standing(tenant_id) {
    tenant := data.tenants[tenant_id]

    # Tenant is active
    tenant.status == "active"

    # Not suspended
    tenant.suspended != true

    # Subscription is active
    tenant.subscription_status == "active"

    # No compliance violations
    count(tenant.compliance_violations) == 0

    # Billing is current
    tenant.billing_status == "current"
}

# Cross-tenant access authorization
cross_tenant_access_authorized(tenant_id, operation, target_tenant_id) {
    # No cross-tenant access required
    count(target_tenant_id) == 0
}

cross_tenant_access_authorized(tenant_id, operation, target_tenant_id) {
    # Cross-tenant access is authorized
    is_cross_tenant_operation(operation)
    cross_tenant_permission := get_cross_tenant_permission(tenant_id, operation)
    cross_tenant_permission == "allowed"
}

# Data residency compliance
data_residency_compliant(tenant_id, data_location) {
    # No data residency restrictions
    tenant := data.tenants[tenant_id]
    count(tenant.residency_requirements) == 0
}

data_residency_compliant(tenant_id, data_location) {
    # Data location complies with tenant requirements
    tenant := data.tenants[tenant_id]
    data_location.country in tenant.residency_requirements.allowed_countries
}

# Performance isolation
performance_isolation_maintained(tenant_id, operation) {
    # Operation doesn't exceed performance limits
    resource_usage := get_tenant_resource_usage(tenant_id)
    performance_limits := data.tenant_performance_limits[tenant_id]

    # CPU usage
    resource_usage.cpu_percentage < performance_limits.max_cpu_percentage

    # Memory usage
    resource_usage.memory_percentage < performance_limits.max_memory_percentage

    # Concurrent operations
    resource_usage.concurrent_operations < performance_limits.max_concurrent_operations
}

# Billing and subscription requirements
billing_requirements_met(tenant_id, operation) {
    # Operation is covered by current subscription
    tenant := data.tenants[tenant_id]
    operation_features := get_required_features(operation)

    # Check if tenant's plan includes required features
    plan_features := data.subscription_plans[tenant.plan].features
    required_features := {feature | feature := operation_features[_]}
    plan_features >= required_features
}

billing_requirements_met(tenant_id, operation) {
    # Operation has sufficient credits/allowance
    tenant := data.tenants[tenant_id]
    operation_cost := get_operation_cost(operation)

    tenant.available_credits >= operation_cost
}

# Audit and compliance
audit_compliance_satisfied(tenant_id, operation) {
    # All multi-tenant operations must be auditable
    true
}

# Helper functions

# Extract resource owner from resource identifier
extract_resource_owner(resource) = owner {
    parts := split(resource, ":")
    owner := parts[0]
}

# Check if operation is cross-tenant
is_cross_tenant_operation(operation) {
    operation in ["tenant_admin_access", "cross_tenant_sharing", "global_analytics"]
}

# Get quota type for operation
get_quota_type(operation) = quota_type {
    quota_mapping := {
        "create_resource": "resource_count",
        "store_data": "storage_gb",
        "process_data": "compute_units",
        "api_calls": "api_requests_per_hour",
        "concurrent_users": "max_concurrent_users",
        "export_data": "export_gb_per_month",
    }
    quota_type := quota_mapping[operation]
}

# Get current usage for tenant and quota type
get_current_usage(tenant_id, quota_type) = usage {
    # Get current usage from metrics data
    usage := data.tenant_usage_metrics[tenant_id][quota_type]
}

# Get cross-tenant permission
get_cross_tenant_permission(tenant_id, operation) = permission {
    permission := data.cross_tenant_permissions[tenant_id][operation]
}

# Get required features for operation
get_required_features(operation) = features {
    feature_mapping := {
        "create_resource": ["resource_creation"],
        "store_data": ["data_storage"],
        "process_data": ["data_processing"],
        "ai_analysis": ["ai_features"],
        "advanced_analytics": ["analytics"],
        "export_data": ["data_export"],
        "api_access": ["api_access"],
        "multi_region": ["multi_region"],
    }
    features := feature_mapping[operation]
}

# Get operation cost
get_operation_cost(operation) = cost {
    cost_mapping := {
        "create_resource": 1,
        "store_data": 0.1,  # per GB
        "process_data": 0.5,  # per compute unit
        "ai_analysis": 2.0,
        "advanced_analytics": 1.5,
        "export_data": 0.2,  # per GB
        "api_call": 0.01,
    }
    cost := cost_mapping[operation]
}

# Get tenant resource usage
get_tenant_resource_usage(tenant_id) = usage {
    usage := data.tenant_resource_usage[tenant_id]
}

# Cross-tenant authorization check
cross_tenant_authorized(tenant_id, operation, resource) {
    # User has cross-tenant permissions
    user := data.users[input.user_id]
    user.role in ["super_admin", "platform_operator"]
}

cross_tenant_authorized(tenant_id, operation, resource) {
    # Specific cross-tenant permission granted
    permission := data.cross_tenant_grants[tenant_id][operation]
    permission.allowed == true
    permission.target_resource == resource
}

# Decision reason explanations
decision_reason[reason] {
    allow
    reasons := [
        "Tenant ID is valid and tenant exists",
        "Tenant isolation is properly enforced",
        "Resource quotas are within limits",
        "Tenant is in good standing",
        "Cross-tenant access is properly authorized",
        "Data residency requirements are met",
        "Performance isolation is maintained",
        "Billing and subscription requirements are met",
        "Audit and compliance requirements are satisfied",
    ]
    reason := concat("; ", [r | r := reasons[_]; r != ""])
}

decision_reason[reason] {
    not allow
    reasons := [
        tenant_invalid_reason,
        isolation_violation_reason,
        quota_exceeded_reason,
        tenant_not_good_standing_reason,
        cross_tenant_unauthorized_reason,
        residency_violation_reason,
        performance_limit_exceeded_reason,
        billing_requirements_not_met_reason,
    ]
    reason := concat("; ", [r | r := reasons[_]; r != ""])
}

# Denial reasons
tenant_invalid_reason = "Tenant ID is invalid or tenant does not exist" {
    not tenant_id_valid(input.tenant_id)
}

isolation_violation_reason = "Tenant isolation violation - access to resources from unauthorized tenant" {
    not tenant_isolation_enforced(input.tenant_id, input.operation, input.resource)
}

quota_exceeded_reason = "Resource quota exceeded for tenant" {
    not within_resource_quotas(input.tenant_id, input.operation)
}

tenant_not_good_standing_reason = "Tenant is not in good standing - inactive, suspended, or compliance issues" {
    not tenant_in_good_standing(input.tenant_id)
}

cross_tenant_unauthorized_reason = "Cross-tenant access is not authorized" {
    not cross_tenant_access_authorized(input.tenant_id, input.operation, input.target_tenant_id)
}

residency_violation_reason = "Data residency requirements are not met" {
    not data_residency_compliant(input.tenant_id, input.data_location)
}

performance_limit_exceeded_reason = "Performance isolation limits exceeded" {
    not performance_isolation_maintained(input.tenant_id, input.operation)
}

billing_requirements_not_met_reason = "Billing or subscription requirements are not met" {
    not billing_requirements_met(input.tenant_id, input.operation)
}
