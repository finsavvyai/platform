/**
 * QueryFlux OpenAI App Actions
 *
 * Main action handlers for the OpenAI GPT Store integration
 * Provides secure database access through natural language
 */

import { z } from 'zod';
import { connectDatabase } from './connect-database.js';
import { naturalLanguageToSQL } from './natural-language-to-sql.js';
import { executeQuery } from './execute-query.js';
import { generateVisualization } from './generate-visualization.js';
import { analyzeDatabase } from './analyze-database.js';
import { logger } from '../utils/logger.js';

// Main actions object for OpenAI integration
export const actions = {
  /**
   * Connect to database with AI-powered assistance
   */
  connectDatabase: async (params: any) => {
    try {
      logger.info('🔗 OpenAI Action: connectDatabase', { params });

      const result = await connectDatabase({
        config: params.config,
        aiAssistance: params.aiAssistance !== false
      });

      logger.info('✅ Database connection successful', { connectionId: result.connectionId });

      return result;
    } catch (error) {
      logger.error('❌ Database connection failed:', error);
      return {
        success: false,
        error: error.message,
        suggestions: [
          'Check if database server is running',
          'Verify network connectivity',
          'Validate connection credentials'
        ],
        troubleshooting: await generateConnectionTroubleshooting(error, params)
      };
    }
  },

  /**
   * Convert natural language to SQL using GPT-4
   */
  naturalLanguageToSQL: async (params: any) => {
    try {
      logger.info('🤖 OpenAI Action: naturalLanguageToSQL', { params });

      const result = await naturalLanguageToSQL({
        naturalLanguage: params.naturalLanguage,
        connectionId: params.connectionId,
        context: params.context,
        databaseType: params.databaseType,
        maxComplexity: params.maxComplexity,
        includeOptimizations: params.includeOptimizations !== false
      });

      if (result.success) {
        logger.info('✅ Natural language to SQL conversion successful', {
          originalQuery: result.originalQuery,
          generatedSQL: result.generatedSQL?.sql
        });
      } else {
        logger.error('❌ Natural language to SQL conversion failed:', result.error);
      }

      return result;
    } catch (error) {
      logger.error('❌ Natural language to SQL error:', error);
      return {
        success: false,
        error: error.message,
        suggestions: [
          'Try rephrasing your question more specifically',
          'Check if your database is connected',
          'Ensure you have proper permissions'
        ]
      };
    }
  },

  /**
   * Execute SQL query with security and monitoring
   */
  executeQuery: async (params: any) => {
    try {
      logger.info('🔍 OpenAI Action: executeQuery', {
        connectionId: params.connectionId,
        query: params.sql?.substring(0, 100) + '...'
      });

      const result = await executeQuery({
        sql: params.sql,
        connectionId: params.connectionId,
        limit: params.limit || 1000,
        timeout: params.timeout || 30000
      });

      if (result.success) {
        logger.info('✅ Query executed successfully', {
          connectionId: result.connectionId,
          rowsReturned: result.rowCount,
          executionTime: result.executionTime
        });
      } else {
        logger.error('❌ Query execution failed:', result.error);
      }

      return result;
    } catch (error) {
      logger.error('❌ Query execution error:', error);
      return {
        success: false,
        error: error.message,
        suggestions: [
          'Check SQL syntax',
          'Verify table and column names',
          'Ensure database connection is active'
        ]
      };
    }
  },

  /**
   * Generate visualization from query results
   */
  createVisualization: async (params: any) => {
    try {
      logger.info('📊 OpenAI Action: createVisualization', {
        chartType: params.chartType,
        rowCount: params.queryResults?.length
      });

      const result = await generateVisualization({
        queryResults: params.queryResults,
        chartType: params.chartType,
        title: params.title,
        styling: params.styling
      });

      if (result.success) {
        logger.info('✅ Visualization generated successfully', {
          type: result.visualization?.type,
          dataPoints: result.metadata?.dataPoints
        });
      } else {
        logger.error('❌ Visualization generation failed:', result.error);
      }

      return result;
    } catch (error) {
      logger.error('❌ Visualization generation error:', error);
      return {
        success: false,
        error: error.message,
        suggestions: [
          'Check if query results are available',
          'Try a different chart type',
          'Ensure data is in correct format'
        ]
      };
    }
  },

  /**
   * Analyze database structure and provide insights
   */
  analyzeDatabase: async (params: any) => {
    try {
      logger.info('🔬 OpenAI Action: analyzeDatabase', { connectionId: params.connectionId });

      const result = await analyzeDatabase({
        connectionId: params.connectionId,
        includeRecommendations: params.includeRecommendations !== false,
        analyzePerformance: params.analyzePerformance === true
      });

      if (result.success) {
        logger.info('✅ Database analysis successful', {
          databaseType: result.database?.type,
          tableCount: result.database?.tableCount
        });
      } else {
        logger.error('❌ Database analysis failed:', result.error);
      }

      return result;
    } catch (error) {
      logger.error('❌ Database analysis error:', error);
      return {
        success: false,
        error: error.message,
        suggestions: [
          'Check if database is connected',
          'Ensure you have proper permissions',
          'Verify database is accessible'
        ]
      };
    }
  }
};

/**
 * Generate troubleshooting steps for connection errors
 */
async function generateConnectionTroubleshooting(error: any, params: any): Promise<string[]> {
  const troubleshooting = [
    '1. Verify database server is running and accessible',
    '2. Check network connectivity to database host',
    '3. Validate connection credentials and permissions',
    '4. Ensure firewall allows connection on specified port',
    '5. Check SSL/TLS certificate configuration',
    `6. Error details: ${error.message}`
  ];

  // Add specific troubleshooting based on error type
  if (error.message.includes('ENOTFOUND')) {
    troubleshooting.push('7. DNS resolution failed - check hostname spelling');
  }

  if (error.message.includes('ECONNREFUSED')) {
    troubleshooting.push('7. Connection refused - check if database port is correct');
  }

  if (error.message.includes('auth') || error.message.includes('password')) {
    troubleshooting.push('7. Authentication failed - check username and password');
  }

  return troubleshooting;
}

export default actions;
