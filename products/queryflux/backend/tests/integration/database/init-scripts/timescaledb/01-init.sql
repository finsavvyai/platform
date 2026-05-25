-- TimescaleDB test database initialization script
-- Creates test schemas, tables, and hypertables for integration testing

-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Create test tables with various data types
CREATE TABLE IF NOT EXISTS test_table (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE,
    age INTEGER CHECK (age >= 0),
    salary DECIMAL(10,2),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    json_data JSONB,
    tags TEXT[]
);

-- Create time-series table for testing TimescaleDB hypertables
CREATE TABLE IF NOT EXISTS metrics_data (
    time TIMESTAMPTZ NOT NULL,
    device_id INTEGER NOT NULL,
    cpu_usage DOUBLE PRECISION,
    memory_usage DOUBLE PRECISION,
    disk_usage DOUBLE PRECISION,
    network_in DOUBLE PRECISION,
    network_out DOUBLE PRECISION,
    temperature DOUBLE PRECISION,
    metadata JSONB
);

-- Create metrics_data as a hypertable
SELECT create_hypertable('metrics_data', 'time', chunk_time_interval => INTERVAL '1 hour');

-- Create another time-series table for weather data
CREATE TABLE IF NOT EXISTS weather_data (
    time TIMESTAMPTZ NOT NULL,
    location_id INTEGER NOT NULL,
    temperature DOUBLE PRECISION,
    humidity DOUBLE PRECISION,
    pressure DOUBLE PRECISION,
    wind_speed DOUBLE PRECISION,
    wind_direction INTEGER,
    precipitation DOUBLE PRECISION,
    conditions VARCHAR(50),
    metadata JSONB
);

-- Create weather_data as a hypertable with different chunk interval
SELECT create_hypertable('weather_data', 'time', chunk_time_interval => INTERVAL '6 hours');

-- Create foreign key test tables
CREATE TABLE IF NOT EXISTS departments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    manager_id INTEGER REFERENCES departments(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS employees (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    department_id INTEGER REFERENCES departments(id),
    salary DECIMAL(10,2),
    hire_date DATE DEFAULT CURRENT_DATE
);

-- Create indexes for testing
CREATE INDEX IF NOT EXISTS idx_test_table_email ON test_table(email);
CREATE INDEX IF NOT EXISTS idx_test_table_name ON test_table(name);
CREATE INDEX IF NOT EXISTS idx_test_table_created_at ON test_table(created_at);
CREATE INDEX IF NOT EXISTS idx_test_table_json_data ON test_table USING GIN(json_data);

-- Create indexes on hypertables
CREATE INDEX IF NOT EXISTS idx_metrics_data_device_id ON metrics_data(device_id, time DESC);
CREATE INDEX IF NOT EXISTS idx_metrics_data_cpu_usage ON metrics_data(cpu_usage, time DESC);
CREATE INDEX IF NOT EXISTS idx_weather_data_location_id ON weather_data(location_id, time DESC);

-- Insert sample data into test_table
INSERT INTO test_table (name, email, age, salary, is_active, json_data, tags) VALUES
('John Doe', 'john@example.com', 30, 75000.00, true, '{"department": "engineering", "level": "senior"}', ARRAY['developer', 'fullstack']),
('Jane Smith', 'jane@example.com', 28, 68000.00, true, '{"department": "design", "level": "mid"}', ARRAY['designer', 'ui']),
('Bob Johnson', 'bob@example.com', 35, 82000.00, false, '{"department": "engineering", "level": "lead"}', ARRAY['developer', 'backend', 'manager']),
('Alice Brown', 'alice@example.com', 32, 72000.00, true, '{"department": "product", "level": "senior"}', ARRAY['product', 'strategy']),
('Charlie Wilson', 'charlie@example.com', 29, 65000.00, true, '{"department": "engineering", "level": "junior"}', ARRAY['developer', 'frontend']);

-- Insert department data
INSERT INTO departments (name) VALUES
('Engineering'),
('Design'),
('Product'),
('Marketing'),
('Sales');

-- Insert employee data
INSERT INTO employees (name, department_id, salary) VALUES
('John Doe', 1, 75000.00),
('Jane Smith', 2, 68000.00),
('Bob Johnson', 1, 82000.00),
('Alice Brown', 3, 72000.00),
('Charlie Wilson', 1, 65000.00);

-- Generate time-series data for metrics_data
INSERT INTO metrics_data (time, device_id, cpu_usage, memory_usage, disk_usage, network_in, network_out, temperature, metadata)
SELECT
    generate_series(
        NOW() - INTERVAL '24 hours',
        NOW(),
        INTERVAL '5 minutes'
    ) as time,
    (random() * 100)::integer as device_id,
    (random() * 100)::double precision as cpu_usage,
    (random() * 100)::double precision as memory_usage,
    (random() * 100)::double precision as disk_usage,
    (random() * 1000)::double precision as network_in,
    (random() * 1000)::double precision as network_out,
    (20 + random() * 60)::double precision as temperature,
    jsonb_build_object(
        'status', CASE WHEN random() > 0.9 THEN 'warning' ELSE 'normal' END,
        'version', 'v1.2.' || (floor(random() * 10) + 1)::text
    ) as metadata;

-- Generate time-series data for weather_data
INSERT INTO weather_data (time, location_id, temperature, humidity, pressure, wind_speed, wind_direction, precipitation, conditions, metadata)
SELECT
    generate_series(
        NOW() - INTERVAL '7 days',
        NOW(),
        INTERVAL '1 hour'
    ) as time,
    (random() * 10 + 1)::integer as location_id,
    (-10 + random() * 50)::double precision as temperature,
    (random() * 100)::double precision as humidity,
    (980 + random() * 50)::double precision as pressure,
    (random() * 30)::double precision as wind_speed,
    (random() * 360)::integer as wind_direction,
    (random() * 20)::double precision as precipitation,
    ARRAY['sunny', 'cloudy', 'rainy', 'snowy', 'foggy'][ceil(random() * 5)] as conditions,
    jsonb_build_object(
        'visibility', (random() * 10)::double precision,
        'uv_index', (random() * 11)::integer
    ) as metadata;

-- Create continuous aggregates for testing TimescaleDB features
CREATE MATERIALIZED VIEW hourly_metrics
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 hour', time) as hour,
    device_id,
    AVG(cpu_usage) as avg_cpu,
    MAX(cpu_usage) as max_cpu,
    MIN(cpu_usage) as min_cpu,
    AVG(memory_usage) as avg_memory,
    AVG(disk_usage) as avg_disk,
    COUNT(*) as measurement_count
FROM metrics_data
GROUP BY hour, device_id;

-- Add refresh policy for continuous aggregate
SELECT add_continuous_aggregate_policy('hourly_metrics',
    start_offset => INTERVAL '1 hour',
    end_offset => INTERVAL '5 minutes',
    schedule_interval => INTERVAL '10 minutes');

-- Create another continuous aggregate for weather data
CREATE MATERIALIZED VIEW daily_weather_summary
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 day', time) as day,
    location_id,
    AVG(temperature) as avg_temperature,
    MAX(temperature) as max_temperature,
    MIN(temperature) as min_temperature,
    AVG(humidity) as avg_humidity,
    SUM(precipitation) as total_precipitation,
    COUNT(*) as measurement_count
FROM weather_data
GROUP BY day, location_id;

-- Add compression policy for old data
SELECT add_compression_policy('metrics_data', INTERVAL '7 days');

-- Create retention policy to delete old data
SELECT add_retention_policy('metrics_data', INTERVAL '30 days');

-- Create views for testing
CREATE OR REPLACE VIEW employee_details AS
SELECT
    e.id,
    e.name,
    d.name as department_name,
    e.salary,
    e.hire_date
FROM employees e
JOIN departments d ON e.department_id = d.id;

-- Create a function for testing
CREATE OR REPLACE FUNCTION calculate_annual_salary(employee_id INTEGER)
RETURNS DECIMAL(10,2) AS $$
BEGIN
    RETURN (SELECT salary * 12 FROM employees WHERE id = employee_id);
END;
$$ LANGUAGE plpgsql;

-- Create trigger for testing
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_test_table_updated_at
    BEFORE UPDATE ON test_table
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions to test user
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO test_user;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO test_user;

-- Create TimescaleDB-specific test tables
CREATE TABLE IF NOT EXISTS device_events (
    time TIMESTAMPTZ NOT NULL,
    device_id INTEGER NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    event_data JSONB,
    severity INTEGER DEFAULT 1
);

SELECT create_hypertable('device_events', 'time', chunk_time_interval => INTERVAL '15 minutes');

CREATE INDEX IF NOT EXISTS idx_device_events_device_type ON device_events(device_id, event_type, time DESC);

-- Insert some device events
INSERT INTO device_events (time, device_id, event_type, event_data, severity)
SELECT
    generate_series(NOW() - INTERVAL '6 hours', NOW(), INTERVAL '10 minutes') as time,
    (random() * 50)::integer as device_id,
    ARRAY['startup', 'shutdown', 'error', 'maintenance', 'update'][ceil(random() * 5)] as event_type,
    jsonb_build_object(
        'message', 'Event occurred',
        'details', jsonb_build_object('value', random() * 100)
    ) as event_data,
    (random() * 5)::integer as severity;

-- Print summary
DO $$
DECLARE
    metrics_count INTEGER;
    weather_count INTEGER;
    events_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO metrics_count FROM metrics_data;
    SELECT COUNT(*) INTO weather_count FROM weather_data;
    SELECT COUNT(*) INTO events_count FROM device_events;

    RAISE NOTICE 'TimescaleDB test database initialized successfully';
    RAISE NOTICE 'Metrics records: %', metrics_count;
    RAISE NOTICE 'Weather records: %', weather_count;
    RAISE NOTICE 'Device events: %', events_count;
END $$;