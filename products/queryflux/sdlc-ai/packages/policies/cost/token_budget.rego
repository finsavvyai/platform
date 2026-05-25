package sdlc.cost

# Default deny policy for cost control
default allow = false

# Allow operation if within budget limits
allow {
    # User and tenant are active
    input.user.status == "active"
    input.tenant.status == "active"

    # Token budget check
    within_token_budget(input.user, input.tenant, input.operation)

    # Cost budget check
    within_cost_budget(input.user, input.tenant, input.operation)

    # Rate limiting check
    within_rate_limits(input.user, input.operation)

    # Resource quota check
    within_resource_quotas(input.user, input.tenant, input.operation)

    # Priority access check
    priority_access_check(input.user, input.operation)
}

# Token budget check
within_token_budget(user, tenant, operation) {
    # Calculate total tokens for this operation
    estimated_tokens := estimate_tokens(operation)

    # Check user-level token budget
    user_usage := user.current_month.tokens_used
    user_limit := user.plan.token_limit

    (user_usage + estimated_tokens) <= user_limit
}

within_token_budget(user, tenant, operation) {
    # User is over budget but has admin override
    estimated_tokens := estimate_tokens(operation)
    user_usage := user.current_month.tokens_used
    user_limit := user.plan.token_limit

    (user_usage + estimated_tokens) > user_limit
    user.role == "admin"
    operation.emergency_override == true
}

within_token_budget(user, tenant, operation) {
    # Check tenant-level token budget
    estimated_tokens := estimate_tokens(operation)
    tenant_usage := tenant.current_month.tokens_used
    tenant_limit := tenant.plan.token_limit

    (tenant_usage + estimated_tokens) <= tenant_limit
}

# Cost budget check
within_cost_budget(user, tenant, operation) {
    # Calculate estimated cost for this operation
    estimated_cost := estimate_cost(operation)

    # Check user-level cost budget
    user_cost_usage := user.current_month.cost_used
    user_cost_limit := user.plan.cost_limit

    (user_cost_usage + estimated_cost) <= user_cost_limit
}

within_cost_budget(user, tenant, operation) {
    # Check tenant-level cost budget
    estimated_cost := estimate_cost(operation)
    tenant_cost_usage := tenant.current_month.cost_used
    tenant_cost_limit := tenant.plan.cost_limit

    (tenant_cost_usage + estimated_cost) <= tenant_cost_limit
}

# Rate limiting check
within_rate_limits(user, operation) {
    # Check per-minute rate limits
    current_minute := time.now_ns() / 60000000000  # Unix timestamp in minutes
    minute_requests := count([r | r <- user.recent_requests, r.timestamp >= current_minute])
    minute_requests <= user.plan.rate_limits.per_minute
}

within_rate_limits(user, operation) {
    # Check per-hour rate limits
    current_hour := time.now_ns() / 3600000000000  # Unix timestamp in hours
    hour_requests := count([r | r <- user.recent_requests, r.timestamp >= current_hour])
    hour_requests <= user.plan.rate_limits.per_hour
}

within_rate_limits(user, operation) {
    # Check per-day rate limits
    current_day := time.now_ns() / 86400000000000  # Unix timestamp in days
    day_requests := count([r | r <- user.recent_requests, r.timestamp >= current_day])
    day_requests <= user.plan.rate_limits.per_day
}

# Resource quota check
within_resource_quotas(user, tenant, operation) {
    # Check concurrent request quota
    active_requests := count([r | r <- user.active_requests, r.status == "active"])
    active_requests <= user.plan.resource_quotas.concurrent_requests
}

within_resource_quotas(user, tenant, operation) {
    # Check document processing quota
    operation.type == "document_process"
    documents_processed := user.current_month.documents_processed
    document_limit := user.plan.resource_quotas.documents_per_month

    documents_processed < document_limit
}

within_resource_quotas(user, tenant, operation) {
    # Check storage quota
    operation.type == "upload"
    current_storage := user.current_storage_bytes
    storage_limit := user.plan.resource_quotas.storage_bytes

    (current_storage + operation.file_size) <= storage_limit
}

# Priority access check
priority_access_check(user, operation) {
    # High priority users always allowed
    user.priority_level >= 8
}

priority_access_check(user, operation) {
    # Priority access during off-peak hours
    user.priority_level >= 5
    is_off_peak_hours()
}

priority_access_check(user, operation) {
    # Standard priority access during normal hours
    user.priority_level >= 1
    not is_peak_hours()
}

# Check if current time is off-peak hours
is_off_peak_hours() {
    current_hour := time.hour(time.now_ns())
    off_peak_hours := {0, 1, 2, 3, 4, 5, 6, 22, 23}
    current_hour in off_peak_hours
}

# Check if current time is peak hours
is_peak_hours() {
    current_hour := time.hour(time.now_ns())
    peak_hours := {9, 10, 11, 12, 13, 14, 15, 16, 17}
    current_hour in peak_hours
}

# Token estimation
estimate_tokens(operation) = tokens {
    operation.type == "llm_completion" -> estimate_completion_tokens(operation)
    operation.type == "embedding" -> estimate_embedding_tokens(operation)
    operation.type == "rag_query" -> estimate_rag_tokens(operation)
    operation.type == "document_process" -> estimate_document_tokens(operation)
    _ -> 100  # Default estimation
}

# Estimate tokens for LLM completion
estimate_completion_tokens(operation) = tokens {
    # Input tokens
    input_tokens := count_tokens(operation.prompt)

    # Estimated output tokens (typically 1/3 of input for completions)
    output_tokens := input_tokens / 3

    tokens := input_tokens + output_tokens
}

# Estimate tokens for embedding
estimate_embedding_tokens(operation) = tokens {
    # Embeddings typically process the entire text
    tokens := count_tokens(operation.text)
}

# Estimate tokens for RAG query
estimate_rag_tokens(operation) = tokens {
    # Context tokens from retrieved documents
    context_tokens := sum([doc.tokens | doc <- operation.context])

    # Query tokens
    query_tokens := count_tokens(operation.query)

    # Estimated response tokens
    response_tokens := (context_tokens + query_tokens) / 4

    tokens := context_tokens + query_tokens + response_tokens
}

# Estimate tokens for document processing
estimate_document_tokens(operation) = tokens {
    # Rough estimation: 1 token per 4 characters of text
    estimated_chars := operation.file_size * 0.7  # Assume 70% of file is text content
    tokens := estimated_chars / 4
}

# Simple token counting (approximation)
count_tokens(text) = tokens {
    # Rough estimation: 1 token per 4 characters
    tokens := count(string.split(text, "")) / 4
}

# Cost estimation
estimate_cost(operation) = cost {
    operation.type == "llm_completion" -> estimate_completion_cost(operation)
    operation.type == "embedding" -> estimate_embedding_cost(operation)
    operation.type == "rag_query" -> estimate_rag_cost(operation)
    operation.type == "document_process" -> estimate_document_cost(operation)
    _ -> 0.001  # Default minimal cost
}

# Estimate cost for LLM completion
estimate_completion_cost(operation) = cost {
    tokens := estimate_tokens(operation)
    model_costs := {
        "gpt-4": 0.03,
        "gpt-3.5-turbo": 0.002,
        "claude-3": 0.015
    }
    cost_per_token := model_costs[operation.model]
    cost := tokens * cost_per_token / 1000
}

# Estimate cost for embedding
estimate_embedding_cost(operation) = cost {
    tokens := estimate_tokens(operation)
    cost_per_token := 0.0001  # Standard embedding cost
    cost := tokens * cost_per_token / 1000
}

# Estimate cost for RAG query
estimate_rag_cost(operation) = cost {
    # Cost includes embedding generation + LLM completion
    embedding_cost := estimate_embedding_cost(operation)
    completion_cost := estimate_completion_cost(operation)
    retrieval_cost := 0.001  # Small cost for vector retrieval

    cost := embedding_cost + completion_cost + retrieval_cost
}

# Estimate cost for document processing
estimate_document_cost(operation) = cost {
    # Cost includes text extraction, embedding generation, and storage
    base_cost := 0.01
    size_cost := operation.file_size * 0.000001  # $0.001 per MB
    embedding_cost := estimate_embedding_cost(operation)

    cost := base_cost + size_cost + embedding_cost
}

# Budget optimization suggestions
budget_optimization_suggestions(user, operation) = suggestions {
    suggestions := [
        suggestion |
        suggestion <- generate_suggestions(user, operation)
    ]
}

generate_suggestions(user, operation) = suggestion {
    # Suggest using smaller model for non-critical operations
    operation.model == "gpt-4"
    operation.priority < 8
    suggestion := {"type": "model_downgrade", "message": "Use GPT-3.5-turbo for cost savings"}
}

generate_suggestions(user, operation) = suggestion {
    # Suggest batching operations
    operation.type == "embedding"
    count(operation.text) < 1000
    suggestion := {"type": "batch_processing", "message": "Batch multiple texts for better efficiency"}
}

generate_suggestions(user, operation) = suggestion {
    # Suggest caching results
    operation.type == "rag_query"
    operation.cachable == true
    suggestion := {"type": "cache_results", "message": "Enable result caching to reduce costs"}
}

# Plan upgrade recommendations
plan_upgrade_recommended(user, operation) = upgrade {
    # Recommend upgrade if user consistently hits limits
    usage_ratio := user.current_month.tokens_used / user.plan.token_limit
    usage_ratio > 0.8

    upgrade := {
        "recommended_plan": "professional",
        "reason": "High token usage approaching limits",
        "current_limit": user.plan.token_limit,
        "recommended_limit": user.plan.token_limit * 2
    }
}

# Policy decision explanation
decision_reason[reason] {
    allow
    reason := "Operation allowed: within budget limits and resource quotas"
}

decision_reason[reason] {
    not allow
    estimated_tokens := estimate_tokens(input.operation)
    user_usage := input.user.current_month.tokens_used
    user_limit := input.user.plan.token_limit

    (user_usage + estimated_tokens) > user_limit
    reason := "Operation blocked: exceeds token budget limit"
}

decision_reason[reason] {
    not allow
    estimated_cost := estimate_cost(input.operation)
    user_cost_usage := input.user.current_month.cost_used
    user_cost_limit := input.user.plan.cost_limit

    (user_cost_usage + estimated_cost) > user_cost_limit
    reason := "Operation blocked: exceeds cost budget limit"
}

decision_reason[reason] {
    not allow
    current_minute := time.now_ns() / 60000000000
    minute_requests := count([r | r <- input.user.recent_requests, r.timestamp >= current_minute])
    minute_requests > input.user.plan.rate_limits.per_minute

    reason := "Operation blocked: exceeds rate limit"
}
