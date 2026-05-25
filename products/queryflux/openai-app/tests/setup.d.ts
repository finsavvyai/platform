/**
 * Test Setup Configuration
 *
 * Global test configuration, mocks, and utilities
 */
export declare const testUtils: {
    /**
     * Generate test connection config
     */
    createTestConnectionConfig: (type?: string) => {
        name: string;
        type: string;
        host: string;
        port: number;
        database: string;
        username: string;
        password: string;
        ssl: boolean;
        maxConnections: number;
        connectionTimeout: number;
        queryTimeout: number;
    };
    /**
     * Generate test query
     */
    createTestQuery: (complexity?: string) => any;
    /**
     * Generate mock OpenAI response
     */
    createMockOpenAIResponse: (query: string) => {
        choices: {
            message: {
                content: string;
            };
        }[];
    };
    /**
     * Generate test schema
     */
    createTestSchema: (tableName?: string) => {
        tables: {
            name: string;
            type: string;
            columns: {
                name: string;
                type: string;
                nullable: boolean;
                primaryKey: boolean;
            }[];
            primaryKey: string[];
            foreignKeys: never[];
        }[];
        relationships: never[];
    };
};
export declare const TEST_CONSTANTS: {
    TIMEOUTS: {
        SHORT: number;
        MEDIUM: number;
        LONG: number;
    };
    CONNECTION_CONFIG: {
        MAX_CONNECTIONS: number;
        DEFAULT_TIMEOUT: number;
    };
    QUERY_LIMITS: {
        DEFAULT_LIMIT: number;
        MAX_LIMIT: number;
    };
    OPENAI_CONFIG: {
        DEFAULT_MODEL: string;
        DEFAULT_TEMPERATURE: number;
        DEFAULT_MAX_TOKENS: number;
    };
};
//# sourceMappingURL=setup.d.ts.map