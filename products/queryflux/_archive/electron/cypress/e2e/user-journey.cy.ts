/// <reference types=\"cypress\" />
import { faker } from '@faker-js/faker';

describe('Complete User Journey', () => {
  const testUser = {
    name: faker.person.fullName(),
    email: faker.internet.email(),
    password: 'TestPassword123!',
  };

  const testConnection = {
    name: 'Test PostgreSQL Connection',
    type: 'postgresql',
    host: 'localhost',
    port: '5432',
    database: 'test_db',
    username: 'test_user',
    password: 'test_password',
  };

  beforeEach(() => {
    // Mock the electron APIs
    cy.window().then((win) => {
      win.electronAPI = {
        // App methods
        app: {
          version: cy.stub().resolves('1.0.0'),
          quit: cy.stub().resolves(),
          minimize: cy.stub().resolves(),
          maximize: cy.stub().resolves(),
          showMessageBox: cy.stub().resolves({ response: 0 }),
          showSaveDialog: cy.stub().resolves({ canceled: false, filePath: '/tmp/test.sql' }),
          showOpenDialog: cy.stub().resolves({ canceled: false, filePaths: ['/tmp/test.sql'] }),
        },

        // Auth methods
        auth: {
          login: cy.stub().resolves({
            id: 'user-123',
            name: testUser.name,
            email: testUser.email,
            role: 'user',
            subscription: { tier: 'free', status: 'active' },
          }),
          logout: cy.stub().resolves(),
          register: cy.stub().resolves({
            id: 'user-123',
            name: testUser.name,
            email: testUser.email,
            role: 'user',
            subscription: { tier: 'free', status: 'active' },
          }),
          refreshToken: cy.stub().resolves(),
          getCurrentUser: cy.stub().resolves({
            id: 'user-123',
            name: testUser.name,
            email: testUser.email,
            role: 'user',
            subscription: { tier: 'free', status: 'active' },
          }),
          isAuthenticated: cy.stub().resolves(true),
        },

        // Connection methods
        connections: {
          getAll: cy.stub().resolves([]),
          getById: cy.stub().resolves(null),
          create: cy.stub().resolves({
            id: 'conn-123',
            ...testConnection,
            port: parseInt(testConnection.port),
            status: 'connected',
            createdAt: new Date().toISOString(),
          }),
          update: cy.stub().resolves({
            id: 'conn-123',
            ...testConnection,
            port: parseInt(testConnection.port),
            status: 'connected',
            updatedAt: new Date().toISOString(),
          }),
          delete: cy.stub().resolves(),
          test: cy.stub().resolves({
            success: true,
            message: 'Connection successful',
            latency: 45,
          }),
          getSchema: cy.stub().resolves({
            schemas: ['public'],
            tables: [
              {
                name: 'users',
                type: 'table',
                schema: 'public',
                columns: [
                  { name: 'id', type: 'integer', nullable: false, primaryKey: true },
                  { name: 'name', type: 'varchar', nullable: false, primaryKey: false },
                  { name: 'email', type: 'varchar', nullable: false, primaryKey: false },
                ],
                indexes: [
                  { name: 'users_pkey', columns: ['id'], type: 'btree', unique: true },
                ],
                rowCount: 100,
              },
            ],
          }),
        },

        // Query methods
        query: {
          execute: cy.stub().resolves({
            id: 'query-123',
            connectionId: 'conn-123',
            query: 'SELECT * FROM users LIMIT 10',
            status: 'completed',
            executionTime: 125,
            rowsAffected: 10,
            columns: [
              { name: 'id', type: 'integer', nullable: false },
              { name: 'name', type: 'varchar', nullable: false },
              { name: 'email', type: 'varchar', nullable: false },
            ],
            data: [
              { id: 1, name: 'John Doe', email: 'john@example.com' },
              { id: 2, name: 'Jane Smith', email: 'jane@example.com' },
            ],
            createdAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
          }),
          getHistory: cy.stub().resolves([
            {
              id: 'query-123',
              connectionId: 'conn-123',
              query: 'SELECT * FROM users LIMIT 10',
              status: 'completed',
              executionTime: 125,
              rowsAffected: 10,
              createdAt: new Date().toISOString(),
            },
          ]),
          save: cy.stub().resolves({
            id: 'saved-query-123',
            connectionId: 'conn-123',
            name: 'Get All Users',
            description: 'Retrieve all users from the database',
            query: 'SELECT * FROM users',
            tags: ['users', 'select'],
            createdAt: new Date().toISOString(),
          }),
          getSaved: cy.stub().resolves([
            {
              id: 'saved-query-123',
              connectionId: 'conn-123',
              name: 'Get All Users',
              description: 'Retrieve all users from the database',
              query: 'SELECT * FROM users',
              tags: ['users', 'select'],
              createdAt: new Date().toISOString(),
            },
          ]),
          delete: cy.stub().resolves(),
        },

        // Table methods
        table: {
          getData: cy.stub().resolves({
            data: [
              { id: 1, name: 'John Doe', email: 'john@example.com' },
              { id: 2, name: 'Jane Smith', email: 'jane@example.com' },
            ],
            columns: [
              { name: 'id', type: 'integer' },
              { name: 'name', type: 'varchar' },
              { name: 'email', type: 'varchar' },
            ],
            totalRows: 2,
          }),
          getStructure: cy.stub().resolves({
            name: 'users',
            type: 'table',
            schema: 'public',
            columns: [
              { name: 'id', type: 'integer', nullable: false, primaryKey: true },
              { name: 'name', type: 'varchar', nullable: false, primaryKey: false },
              { name: 'email', type: 'varchar', nullable: false, primaryKey: false },
            ],
            indexes: [
              { name: 'users_pkey', columns: ['id'], type: 'btree', unique: true },
            ],
            rowCount: 100,
          }),
          insert: cy.stub().resolves({ insertedCount: 1, insertedIds: [3] }),
          update: cy.stub().resolves({ updatedCount: 1 }),
          delete: cy.stub().resolves({ deletedCount: 1 }),
        },

        // WebSocket methods
        websocket: {
          connect: cy.stub().resolves(),
          disconnect: cy.stub().resolves(),
          subscribe: cy.stub().resolves('sub-123'),
          unsubscribe: cy.stub().resolves(),
        },

        // API methods
        api: {
          healthCheck: cy.stub().resolves({
            status: 'healthy',
            version: '1.0.0',
            timestamp: new Date().toISOString(),
            services: {
              database: 'healthy',
              redis: 'healthy',
              websocket: 'healthy',
            },
          }),
        },

        // Settings methods
        settings: {
          get: cy.stub().resolves('dark'),
          set: cy.stub().resolves(),
          getAll: cy.stub().resolves({
            theme: 'dark',
            language: 'en',
            autoSaveQueries: true,
          }),
        },

        // Store methods
        store: {
          get: cy.stub().resolves(),
          set: cy.stub().resolves(),
          delete: cy.stub().resolves(),
          clear: cy.stub().resolves(),
        },

        // Event methods
        on: cy.stub(),
        off: cy.stub(),
        removeAllListeners: cy.stub(),
      };
    });
  });

  it('should complete full user journey from signup to query execution', () => {
    cy.visit('/');

    // Step 1: User Registration
    cy.get('[data-testid=\"auth-component\"]').should('be.visible');
    cy.get('[data-testid=\"toggle-auth-mode\"]').click();
    cy.get('[data-testid=\"name-input\"]').type(testUser.name);
    cy.get('[data-testid=\"email-input\"]').type(testUser.email);
    cy.get('[data-testid=\"password-input\"]').type(testUser.password);
    cy.get('[data-testid=\"confirm-password-input\"]').type(testUser.password);
    cy.get('[data-testid=\"register-button\"]').click();

    // Verify successful registration
    cy.get('[data-testid=\"user-info\"]').should('be.visible');
    cy.get('[data-testid=\"user-name\"]').should('contain', testUser.name);
    cy.get('[data-testid=\"user-email\"]').should('contain', testUser.email);

    // Step 2: Create Database Connection
    cy.get('[data-testid=\"new-connection-btn\"]').click();
    cy.get('[data-testid=\"connection-name\"]').type(testConnection.name);
    cy.get('[data-testid=\"database-type\"]').select(testConnection.type);
    cy.get('[data-testid=\"host\"]').type(testConnection.host);
    cy.get('[data-testid=\"port\"]').type(testConnection.port);
    cy.get('[data-testid=\"database\"]').type(testConnection.database);
    cy.get('[data-testid=\"username\"]').type(testConnection.username);
    cy.get('[data-testid=\"password\"]').type(testConnection.password);
    cy.get('[data-testid=\"save-connection-btn\"]').click();

    // Verify connection was created
    cy.contains(testConnection.name).should('be.visible');
    cy.get('[data-testid=\"status-connected\"]').should('be.visible');

    // Step 3: Test Connection
    cy.get('[data-testid=\"test-connection-btn\"]').first().click();
    cy.contains('Connection successful').should('be.visible');

    // Step 4: View Database Schema
    cy.get('[data-testid=\"connection-item\"]').first().click();
    cy.get('[data-testid=\"refresh-schema-btn\"]').click();
    cy.get('[data-testid=\"schema-tables\"]').should('be.visible');
    cy.contains('users').should('be.visible');

    // Step 5: Execute SQL Query
    cy.get('[data-testid=\"query-editor\"]').type('SELECT * FROM users LIMIT 10');
    cy.get('[data-testid=\"execute-query-btn\"]').click();

    // Verify query results
    cy.get('[data-testid=\"query-results\"]').should('be.visible');
    cy.get('[data-testid=\"result-table\"]').should('be.visible');
    cy.get('[data-testid=\"result-rows\"]').should('contain', '2 rows');

    // Step 6: Save Query
    cy.get('[data-testid=\"save-query-btn\"]').click();
    cy.get('[data-testid=\"query-name\"]').type('Get All Users');
    cy.get('[data-testid=\"query-description\"]').type('Retrieve all users from the database');
    cy.get('[data-testid=\"confirm-save-btn\"]').click();

    // Verify query was saved
    cy.get('[data-testid=\"saved-queries\"]').should('be.visible');
    cy.contains('Get All Users').should('be.visible');

    // Step 7: View Query History
    cy.get('[data-testid=\"query-history-btn\"]').click();
    cy.get('[data-testid=\"history-list\"]').should('be.visible');
    cy.contains('SELECT * FROM users LIMIT 10').should('be.visible');

    // Step 8: Explore Table Data
    cy.get('[data-testid=\"table-users\"]').click();
    cy.get('[data-testid=\"view-table-data\"]').click();
    cy.get('[data-testid=\"table-data-grid\"]').should('be.visible');
    cy.get('[data-testid=\"data-row\"]').should('have.length.greaterThan', 0);

    // Step 9: Edit Table Data
    cy.get('[data-testid=\"edit-data-btn\"]').click();
    cy.get('[data-testid=\"data-cell-0-1\"]').dblclick();
    cy.get('[data-testid=\"cell-editor\"]').type('Updated Name');
    cy.get('[data-testid=\"save-changes-btn\"]').click();

    // Verify data was updated
    cy.contains('Updated Name').should('be.visible');

    // Step 10: Real-time Features
    cy.get('[data-testid=\"enable-realtime-btn\"]').click();
    cy.get('[data-testid=\"websocket-status\"]').should('contain', 'Connected');
    cy.get('[data-testid=\"subscribe-metrics\"]').click();
    cy.get('[data-testid=\"metrics-dashboard\"]').should('be.visible');

    // Step 11: Settings and Preferences
    cy.get('[data-testid=\"settings-btn\"]').click();
    cy.get('[data-testid=\"theme-selector\"]').select('dark');
    cy.get('[data-testid=\"auto-save-queries\"]').check();
    cy.get('[data-testid=\"save-settings-btn\"]').click();

    // Verify settings were saved
    cy.get('[data-testid=\"settings-saved-notification\"]').should('be.visible');

    // Step 12: Logout
    cy.get('[data-testid=\"user-menu\"]').click();
    cy.get('[data-testid=\"logout-btn\"]').click();
    cy.get('[data-testid=\"auth-component\"]').should('be.visible');

    // Verify user is logged out
    cy.get('[data-testid=\"user-info\"]').should('not.exist');
  });

  it('should handle authentication errors gracefully', () => {
    cy.visit('/');

    // Mock authentication failure
    cy.window().then((win) => {
      win.electronAPI.auth.login.rejects(new Error('Invalid credentials'));
    });

    // Attempt login with invalid credentials
    cy.get('[data-testid=\"email-input\"]').type('invalid@example.com');
    cy.get('[data-testid=\"password-input\"]').type('wrongpassword');
    cy.get('[data-testid=\"login-button\"]').click();

    // Verify error message
    cy.get('[data-testid=\"error-message\"]').should('contain', 'Invalid credentials');
    cy.get('[data-testid=\"auth-component\"]').should('be.visible');
  });

  it('should handle connection errors gracefully', () => {
    cy.visit('/');

    // Mock successful login
    cy.window().then((win) => {
      win.electronAPI.auth.login.resolves({
        id: 'user-123',
        name: testUser.name,
        email: testUser.email,
        role: 'user',
      });
      win.electronAPI.auth.isAuthenticated.resolves(true);
      win.electronAPI.auth.getCurrentUser.resolves({
        id: 'user-123',
        name: testUser.name,
        email: testUser.email,
        role: 'user',
      });
    });

    // Login first
    cy.get('[data-testid=\"email-input\"]').type(testUser.email);
    cy.get('[data-testid=\"password-input\"]').type(testUser.password);
    cy.get('[data-testid=\"login-button\"]').click();

    // Mock connection test failure
    cy.window().then((win) => {
      win.electronAPI.connections.test.rejects(new Error('Connection failed'));
    });

    // Attempt to create and test connection
    cy.get('[data-testid=\"new-connection-btn\"]').click();
    cy.get('[data-testid=\"connection-name\"]').type('Invalid Connection');
    cy.get('[data-testid=\"host\"]').type('invalid-host');
    cy.get('[data-testid=\"port\"]').type('9999');
    cy.get('[data-testid=\"save-connection-btn\"]').click();

    // Mock successful connection creation but failed test
    cy.window().then((win) => {
      win.electronAPI.connections.create.resolves({
        id: 'conn-123',
        name: 'Invalid Connection',
        host: 'invalid-host',
        port: 9999,
        status: 'error',
      });
    });

    cy.get('[data-testid=\"test-connection-btn\"]').click();

    // Verify error handling
    cy.get('[data-testid=\"connection-error\"]').should('contain', 'Connection failed');
    cy.get('[data-testid=\"status-error\"]').should('be.visible');
  });

  it('should handle query execution errors gracefully', () => {
    cy.visit('/');

    // Mock successful login and existing connection
    cy.window().then((win) => {
      win.electronAPI.auth.login.resolves({
        id: 'user-123',
        name: testUser.name,
        email: testUser.email,
        role: 'user',
      });
      win.electronAPI.auth.isAuthenticated.resolves(true);
      win.electronAPI.auth.getCurrentUser.resolves({
        id: 'user-123',
        name: testUser.name,
        email: testUser.email,
        role: 'user',
      });
      win.electronAPI.connections.getAll.resolves([
        {
          id: 'conn-123',
          name: 'Test Connection',
          type: 'postgresql',
          host: 'localhost',
          port: 5432,
          status: 'connected',
        },
      ]);
    });

    // Login
    cy.get('[data-testid=\"email-input\"]').type(testUser.email);
    cy.get('[data-testid=\"password-input\"]').type(testUser.password);
    cy.get('[data-testid=\"login-button\"]').click();

    // Mock query execution failure
    cy.window().then((win) => {
      win.electronAPI.query.execute.rejects(new Error('SQL syntax error'));
    });

    // Select connection and execute invalid query
    cy.get('[data-testid=\"connection-item\"]').first().click();
    cy.get('[data-testid=\"query-editor\"]').type('INVALID SQL QUERY');
    cy.get('[data-testid=\"execute-query-btn\"]').click();

    // Verify error handling
    cy.get('[data-testid=\"query-error\"]').should('contain', 'SQL syntax error');
    cy.get('[data-testid=\"query-results\"]').should('not.be.visible');
  });
});