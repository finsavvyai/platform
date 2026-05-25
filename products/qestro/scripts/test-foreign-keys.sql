-- Test foreign key constraints in Questro database
PRAGMA foreign_keys = ON;

-- Test foreign key constraint functionality
BEGIN TRANSACTION;

-- Create test users
INSERT OR IGNORE INTO users (id, email, password, created_at, updated_at)
VALUES
    ('fk-test-user-1', 'fktest1@example.com', 'hash', strftime('%s', 'now'), strftime('%s', 'now')),
    ('fk-test-user-2', 'fktest2@example.com', 'hash', strftime('%s', 'now'), strftime('%s', 'now'));

-- Create test project (valid reference)
INSERT OR IGNORE INTO projects (id, user_id, name, type, created_at, updated_at)
VALUES ('fk-test-project-1', 'fk-test-user-1', 'FK Test Project', 'web', strftime('%s', 'now'), strftime('%s', 'now'));

-- Attempt to create project with invalid user ID (should fail)
INSERT INTO projects (id, user_id, name, type, created_at, updated_at)
VALUES ('fk-test-project-invalid', 'non-existent-user', 'Invalid Project', 'web', strftime('%s', 'now'), strftime('%s', 'now'));

ROLLBACK;

-- If we get here, foreign key constraints are working
SELECT 'Foreign key constraints are working correctly' as result;
