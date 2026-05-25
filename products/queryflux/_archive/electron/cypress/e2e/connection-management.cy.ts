/// <reference types="cypress" />
import { faker } from '@faker-js/faker';

describe('Connection Management', () => {
  beforeEach(() => {
    cy.visit('/');
    // Mock the electron APIs
    cy.window().then((win) => {
      win.electronAPI = {
        invoke: cy.stub().resolves(),
        on: cy.stub(),
        removeAllListeners: cy.stub(),
        getConnections: cy.stub().resolves([]),
        createConnection: cy.stub().resolves(faker.string.uuid()),
        testConnection: cy.stub().resolves(true),
        deleteConnection: cy.stub().resolves(),
        updateConnection: cy.stub().resolves(),
        encryptPassword: cy.stub().resolves('encrypted'),
        decryptPassword: cy.stub().resolves('decrypted'),
      };
    });
  });

  describe('Connection Creation', () => {
    it('should open connection dialog', () => {
      // Click on new connection button
      cy.get('[data-testid="new-connection-btn"]').click();

      // Check if dialog opens
      cy.get('[data-testid="connection-dialog"]').should('be.visible');
      cy.contains('h2', 'New Connection').should('be.visible');
    });

    it('should create a PostgreSQL connection', () => {
      const connectionData = {
        name: 'Test PostgreSQL',
        type: 'postgresql',
        host: 'localhost',
        port: '5432',
        database: 'test_db',
        username: 'test_user',
        password: 'test_password',
      };

      cy.get('[data-testid="new-connection-btn"]').click();

      // Fill out connection form
      cy.get('[data-testid="connection-name"]').type(connectionData.name);
      cy.get('[data-testid="database-type"]').select(connectionData.type);
      cy.get('[data-testid="host"]').type(connectionData.host);
      cy.get('[data-testid="port"]').type(connectionData.port);
      cy.get('[data-testid="database"]').type(connectionData.database);
      cy.get('[data-testid="username"]').type(connectionData.username);
      cy.get('[data-testid="password"]').type(connectionData.password);

      // Save connection
      cy.get('[data-testid="save-connection-btn"]').click();

      // Verify connection was created
      cy.window().then((win) => {
        expect(win.electronAPI.createConnection).to.be.calledWith({
          name: connectionData.name,
          type: connectionData.type,
          host: connectionData.host,
          port: parseInt(connectionData.port),
          database: connectionData.database,
          username: connectionData.username,
          password: connectionData.password,
          sslMode: 'prefer',
          timeout: 30,
        });
      });

      // Check if connection appears in the list
      cy.contains(connectionData.name).should('be.visible');
    });

    it('should create a MongoDB connection', () => {
      const connectionData = {
        name: 'Test MongoDB',
        type: 'mongodb',
        host: 'localhost',
        port: '27017',
        database: 'test_db',
        username: 'test_user',
        password: 'test_password',
      };

      cy.get('[data-testid="new-connection-btn"]').click();

      // Fill out connection form
      cy.get('[data-testid="connection-name"]').type(connectionData.name);
      cy.get('[data-testid="database-type"]').select(connectionData.type);
      cy.get('[data-testid="host"]').type(connectionData.host);
      cy.get('[data-testid="port"]').type(connectionData.port);
      cy.get('[data-testid="database"]').type(connectionData.database);
      cy.get('[-testid="username"]').type(connectionData.username);
      cy.get('[data-testid="password"]').type(connectionData.password);

      // Save connection
      cy.get('[data-testid="save-connection-btn"]').click();

      // Verify connection was created
      cy.window().then((win) => {
        expect(win.electronAPI.createConnection).to.be.calledWith({
          name: connectionData.name,
          type: connectionData.type,
          host: connectionData.host,
          port: parseInt(connectionData.port),
          database: connectionData.database,
          username: connectionData.username,
          password: connectionData.password,
        });
      });

      // Check if connection appears in the list
      cy.contains(connectionData.name).should('be.visible');
    });

    it('should validate required fields', () => {
      cy.get('[data-testid="new-connection-btn"]').click();

      // Try to save without filling required fields
      cy.get('[data-testid="save-connection-btn"]').click();

      // Should show validation errors
      cy.contains('Connection name is required').should('be.visible');
      cy.contains('Host is required').should('be.visible');
      cy.contains('Port is required').should('be.visible');
    });

    it('should validate port number', () => {
      cy.get('[data-testid="new-connection-btn"]').click();

      // Fill form with invalid port
      cy.get('[data-testid="connection-name"]').type('Test Connection');
      cy.get('[data-testid="host"]').type('localhost');
      cy.get('[data-testid="port"]').type('invalid-port');

      // Save connection
      cy.get('[data-testid="save-connection-btn"]').click();

      // Should show validation error
      cy.contains('Port must be a valid number').should('be.visible');
    });
  });

  describe('Connection Testing', () => {
    beforeEach(() => {
      // Create a test connection first
      cy.window().then((win) => {
        win.electronAPI.getConnections.returns([{
          id: 'test-connection',
          name: 'Test Connection',
          type: 'postgresql',
          host: 'localhost',
          port: 5432,
          database: 'test_db',
          username: 'test_user',
          sslMode: 'prefer',
        }]);
      });
    });

    it('should test connection successfully', () => {
      cy.get('[data-testid="connection-item"]').first().within(() => {
        cy.get('[data-testid="test-connection-btn"]').click();
      });

      // Verify test was called
      cy.window().then((win) => {
        expect(win.electronAPI.testConnection).to.be.called();
      });

      // Should show success message
      cy.contains('Connection successful').should('be.visible');
    });

    it('should handle connection test failure', () => {
      cy.window().then((win) => {
        win.electronAPI.testConnection.rejects(new Error('Connection failed'));
      });

      cy.get('[data-testid="connection-item"]').first().within(() => {
        cy.get('[data-testid="test-connection-btn"]').click();
      });

      // Should show error message
      cy.contains('Connection failed').should('be.visible');
    });
  });

  describe('Connection Editing', () => {
    beforeEach(() => {
      // Create a test connection first
      cy.window().then((win) => {
        win.electronAPI.getConnections.returns([{
          id: 'test-connection',
          name: 'Test Connection',
          type: 'postgresql',
          host: 'localhost',
          port: 5432,
          database: 'test_db',
          username: 'test_user',
          sslMode: 'prefer',
        }]);
      });
    });

    it('should edit connection details', () => {
      cy.get('[data-testid="connection-item"]').first().within(() => {
        cy.get('[data-testid="edit-connection-btn"]').click();
      });

      // Check if edit dialog opens with pre-filled data
      cy.get('[data-testid="connection-dialog"]').should('be.visible');
      cy.get('[data-testid="connection-name"]').should('have.value', 'Test Connection');
      cy.get('[data-testid="host"]').should('have.value', 'localhost');
      cy.get('[data-testid="port"]').should('have.value', '5432');

      // Update connection name
      cy.get('[data-testid="connection-name"]').clear().type('Updated Connection');

      // Save changes
      cy.get('[data-testid="save-connection-btn"]').click();

      // Verify update was called
      cy.window().then((win) => {
        expect(win.electronAPI.updateConnection).to.be.calledWith({
          id: 'test-connection',
          name: 'Updated Connection',
          type: 'postgresql',
          host: 'localhost',
          port: 5432,
          database: 'test_db',
          username: 'test_user',
          sslMode: 'prefer',
        });
      });
    });
  });

  describe('Connection Deletion', () => {
    beforeEach(() => {
      // Create a test connection first
      cy.window().then((win) => {
        win.electronAPI.getConnections.returns([{
          id: 'test-connection',
          name: 'Test Connection',
          type: 'postgresql',
          host: 'localhost',
          port: 5432,
          database: 'test_db',
          username: 'test_user',
        }]);
      });
    });

    it('should delete connection', () => {
      cy.get('[data-testid="connection-item"]').first().within(() => {
        cy.get('[data-testid="delete-connection-btn"]').click();
      });

      // Handle confirmation dialog
      cy.get('[data-testid="confirm-delete-btn"]').click();

      // Verify deletion was called
      cy.window().then((win) => {
        expect(win.electronAPI.deleteConnection).to.be.calledWith('test-connection');
      });

      // Connection should be removed from list
      cy.contains('Test Connection').should('not.exist');
    });

    it('should cancel deletion', () => {
      cy.get('[data-testid="connection-item"]').first().within(() => {
        cy.get('[data-testid="delete-connection-btn"]').click();
      });

      // Cancel deletion
      cy.get('[data-testid="cancel-delete-btn"]').click();

      // Connection should still exist
      cy.contains('Test Connection').should('be.visible');

      // Verify deletion was not called
      cy.window().then((win) => {
        expect(win.electronAPI.deleteConnection).not.to.be.called();
      });
    });
  });

  describe('Connection List', () => {
    it('should display empty state when no connections exist', () => {
      // Mock empty connections list
      cy.window().then((win) => {
        win.electronAPI.getConnections.returns([]);
      });

      // Should show empty state
      cy.contains('No connections yet').should('be.visible');
      cy.contains('Create your first connection').should('be.visible');
      cy.get('[data-testid="new-connection-btn"]').should('be.visible');
    });

    it('should display multiple connections', () => {
      const connections = [
        {
          id: 'connection-1',
          name: 'PostgreSQL DB',
          type: 'postgresql',
          host: 'localhost',
          port: 5432,
          status: 'connected',
        },
        {
          id: 'connection-2',
          name: 'MongoDB',
          type: 'mongodb',
          host: 'localhost',
          port: 27017,
          status: 'connected',
        },
        {
          id: 'connection-3',
          name: 'Redis',
          type: 'redis',
          host: 'localhost',
          port: 6379,
          status: 'connected',
        },
      ];

      cy.window().then((win) => {
        win.electronAPI.getConnections.returns(connections);
      });

      // Should display all connections
      cy.contains('PostgreSQL DB').should('be.visible');
      cy.contains('MongoDB').should('be.visible');
      cy.contains('Redis').should('be.visible');

      // Should show database type indicators
      cy.get('[data-testid="db-type-postgresql"]').should('be.visible');
      cy.get('[data-testid="db-type-mongodb"]').should('be.visible');
      cy.get('[data-testid="db-type-redis"]').should('be.visible');
    });

    it('should filter connections by search', () => {
      const connections = [
        {
          id: 'connection-1',
          name: 'PostgreSQL Production',
          type: 'postgresql',
          host: 'prod.example.com',
          port: 5432,
          status: 'connected',
        },
        {
          id: 'connection-2',
          name: 'MongoDB Development',
          type: 'mongodb',
          host: 'dev.example.com',
          port: 27017,
          status: 'connected',
        },
      ];

      cy.window().then((win) => {
        win.electronAPI.getConnections.returns(connections);
      });

      // Should display both connections initially
      cy.contains('PostgreSQL Production').should('be.visible');
      cy.contains('MongoDB Development').should('be.visible');

      // Search for "PostgreSQL"
      cy.get('[data-testid="connection-search"]').type('PostgreSQL');

      // Should filter results
      cy.contains('PostgreSQL Production').should('be.visible');
      cy.contains('MongoDB Development').should('not.exist');

      // Clear search
      cy.get('[data-testid="clear-search-btn"]').click();

      // Should show all connections again
      cy.contains('PostgreSQL Production').should('be.visible');
      cy.contains('MongoDB Development').should('be.visible');
    });
  });

  describe('Connection Status', () => {
    it('should show connection status indicators', () => {
      const connections = [
        {
          id: 'connection-1',
          name: 'Connected DB',
          type: 'postgresql',
          status: 'connected',
        },
        {
          id: 'connection-2',
          name: 'Disconnected DB',
          type: 'mysql',
          status: 'disconnected',
        },
        {
          id: 'connection-3',
          name: 'Connecting DB',
          type: 'mongodb',
          status: 'connecting',
        },
      ];

      cy.window().then((win) => {
        win.electronAPI.getConnections.returns(connections);
      });

      // Should show status indicators
      cy.get('[data-testid="status-connected"]').should('be.visible');
      cy.get('[data-testid="status-disconnected"]').should('be.visible');
      cy.get('[data-testid="status-connecting"]').should('be.visible');
    });

    it('should update status in real-time', () => {
      // Initially disconnected
      cy.window().then((win) => {
        win.electronAPI.getConnections.returns([{
          id: 'connection-1',
          name: 'Test DB',
          type: 'postgresql',
          status: 'disconnected',
        }]);
      });

      cy.get('[data-testid="status-disconnected"]').should('be.visible');

      // Simulate real-time status update
      cy.window().then((win) => {
        win.electronAPI.getConnections.returns([{
          id: 'connection-1',
          name: 'Test DB',
          type: 'postgresql',
          status: 'connected',
        }]);
      });

      // Status should update without page reload
      cy.get('[data-testid="status-connected"]').should('be.visible');
      cy.get('[data-testid="status-disconnected"]').should('not.exist');
    });
  });
});