CREATE TABLE seats (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    subscription_id TEXT NOT NULL REFERENCES subscriptions(id),
    user_id TEXT NOT NULL,
    user_email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'analyst',
    activated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deactivated_at TIMESTAMPTZ
);

CREATE INDEX idx_seats_tenant ON seats(tenant_id);
CREATE INDEX idx_seats_subscription ON seats(subscription_id);
CREATE INDEX idx_seats_user ON seats(user_id);
CREATE UNIQUE INDEX idx_seats_tenant_user ON seats(tenant_id, user_id) WHERE deactivated_at IS NULL;
