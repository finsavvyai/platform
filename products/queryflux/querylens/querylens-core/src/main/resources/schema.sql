-- File: src/main/resources/schema.sql
CREATE TABLE IF NOT EXISTS datasources (
                                           id SERIAL PRIMARY KEY,
                                           name VARCHAR(255) NOT NULL,
    description TEXT,
    url VARCHAR(255) NOT NULL,
    username VARCHAR(255) NOT NULL,
    password VARCHAR(255) NOT NULL,
    driver_class_name VARCHAR(255) NOT NULL
    );

-- Common prompts table for dashboard functionality
CREATE TABLE IF NOT EXISTS common_prompts (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    prompt_text TEXT NOT NULL,
    category VARCHAR(100),
    usage_count INT DEFAULT 0,
    is_favorite BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP
);

-- Sample data
MERGE INTO datasources (name, description, url, username, password, driver_class_name)
KEY(name)
VALUES ('Sample Database', 'Sample database for testing', 'jdbc:h2:mem:testdb', 'sa', '', 'org.h2.Driver');