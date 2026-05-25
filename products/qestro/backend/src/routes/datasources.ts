import express from 'express';
import { DataSourceService } from '../services/DataSourceService.js';
import { authenticateToken } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validation.js';
import { body, param, query } from 'express-validator';

const router = express.Router();
const dataSourceService = new DataSourceService();

// Get all data sources for a user
router.get('/', authenticateToken, async (req, res) => {
    try {
        const userId = req.user?.userId;
        const { type, status, search } = req.query;
        
        // Fetch data sources from database with filters
        const dataSources = await fetchUserDataSources(userId, {
            type: type as string,
            status: status as string,
            search: search as string
        });
        
        res.json({
            success: true,
            dataSources
        });
    } catch (error) {
        console.error('Failed to fetch data sources:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch data sources'
        });
    }
});

// Create a new data source
router.post('/',
    authenticateToken,
    [
        body('name').notEmpty().withMessage('Name is required'),
        body('type').isIn(['postgresql', 'mysql', 'mongodb', 'redis', 'api', 'graphql', 'rest']).withMessage('Invalid data source type'),
        body('config').isObject().withMessage('Configuration is required'),
        body('tags').optional().isArray()
    ],
    validateRequest,
    async (req, res) => {
        try {
            const { name, type, config, tags } = req.body;
            const userId = req.user!.userId;
            
            // Validate configuration based on type
            const configValidation = validateDataSourceConfig(type, config);
            if (!configValidation.valid) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid configuration',
                    details: configValidation.errors
                });
            }
            
            // Create data source
            const dataSource = await dataSourceService.createDataSource({
                name,
                type: type as any,
                config,
                userId,
                status: 'inactive',
                tags
            });
            
            res.status(201).json({
                success: true,
                dataSource
            });
        } catch (error) {
            console.error('Data source creation failed:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to create data source'
            });
        }
    }
);

// Test data source connection
router.post('/:id/test',
    authenticateToken,
    [param('id').notEmpty().withMessage('Data source ID is required')],
    validateRequest,
    async (req, res) => {
        try {
            const { id } = req.params;
            const userId = req.user?.userId;
            
            // Verify ownership
            const dataSource = await getDataSourceById(id, userId);
            if (!dataSource) {
                return res.status(404).json({
                    success: false,
                    error: 'Data source not found'
                });
            }
            
            // Test connection
            const result = await dataSourceService.testConnection(dataSource);
            
            // Update last tested timestamp
            await updateDataSourceLastTested(id);
            
            res.json({
                success: result.success,
                error: result.error,
                metadata: result.metadata
            });
        } catch (error) {
            console.error('Connection test failed:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to test connection'
            });
        }
    }
);

// Discover schema
router.post('/:id/discover-schema',
    authenticateToken,
    [param('id').notEmpty().withMessage('Data source ID is required')],
    validateRequest,
    async (req, res) => {
        try {
            const { id } = req.params;
            const userId = req.user?.userId;
            
            // Verify ownership
            const dataSource = await getDataSourceById(id, userId);
            if (!dataSource) {
                return res.status(404).json({
                    success: false,
                    error: 'Data source not found'
                });
            }
            
            // Discover schema
            const result = await dataSourceService.discoverSchema(id);
            
            res.json(result);
        } catch (error) {
            console.error('Schema discovery failed:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to discover schema'
            });
        }
    }
);

// Execute query
router.post('/:id/query',
    authenticateToken,
    [
        param('id').notEmpty().withMessage('Data source ID is required'),
        body('name').notEmpty().withMessage('Query name is required'),
        body('query').notEmpty().withMessage('Query is required'),
        body('parameters').optional().isObject(),
        body('validation').optional().isArray(),
        body('caching').optional().isObject()
    ],
    validateRequest,
    async (req, res) => {
        try {
            const { id } = req.params;
            const { name, query, parameters, validation, caching } = req.body;
            const userId = req.user?.userId;
            
            // Verify ownership
            const dataSource = await getDataSourceById(id, userId);
            if (!dataSource) {
                return res.status(404).json({
                    success: false,
                    error: 'Data source not found'
                });
            }
            
            // Create query object
            const queryObj = {
                id: generateId(),
                dataSourceId: id,
                name,
                query,
                parameters,
                validation,
                caching
            };
            
            // Execute query
            const result = await dataSourceService.executeQuery(id, queryObj);
            
            // Store query for reuse
            await storeQuery(queryObj, userId);
            
            res.json(result);
        } catch (error) {
            console.error('Query execution failed:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to execute query'
            });
        }
    }
);

// Test API endpoint
router.post('/:id/test-endpoint',
    authenticateToken,
    [
        param('id').notEmpty().withMessage('Data source ID is required'),
        body('name').notEmpty().withMessage('Endpoint name is required'),
        body('method').isIn(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']).withMessage('Invalid HTTP method'),
        body('path').notEmpty().withMessage('Path is required'),
        body('headers').optional().isObject(),
        body('body').optional(),
        body('queryParams').optional().isObject(),
        body('expectedResponse').optional().isObject(),
        body('validation').optional().isArray()
    ],
    validateRequest,
    async (req, res) => {
        try {
            const { id } = req.params;
            const { name, method, path, headers, body, queryParams, expectedResponse, validation } = req.body;
            const userId = req.user?.userId;
            
            // Verify ownership
            const dataSource = await getDataSourceById(id, userId);
            if (!dataSource) {
                return res.status(404).json({
                    success: false,
                    error: 'Data source not found'
                });
            }
            
            // Create endpoint object
            const endpoint = {
                id: generateId(),
                dataSourceId: id,
                name,
                method: method as any,
                path,
                headers,
                body,
                queryParams,
                expectedResponse,
                validation
            };
            
            // Test endpoint
            const result = await dataSourceService.testAPIEndpoint(id, endpoint);
            
            // Store endpoint for reuse
            await storeAPIEndpoint(endpoint, userId);
            
            res.json(result);
        } catch (error) {
            console.error('API endpoint test failed:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to test API endpoint'
            });
        }
    }
);

// Generate test data
router.post('/:id/generate-test-data',
    authenticateToken,
    [
        param('id').notEmpty().withMessage('Data source ID is required'),
        body('schema').isObject().withMessage('Schema is required'),
        body('count').optional().isInt({ min: 1, max: 10000 }).withMessage('Count must be between 1 and 10000')
    ],
    validateRequest,
    async (req, res) => {
        try {
            const { id } = req.params;
            const { schema, count = 100 } = req.body;
            const userId = req.user?.userId;
            
            // Verify ownership
            const dataSource = await getDataSourceById(id, userId);
            if (!dataSource) {
                return res.status(404).json({
                    success: false,
                    error: 'Data source not found'
                });
            }
            
            // Generate test data
            const testData = await dataSourceService.generateTestData(id, schema, count);
            
            res.json({
                success: true,
                data: testData,
                count: testData.length
            });
        } catch (error) {
            console.error('Test data generation failed:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to generate test data'
            });
        }
    }
);

// Create performance test
router.post('/:id/performance-test',
    authenticateToken,
    [
        param('id').notEmpty().withMessage('Data source ID is required'),
        body('concurrency').isInt({ min: 1, max: 1000 }).withMessage('Concurrency must be between 1 and 1000'),
        body('duration').isInt({ min: 10, max: 3600 }).withMessage('Duration must be between 10 and 3600 seconds'),
        body('rampUp').optional().isInt({ min: 0, max: 300 }).withMessage('Ramp up must be between 0 and 300 seconds'),
        body('queries').optional().isArray(),
        body('endpoints').optional().isArray()
    ],
    validateRequest,
    async (req, res) => {
        try {
            const { id } = req.params;
            const { concurrency, duration, rampUp = 0, queries = [], endpoints = [] } = req.body;
            const userId = req.user?.userId;
            
            // Verify ownership
            const dataSource = await getDataSourceById(id, userId);
            if (!dataSource) {
                return res.status(404).json({
                    success: false,
                    error: 'Data source not found'
                });
            }
            
            // Validate that we have either queries or endpoints
            if (queries.length === 0 && endpoints.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'At least one query or endpoint is required'
                });
            }
            
            // Create performance test
            const result = await dataSourceService.createPerformanceTest(id, {
                queries,
                endpoints,
                concurrency,
                duration,
                rampUp
            });
            
            res.status(201).json({
                success: true,
                testId: result.testId,
                status: result.status
            });
        } catch (error) {
            console.error('Performance test creation failed:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to create performance test'
            });
        }
    }
);

// Run performance test
router.post('/performance-tests/:testId/run',
    authenticateToken,
    [param('testId').notEmpty().withMessage('Test ID is required')],
    validateRequest,
    async (req, res) => {
        try {
            const { testId } = req.params;
            const userId = req.user?.userId;
            
            // Verify ownership
            const test = await getPerformanceTestById(testId, userId);
            if (!test) {
                return res.status(404).json({
                    success: false,
                    error: 'Performance test not found'
                });
            }
            
            // Run performance test (this would typically be async)
            const result = await dataSourceService.runPerformanceTest(testId);
            
            res.json(result);
        } catch (error) {
            console.error('Performance test execution failed:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to run performance test'
            });
        }
    }
);

// Get stored queries
router.get('/:id/queries',
    authenticateToken,
    [param('id').notEmpty().withMessage('Data source ID is required')],
    validateRequest,
    async (req, res) => {
        try {
            const { id } = req.params;
            const userId = req.user?.userId;
            
            // Verify ownership
            const dataSource = await getDataSourceById(id, userId);
            if (!dataSource) {
                return res.status(404).json({
                    success: false,
                    error: 'Data source not found'
                });
            }
            
            // Get stored queries
            const queries = await getStoredQueries(id, userId);
            
            res.json({
                success: true,
                queries
            });
        } catch (error) {
            console.error('Failed to fetch queries:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch queries'
            });
        }
    }
);

// Get stored API endpoints
router.get('/:id/endpoints',
    authenticateToken,
    [param('id').notEmpty().withMessage('Data source ID is required')],
    validateRequest,
    async (req, res) => {
        try {
            const { id } = req.params;
            const userId = req.user?.userId;
            
            // Verify ownership
            const dataSource = await getDataSourceById(id, userId);
            if (!dataSource) {
                return res.status(404).json({
                    success: false,
                    error: 'Data source not found'
                });
            }
            
            // Get stored endpoints
            const endpoints = await getStoredEndpoints(id, userId);
            
            res.json({
                success: true,
                endpoints
            });
        } catch (error) {
            console.error('Failed to fetch endpoints:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch endpoints'
            });
        }
    }
);

// Update data source
router.put('/:id',
    authenticateToken,
    [
        param('id').notEmpty().withMessage('Data source ID is required'),
        body('name').optional().notEmpty().withMessage('Name cannot be empty'),
        body('config').optional().isObject(),
        body('tags').optional().isArray()
    ],
    validateRequest,
    async (req, res) => {
        try {
            const { id } = req.params;
            const updates = req.body;
            const userId = req.user?.userId;
            
            // Verify ownership
            const dataSource = await getDataSourceById(id, userId);
            if (!dataSource) {
                return res.status(404).json({
                    success: false,
                    error: 'Data source not found'
                });
            }
            
            // Validate configuration if provided
            if (updates.config) {
                const configValidation = validateDataSourceConfig(dataSource.type, updates.config);
                if (!configValidation.valid) {
                    return res.status(400).json({
                        success: false,
                        error: 'Invalid configuration',
                        details: configValidation.errors
                    });
                }
            }
            
            // Update data source
            const updatedDataSource = await updateDataSource(id, updates);
            
            res.json({
                success: true,
                dataSource: updatedDataSource
            });
        } catch (error) {
            console.error('Data source update failed:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to update data source'
            });
        }
    }
);

// Delete data source
router.delete('/:id',
    authenticateToken,
    [param('id').notEmpty().withMessage('Data source ID is required')],
    validateRequest,
    async (req, res) => {
        try {
            const { id } = req.params;
            const userId = req.user?.userId;
            
            // Verify ownership
            const dataSource = await getDataSourceById(id, userId);
            if (!dataSource) {
                return res.status(404).json({
                    success: false,
                    error: 'Data source not found'
                });
            }
            
            // Check if data source is being used
            const isInUse = await isDataSourceInUse(id);
            if (isInUse) {
                return res.status(400).json({
                    success: false,
                    error: 'Cannot delete data source that is currently in use'
                });
            }
            
            // Delete data source
            await deleteDataSource(id);
            
            res.json({
                success: true,
                message: 'Data source deleted successfully'
            });
        } catch (error) {
            console.error('Data source deletion failed:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to delete data source'
            });
        }
    }
);

// Data source templates
router.get('/templates', authenticateToken, async (req, res) => {
    try {
        const templates = getDataSourceTemplates();
        
        res.json({
            success: true,
            templates
        });
    } catch (error) {
        console.error('Failed to fetch templates:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch templates'
        });
    }
});

// Helper functions

function validateDataSourceConfig(type: string, config: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    switch (type) {
        case 'postgresql':
        case 'mysql':
            if (!config.host) errors.push('Host is required');
            if (!config.port) errors.push('Port is required');
            if (!config.database) errors.push('Database is required');
            if (!config.username) errors.push('Username is required');
            if (!config.password) errors.push('Password is required');
            break;
            
        case 'mongodb':
            if (!config.connectionString && (!config.host || !config.port)) {
                errors.push('Either connection string or host/port is required');
            }
            break;
            
        case 'redis':
            if (!config.host) errors.push('Host is required');
            if (!config.port) errors.push('Port is required');
            break;
            
        case 'api':
        case 'rest':
        case 'graphql':
            if (!config.baseUrl) errors.push('Base URL is required');
            break;
            
        default:
            errors.push('Unsupported data source type');
    }
    
    return {
        valid: errors.length === 0,
        errors
    };
}

function getDataSourceTemplates() {
    return [
        {
            type: 'postgresql',
            name: 'PostgreSQL Database',
            description: 'Connect to PostgreSQL database',
            config: {
                host: 'localhost',
                port: 5432,
                database: 'mydb',
                username: 'user',
                password: '',
                ssl: false
            }
        },
        {
            type: 'mysql',
            name: 'MySQL Database',
            description: 'Connect to MySQL database',
            config: {
                host: 'localhost',
                port: 3306,
                database: 'mydb',
                username: 'user',
                password: '',
                ssl: false
            }
        },
        {
            type: 'mongodb',
            name: 'MongoDB Database',
            description: 'Connect to MongoDB database',
            config: {
                host: 'localhost',
                port: 27017,
                database: 'mydb',
                username: '',
                password: ''
            }
        },
        {
            type: 'redis',
            name: 'Redis Cache',
            description: 'Connect to Redis cache',
            config: {
                host: 'localhost',
                port: 6379,
                password: ''
            }
        },
        {
            type: 'api',
            name: 'REST API',
            description: 'Connect to REST API',
            config: {
                baseUrl: 'https://api.example.com',
                apiKey: '',
                headers: {
                    'Content-Type': 'application/json'
                },
                authentication: {
                    type: 'bearer'
                }
            }
        },
        {
            type: 'graphql',
            name: 'GraphQL API',
            description: 'Connect to GraphQL API',
            config: {
                baseUrl: 'https://api.example.com/graphql',
                headers: {
                    'Content-Type': 'application/json'
                },
                authentication: {
                    type: 'bearer'
                }
            }
        }
    ];
}

function generateId(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// Database operations (placeholders - implement with actual database)
async function fetchUserDataSources(userId: string, filters: any): Promise<any[]> {
    // Implement database query with filters
    return [];
}

async function getDataSourceById(id: string, userId: string): Promise<any> {
    // Implement database lookup with ownership verification
    return null;
}

async function updateDataSourceLastTested(id: string): Promise<void> {
    // Update last tested timestamp
    console.log(`Updated last tested for data source ${id}`);
}

async function storeQuery(query: any, userId: string): Promise<void> {
    // Store query for reuse
    console.log(`Storing query: ${query.name}`);
}

async function storeAPIEndpoint(endpoint: any, userId: string): Promise<void> {
    // Store endpoint for reuse
    console.log(`Storing endpoint: ${endpoint.name}`);
}

async function getStoredQueries(dataSourceId: string, userId: string): Promise<any[]> {
    // Get stored queries for data source
    return [];
}

async function getStoredEndpoints(dataSourceId: string, userId: string): Promise<any[]> {
    // Get stored endpoints for data source
    return [];
}

async function updateDataSource(id: string, updates: any): Promise<any> {
    // Update data source in database
    return null;
}

async function deleteDataSource(id: string): Promise<void> {
    // Delete data source from database
    console.log(`Deleted data source ${id}`);
}

async function isDataSourceInUse(id: string): Promise<boolean> {
    // Check if data source is being used in tests
    return false;
}

async function getPerformanceTestById(testId: string, userId: string): Promise<any> {
    // Get performance test with ownership verification
    return null;
}

export default router;