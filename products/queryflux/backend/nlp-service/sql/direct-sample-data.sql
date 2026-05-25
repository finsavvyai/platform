-- Direct sample data initialization script for H2
DROP TABLE IF EXISTS SAMPLE_DATA;

CREATE TABLE SAMPLE_DATA (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50),
    category VARCHAR(50),
    value DECIMAL(10,2),
    created_date DATE
);

INSERT INTO SAMPLE_DATA (name, category, value, created_date) VALUES
    ('Product A', 'Electronics', 150.50, '2023-01-01'),
    ('Product B', 'Electronics', 200.75, '2023-01-05'),
    ('Product C', 'Furniture', 350.25, '2023-01-10'),
    ('Product D', 'Furniture', 120.00, '2023-01-15'),
    ('Product E', 'Clothing', 75.99, '2023-01-20'),
    ('Product F', 'Clothing', 45.50, '2023-01-25'),
    ('Product G', 'Electronics', 500.00, '2023-02-01'),
    ('Product H', 'Furniture', 250.00, '2023-02-05'),
    ('Product I', 'Clothing', 60.75, '2023-02-10'),
    ('Product J', 'Electronics', 350.25, '2023-02-15');
