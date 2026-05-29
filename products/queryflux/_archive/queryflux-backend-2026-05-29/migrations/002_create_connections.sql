CREATE TABLE IF NOT EXISTS connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'postgres',
    host VARCHAR(255) NOT NULL,
    port INTEGER NOT NULL DEFAULT 5432,
    database_name VARCHAR(255) NOT NULL,
    username VARCHAR(255) NOT NULL,
    encrypted_password TEXT NOT NULL,
    ssl_mode VARCHAR(50) NOT NULL DEFAULT 'disable',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_connections_user_id ON connections(user_id);
CREATE INDEX idx_connections_name ON connections(user_id, name);
