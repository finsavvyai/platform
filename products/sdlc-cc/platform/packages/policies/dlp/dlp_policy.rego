package sdlc.dlp

# Default deny policy for DLP scanning
default allow = false

# Allow content if it passes DLP scanning
allow {
    # Content has been scanned
    input.dlp_scanned == true

    # No high-risk PII detected
    not contains_high_risk_pii(input.content)

    # Medium-risk PII is properly handled
    handle_medium_risk_pii(input.content, input.user, input.purpose)

    # User has appropriate clearance for detected PII
    pii_clearance_check(input.user, input.detected_pii)

    # Purpose is appropriate for content sensitivity
    purpose_sensitivity_check(input.content, input.purpose)

    # Geographic compliance for PII
    geographic_pii_compliance(input.content, input.detected_pii, input.user)
}

# High-risk PII detection
contains_high_risk_pii(content) {
    some pattern in high_risk_patterns
    regex.match(pattern.regex, content)
}

# High-risk PII patterns
high_risk_patterns = [
    {"name": "ssn", "regex": "\\b\\d{3}-\\d{2}-\\d{4}\\b", "risk": "high"},
    {"name": "credit_card", "regex": "\\b\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}\\b", "risk": "high"},
    {"name": "bank_account", "regex": "\\b\\d{9,18}\\b", "risk": "high"},
    {"name": "passport", "regex": "\\b[A-Z]{2}\\d{7}\\b", "risk": "high"},
    {"name": "driver_license", "regex": "\\b[A-Z]{1,2}\\d{7,8}\\b", "risk": "high"}
]

# Medium-risk PII patterns
medium_risk_patterns = [
    {"name": "email", "regex": "\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}\\b", "risk": "medium"},
    {"name": "phone", "regex": "\\b\\d{3}-\\d{3}-\\d{4}\\b", "risk": "medium"},
    {"name": "address", "regex": "\\d+\\s+[A-Za-z\\s]+,\\s*[A-Za-z\\s]+\\s+\\d{5}", "risk": "medium"},
    {"name": "date_of_birth", "regex": "\\b\\d{1,2}[/-]\\d{1,2}[/-]\\d{4}\\b", "risk": "medium"},
    {"name": "medical_record", "regex": "\\bMRN\\s*\\d+\\b", "risk": "medium"}
]

# Handle medium-risk PII
handle_medium_risk_pii(content, user, purpose) {
    # No medium-risk PII detected
    not contains_medium_risk_pii(content)
}

handle_medium_risk_pii(content, user, purpose) {
    # Medium-risk PII detected but user has authorization
    contains_medium_risk_pii(content)
    user.role in {"admin", "data_scientist", "analyst"}
    purpose in {"research", "analytics", "compliance"}
}

handle_medium_risk_pii(content, user, purpose) {
    # Medium-risk PII is redacted
    contains_medium_risk_pii(content)
    input.redaction_enabled == true
    redaction_applied(content, medium_risk_patterns)
}

# Medium-risk PII detection
contains_medium_risk_pii(content) {
    some pattern in medium_risk_patterns
    regex.match(pattern.regex, content)
}

# PII clearance check
pii_clearance_check(user, detected_pii) {
    # No PII detected
    count(detected_pii) == 0
}

pii_clearance_check(user, detected_pii) {
    # User has appropriate clearance for detected PII types
    every pii_item in detected_pii {
        user.clearance_level >= pii_clearance_requirements[pii_item.type]
    }
}

# PII clearance requirements
pii_clearance_requirements = {
    "ssn": 3,           # Secret clearance
    "credit_card": 2,   # Confidential clearance
    "bank_account": 2,  # Confidential clearance
    "email": 1,         # Internal clearance
    "phone": 1,         # Internal clearance
    "address": 1,       # Internal clearance
    "medical_record": 3 # Secret clearance
}

# Purpose sensitivity check
purpose_sensitivity_check(content, purpose) {
    # Content is not highly sensitive
    not highly_sensitive_content(content)
}

purpose_sensitivity_check(content, purpose) {
    # Content is sensitive but purpose is authorized
    highly_sensitive_content(content)
    purpose in sensitive_content_purposes
}

# Check if content is highly sensitive
highly_sensitive_content(content) {
    # Contains multiple PII types
    pii_count := count_detected_pii_types(content)
    pii_count >= 3
}

highly_sensitive_content(content) {
    # Contains high-risk PII
    contains_high_risk_pii(content)
}

highly_sensitive_content(content) {
    # Contains sensitive keywords
    some keyword in sensitive_keywords
    regex.matches("(?i).*" + keyword + ".*", content)
}

# Sensitive keywords
sensitive_keywords = [
    "confidential", "secret", "top secret", "classified",
    "internal use only", "proprietary", "trade secret",
    "medical record", "patient information", "diagnosis",
    "financial information", "tax return", "credit report"
]

# Purposes authorized for sensitive content
sensitive_content_purposes = {
    "compliance", "audit", "legal", "security_investigation",
    "research", "analytics", "risk_assessment"
}

# Geographic PII compliance
geographic_pii_compliance(content, detected_pii, user) {
    # No geographic restrictions on PII
    not has_geographic_pii_restrictions(detected_pii)
}

geographic_pii_compliance(content, detected_pii, user) {
    # User location complies with PII geographic restrictions
    has_geographic_pii_restrictions(detected_pii)
    every pii_item in detected_pii {
        geographic_compliance_check(pii_item, user)
    }
}

# Check if PII has geographic restrictions
has_geographic_pii_restrictions(detected_pii) {
    some pii_item in detected_pii
    pii_item.type in geographically_restricted_pii
}

# Geographically restricted PII types
geographically_restricted_pii = {
    "ssn", "medical_record", "financial_data", "tax_id"
}

# Geographic compliance check
geographic_compliance_check(pii_item, user) {
    # User is in allowed jurisdiction
    user.location.country in allowed_jurisdictions[pii_item.type]
}

# Allowed jurisdictions by PII type
allowed_jurisdictions = {
    "ssn": ["US"],  # SSN only allowed in US
    "medical_record": ["US", "CA", "UK", "AU"],  # HIPAA and equivalent jurisdictions
    "financial_data": ["US", "CA", "UK", "EU"],   # Financial data jurisdictions
    "tax_id": ["US", "CA", "UK"]  # Tax ID jurisdictions
}

# Redaction requirements
should_redact_pii(content, pii_item, user) {
    # User lacks clearance for PII type
    user.clearance_level < pii_clearance_requirements[pii_item.type]
}

should_redact_pii(content, pii_item, user) {
    # Purpose requires redaction
    input.purpose in redaction_required_purposes
}

should_redact_pii(content, pii_item, user) {
    # Content sharing with external parties
    input.audience == "external"
}

# Purposes requiring redaction
redaction_required_purposes = {
    "demo", "training", "testing", "external_sharing"
}

# Redaction methods
redaction_method(pii_item) {
    pii_item.type == "ssn" -> "full_mask"
    pii_item.type == "credit_card" -> "partial_mask"
    pii_item.type == "email" -> "domain_mask"
    pii_item.type == "phone" -> "partial_mask"
    _ -> "full_mask"
}

# Count detected PII types
count_detected_pii_types(content) {
    detected_types := {type |
        some pattern in high_risk_patterns
        regex.match(pattern.regex, content)
        type := pattern.name
    }

    # Add medium-risk PII types
    detected_types := {type |
        some pattern in medium_risk_patterns
        regex.match(pattern.regex, content)
        type := pattern.name
    }

    count(detected_types)
}

# Check if redaction is properly applied
redaction_applied(content, patterns) {
    # Redaction patterns should be present
    redaction_pattern := "\\*{3,}|\\[REDACTED\\]|\\[MASKED\\]"
    regex.match(redaction_pattern, content)
}

# DLP risk scoring
risk_score(content) = score {
    high_risk_count := count([pattern | pattern <- high_risk_patterns, regex.match(pattern.regex, content)])
    medium_risk_count := count([pattern | pattern <- medium_risk_patterns, regex.match(pattern.regex, content)])
    sensitive_keyword_count := count([keyword | keyword <- sensitive_keywords, regex.matches("(?i).*" + keyword + ".*", content)])

    score := (high_risk_count * 10) + (medium_risk_count * 5) + (sensitive_keyword_count * 3)
}

# Risk level determination
risk_level(content) = level {
    score := risk_score(content)
    level := {
        score >= 20 -> "high",
        score >= 10 -> "medium",
        score >= 1 -> "low",
        _ -> "none"
    }[true]
}

# Policy decision explanation
decision_reason[reason] {
    allow
    reason := "Content passes DLP scanning: no high-risk PII detected and medium-risk PII properly handled"
}

decision_reason[reason] {
    not allow
    contains_high_risk_pii(input.content)
    reason := "Content blocked: contains high-risk PII"
}

decision_reason[reason] {
    not allow
    not pii_clearance_check(input.user, input.detected_pii)
    reason := "Content blocked: insufficient clearance for detected PII"
}

decision_reason[reason] {
    not allow
    not purpose_sensitivity_check(input.content, input.purpose)
    reason := "Content blocked: purpose not authorized for sensitive content"
}
