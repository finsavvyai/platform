package sdlc.multitenancy

base_data := {
    "tenants": {
        "t1": {
            "status": "active",
            "suspended": false,
            "subscription_status": "active",
            "compliance_status": "good",
        },
    },
    "tenant_quotas": {
        "t1": {
            "documents": 1000,
        },
    },
}

test_tenant_id_valid_when_present {
    tenant_id_valid("t1") with data as base_data
}

test_tenant_id_invalid_when_empty {
    not tenant_id_valid("") with data as base_data
}

test_tenant_id_invalid_when_unknown {
    not tenant_id_valid("ghost") with data as base_data
}

test_tenant_in_good_standing_passes {
    tenant_in_good_standing("t1") with data as base_data
}

test_tenant_not_in_good_standing_when_suspended {
    bad := {"tenants": {"t1": {"status": "active", "suspended": true, "subscription_status": "active", "compliance_status": "good"}}}
    not tenant_in_good_standing("t1") with data as bad
}
