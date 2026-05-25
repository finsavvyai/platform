-- MySQL test database initialization script
-- Creates test schemas and tables for integration testing

-- Create test tables with various data types
CREATE TABLE IF NOT EXISTS test_table (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE,
    age INT CHECK (age >= 0),
    salary DECIMAL(10,2),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    json_data JSON,
    tags JSON
);

-- Create test table for schema operations
CREATE TABLE IF NOT EXISTS schema_test (
    id INT PRIMARY KEY,
    text_col TEXT,
    int_col INT,
    float_col FLOAT,
    date_col DATE,
    time_col TIME,
    timestamp_col TIMESTAMP,
    bool_col BOOLEAN,
    uuid_col CHAR(36)
);

-- Create foreign key test tables
CREATE TABLE IF NOT EXISTS departments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    manager_id INT,
    FOREIGN KEY (manager_id) REFERENCES departments(id)
);

CREATE TABLE IF NOT EXISTS employees (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    department_id INT,
    salary DECIMAL(10,2),
    hire_date DATE DEFAULT CURDATE(),
    FOREIGN KEY (department_id) REFERENCES departments(id)
);

-- Create indexes for testing
CREATE INDEX IF NOT EXISTS idx_test_table_email ON test_table(email);
CREATE INDEX IF NOT EXISTS idx_test_table_name ON test_table(name);
CREATE INDEX IF NOT EXISTS idx_test_table_created_at ON test_table(created_at);

-- Insert sample data
INSERT INTO test_table (name, email, age, salary, is_active, json_data, tags) VALUES
('John Doe', 'john@example.com', 30, 75000.00, TRUE, '{"department": "engineering", "level": "senior"}', '["developer", "fullstack"]'),
('Jane Smith', 'jane@example.com', 28, 68000.00, TRUE, '{"department": "design", "level": "mid"}', '["designer", "ui"]'),
('Bob Johnson', 'bob@example.com', 35, 82000.00, FALSE, '{"department": "engineering", "level": "lead"}', '["developer", "backend", "manager"]'),
('Alice Brown', 'alice@example.com', 32, 72000.00, TRUE, '{"department": "product", "level": "senior"}', '["product", "strategy"]'),
('Charlie Wilson', 'charlie@example.com', 29, 65000.00, TRUE, '{"department": "engineering", "level": "junior"}', '["developer", "frontend"]');

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

-- Create a stored procedure for testing
DELIMITER //
CREATE PROCEDURE calculate_annual_salary(IN emp_id INT, OUT annual_salary DECIMAL(10,2))
BEGIN
    SELECT salary * 12 INTO annual_salary FROM employees WHERE id = emp_id;
END //
DELIMITER ;

-- Create a trigger for testing
DELIMITER //
CREATE TRIGGER update_test_table_updated_at
    BEFORE UPDATE ON test_table
    FOR EACH ROW
BEGIN
    SET NEW.updated_at = CURRENT_TIMESTAMP;
END //
DELIMITER ;

-- Grant permissions to test user
GRANT ALL PRIVILEGES ON test_db.* TO 'test_user'@'%';