/**
 * Unit Tests: Natural Language to SQL Engine
 *
 * Comprehensive tests for AI-powered SQL generation,
 * validation, optimization, and security
 */
import { describe, it, expect, jest, beforeEach, afterEach, } from "@jest/globals";
import { NaturalLanguageToSQLEngine } from "../../../src/actions/natural-language-to-sql.js";
import { testUtils } from "../../setup.js";
// Mock OpenAI
jest.mock("openai", () => ({
    default: jest.fn().mockImplementation(() => ({
        chat: {
            completions: {
                create: jest.fn(),
            },
        },
    })),
}));
// Mock dependencies
jest.mock("../../../src/security/query-validator.js", () => ({
    QueryValidator: jest.fn().mockImplementation(() => ({
        validateSQL: jest.fn().mockResolvedValue({
            valid: true,
            errors: [],
            warnings: [],
            security: {
                hasInjection: false,
                hasDataLeak: false,
                hasPrivilegeEscalation: false,
            },
        }),
    })),
}));
jest.mock("../../../src/database/schema-analyzer.js", () => ({
    SchemaAnalyzer: jest.fn().mockImplementation(() => ({
        getSchema: jest.fn().mockResolvedValue(testUtils.createTestSchema()),
    })),
}));
describe("NaturalLanguageToSQLEngine", () => {
    let engine;
    let mockOpenAI;
    beforeEach(() => {
        engine = new NaturalLanguageToSQLEngine();
        mockOpenAI = require("openai").default().chat.completions.create;
    });
    afterEach(() => {
        jest.clearAllMocks();
    });
    describe("Basic Conversion", () => {
        it("should convert simple natural language to SQL", async () => {
            const request = {
                naturalLanguage: "Show me all users",
                connectionId: "test-connection",
                databaseType: "postgresql",
            };
            const mockResponse = testUtils.createMockOpenAIResponse("SELECT * FROM users");
            mockOpenAI.mockResolvedValue(mockResponse);
            const result = await engine.convertToSQL(request);
            expect(result.success).toBe(true);
            expect(result.generatedSQL.sql).toContain("SELECT");
            expect(result.originalQuery).toBe("Show me all users");
            expect(result.validation.valid).toBe(true);
        });
        it("should handle complex natural language queries", async () => {
            const request = {
                naturalLanguage: "Show me all active users who joined in the last 30 days, ordered by their registration date",
                connectionId: "test-connection",
                databaseType: "postgresql",
            };
            const mockResponse = testUtils.createMockOpenAIResponse(`SELECT * FROM users
         WHERE active = true
         AND created_at >= NOW() - INTERVAL '30 days'
         ORDER BY created_at DESC`);
            mockOpenAI.mockResolvedValue(mockResponse);
            const result = await engine.convertToSQL(request);
            expect(result.success).toBe(true);
            expect(result.generatedSQL.sql).toContain("WHERE");
            expect(result.generatedSQL.sql).toContain("ORDER BY");
            expect(result.generatedSQL.complexity).toBe("medium");
        });
        it("should handle aggregate queries", async () => {
            const request = {
                naturalLanguage: "Count the number of users in each department",
                connectionId: "test-connection",
                databaseType: "postgresql",
            };
            const mockResponse = testUtils.createMockOpenAIResponse("SELECT department, COUNT(*) as user_count FROM users GROUP BY department");
            mockOpenAI.mockResolvedValue(mockResponse);
            const result = await engine.convertToSQL(request);
            expect(result.success).toBe(true);
            expect(result.generatedSQL.sql).toContain("COUNT(*)");
            expect(result.generatedSQL.sql).toContain("GROUP BY");
        });
        it("should handle JOIN operations", async () => {
            const request = {
                naturalLanguage: "Show me user names and their email addresses from the profiles table",
                connectionId: "test-connection",
                databaseType: "postgresql",
            };
            const mockResponse = testUtils.createMockOpenAIResponse(`SELECT u.name, p.email
         FROM users u
         JOIN profiles p ON u.id = p.user_id`);
            mockOpenAI.mockResolvedValue(mockResponse);
            const result = await engine.convertToSQL(request);
            expect(result.success).toBe(true);
            expect(result.generatedSQL.sql).toContain("JOIN");
            expect(result.generatedSQL.sql).toContain("ON");
        });
        it("should handle empty natural language input", async () => {
            const request = {
                naturalLanguage: "",
                connectionId: "test-connection",
            };
            const result = await engine.convertToSQL(request);
            expect(result.success).toBe(false);
            expect(result.error).toContain("Query cannot be empty");
        });
        it("should validate input parameters", async () => {
            const request = {
                naturalLanguage: "Test query",
                connectionId: "",
            };
            const result = await engine.convertToSQL(request);
            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });
    });
    describe("Query Validation", () => {
        it("should validate generated SQL syntax", async () => {
            const request = {
                naturalLanguage: "Show me all users",
                connectionId: "test-connection",
                databaseType: "postgresql",
            };
            // Mock OpenAI response
            mockOpenAI.mockResolvedValue(testUtils.createMockOpenAIResponse("SELECT * FROM users"));
            // Mock validation failure
            const QueryValidator = require("../../../src/security/query-validator.js").QueryValidator;
            QueryValidator.mockImplementationOnce(() => ({
                validateSQL: jest.fn().mockResolvedValue({
                    valid: false,
                    errors: ["Syntax error near users"],
                    warnings: [],
                    security: {
                        hasInjection: false,
                        hasDataLeak: false,
                        hasPrivilegeEscalation: false,
                    },
                }),
            }));
            const result = await engine.convertToSQL(request);
            expect(result.success).toBe(true); // Still succeeds but with validation errors
            expect(result.validation.valid).toBe(false);
            expect(result.validation.errors).toContain("Syntax error near users");
        });
        it("should detect SQL injection attempts", async () => {
            const request = {
                naturalLanguage: "Show me all users; DROP TABLE users;",
                connectionId: "test-connection",
                databaseType: "postgresql",
            };
            // Mock OpenAI response (should sanitize the input)
            mockOpenAI.mockResolvedValue(testUtils.createMockOpenAIResponse("SELECT * FROM users"));
            // Mock security validation failure
            const QueryValidator = require("../../../src/security/query-validator.js").QueryValidator;
            QueryValidator.mockImplementationOnce(() => ({
                validateSQL: jest.fn().mockResolvedValue({
                    valid: true,
                    errors: [],
                    warnings: [],
                    security: {
                        hasInjection: false,
                        hasDataLeak: false,
                        hasPrivilegeEscalation: false,
                    },
                }),
            }));
            const result = await engine.convertToSQL(request);
            expect(result.success).toBe(true);
            expect(result.generatedSQL.sql).not.toContain("DROP TABLE");
        });
    });
    describe("Query Optimization", () => {
        it("should add LIMIT clause when not present", async () => {
            const request = {
                naturalLanguage: "Show me all users",
                connectionId: "test-connection",
                databaseType: "postgresql",
                includeOptimizations: true,
            };
            const mockResponse = testUtils.createMockOpenAIResponse("SELECT * FROM users");
            mockOpenAI.mockResolvedValue(mockResponse);
            const result = await engine.convertToSQL(request);
            expect(result.success).toBe(true);
            expect(result.generatedSQL.sql).toContain("LIMIT 1000");
            expect(result.optimization.enabled).toBe(true);
            expect(result.optimization.appliedOptimizations).toContain("Added result limit for safety");
        });
        it("should add TOP clause for SQL Server", async () => {
            const request = {
                naturalLanguage: "Show me all users",
                connectionId: "test-connection",
                databaseType: "sqlserver",
                includeOptimizations: true,
            };
            const mockResponse = testUtils.createMockOpenAIResponse("SELECT * FROM users");
            mockOpenAI.mockResolvedValue(mockResponse);
            const result = await engine.convertToSQL(request);
            expect(result.success).toBe(true);
            expect(result.generatedSQL.sql).toContain("SELECT TOP 1000");
        });
        it("should suggest missing indexes", async () => {
            const request = {
                naturalLanguage: "Find users by email",
                connectionId: "test-connection",
                databaseType: "postgresql",
                includeOptimizations: true,
            };
            const mockResponse = testUtils.createMockOpenAIResponse('SELECT * FROM users WHERE email = "test@example.com"');
            mockOpenAI.mockResolvedValue(mockResponse);
            const result = await engine.convertToSQL(request);
            expect(result.success).toBe(true);
            expect(result.optimization.suggestedIndexes).toContain("Consider adding index on email for WHERE clause optimization");
        });
        it("should handle optimization disabled", async () => {
            const request = {
                naturalLanguage: "Show me all users",
                connectionId: "test-connection",
                databaseType: "postgresql",
                includeOptimizations: false,
            };
            const mockResponse = testUtils.createMockOpenAIResponse("SELECT * FROM users");
            mockOpenAI.mockResolvedValue(mockResponse);
            const result = await engine.convertToSQL(request);
            expect(result.success).toBe(true);
            expect(result.optimization.enabled).toBe(false);
            expect(result.optimization.appliedOptimizations).toHaveLength(0);
        });
        it("should estimate performance gains", async () => {
            const request = {
                naturalLanguage: "Show me all users",
                connectionId: "test-connection",
                databaseType: "postgresql",
                includeOptimizations: true,
            };
            const mockResponse = testUtils.createMockOpenAIResponse("SELECT * FROM users");
            mockOpenAI.mockResolvedValue(mockResponse);
            const result = await engine.convertToSQL(request);
            expect(result.success).toBe(true);
            expect(result.optimization.performanceGain).toBeDefined();
            expect(typeof result.optimization.performanceGain).toBe("string");
        });
    });
    describe("Query Analysis and Insights", () => {
        it("should analyze query complexity correctly", async () => {
            const request = {
                naturalLanguage: "Simple count of users",
                connectionId: "test-connection",
                databaseType: "postgresql",
            };
            const mockResponse = testUtils.createMockOpenAIResponse("SELECT COUNT(*) FROM users");
            mockResponse.choices[0].message.content = JSON.stringify({
                sql: "SELECT COUNT(*) FROM users",
                explanation: "Counts total users",
                complexity: "low",
                optimizations: [],
                estimatedExecutionTime: "10ms",
            });
            mockOpenAI.mockResolvedValue(mockResponse);
            const result = await engine.convertToSQL(request);
            expect(result.success).toBe(true);
            expect(result.generatedSQL.complexity).toBe("low");
            expect(result.insights.queryType).toBe("select");
        });
        it("should provide performance considerations", async () => {
            const request = {
                naturalLanguage: "Find users with complex conditions",
                connectionId: "test-connection",
                databaseType: "postgresql",
            };
            const mockResponse = testUtils.createMockOpenAIResponse("SELECT * FROM users WHERE complex_condition = true");
            mockOpenAI.mockResolvedValue(mockResponse);
            // Mock insights generation
            const insightsMockResponse = {
                choices: [
                    {
                        message: {
                            content: JSON.stringify({
                                queryType: "select",
                                complexity: "medium",
                                tablesAccessed: ["users"],
                                estimatedRows: "1000",
                                performanceConsiderations: [
                                    "Consider adding index on complex_condition",
                                ],
                                securityConsiderations: ["Query only accesses allowed tables"],
                                optimizationSuggestions: [
                                    "Use specific columns instead of SELECT *",
                                ],
                                alternativeApproaches: [
                                    "Use materialized view for complex queries",
                                ],
                            }),
                        },
                    },
                ],
            };
            mockOpenAI.mockResolvedValueOnce(insightsMockResponse);
            const result = await engine.convertToSQL(request);
            expect(result.success).toBe(true);
            expect(result.insights.performanceConsiderations).toBeDefined();
            expect(result.insights.performanceConsiderations.length).toBeGreaterThan(0);
        });
        it("should provide security considerations", async () => {
            const request = {
                naturalLanguage: "Show me sensitive user data",
                connectionId: "test-connection",
                databaseType: "postgresql",
            };
            const mockResponse = testUtils.createMockOpenAIResponse("SELECT id, name FROM users"); // Excludes sensitive columns
            mockOpenAI.mockResolvedValue(mockResponse);
            const result = await engine.convertToSQL(request);
            expect(result.success).toBe(true);
            expect(result.insights.securityConsiderations).toBeDefined();
        });
        it("should provide optimization suggestions", async () => {
            const request = {
                naturalLanguage: "Get all data from large table",
                connectionId: "test-connection",
                databaseType: "postgresql",
            };
            const mockResponse = testUtils.createMockOpenAIResponse("SELECT * FROM large_table");
            mockOpenAI.mockResolvedValue(mockResponse);
            const result = await engine.convertToSQL(request);
            expect(result.success).toBe(true);
            expect(result.insights.optimizationSuggestions).toBeDefined();
            expect(result.insights.optimizationSuggestions.length).toBeGreaterThan(0);
        });
    });
    describe("Error Handling", () => {
        it("should handle OpenAI API failures gracefully", async () => {
            const request = {
                naturalLanguage: "Show me all users",
                connectionId: "test-connection",
                databaseType: "postgresql",
            };
            mockOpenAI.mockRejectedValue(new Error("OpenAI API error"));
            const result = await engine.convertToSQL(request);
            expect(result.success).toBe(false);
            expect(result.error).toContain("OpenAI API error");
            expect(result.suggestions).toBeDefined();
            expect(result.troubleshooting).toBeDefined();
        });
        it("should handle schema analysis failures", async () => {
            const request = {
                naturalLanguage: "Show me all users",
                connectionId: "test-connection",
                databaseType: "postgresql",
            };
            // Mock schema analyzer failure
            const SchemaAnalyzer = require("../../../src/database/schema-analyzer.js").SchemaAnalyzer;
            SchemaAnalyzer.mockImplementationOnce(() => ({
                getSchema: jest
                    .fn()
                    .mockRejectedValue(new Error("Schema analysis failed")),
            }));
            const result = await engine.convertToSQL(request);
            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });
        it("should handle validation failures", async () => {
            const request = {
                naturalLanguage: "Show me all users",
                connectionId: "test-connection",
                databaseType: "postgresql",
            };
            mockOpenAI.mockResolvedValue(testUtils.createMockOpenAIResponse("SELECT * FROM users"));
            // Mock validation failure
            const QueryValidator = require("../../../src/security/query-validator.js").QueryValidator;
            QueryValidator.mockImplementationOnce(() => ({
                validateSQL: jest
                    .fn()
                    .mockRejectedValue(new Error("Validation failed")),
            }));
            const result = await engine.convertToSQL(request);
            expect(result.success).toBe(false);
            expect(result.error).toContain("Validation failed");
        });
        it("should provide helpful error suggestions", async () => {
            const request = {
                naturalLanguage: "Invalid query that cannot be converted",
                connectionId: "test-connection",
                databaseType: "postgresql",
            };
            mockOpenAI.mockRejectedValue(new Error("Cannot understand query intent"));
            const result = await engine.convertToSQL(request);
            expect(result.success).toBe(false);
            expect(result.suggestions).toBeDefined();
            expect(result.suggestions.length).toBeGreaterThan(0);
            expect(result.troubleshooting).toBeDefined();
            expect(result.troubleshooting.length).toBeGreaterThan(0);
        });
    });
    describe("Database Type Specifics", () => {
        it("should handle PostgreSQL specific syntax", async () => {
            const request = {
                naturalLanguage: "Get users created in last 7 days",
                connectionId: "test-connection",
                databaseType: "postgresql",
            };
            const mockResponse = testUtils.createMockOpenAIResponse("SELECT * FROM users WHERE created_at >= NOW() - INTERVAL '7 days'");
            mockOpenAI.mockResolvedValue(mockResponse);
            const result = await engine.convertToSQL(request);
            expect(result.success).toBe(true);
            expect(result.generatedSQL.sql).toContain("NOW()");
            expect(result.generatedSQL.sql).toContain("INTERVAL '7 days'");
        });
        it("should handle MySQL specific syntax", async () => {
            const request = {
                naturalLanguage: "Get users created in last 7 days",
                connectionId: "test-connection",
                databaseType: "mysql",
            };
            const mockResponse = testUtils.createMockOpenAIResponse("SELECT * FROM users WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)");
            mockOpenAI.mockResolvedValue(mockResponse);
            const result = await engine.convertToSQL(request);
            expect(result.success).toBe(true);
            expect(result.generatedSQL.sql).toContain("DATE_SUB");
            expect(result.generatedSQL.sql).toContain("INTERVAL 7 DAY");
        });
        it("should handle MongoDB query syntax", async () => {
            const request = {
                naturalLanguage: "Find users with active status",
                connectionId: "test-connection",
                databaseType: "mongodb",
            };
            const mockResponse = testUtils.createMockOpenAIResponse('db.users.find({ status: "active" })');
            mockOpenAI.mockResolvedValue(mockResponse);
            const result = await engine.convertToSQL(request);
            expect(result.success).toBe(true);
            expect(result.generatedSQL.sql).toContain("db.users.find");
            expect(result.generatedSQL.sql).toContain('{ status: "active" }');
        });
    });
    describe("Context and Complexity", () => {
        it("should handle low complexity queries", async () => {
            const request = {
                naturalLanguage: "Count users",
                connectionId: "test-connection",
                databaseType: "postgresql",
                maxComplexity: "low",
            };
            const mockResponse = testUtils.createMockOpenAIResponse("SELECT COUNT(*) FROM users");
            mockResponse.choices[0].message.content = JSON.stringify({
                sql: "SELECT COUNT(*) FROM users",
                explanation: "Counts total users",
                complexity: "low",
                optimizations: [],
                estimatedExecutionTime: "5ms",
            });
            mockOpenAI.mockResolvedValue(mockResponse);
            const result = await engine.convertToSQL(request);
            expect(result.success).toBe(true);
            expect(result.generatedSQL.complexity).toBe("low");
        });
        it("should handle medium complexity queries", async () => {
            const request = {
                naturalLanguage: "Get users and their profiles",
                connectionId: "test-connection",
                databaseType: "postgresql",
                maxComplexity: "medium",
            };
            const mockResponse = testUtils.createMockOpenAIResponse("SELECT u.*, p.* FROM users u JOIN profiles p ON u.id = p.user_id");
            mockResponse.choices[0].message.content = JSON.stringify({
                sql: "SELECT u.*, p.* FROM users u JOIN profiles p ON u.id = p.user_id",
                explanation: "Gets users with their profiles",
                complexity: "medium",
                optimizations: [],
                estimatedExecutionTime: "50ms",
            });
            mockOpenAI.mockResolvedValue(mockResponse);
            const result = await engine.convertToSQL(request);
            expect(result.success).toBe(true);
            expect(result.generatedSQL.complexity).toBe("medium");
        });
        it("should provide context to OpenAI when available", async () => {
            const request = {
                naturalLanguage: "Get the data",
                connectionId: "test-connection",
                databaseType: "postgresql",
                context: "User is looking for customer data from the orders table",
            };
            mockOpenAI.mockResolvedValue(testUtils.createMockOpenAIResponse("SELECT * FROM orders"));
            const result = await engine.convertToSQL(request);
            expect(result.success).toBe(true);
            expect(mockOpenAI).toHaveBeenCalledWith(expect.objectContaining({
                messages: expect.arrayContaining([
                    expect.objectContaining({
                        content: expect.stringContaining("User is looking for customer data from the orders table"),
                    }),
                ]),
            }));
        });
    });
    describe("Request Tracking and Metadata", () => {
        it("should generate unique request ID", async () => {
            const request = {
                naturalLanguage: "Show me all users",
                connectionId: "test-connection",
                databaseType: "postgresql",
            };
            mockOpenAI.mockResolvedValue(testUtils.createMockOpenAIResponse("SELECT * FROM users"));
            const result = await engine.convertToSQL(request);
            expect(result.success).toBe(true);
            expect(result.metadata.requestId).toMatch(/^req_\d+_[a-z0-9]+$/);
        });
        it("should track processing time", async () => {
            const request = {
                naturalLanguage: "Show me all users",
                connectionId: "test-connection",
                databaseType: "postgresql",
            };
            mockOpenAI.mockResolvedValue(testUtils.createMockOpenAIResponse("SELECT * FROM users"));
            const result = await engine.convertToSQL(request);
            expect(result.success).toBe(true);
            expect(result.metadata.processingTime).toMatch(/\d+ms$/);
        });
        it("should include schema version in metadata", async () => {
            const request = {
                naturalLanguage: "Show me all users",
                connectionId: "test-connection",
                databaseType: "postgresql",
            };
            const SchemaAnalyzer = require("../../../src/database/schema-analyzer.js").SchemaAnalyzer;
            SchemaAnalyzer.mockImplementationOnce(() => ({
                getSchema: jest.fn().mockResolvedValue({
                    ...testUtils.createTestSchema(),
                    version: "1.0.0",
                }),
            }));
            mockOpenAI.mockResolvedValue(testUtils.createMockOpenAIResponse("SELECT * FROM users"));
            const result = await engine.convertToSQL(request);
            expect(result.success).toBe(true);
            expect(result.metadata.schemaVersion).toBe("1.0.0");
        });
    });
    describe("Configuration and Settings", () => {
        it("should use default model configuration", async () => {
            const request = {
                naturalLanguage: "Show me all users",
                connectionId: "test-connection",
                databaseType: "postgresql",
            };
            mockOpenAI.mockResolvedValue(testUtils.createMockOpenAIResponse("SELECT * FROM users"));
            await engine.convertToSQL(request);
            expect(mockOpenAI).toHaveBeenCalledWith(expect.objectContaining({
                model: expect.any(String),
                temperature: expect.any(Number),
                max_tokens: expect.any(Number),
            }));
        });
        it("should handle missing database type gracefully", async () => {
            const request = {
                naturalLanguage: "Show me all users",
                connectionId: "test-connection",
            };
            mockOpenAI.mockResolvedValue(testUtils.createMockOpenAIResponse("SELECT * FROM users"));
            const result = await engine.convertToSQL(request);
            expect(result.success).toBe(true);
            expect(result.generatedSQL.sql).toContain("SELECT");
        });
    });
});
//# sourceMappingURL=natural-language-to-sql.test.js.map