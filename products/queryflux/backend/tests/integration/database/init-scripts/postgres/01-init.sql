-- PostgreSQL test database initialization script
-- Creates test schemas and tables for integration testing

-- Create test schemas
CREATE SCHEMA IF NOT EXISTS test_schema;
CREATE SCHEMA IF NOT EXISTS integration_test;

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

-- Create test table for schema operations
CREATE TABLE IF NOT EXISTS schema_test (
    id INTEGER PRIMARY KEY,
    text_col TEXT,
    int_col INTEGER,
    float_col FLOAT,
    date_col DATE,
    time_col TIME,
    timestamp_col TIMESTAMP,
    bool_col BOOLEAN,
    uuid_col UUID DEFAULT gen_random_uuid()
);

-- Create foreign key test tables
CREATE TABLE IF NOT EXISTS departments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    manager_id INTEGER REFERENCES departments(id)
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

-- Insert sample data
INSERT INTO test_table (name, email, age, salary, is_active, json_data, tags) VALUES
('John Doe', 'john@example.com', 30, 75000.00, true, '{"department": "engineering", "level": "senior"}', ARRAY['developer', 'fullstack']),
('Jane Smith', 'jane@example.com', 28, 68000.00, true, '{"department": "design", "level": "mid"}', ARRAY['designer', 'ui']),
('Bob Johnson', 'bob@example.com', 35, 82000.00, false, '{"department": "engineering", "level": "lead"}', ARRAY['developer', 'backend', 'manager']),
('Alice Brown', 'alice@example.com', 32, 72000.00, true, '{"department": "product", "level": "senior"}', ARRAY['product', 'strategy']),
('Charlie Wilson', 'charlie@example.com', 29, 65000.00, true, '{"department": "engineering", "level": "junior"}', ARRAY['developer', 'frontend']);

INSERT INTO departments (name) VALUES
('Engineering'),
('Design'),
('Product'),
('Marketing'),
('Sales');

INSERT INTO employees (name, department_id, salary) VALUES
('John Doe', 1, 75000.00),
('Jane Smith', 2, 68000.00),
('Bob Johnson', 1, 82000.00),
('Alice Brown', 3, 72000.00),
('Charlie Wilson', 1, 65000.00);

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
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA test_schema TO test_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA integration_test TO test_user;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO test_user;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA test_schema TO test_user;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA integration_test TO test_user;