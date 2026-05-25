-- TimescaleDB Test Database Schema
-- Create test tables with hypertables for QueryFlux testing

-- Create the database (this will be the default database)
-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Create regular tables
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

-- Create time-series table for query metrics
CREATE TABLE IF NOT EXISTS query_metrics (
    time TIMESTAMP NOT NULL,
    connection_id INTEGER,
    query_type VARCHAR(50),
    execution_time_ms FLOAT,
    rows_returned INTEGER,
    memory_usage_mb FLOAT,
    cpu_usage_percent FLOAT,
    error_count INTEGER DEFAULT 0,
    tags JSONB DEFAULT '{}'
);

-- Convert query_metrics to hypertable
SELECT create_hypertable('query_metrics', 'time',
    chunk_time_interval => INTERVAL '1 day',
    if_not_exists => TRUE);

-- Create aggregate views for query metrics
CREATE MATERIALIZED VIEW IF NOT EXISTS query_metrics_hourly
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 hour', time) AS hour,
    connection_id,
    query_type,
    AVG(execution_time_ms) AS avg_execution_time,
    MAX(execution_time_ms) AS max_execution_time,
    MIN(execution_time_ms) AS min_execution_time,
    SUM(rows_returned) AS total_rows_returned,
    AVG(memory_usage_mb) AS avg_memory_usage,
    AVG(cpu_usage_percent) AS avg_cpu_usage,
    SUM(error_count) AS total_errors,
    COUNT(*) AS query_count
FROM query_metrics
GROUP BY hour, connection_id, query_type;

-- Create indexes
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_created_at ON users(created_at);

CREATE INDEX idx_connections_user_id ON connections(user_id);
CREATE INDEX idx_connections_database_type ON connections(database_type);
CREATE INDEX idx_connections_created_at ON connections(created_at);

CREATE INDEX idx_query_metrics_time ON query_metrics(time DESC);
CREATE INDEX idx_query_metrics_connection_id ON query_metrics(connection_id);
CREATE INDEX idx_query_metrics_query_type ON query_metrics(query_type);

-- Insert test data
INSERT INTO users (username, email) VALUES
    ('testuser', 'test@example.com'),
    ('admin', 'admin@example.com');

INSERT INTO connections (user_id, name, database_type, host, port, database_name, username) VALUES
    (1, 'Test PostgreSQL', 'postgresql', 'localhost', 5432, 'queryflux_test', 'testuser'),
    (2, 'Test InfluxDB', 'influxdb', 'localhost', 8086, 'queryflux_test', 'testuser');

-- Insert sample time-series data (last 24 hours)
INSERT INTO query_metrics (time, connection_id, query_type, execution_time_ms, rows_returned, memory_usage_mb, cpu_usage_percent, error_count, tags)
SELECT
    generate_series(
        NOW() - INTERVAL '24 hours',
        NOW(),
        INTERVAL '5 minutes'
    ) AS time,
    (id % 2) + 1 AS connection_id,
    CASE WHEN (id % 3 = 0) THEN 'SELECT' WHEN (id % 3 = 1) THEN 'INSERT' ELSE 'UPDATE' END AS query_type,
    random() * 100 + 10 AS execution_time_ms,
    floor(random() * 1000 + 1) AS rows_returned,
    random() * 50 + 10 AS memory_usage_mb,
    random() * 30 + 5 AS cpu_usage_percent,
    floor(random() * 2) AS error_count,
    '{"environment": "test", "version": "1.0"}'::jsonb AS tags
FROM generate_series(1, 288);  -- 24 hours * 12 per hour (every 5 minutes)