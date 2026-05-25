// Import jest from the global scope (available in Jest environment)
// import { setupCustomMatchers } from './utils/customMatchers.js';
// import { TestEnvironmentUtils, DatabaseTestUtils } from './utils/testHelpers.js';

// Setup custom matchers
// setupCustomMatchers();

// Global test setup
beforeAll(async () => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-secret-key';
  process.env.DATABASE_URL = 'postgresql://shaharsolomon@localhost:5432/questro_test';
  process.env.TEST_DATABASE_URL = process.env.DATABASE_URL;
  process.env.REDIS_URL = 'redis://localhost:6379/1';
  process.env.OPENAI_API_KEY = 'test-openai-key';
  
  // Additional environment variables for comprehensive testing
  process.env.DB_HOST = 'localhost';
  process.env.DB_PORT = '5432';
  process.env.DB_NAME = 'questro_test';
  process.env.DB_USER = 'shaharsolomon';
  process.env.DB_PASSWORD = '';
  process.env.STRIPE_SECRET_KEY = 'test-stripe-key';
  process.env.LEMON_SQUEEZY_API_KEY = 'test-lemonsqueezy-key';
  process.env.USE_SUPABASE = 'false';
  
  // Initialize test database if needed
  // try {
  //   await DatabaseTestUtils.seedTestData();
  // } catch (error) {
  //   console.warn('Database seeding skipped:', error.message);
  // }
});

// Global test cleanup
afterAll(async () => {
  // Cleanup test data
  // try {
  //   await DatabaseTestUtils.cleanupDatabase();
  // } catch (error) {
  //   console.warn('Database cleanup skipped:', error.message);
  // }
});

// Setup for each test
beforeEach(() => {
  // Clear all mocks before each test
  // jest.clearAllMocks();
});

// Cleanup after each test
afterEach(async () => {
  // Rollback any test transactions
  // try {
  //   await DatabaseTestUtils.rollbackTestTransaction();
  // } catch (error) {
  //   // Ignore rollback errors in tests that don't use transactions
  // }
});

// Global test utilities
// global.console = {
//   ...console,
//   log: jest.fn(),
//   debug: jest.fn(),
//   info: jest.fn(),
//   warn: jest.fn(),
//   error: jest.fn(),
// };

// Global error handler for unhandled promise rejections in tests
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Global error handler for uncaught exceptions in tests
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});