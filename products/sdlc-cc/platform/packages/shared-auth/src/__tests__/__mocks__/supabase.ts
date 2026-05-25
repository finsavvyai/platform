// Manual mock for @supabase/supabase-js
// Controls the return values via exported mutable refs so tests can override them.

export const mockAuthSignInWithPassword = jest.fn();
export const mockAuthSignUp = jest.fn();
export const mockAuthSignOut = jest.fn();
export const mockAuthGetUser = jest.fn();
export const mockFrom = jest.fn();

// Default chainable query builder
export const createQueryBuilder = (defaultResult: { data: any; error: any }) => {
  const builder: any = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(defaultResult),
    then: undefined as any,
  };
  // Make the builder itself thenable so `await from(...).insert(...)` resolves.
  builder.insert = jest.fn().mockResolvedValue(defaultResult);
  builder.update = jest.fn().mockReturnThis();
  builder.eq = jest.fn().mockReturnThis();
  builder.select = jest.fn().mockReturnThis();
  builder.single = jest.fn().mockResolvedValue(defaultResult);
  return builder;
};

// Per-table overrides map – populated by tests using mockTableResult()
const tableResults: Map<string, { data: any; error: any }> = new Map();

export const mockTableResult = (table: string, result: { data: any; error: any }) => {
  tableResults.set(table, result);
};

export const clearTableResults = () => tableResults.clear();

const buildChain = (table: string) => {
  const getResult = () => tableResults.get(table) ?? { data: null, error: null };

  const chain: any = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockImplementation(() => Promise.resolve(getResult())),
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockImplementation(() => Promise.resolve(getResult())),
  };

  return chain;
};

const makeClient = () => ({
  auth: {
    signInWithPassword: mockAuthSignInWithPassword,
    signUp: mockAuthSignUp,
    signOut: mockAuthSignOut,
    getUser: mockAuthGetUser,
  },
  from: (table: string) => buildChain(table),
});

export const createClient = jest.fn().mockImplementation(() => makeClient());
