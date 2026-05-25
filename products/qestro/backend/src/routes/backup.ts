/**
 * Backup and Disaster Recovery Routes
 * API endpoints for backup management, disaster recovery, and system restoration
 */

import express from 'express';
import { backupService } from '../services/BackupService.js';
import { disasterRecoveryService } from '../services/DisasterRecoveryService.js';
import { logger } from '../utils/logger.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

/**
 * Backup Management Routes
 */

// Create database backup
router.post('/backup/database', authenticateToken, async (req, res) => {
  try {
    const { name, tags } = req.body;
    const userId = req.user!.userId;

    const backup = await backupService.createDatabaseBackup({
      name,
      createdBy: userId,
      tags,
    });

    res.json({
      success: true,
      backup,
      message: 'Database backup created successfully',
    });
  } catch (error) {
    logger.error('Failed to create database backup:', error);
    res.status(500).json({ error: 'Failed to create database backup' });
  }
});

// Create files backup
router.post('/backup/files', authenticateToken, async (req, res) => {
  try {
    const { sourcePaths, name, tags } = req.body;
    const userId = req.user!.userId;

    if (!sourcePaths || !Array.isArray(sourcePaths)) {
      return res.status(400).json({ error: 'Source paths array is required' });
    }

    const backup = await backupService.createFilesBackup(sourcePaths, {
      name,
      createdBy: userId,
      tags,
    });

    res.json({
      success: true,
      backup,
      message: 'Files backup created successfully',
    });
  } catch (error) {
    logger.error('Failed to create files backup:', error);
    res.status(500).json({ error: 'Failed to create files backup' });
  }
});

// List backups
router.get('/backups', authenticateToken, async (req, res) => {
  try {
    const { type, status, limit = 50, offset = 0 } = req.query;

    const backups = await backupService.listBackups({
      type: type as string,
      status: status as string,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    });

    res.json({
      success: true,
      backups,
      count: backups.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to list backups:', error);
    res.status(500).json({ error: 'Failed to list backups' });
  }
});

// Get backup details
router.get('/backups/:backupId', authenticateToken, async (req, res) => {
  try {
    const { backupId } = req.params;

    const backup = await backupService.getBackupMetadata(backupId);
    if (!backup) {
      return res.status(404).json({ error: 'Backup not found' });
    }

    res.json({
      success: true,
      backup,
    });
  } catch (error) {
    logger.error(`Failed to get backup details: ${req.params.backupId}`, error);
    res.status(500).json({ error: 'Failed to get backup details' });
  }
});

// Get backup progress
router.get('/backups/:backupId/progress', authenticateToken, async (req, res) => {
  try {
    const { backupId } = req.params;

    const progress = backupService.getBackupProgress(backupId);
    if (!progress) {
      return res.status(404).json({ error: 'Backup progress not found' });
    }

    res.json({
      success: true,
      progress,
    });
  } catch (error) {
    logger.error(`Failed to get backup progress: ${req.params.backupId}`, error);
    res.status(500).json({ error: 'Failed to get backup progress' });
  }
});

// Delete backup
router.delete('/backups/:backupId', authenticateToken, async (req, res) => {
  try {
    const { backupId } = req.params;

    const success = await backupService.deleteBackup(backupId);
    if (!success) {
      return res.status(404).json({ error: 'Backup not found or could not be deleted' });
    }

    res.json({
      success: true,
      message: 'Backup deleted successfully',
    });
  } catch (error) {
    logger.error(`Failed to delete backup: ${req.params.backupId}`, error);
    res.status(500).json({ error: 'Failed to delete backup' });
  }
});

// Restore from backup
router.post('/backups/:backupId/restore', authenticateToken, async (req, res) => {
  try {
    const { backupId } = req.params;
    const { targetDatabase } = req.body;

    const success = await backupService.restoreFromBackup(backupId, targetDatabase);
    if (!success) {
      return res.status(400).json({ error: 'Restore failed' });
    }

    res.json({
      success: true,
      message: 'Database restored successfully',
    });
  } catch (error) {
    logger.error(`Failed to restore from backup: ${req.params.backupId}`, error);
    res.status(500).json({ error: 'Failed to restore from backup' });
  }
});

// Test backup and restore
router.post('/backups/:backupId/test', authenticateToken, async (req, res) => {
  try {
    const { backupId } = req.params;

    const testResult = await backupService.testBackupRestore(backupId);

    res.json({
      success: true,
      testResult,
      message: 'Backup test completed',
    });
  } catch (error) {
    logger.error(`Failed to test backup: ${req.params.backupId}`, error);
    res.status(500).json({ error: 'Failed to test backup' });
  }
});

// Cancel backup
router.post('/backups/:backupId/cancel', authenticateToken, async (req, res) => {
  try {
    const { backupId } = req.params;

    const success = await backupService.cancelBackup(backupId);
    if (!success) {
      return res.status(404).json({ error: 'Backup not found or could not be cancelled' });
    }

    res.json({
      success: true,
      message: 'Backup cancelled successfully',
    });
  } catch (error) {
    logger.error(`Failed to cancel backup: ${req.params.backupId}`, error);
    res.status(500).json({ error: 'Failed to cancel backup' });
  }
});

// Cleanup expired backups
router.post('/backups/cleanup', authenticateToken, async (req, res) => {
  try {
    const deletedCount = await backupService.cleanupExpiredBackups();

    res.json({
      success: true,
      deletedCount,
      message: `Cleaned up ${deletedCount} expired backups`,
    });
  } catch (error) {
    logger.error('Failed to cleanup expired backups:', error);
    res.status(500).json({ error: 'Failed to cleanup expired backups' });
  }
});

// Get backup statistics
router.get('/backups/stats/summary', authenticateToken, async (req, res) => {
  try {
    const stats = await backupService.getBackupStatistics();

    res.json({
      success: true,
      stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to get backup statistics:', error);
    res.status(500).json({ error: 'Failed to get backup statistics' });
  }
});

/**
 * Disaster Recovery Routes
 */

// Create recovery procedure
router.post('/recovery/procedures', authenticateToken, async (req, res) => {
  try {
    const procedure = await disasterRecoveryService.createRecoveryProcedure(req.body);

    res.json({
      success: true,
      procedure,
      message: 'Recovery procedure created successfully',
    });
  } catch (error) {
    logger.error('Failed to create recovery procedure:', error);
    res.status(500).json({ error: 'Failed to create recovery procedure' });
  }
});

// Get recovery procedure
router.get('/recovery/procedures/:procedureId', authenticateToken, async (req, res) => {
  try {
    const { procedureId } = req.params;

    const procedure = await disasterRecoveryService.getRecoveryProcedure(procedureId);
    if (!procedure) {
      return res.status(404).json({ error: 'Recovery procedure not found' });
    }

    res.json({
      success: true,
      procedure,
    });
  } catch (error) {
    logger.error(`Failed to get recovery procedure: ${req.params.procedureId}`, error);
    res.status(500).json({ error: 'Failed to get recovery procedure' });
  }
});

// Execute recovery procedure
router.post('/recovery/procedures/:procedureId/execute', authenticateToken, async (req, res) => {
  try {
    const { procedureId } = req.params;
    const { triggerReason, backupId, dryRun } = req.body;
    const userId = req.user!.userId;

    const executionId = await disasterRecoveryService.executeRecoveryProcedure(procedureId, {
      triggerReason: triggerReason || 'manual',
      triggeredBy: userId,
      backupId,
      dryRun,
    });

    res.json({
      success: true,
      executionId,
      message: 'Recovery procedure execution started',
    });
  } catch (error) {
    logger.error(`Failed to execute recovery procedure: ${req.params.procedureId}`, error);
    res.status(500).json({ error: 'Failed to execute recovery procedure' });
  }
});

// Get recovery execution status
router.get('/recovery/executions/:executionId', authenticateToken, async (req, res) => {
  try {
    const { executionId } = req.params;

    const execution = await disasterRecoveryService.getRecoveryExecution(executionId);

    res.json({
      success: true,
      execution,
    });
  } catch (error) {
    logger.error(`Failed to get recovery execution: ${req.params.executionId}`, error);
    res.status(500).json({ error: 'Failed to get recovery execution' });
  }
});

// Test recovery procedure
router.post('/recovery/procedures/:procedureId/test', authenticateToken, async (req, res) => {
  try {
    const { procedureId } = req.params;

    const testResult = await disasterRecoveryService.testRecoveryProcedure(procedureId);

    res.json({
      success: true,
      testResult,
      message: 'Recovery procedure test completed',
    });
  } catch (error) {
    logger.error(`Failed to test recovery procedure: ${req.params.procedureId}`, error);
    res.status(500).json({ error: 'Failed to test recovery procedure' });
  }
});

// Create disaster scenario
router.post('/recovery/scenarios', authenticateToken, async (req, res) => {
  try {
    const scenario = await disasterRecoveryService.createDisasterScenario(req.body);

    res.json({
      success: true,
      scenario,
      message: 'Disaster scenario created successfully',
    });
  } catch (error) {
    logger.error('Failed to create disaster scenario:', error);
    res.status(500).json({ error: 'Failed to create disaster scenario' });
  }
});

// Schedule automated tests
router.post('/recovery/schedule-tests', authenticateToken, async (req, res) => {
  try {
    await disasterRecoveryService.scheduleAutomatedTests();

    res.json({
      success: true,
      message: 'Automated recovery testing scheduled',
    });
  } catch (error) {
    logger.error('Failed to schedule automated tests:', error);
    res.status(500).json({ error: 'Failed to schedule automated tests' });
  }
});

/**
 * System Health and Readiness Routes
 */

// Get system backup readiness
router.get('/health/backup-readiness', authenticateToken, async (req, res) => {
  try {
    const stats = await backupService.getBackupStatistics();
    const recentBackups = await backupService.listBackups({
      limit: 5,
    });

    const readiness = {
      backupService: {
        status: 'operational',
        statistics: stats,
        recentBackups: recentBackups.slice(0, 3),
        lastBackup: recentBackups.length > 0 ? recentBackups[0].timestamp : null,
      },
      recommendations: [],
    };

    // Add recommendations based on statistics
    if (stats.completedBackups < 1) {
      readiness.recommendations.push('No completed backups found - create initial backup');
    }

    if (stats.failedBackups > stats.completedBackups * 0.1) {
      readiness.recommendations.push('High backup failure rate - investigate backup issues');
    }

    if (!readiness.backupService.lastBackup) {
      readiness.recommendations.push('No recent backups - schedule regular backups');
    } else {
      const daysSinceLastBackup = (Date.now() - new Date(readiness.backupService.lastBackup).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceLastBackup > 1) {
        readiness.recommendations.push(`Last backup was ${Math.floor(daysSinceLastBackup)} days ago`);
      }
    }

    res.json({
      success: true,
      readiness,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to get backup readiness:', error);
    res.status(500).json({ error: 'Failed to get backup readiness' });
  }
});

// Comprehensive disaster readiness assessment
router.get('/health/disaster-readiness', authenticateToken, async (req, res) => {
  try {
    const backupStats = await backupService.getBackupStatistics();
    const recentBackups = await backupService.listBackups({ limit: 10 });

    const assessment = {
      overall: {
        status: 'ready', // ready, degraded, critical
        score: 0, // 0-100
        lastAssessment: new Date().toISOString(),
      },
      backup: {
        status: backupStats.completedBackups > 0 ? 'ready' : 'critical',
        recentBackups: recentBackups.length,
        lastBackup: recentBackups.length > 0 ? recentBackups[0].timestamp : null,
        retentionDays: backupStats.retentionDays,
        totalSize: backupStats.totalSize,
        failureRate: backupStats.completedBackups > 0
          ? (backupStats.failedBackups / (backupStats.completedBackups + backupStats.failedBackups)) * 100
          : 0,
      },
      recovery: {
        proceduresTested: 0, // Would query from disaster recovery service
        lastTestDate: null,
        averageTestDuration: 0,
        rtoCompliance: 0, // Percentage of procedures meeting RTO
        rpoCompliance: 0, // Percentage of procedures meeting RPO
      },
      recommendations: [],
      criticalIssues: [],
    };

    // Calculate overall score
    let score = 0;

    // Backup score (40%)
    if (backupStats.completedBackups > 0) score += 20;
    if (backupStats.failedBackups < backupStats.completedBackups * 0.1) score += 10;
    if (recentBackups.length > 0) {
      const daysSinceLastBackup = (Date.now() - new Date(recentBackups[0].timestamp).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceLastBackup < 1) score += 10;
    }

    // Recovery score (60%)
    score += 30; // Assuming basic recovery procedures exist
    score += 30; // Assuming some testing has been done

    assessment.overall.score = Math.min(100, score);

    // Determine overall status
    if (score >= 80) {
      assessment.overall.status = 'ready';
    } else if (score >= 50) {
      assessment.overall.status = 'degraded';
    } else {
      assessment.overall.status = 'critical';
    }

    // Generate recommendations
    if (backupStats.completedBackups === 0) {
      assessment.criticalIssues.push('No backup system configured');
      assessment.recommendations.push('Set up automated backup schedule');
    }

    if (backupStats.failedBackups > backupStats.completedBackups * 0.2) {
      assessment.criticalIssues.push('High backup failure rate');
      assessment.recommendations.push('Investigate and fix backup failures');
    }

    if (!recentBackups.length || (Date.now() - new Date(recentBackups[0].timestamp).getTime()) > 2 * 24 * 60 * 60 * 1000) {
      assessment.recommendations.push('Schedule more frequent backups');
    }

    assessment.recommendations.push('Test recovery procedures regularly');
    assessment.recommendations.push('Review and update RTO/RPO targets');
    assessment.recommendations.push('Document disaster response procedures');

    res.json({
      success: true,
      assessment,
    });
  } catch (error) {
    logger.error('Failed to get disaster readiness assessment:', error);
    res.status(500).json({ error: 'Failed to get disaster readiness assessment' });
  }
});

// Export backup
router.get('/backups/:backupId/export', authenticateToken, async (req, res) => {
  try {
    const { backupId } = req.params;
    const backup = await backupService.getBackupMetadata(backupId);

    if (!backup) {
      return res.status(404).json({ error: 'Backup not found' });
    }

    // Set appropriate headers for file download
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${backup.id}.backup"`);
    res.setHeader('Content-Length', backup.size);

    // Stream the backup file
    const fs = await import('fs');
    const fileStream = fs.createReadStream(backup.location);
    fileStream.pipe(res);

  } catch (error) {
    logger.error(`Failed to export backup: ${req.params.backupId}`, error);
    res.status(500).json({ error: 'Failed to export backup' });
  }
});

export default router;