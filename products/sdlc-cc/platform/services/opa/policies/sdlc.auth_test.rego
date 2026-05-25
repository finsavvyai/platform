package sdlc.auth

# Baseline data used by most tests. Real OPA deployments load from a bundle;
# tests injest via `with data as {...}`.
base_data := {
    "users": {
        "u1": {
            "status": "active",
            "locked": false,
            "email_verified": true,
            "suspended": false,
        },
    },
    "sessions": {
        "s1": {
            "status": "active",
            "expires_at": 9999999999999999999,
            "revoked": false,
        },
    },
    "tenants": {
        "t1": {
            "status": "active",
            "suspended": false,
            "subscription_status": "active",
            "compliance_status": "good",
        },
    },
}

valid_auth_input := {
    "authentication": {
        "user_id": "u1",
        "tenant_id": "t1",
        "session_id": "s1",
        "token_id": "tok-1",
        "token_signature_valid": true,
        "expires_at": 9999999999999999999,
        "issuer": "sdlc-auth",
        "role": "super_admin",
        "ip_address": "10.0.0.1",
        "device_fingerprint": "fp1",
    },
    "action": "read",
    "resource": {"type": "document", "id": "doc1"},
    "tenant_id": "t1",
}

test_token_valid_when_signed_unexpired_trusted {
    is_token_valid(valid_auth_input.authentication) with data as base_data
}

test_token_invalid_when_expired {
    not is_token_valid({
        "token_id": "x",
        "token_signature_valid": true,
        "expires_at": 1,
        "issuer": "sdlc-auth",
    }) with data as base_data
}

test_token_invalid_when_signature_bad {
    not is_token_valid({
        "token_id": "x",
        "token_signature_valid": false,
        "expires_at": 9999999999999999999,
        "issuer": "sdlc-auth",
    }) with data as base_data
}

test_token_invalid_when_issuer_untrusted {
    not is_token_valid({
        "token_id": "x",
        "token_signature_valid": true,
        "expires_at": 9999999999999999999,
        "issuer": "https://evil.example",
    }) with data as base_data
}

test_user_active_passes_for_healthy_user {
    is_user_active("u1") with data as base_data
}

test_user_active_fails_when_locked {
    locked := {"users": {"u1": {"status": "active", "locked": true, "email_verified": true, "suspended": false}}}
    not is_user_active("u1") with data as locked
}

test_user_active_fails_when_suspended {
    suspended := {"users": {"u1": {"status": "active", "locked": false, "email_verified": true, "suspended": true}}}
    not is_user_active("u1") with data as suspended
}

test_user_active_fails_when_email_unverified {
    unverified := {"users": {"u1": {"status": "active", "locked": false, "email_verified": false, "suspended": false}}}
    not is_user_active("u1") with data as unverified
}

test_session_valid_for_active_unexpired {
    is_session_valid("s1") with data as base_data
}

test_session_invalid_when_revoked {
    revoked := {"sessions": {"s1": {"status": "active", "expires_at": 9999999999999999999, "revoked": true}}}
    not is_session_valid("s1") with data as revoked
}

test_session_invalid_when_expired {
    expired := {"sessions": {"s1": {"status": "active", "expires_at": 1, "revoked": false}}}
    not is_session_valid("s1") with data as expired
}

test_tenant_active_pass {
    is_tenant_active("t1") with data as base_data
}

test_tenant_fails_when_suspended {
    suspended := {"tenants": {"t1": {"status": "active", "suspended": true, "subscription_status": "active", "compliance_status": "good"}}}
    not is_tenant_active("t1") with data as suspended
}

test_tenant_fails_when_subscription_cancelled {
    cancelled := {"tenants": {"t1": {"status": "active", "suspended": false, "subscription_status": "cancelled", "compliance_status": "good"}}}
    not is_tenant_active("t1") with data as cancelled
}

test_tenant_fails_when_compliance_bad {
    nc := {"tenants": {"t1": {"status": "active", "suspended": false, "subscription_status": "active", "compliance_status": "violation"}}}
    not is_tenant_active("t1") with data as nc
}
