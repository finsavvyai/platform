// Mock database configuration for tests
export const db = {
  query: () => Promise.resolve([]),
  execute: () => Promise.resolve({}),
};