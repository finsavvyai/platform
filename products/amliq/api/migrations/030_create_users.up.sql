CREATE TABLE IF NOT EXISTS users (
    id          VARCHAR(64)  PRIMARY KEY,
    tenant_id   VARCHAR(64)  NOT NULL REFERENCES tenants(id),
    email       VARCHAR(255) NOT NULL UNIQUE,
    password    VARCHAR(255) NOT NULL DEFAULT '',
    role        VARCHAR(32)  NOT NULL DEFAULT 'admin',
    provider    VARCHAR(32)  NOT NULL DEFAULT 'email',
    provider_id VARCHAR(255) NOT NULL DEFAULT '',
    name        VARCHAR(255) NOT NULL DEFAULT '',
    avatar_url  TEXT         NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE INDEX idx_users_email ON users(email);
CREATE UNIQUE INDEX idx_users_provider ON users(provider, provider_id)
    WHERE provider != 'email';
