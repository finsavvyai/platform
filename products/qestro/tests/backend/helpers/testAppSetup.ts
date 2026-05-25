/**
 * Test App Setup Helper
 * Sets up Express app for integration testing
 */

import { Express } from 'express';
import request from 'supertest';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

// Import routes
import pluginsRoutes from '../../../backend/src/routes/plugins';
import pluginSecurityRoutes from '../../../backend/src/routes/plugin-security';
import authRoutes from '../../../backend/src/routes/auth';

// Mock database and services
jest.mock('../../../backend/src/database/database.js');
jest.mock('../../../backend/src/services/AnalyticsService');
jest.mock('../../../backend/src/services/NotificationService');
jest.mock('../../../backend/src/services/FileStorageService');

/**
 * Setup Express app for testing
 */
export async function setupTestApp(): Promise<Express> {
  const express = await import('express');
  const app = express();

  // Basic middleware
  app.use(helmet());
  app.use(cors());
  app.use(morgan('dev'));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // API routes
  app.use('/api/auth', authRoutes);
  app.use('/api/plugins', pluginsRoutes);
  app.use('/api/plugin-security', pluginSecurityRoutes);

  // Mock marketplace routes for testing
  app.get('/api/marketplace/plugins/search', async (req, res) => {
    try {
      const { q, category, limit = 20, offset = 0 } = req.query;

      // Return mock search results
      const mockPlugins = [
        {
          id: 'test-plugin-1',
          name: 'Test Plugin 1',
          description: 'First test plugin',
          author: 'Test Author',
          category: 'testing',
          tags: ['test', 'integration'],
          price: 0,
          isFree: true,
          isVerified: true,
          downloadCount: 1000,
          rating: 4.5,
          reviewCount: 25,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      res.json({
        success: true,
        plugins: mockPlugins,
        total: mockPlugins.length,
        facets: {
          categories: [{ category: 'testing', count: 1 }],
          tags: [{ tag: 'test', count: 1 }],
          authors: [{ author: 'Test Author', count: 1 }],
          priceRanges: [{ range: 'Free', count: 1 }],
        },
      });
    } catch (error) {
      console.error('Search error:', error);
      res.status(500).json({ success: false, error: 'Search failed' });
    }
  });

  app.get('/api/marketplace/plugins/:id', async (req, res) => {
    try {
      const { id } = req.params;

      // Return mock plugin details
      res.json({
        success: true,
        data: {
          id,
          name: 'Test Plugin',
          description: 'Test plugin details',
          author: 'Test Author',
          category: 'testing',
          price: 0,
          isFree: true,
          isVerified: true,
          downloadCount: 1000,
          rating: 4.5,
          reviewCount: 25,
          latestVersion: {
            version: '1.0.0',
            downloadUrl: 'https://example.com/plugin.zip',
            publishedAt: new Date(),
          },
          versions: [],
          screenshots: [],
          securityInfo: {
            hasVulnerabilities: false,
            lastScanned: new Date(),
            scanScore: 95,
            verified: true,
          },
        },
      });
    } catch (error) {
      console.error('Plugin details error:', error);
      res.status(500).json({ success: false, error: 'Failed to get plugin details' });
    }
  });

  app.post('/api/marketplace/plugins/:id/download', async (req, res) => {
    try {
      const { id } = req.params;
      const { version } = req.body;

      res.json({
        success: true,
        data: {
          downloadId: `download-${id}-${version}`,
          pluginId: id,
          version,
          downloadUrl: 'https://example.com/plugin.zip',
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
    } catch (error) {
      console.error('Download error:', error);
      res.status(500).json({ success: false, error: 'Failed to generate download' });
    }
  });

  app.get('/api/marketplace/plugins/:id/reviews', async (req, res) => {
    try {
      const { id } = req.params;

      res.json({
        success: true,
        data: [
          {
            id: 'review-1',
            pluginId: id,
            userId: 'user-1',
            rating: 5,
            title: 'Great Plugin',
            content: 'This plugin works great!',
            isVerifiedPurchase: true,
            helpfulCount: 10,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      });
    } catch (error) {
      console.error('Reviews error:', error);
      res.status(500).json({ success: false, error: 'Failed to get reviews' });
    }
  });

  // Error handling middleware
  app.use((err: any, req: any, res: any, next: any) => {
    console.error('Test app error:', err);
    res.status(err.status || 500).json({
      success: false,
      error: err.message || 'Internal server error',
    });
  });

  // 404 handler
  app.use('*', (req, res) => {
    res.status(404).json({
      success: false,
      error: 'Endpoint not found',
    });
  });

  return app;
}

/**
 * Create authenticated request agent
 */
export function createAuthRequest(app: Express, authToken: string) {
  return request(app).set('Authorization', `Bearer ${authToken}`);
}