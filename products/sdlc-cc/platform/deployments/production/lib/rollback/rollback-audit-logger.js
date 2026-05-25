/**
 * Rollback Audit Logger
 * 
 * Logs all rollback events and details for audit trail
 * Implements event logging, details recording, and audit trail storage
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class RollbackAuditLogger {
  constructor(logger, config) {
    this.logger = logger;
    this.config = config;
    this.auditDir = path.join(__dirname, '..', '..', 'logs', 'rollback-audit');
    
    // Ensure audit directory exists
    this.ensureAuditDirectory();
  }

  /**
   * Ensure audit directory exists
   */
  ensureAuditDirectory() {
    if (!fs.existsSync(this.auditDir)) {
      fs.mkdirSync(this.auditDir, { recursive: true });
    }
  }

  /**
   * Log rollback start event
   * @param {string} deploymentId - Deployment ID
   * @param {string} reason - Reason for rollback
   * @returns {Promise<string>} Audit record ID
   */
  async logRollbackStart(deploymentId, reason) {
    try {
      const auditRecordId = this.generateAuditRecordId();
      
      const auditRecord = {
        auditRecordId,
        eventType: 'ROLLBACK_START',
        deploymentId,
        reason,
        timestamp: new Date().toISOString(),
        user: this.getUserIdentity(),
        environment: this.config.environment || 'unknown',
        metadata: {
          hostname: require('os').hostname(),
          platform: process.platform,
          nodeVersion: process.version
        }
      };
      
      await this.storeAuditRecord(auditRecord);
      
      this.logger.info(`Rollback start logged: ${auditRecordId}`);
      
      return auditRecordId;
      
    } catch (error) {
      this.logger.error(`Failed to log rollback start: ${error.message}`);
      throw error;
    }
  }

  /**
   * Log rollback completion event
   * @param {string} deploymentId - Deployment ID
   * @param {Object} rollbackResult - Rollback result
   * @returns {Promise<string>} Audit record ID
   */
  async logRollbackComplete(deploymentId, rollbackResult) {
    try {
      const auditRecordId = this.generateAuditRecordId();
      
      const auditRecord = {
        auditRecordId,
        eventType: 'ROLLBACK_COMPLETE',
        deploymentId,
        timestamp: new Date().toISOString(),
        user: this.getUserIdentity(),
        environment: this.config.environment || 'unknown',
        result: {
          success: rollbackResult.success,
          duration: rollbackResult.duration,
          phasesCompleted: rollbackResult.phases?.length || 0,
          verified: rollbackResult.verified
        },
        details: this.sanitizeRollbackDetails(rollbackResult),
        metadata: {
          hostname: require('os').hostname(),
          platform: process.platform,
          nodeVersion: process.version
        }
      };
      
      await this.storeAuditRecord(auditRecord);
      
      this.logger.info(`Rollback completion logged: ${auditRecordId}`);
      
      return auditRecordId;
      
    } catch (error) {
      this.logger.error(`Failed to log rollback completion: ${error.message}`);
      throw error;
    }
  }

  /**
   * Log rollback error event
   * @param {string} deploymentId - Deployment ID
   * @param {Error} error - Error that occurred
   * @returns {Promise<string>} Audit record ID
   */
  async logRollbackError(deploymentId, error) {
    try {
      const auditRecordId = this.generateAuditRecordId();
      
      const auditRecord = {
        auditRecordId,
        eventType: 'ROLLBACK_ERROR',
        deploymentId,
        timestamp: new Date().toISOString(),
        user: this.getUserIdentity(),
        environment: this.config.environment || 'unknown',
        error: {
          message: error.message,
          stack: error.stack,
          name: error.name
        },
        metadata: {
          hostname: require('os').hostname(),
          platform: process.platform,
          nodeVersion: process.version
        }
      };
      
      await this.storeAuditRecord(auditRecord);
      
      this.logger.info(`Rollback error logged: ${auditRecordId}`);
      
      return auditRecordId;
      
    } catch (logError) {
      this.logger.error(`Failed to log rollback error: ${logError.message}`);
      throw logError;
    }
  }

  /**
   * Log rollback phase event
   * @param {string} deploymentId - Deployment ID
   * @param {string} phase - Phase name
   * @param {Object} phaseResult - Phase result
   * @returns {Promise<string>} Audit record ID
   */
  async logRollbackPhase(deploymentId, phase, phaseResult) {
    try {
      const auditRecordId = this.generateAuditRecordId();
      
      const auditRecord = {
        auditRecordId,
        eventType: 'ROLLBACK_PHASE',
        deploymentId,
        phase,
        timestamp: new Date().toISOString(),
        user: this.getUserIdentity(),
        environment: this.config.environment || 'unknown',
        result: {
          success: phaseResult.success,
          duration: phaseResult.duration
        },
        details: this.sanitizePhaseDetails(phaseResult),
        metadata: {
          hostname: require('os').hostname()
        }
      };
      
      await this.storeAuditRecord(auditRecord);
      
      this.logger.debug(`Rollback phase logged: ${phase} (${auditRecordId})`);
      
      return auditRecordId;
      
    } catch (error) {
      this.logger.error(`Failed to log rollback phase: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate unique audit record ID
   * @returns {string} Audit record ID
   */
  generateAuditRecordId() {
    const timestamp = Date.now();
    const random = crypto.randomBytes(4).toString('hex');
    return `audit-rollback-${timestamp}-${random}`;
  }

  /**
   * Get user identity
   * @returns {Object} User identity information
   */
  getUserIdentity() {
    return {
      username: process.env.USER || process.env.USERNAME || 'unknown',
      uid: process.getuid ? process.getuid() : null,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Sanitize rollback details for audit log
   * @param {Object} rollbackResult - Rollback result
   * @returns {Object} Sanitized details
   */
  sanitizeRollbackDetails(rollbackResult) {
    // Remove sensitive information and large data structures
    const sanitized = {
      success: rollbackResult.success,
      duration: rollbackResult.duration,
      startTime: rollbackResult.startTime,
      endTime: rollbackResult.endTime,
      reason: rollbackResult.reason
    };
    
    if (rollbackResult.phases) {
      sanitized.phases = rollbackResult.phases.map(phase => ({
        name: phase.name,
        success: phase.success,
        duration: phase.duration
      }));
    }
    
    if (rollbackResult.errors) {
      sanitized.errors = rollbackResult.errors.map(error => ({
        phase: error.phase,
        error: error.error
      }));
    }
    
    return sanitized;
  }

  /**
   * Sanitize phase details for audit log
   * @param {Object} phaseResult - Phase result
   * @returns {Object} Sanitized details
   */
  sanitizePhaseDetails(phaseResult) {
    return {
      success: phaseResult.success,
      duration: phaseResult.duration,
      error: phaseResult.error || null
    };
  }

  /**
   * Store audit record to file system
   * @param {Object} auditRecord - Audit record to store
   * @returns {Promise<void>}
   */
  async storeAuditRecord(auditRecord) {
    try {
      // Store in daily audit file
      const date = new Date().toISOString().split('T')[0];
      const auditFile = path.join(this.auditDir, `rollback-audit-${date}.jsonl`);
      
      // Append to JSONL file (one JSON object per line)
      const auditLine = JSON.stringify(auditRecord) + '\n';
      fs.appendFileSync(auditFile, auditLine, 'utf8');
      
      // Also store individual record file for easy retrieval
      const recordFile = path.join(this.auditDir, `${auditRecord.auditRecordId}.json`);
      fs.writeFileSync(recordFile, JSON.stringify(auditRecord, null, 2), 'utf8');
      
      this.logger.debug(`Audit record stored: ${auditRecord.auditRecordId}`);
      
    } catch (error) {
      this.logger.error(`Failed to store audit record: ${error.message}`);
      throw error;
    }
  }

  /**
   * Store audit trail to long-term storage (R2)
   * @param {string} deploymentId - Deployment ID
   * @returns {Promise<Object>} Storage result
   */
  async storeAuditTrailToR2(deploymentId) {
    try {
      this.logger.info('Storing audit trail to R2...');
      
      // Get all audit records for this deployment
      const auditRecords = await this.getAuditRecordsForDeployment(deploymentId);
      
      if (auditRecords.length === 0) {
        this.logger.warn('No audit records found for deployment');
        return {
          success: false,
          message: 'No audit records found'
        };
      }
      
      // Create audit trail document
      const auditTrail = {
        deploymentId,
        createdAt: new Date().toISOString(),
        recordCount: auditRecords.length,
        records: auditRecords,
        retention: '7-years',
        metadata: {
          environment: this.config.environment,
          user: this.getUserIdentity()
        }
      };
      
      // Store to file (in production, this would upload to R2)
      const trailFile = path.join(this.auditDir, `audit-trail-${deploymentId}.json`);
      fs.writeFileSync(trailFile, JSON.stringify(auditTrail, null, 2), 'utf8');
      
      this.logger.success(`Audit trail stored: ${trailFile}`);
      
      // In production, upload to R2:
      // await this.uploadToR2(auditTrail, `audit-trails/rollback/${deploymentId}.json`);
      
      return {
        success: true,
        recordCount: auditRecords.length,
        location: trailFile
      };
      
    } catch (error) {
      this.logger.error(`Failed to store audit trail: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get audit records for a deployment
   * @param {string} deploymentId - Deployment ID
   * @returns {Promise<Array>} Audit records
   */
  async getAuditRecordsForDeployment(deploymentId) {
    try {
      const records = [];
      
      // Read all audit files
      const files = fs.readdirSync(this.auditDir);
      const jsonlFiles = files.filter(file => file.endsWith('.jsonl'));
      
      for (const file of jsonlFiles) {
        const filePath = path.join(this.auditDir, file);
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n').filter(line => line.trim());
        
        for (const line of lines) {
          try {
            const record = JSON.parse(line);
            if (record.deploymentId === deploymentId) {
              records.push(record);
            }
          } catch (parseError) {
            // Skip invalid lines
          }
        }
      }
      
      // Sort by timestamp
      records.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      
      return records;
      
    } catch (error) {
      this.logger.error(`Failed to get audit records: ${error.message}`);
      return [];
    }
  }

  /**
   * Get audit record by ID
   * @param {string} auditRecordId - Audit record ID
   * @returns {Object|null} Audit record
   */
  getAuditRecord(auditRecordId) {
    try {
      const recordFile = path.join(this.auditDir, `${auditRecordId}.json`);
      
      if (!fs.existsSync(recordFile)) {
        return null;
      }
      
      return JSON.parse(fs.readFileSync(recordFile, 'utf8'));
      
    } catch (error) {
      this.logger.error(`Failed to get audit record: ${error.message}`);
      return null;
    }
  }

  /**
   * Create audit trail summary
   * @param {string} deploymentId - Deployment ID
   * @returns {Promise<Object>} Summary
   */
  async createAuditTrailSummary(deploymentId) {
    try {
      const records = await this.getAuditRecordsForDeployment(deploymentId);
      
      const summary = {
        deploymentId,
        totalRecords: records.length,
        eventTypes: {},
        timeline: [],
        duration: null
      };
      
      // Count event types
      for (const record of records) {
        summary.eventTypes[record.eventType] = 
          (summary.eventTypes[record.eventType] || 0) + 1;
      }
      
      // Create timeline
      summary.timeline = records.map(record => ({
        timestamp: record.timestamp,
        eventType: record.eventType,
        phase: record.phase
      }));
      
      // Calculate duration
      if (records.length >= 2) {
        const start = new Date(records[0].timestamp);
        const end = new Date(records[records.length - 1].timestamp);
        summary.duration = end - start;
      }
      
      return summary;
      
    } catch (error) {
      this.logger.error(`Failed to create audit trail summary: ${error.message}`);
      return null;
    }
  }

  /**
   * Create audit trail report
   * @param {string} deploymentId - Deployment ID
   * @returns {Promise<string>} Formatted report
   */
  async createAuditTrailReport(deploymentId) {
    const summary = await this.createAuditTrailSummary(deploymentId);
    
    if (!summary) {
      return 'Audit trail report unavailable';
    }
    
    const lines = [];
    
    lines.push('='.repeat(60));
    lines.push('ROLLBACK AUDIT TRAIL REPORT');
    lines.push('='.repeat(60));
    lines.push('');
    lines.push(`Deployment ID: ${deploymentId}`);
    lines.push(`Total Records: ${summary.totalRecords}`);
    
    if (summary.duration) {
      lines.push(`Duration: ${summary.duration}ms`);
    }
    
    lines.push('');
    lines.push('Event Types:');
    for (const [eventType, count] of Object.entries(summary.eventTypes)) {
      lines.push(`  ${eventType}: ${count}`);
    }
    
    lines.push('');
    lines.push('Timeline:');
    for (const event of summary.timeline) {
      const time = new Date(event.timestamp).toISOString();
      const phase = event.phase ? ` (${event.phase})` : '';
      lines.push(`  ${time} - ${event.eventType}${phase}`);
    }
    
    lines.push('');
    lines.push('='.repeat(60));
    
    return lines.join('\n');
  }

  /**
   * Clean up old audit records
   * @param {number} retentionDays - Number of days to retain
   * @returns {number} Number of records deleted
   */
  cleanupOldAuditRecords(retentionDays = 2555) { // 7 years default
    try {
      this.logger.info(`Cleaning up audit records older than ${retentionDays} days`);
      
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
      
      const files = fs.readdirSync(this.auditDir);
      let deletedCount = 0;
      
      for (const file of files) {
        if (!file.endsWith('.json') || file.includes('audit-trail-')) {
          continue; // Skip JSONL files and audit trail files
        }
        
        try {
          const filePath = path.join(this.auditDir, file);
          const record = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          
          const recordDate = new Date(record.timestamp);
          
          if (recordDate < cutoffDate) {
            fs.unlinkSync(filePath);
            deletedCount++;
          }
          
        } catch (error) {
          this.logger.error(`Error processing audit file ${file}: ${error.message}`);
        }
      }
      
      this.logger.info(`Cleaned up ${deletedCount} old audit records`);
      
      return deletedCount;
      
    } catch (error) {
      this.logger.error(`Audit cleanup failed: ${error.message}`);
      return 0;
    }
  }
}

module.exports = { RollbackAuditLogger };
