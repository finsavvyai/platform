-- +goose Down
-- Rollback initial schema migration

-- Drop tables in reverse order of creation
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS api_keys CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS organizations CASCADE;

-- Drop enum types
DROP TYPE IF EXISTS notification_type;
DROP TYPE IF EXISTS account_status;
DROP TYPE IF EXISTS transaction_status;
DROP TYPE IF EXISTS payment_method;
DROP TYPE IF EXISTS risk_level;

-- Drop extension
DROP EXTENSION IF EXISTS "uuid-ossp";
