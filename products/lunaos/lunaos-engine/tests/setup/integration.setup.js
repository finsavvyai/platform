// Integration test setup — runs before each test file
// Sets up test environment for D1/KV mocking via miniflare

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-integration-tests';
process.env.ENVIRONMENT = 'test';
