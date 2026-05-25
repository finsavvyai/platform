/**
 * Questro AI-Powered Testing Automation Platform
 * Disaster Recovery Coordinator
 *
 * Comprehensive disaster recovery management system providing
 * automated failover, health monitoring, recovery orchestration,
 * and business continuity coordination.
 */

import { EventEmitter } from 'events';

export interface DRRegion {
  id: string;
  name: string;
  location: string;
  primary: boolean;
  active: boolean;
  endpoint: string;
  databaseUrl: string;
  storageUrl: string;
  healthEndpoint: string;
}

export interface DRHealthCheck {
  regionId: string;
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  lastCheck: Date;
  consecutiveFailures: number;
  details: any;
}

export interface DRFailoverPlan {
  id: string;
  name: string;
  triggerConditions: string[];
  failoverOrder: string[];
  rollbackPlan: string;
  estimatedRTO: number; // Recovery Time Objective in minutes
  estimatedRPO: number; // Recovery Point Objective in minutes
  autoFailover: boolean;
  testMode: boolean;
}

export interface DRRecoveryProcedure {
  id: string;
  name: string;
  description: string;
  steps: DRRecoveryStep[];
  rollbackSteps: DRRecoveryStep[];
  estimatedDuration: number;
  dependencies: string[];
  verificationSteps: DRVerificationStep[];
}

export interface DRRecoveryStep {
  id: string;
  name: string;
  description: string;
  action: string;
  parameters: Record<string, any>;
  timeout: number;
  retryCount: number;
  critical: boolean;
}

export interface DRVerificationStep {
  id: string;
  name: string;
  description: string;
  action: string;
  expectedOutcome: string;
  timeout: number;
}

export interface DRIncident {
  id: string;
  type: 'region_failure' | 'database_corruption' | 'security_incident' | 'network_outage' | 'service_degradation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'detected' | 'investigating' | 'recovering' | 'resolved';
  startTime: Date;
  endTime?: Date;
  affectedRegions: string[];
  affectedServices: string[];
  recoveryPlan?: string;
  actions: DRAction[];
  notifications: DRNotification[];
}

export interface DRAction {
  id: string;
  type: 'failover' | 'backup' | 'restore' | 'notification' | 'investigation';
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  startTime: Date;
  endTime?: Date;
  details: any;
  result?: any;
}

export interface DRNotification {
  id: string;
  type: 'email' | 'slack' | 'sms' | 'pager';
  recipients: string[];
  message: string;
  severity: 'info' | 'warning' | 'critical';
  sentAt: Date;
  status: 'pending' | 'sent' | 'failed';
}

/**
 * Disaster Recovery Coordinator
 */
export class DRCoordinator extends EventEmitter {
  private regions: Map<string, DRRegion> = new Map();
  private healthChecks: Map<string, DRHealthCheck[]> = new Map();
  private failoverPlans: Map<string, DRFailoverPlan> = new Map();
  private recoveryProcedures: Map<string, DRRecoveryProcedure> = new Map();
  private incidents: Map<string, DRIncident> = new Map();
  private activeIncidents: Map<string, DRIncident> = new Map();
  private healthCheckInterval?: NodeJS.Timeout;
  private isEnabled: boolean = true;
  private isInFailover: boolean = false;
  private currentPrimaryRegion: string;

  constructor() {
    super();
    this.initializeRegions();
    this.initializeFailoverPlans();
    this.initializeRecoveryProcedures();
    this.startHealthMonitoring();
  }

  /**
   * Initialize disaster recovery regions
   */
  private initializeRegions(): void {
    const regions: DRRegion[] = [
      {
        id: 'us-east-1',
        name: 'US East (N. Virginia)',
        location: 'us-east-1',
        primary: true,
        active: true,
        endpoint: 'https://api.qestro.ai',
        databaseUrl: process.env.DATABASE_URL_PRIMARY || '',
        storageUrl: process.env.STORAGE_URL_PRIMARY || '',
        healthEndpoint: 'https://api.qestro.ai/health'
      },
      {
        id: 'us-west-2',
        name: 'US West (Oregon)',
        location: 'us-west-2',
        primary: false,
        active: true,
        endpoint: 'https://api-west.qestro.ai',
        databaseUrl: process.env.DATABASE_URL_SECONDARY || '',
        storageUrl: process.env.STORAGE_URL_SECONDARY || '',
        healthEndpoint: 'https://api-west.qestro.ai/health'
      },
      {
        id: 'eu-west-1',
        name: 'EU West (Ireland)',
        location: 'eu-west-1',
        primary: false,
        active: true,
        endpoint: 'https://api-eu.qestro.ai',
        databaseUrl: process.env.DATABASE_URL_EU || '',
        storageUrl: process.env.STORAGE_URL_EU || '',
        healthEndpoint: 'https://api-eu.qestro.ai/health'
      }
    ];

    regions.forEach(region => {
      this.regions.set(region.id, region);
      this.healthChecks.set(region.id, []);
    });

    // Set current primary region
    const primaryRegion = regions.find(r => r.primary);
    this.currentPrimaryRegion = primaryRegion?.id || 'us-east-1';
  }

  /**
   * Initialize failover plans
   */
  private initializeFailoverPlans(): void {
    const plans: DRFailoverPlan[] = [
      {
        id: 'region-failure',
        name: 'Region Failure Failover',
        triggerConditions: [
          'primary_region_unhealthy',
          'multiple_service_failures',
          'network_connectivity_loss'
        ],
        failoverOrder: ['us-west-2', 'eu-west-1'],
        rollbackPlan: 'region-rollback',
        estimatedRTO: 15,
        estimatedRPO: 5,
        autoFailover: true,
        testMode: false
      },
      {
        id: 'database-failure',
        name: 'Database Failure Recovery',
        triggerConditions: [
          'database_corruption',
          'database_unavailable',
          'replication_lag_exceeded'
        ],
        failoverOrder: ['promote_secondary', 'restore_from_backup'],
        rollbackPlan: 'database-rollback',
        estimatedRTO: 30,
        estimatedRPO: 15,
        autoFailover: false,
        testMode: false
      },
      {
        id: 'security-incident',
        name: 'Security Incident Response',
        triggerConditions: [
          'security_breach_detected',
          'malicious_activity',
          'data_compromise'
        ],
        failoverOrder: ['isolate_affected', 'promote_clean_region'],
        rollbackPlan: 'security-rollback',
        estimatedRTO: 60,
        estimatedRPO: 30,
        autoFailover: false,
        testMode: false
      }
    ];

    plans.forEach(plan => {
      this.failoverPlans.set(plan.id, plan);
    });
  }

  /**
   * Initialize recovery procedures
   */
  private initializeRecoveryProcedures(): void {
    const procedures: DRRecoveryProcedure[] = [
      {
        id: 'region-failover',
        name: 'Region Failover Procedure',
        description: 'Execute failover from primary to secondary region',
        steps: [
          {
            id: 'verify-secondary-health',
            name: 'Verify Secondary Region Health',
            description: 'Ensure secondary region is healthy and ready',
            action: 'health_check',
            parameters: { region: 'secondary' },
            timeout: 300000, // 5 minutes
            retryCount: 3,
            critical: true
          },
          {
            id: 'stop-primary-services',
            name: 'Stop Primary Region Services',
            description: 'Gracefully stop services in primary region',
            action: 'stop_services',
            parameters: { region: 'primary', graceful: true },
            timeout: 600000, // 10 minutes
            retryCount: 2,
            critical: true
          },
          {
            id: 'promote-secondary-database',
            name: 'Promote Secondary Database',
            description: 'Promote secondary database to primary',
            action: 'promote_database',
            parameters: { region: 'secondary' },
            timeout: 300000, // 5 minutes
            retryCount: 1,
            critical: true
          },
          {
            id: 'update-dns-records',
            name: 'Update DNS Records',
            description: 'Update DNS to point to secondary region',
            action: 'update_dns',
            parameters: { targetRegion: 'secondary', ttl: 60 },
            timeout: 180000, // 3 minutes
            retryCount: 3,
            critical: true
          },
          {
            id: 'verify-failover',
            name: 'Verify Failover Success',
            description: 'Verify services are working in new primary',
            action: 'verify_services',
            parameters: { region: 'secondary' },
            timeout: 300000, // 5 minutes
            retryCount: 3,
            critical: true
          }
        ],
        rollbackSteps: [
          {
            id: 'rollback-dns',
            name: 'Rollback DNS Records',
            description: 'Rollback DNS to original primary region',
            action: 'update_dns',
            parameters: { targetRegion: 'primary', ttl: 300 },
            timeout: 180000,
            retryCount: 3,
            critical: true
          },
          {
            id: 'rollback-database',
            name: 'Rollback Database Configuration',
            description: 'Rollback database to original configuration',
            action: 'rollback_database',
            parameters: { primaryRegion: 'primary' },
            timeout: 300000,
            retryCount: 1,
            critical: true
          }
        ],
        estimatedDuration: 20,
        dependencies: ['secondary-region-healthy'],
        verificationSteps: [
          {
            id: 'check-api-endpoints',
            name: 'Check API Endpoints',
            description: 'Verify all API endpoints are responding',
            action: 'api_health_check',
            expectedOutcome: 'All endpoints return 200 OK',
            timeout: 120000
          },
          {
            id: 'check-database-connectivity',
            name: 'Check Database Connectivity',
            description: 'Verify database is accessible and responding',
            action: 'database_health_check',
            expectedOutcome: 'Database queries succeed',
            timeout: 60000
          }
        ]
      }
    ];

    procedures.forEach(procedure => {
      this.recoveryProcedures.set(procedure.id, procedure);
    });
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(() => {
      this.performHealthChecks();
    }, 30000); // Check every 30 seconds

    // Initial health check
    this.performHealthChecks();
  }

  /**
   * Perform health checks across all regions
   */
  private async performHealthChecks(): Promise<void> {
    if (!this.isEnabled) return;

    const healthCheckPromises: Promise<DRHealthCheck>[] = [];

    for (const [regionId, region] of this.regions) {
      healthCheckPromises.push(this.checkRegionHealth(region));
    }

    try {
      const results = await Promise.allSettled(healthCheckPromises);

      results.forEach((result, index) => {
        const regionId = Array.from(this.regions.keys())[index];
        if (result.status === 'fulfilled') {
          this.updateRegionHealth(regionId, result.value);
        } else {
          console.error(`Health check failed for region ${regionId}:`, result.reason);
        }
      });

      // Analyze health results for potential incidents
      this.analyzeHealthResults();

    } catch (error) {
      console.error('Health monitoring failed:', error);
    }
  }

  /**
   * Check individual region health
   */
  private async checkRegionHealth(region: DRRegion): Promise<DRHealthCheck> {
    const startTime = Date.now();

    try {
      // Perform comprehensive health check
      const healthResponse = await this.makeHealthCheckRequest(region.healthEndpoint);
      const responseTime = Date.now() - startTime;

      // Check database connectivity
      const dbHealthy = await this.checkDatabaseHealth(region.databaseUrl);

      // Check storage connectivity
      const storageHealthy = await this.checkStorageHealth(region.storageUrl);

      const overallHealth = healthResponse.status === 'healthy' && dbHealthy && storageHealthy;

      return {
        regionId: region.id,
        service: 'overall',
        status: overallHealth ? 'healthy' : 'unhealthy',
        responseTime,
        lastCheck: new Date(),
        consecutiveFailures: 0,
        details: {
          api: healthResponse,
          database: dbHealthy,
          storage: storageHealthy
        }
      };

    } catch (error) {
      return {
        regionId: region.id,
        service: 'overall',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        lastCheck: new Date(),
        consecutiveFailures: 1,
        details: {
          error: error.message
        }
      };
    }
  }

  /**
   * Make health check request to region
   */
  private async makeHealthCheckRequest(endpoint: string): Promise<any> {
    const response = await fetch(`${endpoint}/health`, {
      method: 'GET',
      timeout: 10000,
      headers: {
        'User-Agent': 'Questro-DR-Coordinator/1.0'
      }
    });

    if (!response.ok) {
      throw new Error(`Health check failed: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Check database health
   */
  private async checkDatabaseHealth(databaseUrl: string): Promise<boolean> {
    try {
      // Implementation would connect to database and run health check
      // For now, return true as placeholder
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check storage health
   */
  private async checkStorageHealth(storageUrl: string): Promise<boolean> {
    try {
      // Implementation would check storage connectivity
      // For now, return true as placeholder
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Update region health status
   */
  private updateRegionHealth(regionId: string, healthCheck: DRHealthCheck): void {
    const previousChecks = this.healthChecks.get(regionId) || [];
    const lastCheck = previousChecks[previousChecks.length - 1];

    // Update consecutive failures count
    if (healthCheck.status === 'unhealthy' && lastCheck?.status === 'unhealthy') {
      healthCheck.consecutiveFailures = lastCheck.consecutiveFailures + 1;
    } else if (healthCheck.status === 'healthy') {
      healthCheck.consecutiveFailures = 0;
    }

    // Add to history (keep last 100 checks)
    previousChecks.push(healthCheck);
    if (previousChecks.length > 100) {
      previousChecks.shift();
    }

    this.healthChecks.set(regionId, previousChecks);

    // Emit health check event
    this.emit('healthCheck', healthCheck);
  }

  /**
   * Analyze health results for potential incidents
   */
  private analyzeHealthResults(): void {
    for (const [regionId, healthChecks] of this.healthChecks) {
      const latestCheck = healthChecks[healthChecks.length - 1];
      if (!latestCheck) continue;

      const region = this.regions.get(regionId);
      if (!region) continue;

      // Check for primary region failure
      if (region.primary && latestCheck.status === 'unhealthy' && latestCheck.consecutiveFailures >= 3) {
        this.detectIncident('region_failure', 'high', [regionId], ['api', 'database', 'storage']);
      }

      // Check for service degradation
      if (latestCheck.status === 'degraded' && latestCheck.responseTime > 5000) {
        this.detectIncident('service_degradation', 'medium', [regionId], ['api']);
      }
    }
  }

  /**
   * Detect and create incident
   */
  private detectIncident(type: DRIncident['type'], severity: DRIncident['severity'], affectedRegions: string[], affectedServices: string[]): void {
    const incidentId = this.generateIncidentId();

    const incident: DRIncident = {
      id: incidentId,
      type,
      severity,
      status: 'detected',
      startTime: new Date(),
      affectedRegions,
      affectedServices,
      actions: [],
      notifications: []
    };

    this.incidents.set(incidentId, incident);
    this.activeIncidents.set(incidentId, incident);

    // Emit incident detection event
    this.emit('incidentDetected', incident);

    // Check for automatic failover
    this.checkAutoFailover(incident);

    // Send notifications
    this.sendIncidentNotifications(incident);
  }

  /**
   * Check for automatic failover conditions
   */
  private checkAutoFailover(incident: DRIncident): void {
    const failoverPlan = this.failoverPlans.get('region-failure');
    if (!failoverPlan || !failoverPlan.autoFailover || this.isInFailover) return;

    // Check if incident meets failover criteria
    const shouldFailover =
      incident.type === 'region_failure' &&
      incident.severity === 'high' &&
      incident.affectedRegions.includes(this.currentPrimaryRegion);

    if (shouldFailover) {
      console.log('Initiating automatic failover due to incident:', incident.id);
      this.initiateFailover('region-failure', incident.id);
    }
  }

  /**
   * Initiate failover procedure
   */
  async initiateFailover(planId: string, incidentId?: string): Promise<boolean> {
    if (this.isInFailover) {
      console.log('Failover already in progress');
      return false;
    }

    const plan = this.failoverPlans.get(planId);
    if (!plan) {
      console.error('Failover plan not found:', planId);
      return false;
    }

    const procedure = this.recoveryProcedures.get('region-failover');
    if (!procedure) {
      console.error('Recovery procedure not found');
      return false;
    }

    console.log('Initiating failover with plan:', plan.name);
    this.isInFailover = true;

    try {
      // Update incident status
      if (incidentId) {
        const incident = this.incidents.get(incidentId);
        if (incident) {
          incident.status = 'recovering';
          incident.recoveryPlan = planId;
        }
      }

      // Execute recovery procedure
      const success = await this.executeRecoveryProcedure(procedure, {
        failoverPlan: plan,
        incidentId,
        testMode: plan.testMode
      });

      if (success) {
        // Update primary region
        this.updatePrimaryRegion(plan.failoverOrder[0]);

        // Update incident status
        if (incidentId) {
          const incident = this.incidents.get(incidentId);
          if (incident) {
            incident.status = 'resolved';
            incident.endTime = new Date();
          }
        }

        this.emit('failoverSuccess', { planId, incidentId, newPrimaryRegion: plan.failoverOrder[0] });
      } else {
        this.emit('failoverFailed', { planId, incidentId });
      }

      return success;

    } catch (error) {
      console.error('Failover failed:', error);
      this.emit('failoverFailed', { planId, incidentId, error });
      return false;
    } finally {
      this.isInFailover = false;
    }
  }

  /**
   * Execute recovery procedure
   */
  private async executeRecoveryProcedure(procedure: DRRecoveryProcedure, context: any): Promise<boolean> {
    console.log('Executing recovery procedure:', procedure.name);

    try {
      // Execute each step
      for (const step of procedure.steps) {
        console.log('Executing step:', step.name);

        const success = await this.executeRecoveryStep(step, context);
        if (!success && step.critical) {
          console.error('Critical step failed:', step.name);
          return false;
        }
      }

      // Execute verification steps
      for (const verification of procedure.verificationSteps) {
        console.log('Verifying:', verification.name);

        const success = await this.executeVerificationStep(verification, context);
        if (!success) {
          console.error('Verification failed:', verification.name);
          return false;
        }
      }

      console.log('Recovery procedure completed successfully');
      return true;

    } catch (error) {
      console.error('Recovery procedure failed:', error);
      return false;
    }
  }

  /**
   * Execute individual recovery step
   */
  private async executeRecoveryStep(step: DRRecoveryStep, context: any): Promise<boolean> {
    try {
      switch (step.action) {
        case 'health_check':
          return await this.performHealthCheckAction(step.parameters);
        case 'stop_services':
          return await this.stopServicesAction(step.parameters);
        case 'promote_database':
          return await this.promoteDatabaseAction(step.parameters);
        case 'update_dns':
          return await this.updateDnsAction(step.parameters);
        case 'verify_services':
          return await this.verifyServicesAction(step.parameters);
        default:
          console.warn('Unknown recovery step action:', step.action);
          return true;
      }
    } catch (error) {
      console.error('Recovery step failed:', step.name, error);
      return false;
    }
  }

  /**
   * Execute verification step
   */
  private async executeVerificationStep(step: DRVerificationStep, context: any): Promise<boolean> {
    try {
      switch (step.action) {
        case 'api_health_check':
          return await this.verifyApiHealth();
        case 'database_health_check':
          return await this.verifyDatabaseHealth();
        default:
          console.warn('Unknown verification step action:', step.action);
          return true;
      }
    } catch (error) {
      console.error('Verification step failed:', step.name, error);
      return false;
    }
  }

  // Action implementations (simplified)
  private async performHealthCheckAction(params: any): Promise<boolean> {
    // Implementation would perform health check on specified region
    return true;
  }

  private async stopServicesAction(params: any): Promise<boolean> {
    // Implementation would stop services in specified region
    return true;
  }

  private async promoteDatabaseAction(params: any): Promise<boolean> {
    // Implementation would promote database to primary
    return true;
  }

  private async updateDnsAction(params: any): Promise<boolean> {
    // Implementation would update DNS records
    return true;
  }

  private async verifyServicesAction(params: any): Promise<boolean> {
    // Implementation would verify services are working
    return true;
  }

  private async verifyApiHealth(): Promise<boolean> {
    // Implementation would verify API health
    return true;
  }

  private async verifyDatabaseHealth(): Promise<boolean> {
    // Implementation would verify database health
    return true;
  }

  /**
   * Update primary region
   */
  private updatePrimaryRegion(newPrimaryRegionId: string): void {
    // Update all regions
    for (const [id, region] of this.regions) {
      region.primary = (id === newPrimaryRegionId);
    }

    this.currentPrimaryRegion = newPrimaryRegionId;

    console.log('Primary region updated to:', newPrimaryRegionId);
    this.emit('primaryRegionChanged', newPrimaryRegionId);
  }

  /**
   * Send incident notifications
   */
  private async sendIncidentNotifications(incident: DRIncident): Promise<void> {
    const notifications: DRNotification[] = [
      {
        id: this.generateNotificationId(),
        type: 'slack',
        recipients: ['#alerts', '#oncall'],
        message: this.formatIncidentMessage(incident),
        severity: incident.severity === 'critical' ? 'critical' : 'warning',
        sentAt: new Date(),
        status: 'pending'
      },
      {
        id: this.generateNotificationId(),
        type: 'email',
        recipients: ['oncall@qestro.ai', 'devops@qestro.ai'],
        message: this.formatIncidentEmail(incident),
        severity: incident.severity === 'critical' ? 'critical' : 'warning',
        sentAt: new Date(),
        status: 'pending'
      }
    ];

    incident.notifications = notifications;

    // Send notifications (implementation would actually send them)
    notifications.forEach(notification => {
      console.log('Sending notification:', notification.type, notification.message);
      notification.status = 'sent';
    });

    this.emit('notificationsSent', notifications);
  }

  /**
   * Format incident message for Slack
   */
  private formatIncidentMessage(incident: DRIncident): string {
    const severityEmoji = {
      low: '🟢',
      medium: '🟡',
      high: '🟠',
      critical: '🔴'
    };

    return `${severityEmoji[incident.severity]} **${incident.type.toUpperCase()}** detected in regions: ${incident.affectedRegions.join(', ')}. Services affected: ${incident.affectedServices.join(', ')}. Status: ${incident.status}`;
  }

  /**
   * Format incident email
   */
  private formatIncidentEmail(incident: DRIncident): string {
    return `
Incident Alert: ${incident.type.toUpperCase()}

Severity: ${incident.severity.toUpperCase()}
Status: ${incident.status}
Started: ${incident.startTime.toISOString()}
Affected Regions: ${incident.affectedRegions.join(', ')}
Affected Services: ${incident.affectedServices.join(', ')}

Immediate action required.
    `.trim();
  }

  /**
   * Test disaster recovery procedures
   */
  async testDisasterRecovery(procedureId: string): Promise<boolean> {
    console.log('Testing disaster recovery procedure:', procedureId);

    const procedure = this.recoveryProcedures.get(procedureId);
    if (!procedure) {
      console.error('Recovery procedure not found:', procedureId);
      return false;
    }

    // Create test incident
    const testIncident: DRIncident = {
      id: this.generateIncidentId(),
      type: 'service_degradation',
      severity: 'medium',
      status: 'detected',
      startTime: new Date(),
      affectedRegions: [this.currentPrimaryRegion],
      affectedServices: ['api'],
      actions: [],
      notifications: []
    };

    // Execute procedure in test mode
    return await this.executeRecoveryProcedure(procedure, {
      testMode: true,
      incidentId: testIncident.id
    });
  }

  /**
   * Generate unique IDs
   */
  private generateIncidentId(): string {
    return `incident_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateNotificationId(): string {
    return `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get system status
   */
  getSystemStatus(): any {
    const regions = Array.from(this.regions.values()).map(region => ({
      ...region,
      health: this.healthChecks.get(region.id)?.slice(-1)[0] || null
    }));

    const activeIncidents = Array.from(this.activeIncidents.values());

    return {
      regions,
      primaryRegion: this.currentPrimaryRegion,
      isInFailover: this.isInFailover,
      activeIncidents: activeIncidents.length,
      lastHealthCheck: new Date(),
      enabled: this.isEnabled
    };
  }

  /**
   * Enable/disable DR coordinator
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;

    if (!enabled && this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    } else if (enabled && !this.healthCheckInterval) {
      this.startHealthMonitoring();
    }
  }

  /**
   * Get incidents
   */
  getIncidents(includeResolved: boolean = false): DRIncident[] {
    const incidents = Array.from(this.incidents.values());

    if (!includeResolved) {
      return incidents.filter(incident => incident.status !== 'resolved');
    }

    return incidents;
  }

  /**
   * Get health status
   */
  getHealthStatus(): Map<string, DRHealthCheck[]> {
    return new Map(this.healthChecks);
  }

  /**
   * Shutdown DR coordinator
   */
  shutdown(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    this.setEnabled(false);
    console.log('DR Coordinator shutdown completed');
  }
}

export { DRCoordinator };
