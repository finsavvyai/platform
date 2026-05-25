import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validation.js';
import { dataValidationEngine } from '../services/DataValidationEngine.js';
import { dataQualityAnalyzer } from '../services/DataQualityAnalyzer.js';
import { connectionPoolManager } from '../services/ConnectionPoolManager.js';
import { logger } from '../utils/logger.js';
import Joi from 'joi';

const router = express.Router();

// Validation schemas
const validateDatabaseSchema = {
  body: Joi.object({
    connectionId: Joi.string().uuid().required(),
    customRules: Joi.array().items(
      Joi.object({
        id: Joi.string().required(),
        name: Joi.string().required(),
        type: Joi.string().valid('uniqueness', 'constraint', 'referential', 'custom', 'consistency', 'quality').required(),
        table: Joi.string().optional(),
        column: Joi.string().optional(),
        query: Joi.string().required(),
        expectedResult: Joi.any().optional(),
        severity: Joi.string().valid('low', 'medium', 'high', 'critical').required(),
        description: Joi.string().required(),
        autoFix: Joi.boolean().optional(),
        fixQuery: Joi.string().optional()
      })
    ).optional()
  })
};

const validateConsistencySchema = {
  body: Joi.object({
    connectionId: Joi.string().uuid().required(),
    tables: Joi.array().items(Joi.string()).min(2).required()
  })
};

const autoFixSchema = {
  body: Joi.object({
    connectionId: Joi.string().uuid().required(),
    ruleIds: Joi.array().items(Joi.string()).min(1).required()
  })
};

const analyzeDatabaseSchema = {
  body: Joi.object({
    connectionId: Joi.string().uuid().required(),
    options: Joi.object({
      includeProfiling: Joi.boolean().optional(),
      includeLineage: Joi.boolean().optional(),
      sampleSize: Joi.number().integer().min(100).max(100000).optional(),
      tables: Joi.array().items(Joi.string()).optional()
    }).optional()
  })
};

const analyzeTableSchema = {
  body: Joi.object({
    connectionId: Joi.string().uuid().required(),
    tableName: Joi.string().required(),
    sampleSize: Joi.number().integer().min(100).max(100000).optional(),
    includeProfiling: Joi.boolean().optional()
  })
};

const dataLineageSchema = {
  body: Joi.object({
    connectionId: Joi.string().uuid().required(),
    tableName: Joi.string().required(),
    depth: Joi.number().integer().min(1).max(5).optional()
  })
};

// Routes

/**
 * @route POST /api/data-validation/validate-database
 * @desc Validate entire database with custom or default rules
 * @access Private
 */
router.post('/validate-database',
  authenticateToken,
  validateRequest(validateDatabaseSchema),
  async (req, res) => {
    try {
      const { connectionId, customRules } = req.body;

      logger.info(`Starting database validation for connection: ${connectionId}`);

      const report = await dataValidationEngine.validateDatabase(connectionId, customRules);

      res.json({
        success: true,
        data: report,
        message: 'Database validation completed successfully'
      });

    } catch (error) {
      logger.error('Database validation failed:', error);
      res.status(500).json({
        success: false,
        error: 'Database validation failed',
        details: error.message
      });
    }
  }
);

/**
 * @route POST /api/data-validation/validate-consistency
 * @desc Validate data consistency across multiple tables
 * @access Private
 */
router.post('/validate-consistency',
  authenticateToken,
  validateRequest(validateConsistencySchema),
  async (req, res) => {
    try {
      const { connectionId, tables } = req.body;

      logger.info(`Starting consistency validation for connection: ${connectionId}, tables: ${tables.join(', ')}`);

      const results = await dataValidationEngine.validateDataConsistency(connectionId, tables);

      res.json({
        success: true,
        data: {
          connectionId,
          tables,
          timestamp: new Date(),
          results,
          summary: {
            totalRules: results.length,
            passedRules: results.filter(r => r.passed).length,
            failedRules: results.filter(r => !r.passed).length,
            criticalIssues: results.filter(r => !r.passed && r.severity === 'critical').length
          }
        },
        message: 'Data consistency validation completed successfully'
      });

    } catch (error) {
      logger.error('Data consistency validation failed:', error);
      res.status(500).json({
        success: false,
        error: 'Data consistency validation failed',
        details: error.message
      });
    }
  }
);

/**
 * @route POST /api/data-validation/auto-fix
 * @desc Automatically fix validation issues where possible
 * @access Private
 */
router.post('/auto-fix',
  authenticateToken,
  validateRequest(autoFixSchema),
  async (req, res) => {
    try {
      const { connectionId, ruleIds } = req.body;

      logger.info(`Starting auto-fix for connection: ${connectionId}, rules: ${ruleIds.join(', ')}`);

      const result = await dataValidationEngine.autoFixIssues(connectionId, ruleIds);

      res.json({
        success: true,
        data: {
          connectionId,
          timestamp: new Date(),
          ...result,
          summary: {
            totalRules: ruleIds.length,
            fixedRules: result.fixed.length,
            failedRules: result.failed.length,
            successRate: ((result.fixed.length / ruleIds.length) * 100).toFixed(2) + '%'
          }
        },
        message: `Auto-fix completed: ${result.fixed.length}/${ruleIds.length} rules fixed successfully`
      });

    } catch (error) {
      logger.error('Auto-fix failed:', error);
      res.status(500).json({
        success: false,
        error: 'Auto-fix failed',
        details: error.message
      });
    }
  }
);

/**
 * @route POST /api/data-validation/analyze-database
 * @desc Perform comprehensive database quality analysis
 * @access Private
 */
router.post('/analyze-database',
  authenticateToken,
  validateRequest(analyzeDatabaseSchema),
  async (req, res) => {
    try {
      const { connectionId, options } = req.body;

      logger.info(`Starting database analysis for connection: ${connectionId}`);

      const analysis = await dataQualityAnalyzer.analyzeDatabase(connectionId, options);

      res.json({
        success: true,
        data: analysis,
        message: 'Database analysis completed successfully'
      });

    } catch (error) {
      logger.error('Database analysis failed:', error);
      res.status(500).json({
        success: false,
        error: 'Database analysis failed',
        details: error.message
      });
    }
  }
);

/**
 * @route POST /api/data-validation/analyze-table
 * @desc Analyze specific table for data quality
 * @access Private
 */
router.post('/analyze-table',
  authenticateToken,
  validateRequest(analyzeTableSchema),
  async (req, res) => {
    try {
      const { connectionId, tableName, sampleSize, includeProfiling } = req.body;

      logger.info(`Starting table analysis for ${tableName} in connection: ${connectionId}`);

      // Get connection to analyze table
      const connection = await connectionPoolManager.getConnection(connectionId);
      const config = connectionPoolManager.configs?.get(connectionId);

      if (!config) {
        throw new Error(`Configuration not found for connection ${connectionId}`);
      }

      const analysis = await dataQualityAnalyzer.analyzeTable(
        connection,
        tableName,
        config.type,
        sampleSize,
        includeProfiling
      );

      await connectionPoolManager.releaseConnection(connectionId, connection);

      res.json({
        success: true,
        data: analysis,
        message: 'Table analysis completed successfully'
      });

    } catch (error) {
      logger.error('Table analysis failed:', error);
      res.status(500).json({
        success: false,
        error: 'Table analysis failed',
        details: error.message
      });
    }
  }
);

/**
 * @route POST /api/data-validation/data-lineage
 * @desc Generate data lineage graph for a table
 * @access Private
 */
router.post('/data-lineage',
  authenticateToken,
  validateRequest(dataLineageSchema),
  async (req, res) => {
    try {
      const { connectionId, tableName, depth = 3 } = req.body;

      logger.info(`Generating data lineage for table ${tableName} in connection: ${connectionId}`);

      const lineage = await dataQualityAnalyzer.generateDataLineage(connectionId, tableName, depth);

      res.json({
        success: true,
        data: lineage,
        message: 'Data lineage generated successfully'
      });

    } catch (error) {
      logger.error('Data lineage generation failed:', error);
      res.status(500).json({
        success: false,
        error: 'Data lineage generation failed',
        details: error.message
      });
    }
  }
);

/**
 * @route GET /api/data-validation/pool-metrics/:connectionId
 * @desc Get connection pool metrics for a specific connection
 * @access Private
 */
router.get('/pool-metrics/:connectionId',
  authenticateToken,
  async (req, res) => {
    try {
      const { connectionId } = req.params;

      const metrics = connectionPoolManager.getMetrics(connectionId);

      if (!metrics) {
        return res.status(404).json({
          success: false,
          error: 'Connection pool metrics not found',
          details: `No metrics found for connection ${connectionId}`
        });
      }

      res.json({
        success: true,
        data: {
          connectionId,
          metrics,
          timestamp: new Date()
        },
        message: 'Pool metrics retrieved successfully'
      });

    } catch (error) {
      logger.error('Failed to get pool metrics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve pool metrics',
        details: error.message
      });
    }
  }
);

/**
 * @route GET /api/data-validation/pool-metrics
 * @desc Get connection pool metrics for all connections
 * @access Private
 */
router.get('/pool-metrics',
  authenticateToken,
  async (req, res) => {
    try {
      const allMetrics = connectionPoolManager.getAllMetrics();

      res.json({
        success: true,
        data: {
          timestamp: new Date(),
          connections: Object.keys(allMetrics).length,
          metrics: allMetrics
        },
        message: 'All pool metrics retrieved successfully'
      });

    } catch (error) {
      logger.error('Failed to get all pool metrics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve pool metrics',
        details: error.message
      });
    }
  }
);

/**
 * @route POST /api/data-validation/health-check
 * @desc Perform health check on a specific connection
 * @access Private
 */
router.post('/health-check',
  authenticateToken,
  validateRequest({
    body: Joi.object({
      connectionId: Joi.string().uuid().required()
    })
  }),
  async (req, res) => {
    try {
      const { connectionId } = req.body;

      logger.info(`Performing health check for connection: ${connectionId}`);

      const healthResult = await connectionPoolManager.checkHealth(connectionId);

      const status = healthResult.healthy ? 200 : 503;

      res.status(status).json({
        success: healthResult.healthy,
        data: healthResult,
        message: healthResult.healthy ? 'Connection is healthy' : 'Connection health check failed'
      });

    } catch (error) {
      logger.error('Health check failed:', error);
      res.status(500).json({
        success: false,
        error: 'Health check failed',
        details: error.message
      });
    }
  }
);

/**
 * @route GET /api/data-validation/validation-rules
 * @desc Get available validation rule templates
 * @access Private
 */
router.get('/validation-rules',
  authenticateToken,
  async (req, res) => {
    try {
      const ruleTemplates = [
        {
          id: 'uniqueness_check',
          name: 'Uniqueness Validation',
          type: 'uniqueness',
          description: 'Check for duplicate records in a table',
          template: 'SELECT * FROM (SELECT *, COUNT(*) OVER (PARTITION BY {column}) as cnt FROM {table}) t WHERE cnt > 1',
          severity: 'high',
          autoFix: false
        },
        {
          id: 'null_check',
          name: 'Null Value Check',
          type: 'quality',
          description: 'Check for null values in required fields',
          template: 'SELECT COUNT(*) as null_count FROM {table} WHERE {column} IS NULL',
          severity: 'medium',
          autoFix: false
        },
        {
          id: 'foreign_key_check',
          name: 'Referential Integrity Check',
          type: 'referential',
          description: 'Check for orphaned foreign key references',
          template: 'SELECT COUNT(*) FROM {table1} t1 LEFT JOIN {table2} t2 ON t1.{fk_column} = t2.{pk_column} WHERE t2.{pk_column} IS NULL',
          severity: 'high',
          autoFix: false
        },
        {
          id: 'data_type_check',
          name: 'Data Type Validation',
          type: 'quality',
          description: 'Check for invalid data types in columns',
          template: 'SELECT COUNT(*) FROM {table} WHERE NOT {column} ~ \'^[0-9]+$\'',
          severity: 'medium',
          autoFix: false
        },
        {
          id: 'range_check',
          name: 'Value Range Check',
          type: 'constraint',
          description: 'Check for values outside expected range',
          template: 'SELECT COUNT(*) FROM {table} WHERE {column} NOT BETWEEN {min_value} AND {max_value}',
          severity: 'medium',
          autoFix: false
        }
      ];

      res.json({
        success: true,
        data: {
          templates: ruleTemplates,
          count: ruleTemplates.length
        },
        message: 'Validation rule templates retrieved successfully'
      });

    } catch (error) {
      logger.error('Failed to get validation rules:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve validation rules',
        details: error.message
      });
    }
  }
);

export default router;