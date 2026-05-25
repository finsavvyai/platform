-- PostgreSQL Test Database Schema
-- Create test tables for QueryFlux testing

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS connections (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    name VARCHAR(100) NOT NULL,
    database_type VARCHAR(50) NOT NULL,
    host VARCHAR(255) NOT NULL,
    port INTEGER,
    database_name VARCHAR(100),
    username VARCHAR(100),
    password_encrypted TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS queries (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    connection_id INTEGER REFERENCES connections(id),
    query_text TEXT NOT NULL,
    query_type VARCHAR(50),
    execution_time_ms INTEGER,
    rows_affected INTEGER,
    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert test data
INSERT INTO users (username, email) VALUES
    ('testuser', 'test@example.com'),
    ('admin', 'admin@example.com');

INSERT INTO connections (user_id, name, database_type, host, port, database_name, username) VALUES
    (1, 'Test PostgreSQL', 'postgresql', 'localhost', 5432, 'queryflux_test', 'testuser'),
    (2, 'Test MySQL', 'mysql', 'localhost', 3306, 'queryflux_test', 'testuser');

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_connections_user_id ON connections(user_id);
CREATE INDEX IF NOT EXISTS idx_queries_user_id ON queries(user_id);
CREATE INDEX IF NOT EXISTS idx_queries_connection_id ON queries(connection_id);
CREATE INDEX IF NOT EXISTS idx_queries_executed_at ON queries(executed_at);