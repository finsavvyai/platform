import * as vscode from 'vscode';
import * as crypto from 'crypto';
import { DatabaseConnectionManager } from './connectionManager';

export interface SecurityAuditLog {
    id: string;
    timestamp: Date;
    userId?: string;
    connectionId: string;
    action: 'connect' | 'disconnect' | 'query' | 'export' | 'import' | 'schema_change' | 'user_management';
    details: {
        query?: string;
        table?: string;
        database?: string;
        ipAddress?: string;
        userAgent?: string;
        success: boolean;
        error?: string;
        sensitiveData?: boolean;
        riskLevel: 'low' | 'medium' | 'high' | 'critical';
    };
    metadata?: Record<string, any>;
}

export interface SecurityPolicy {
    id: string;
    name: string;
    description: string;
    enabled: boolean;
    rules: SecurityRule[];
    actions: SecurityAction[];
    createdAt: Date;
    updatedAt: Date;
}

export interface SecurityRule {
    id: string;
    type: 'query_pattern' | 'data_access' | 'time_based' | 'user_based' | 'ip_based';
    condition: string;
    parameters: Record<string, any>;
    severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface SecurityAction {
    id: string;
    type: 'block' | 'warn' | 'log' | 'notify' | 'require_approval';
    parameters: Record<string, any>;
}

export interface DataMaskingRule {
    id: string;
    name: string;
    table: string;
    column: string;
    maskingType: 'full' | 'partial' | 'hash' | 'encrypt' | 'null';
    parameters: {
        visibleChars?: number;
        maskChar?: string;
        hashAlgorithm?: string;
        encryptionKey?: string;
    };
    enabled: boolean;
    conditions?: string; // SQL WHERE clause for conditional masking
}

export interface EncryptionKey {
    id: string;
    name: string;
    algorithm: string;
    key: string; // Encrypted
    createdAt: Date;
    expiresAt?: Date;
    usage: string[];
}

export class SecurityManager {
    private connectionManager: DatabaseConnectionManager;
    private auditLogs: SecurityAuditLog[] = [];
    private securityPolicies: SecurityPolicy[] = [];
    private dataMaskingRules: DataMaskingRule[] = [];
    private encryptionKeys: EncryptionKey[] = [];
    private masterKey: string;
    private outputChannel: vscode.OutputChannel;

    constructor(connectionManager: DatabaseConnectionManager) {
        this.connectionManager = connectionManager;
        this.outputChannel = vscode.window.createOutputChannel('Security Manager');
        this.masterKey = this.getOrCreateMasterKey();
        this.loadSecurityData();
    }

    /**
     * Log security event
     */
    async logSecurityEvent(
        connectionId: string,
        action: SecurityAuditLog['action'],
        details: Partial<SecurityAuditLog['details']>,
        metadata?: Record<string, any>
    ): Promise<string> {
        const log: SecurityAuditLog = {
            id: this.generateId(),
            timestamp: new Date(),
            connectionId,
            action,
            details: {
                success: true,
                riskLevel: 'low',
                ...details
            },
            metadata
        };

        // Evaluate security policies
        const violations = await this.evaluateSecurityPolicies(log);
        if (violations.length > 0) {
            log.details.riskLevel = this.getHighestRiskLevel(violations);
            await this.executeSecurityActions(violations, log);
        }

        this.auditLogs.push(log);
        await this.saveAuditLogs();

        // Keep only last 10000 logs
        if (this.auditLogs.length > 10000) {
            this.auditLogs = this.auditLogs.slice(-10000);
        }

        return log.id;
    }

    /**
     * Encrypt sensitive data
     */
    encrypt(data: string, keyId?: string): string {
        try {
            const key = keyId ? this.getEncryptionKey(keyId) : this.getDefaultEncryptionKey();
            if (!key) {
                throw new Error('Encryption key not found');
            }

            const algorithm = key.algorithm;
            const keyBuffer = Buffer.from(key.key, 'hex');
            const iv = crypto.randomBytes(16);
            const cipher = crypto.createCipher(algorithm, keyBuffer);
            
            let encrypted = cipher.update(data, 'utf8', 'hex');
            encrypted += cipher.final('hex');
            
            return iv.toString('hex') + ':' + encrypted;
        } catch (error) {
            this.outputChannel.appendLine(`Encryption failed: ${error instanceof Error ? error.message : String(error)}`);
            throw new Error(`Encryption failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Decrypt sensitive data
     */
    decrypt(encryptedData: string, keyId?: string): string {
        try {
            const key = keyId ? this.getEncryptionKey(keyId) : this.getDefaultEncryptionKey();
            if (!key) {
                throw new Error('Decryption key not found');
            }

            const [ivHex, encrypted] = encryptedData.split(':');
            const iv = Buffer.from(ivHex, 'hex');
            const keyBuffer = Buffer.from(key.key, 'hex');
            const decipher = crypto.createDecipher(key.algorithm, keyBuffer);
            
            let decrypted = decipher.update(encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            
            return decrypted;
        } catch (error) {
            this.outputChannel.appendLine(`Decryption failed: ${error instanceof Error ? error.message : String(error)}`);
            throw new Error(`Decryption failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Hash password
     */
    hashPassword(password: string, salt?: string): { hash: string; salt: string } {
        const actualSalt = salt || crypto.randomBytes(32).toString('hex');
        const hash = crypto.pbkdf2Sync(password, actualSalt, 100000, 64, 'sha512').toString('hex');
        return { hash, salt: actualSalt };
    }

    /**
     * Verify password
     */
    verifyPassword(password: string, hash: string, salt: string): boolean {
        const computedHash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
        return computedHash === hash;
    }

    /**
     * Mask sensitive data
     */
    maskData(data: any, table: string, column: string): any {
        const rule = this.getDataMaskingRule(table, column);
        if (!rule || !rule.enabled) {
            return data;
        }

        if (typeof data !== 'string') {
            return data;
        }

        switch (rule.maskingType) {
            case 'full':
                return '*'.repeat(data.length);
            case 'partial':
                const visibleChars = rule.parameters.visibleChars || 4;
                const maskChar = rule.parameters.maskChar || '*';
                if (data.length <= visibleChars) {
                    return maskChar.repeat(data.length);
                }
                return data.substring(0, visibleChars) + maskChar.repeat(data.length - visibleChars);
            case 'hash':
                const algorithm = rule.parameters.hashAlgorithm || 'sha256';
                return crypto.createHash(algorithm).update(data).digest('hex');
            case 'encrypt':
                return this.encrypt(data);
            case 'null':
                return null;
            default:
                return data;
        }
    }

    /**
     * Check if query contains sensitive operations
     */
    analyzeQuerySecurity(query: string): {
        riskLevel: 'low' | 'medium' | 'high' | 'critical';
        warnings: string[];
        sensitiveOperations: string[];
    } {
        const warnings: string[] = [];
        const sensitiveOperations: string[] = [];
        let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';

        const queryLower = query.toLowerCase();

        // Check for DROP operations
        if (queryLower.includes('drop')) {
            sensitiveOperations.push('DROP');
            warnings.push('DROP operation detected - this can cause data loss');
            riskLevel = 'critical';
        }

        // Check for DELETE without WHERE
        if (queryLower.includes('delete from') && !queryLower.includes('where')) {
            sensitiveOperations.push('DELETE');
            warnings.push('DELETE without WHERE clause - this will affect all rows');
            riskLevel = 'critical';
        }

        // Check for UPDATE without WHERE
        if (queryLower.includes('update') && !queryLower.includes('where')) {
            sensitiveOperations.push('UPDATE');
            warnings.push('UPDATE without WHERE clause - this will affect all rows');
            riskLevel = 'high';
        }

        // Check for TRUNCATE
        if (queryLower.includes('truncate')) {
            sensitiveOperations.push('TRUNCATE');
            warnings.push('TRUNCATE operation detected - this will remove all data');
            riskLevel = 'critical';
        }

        // Check for ALTER TABLE
        if (queryLower.includes('alter table')) {
            sensitiveOperations.push('ALTER TABLE');
            warnings.push('Schema modification detected');
            riskLevel = 'high';
        }

        // Check for CREATE/DROP USER
        if (queryLower.includes('create user') || queryLower.includes('drop user')) {
            sensitiveOperations.push('USER MANAGEMENT');
            warnings.push('User management operation detected');
            riskLevel = 'high';
        }

        // Check for GRANT/REVOKE
        if (queryLower.includes('grant') || queryLower.includes('revoke')) {
            sensitiveOperations.push('PERMISSION MANAGEMENT');
            warnings.push('Permission management operation detected');
            riskLevel = 'high';
        }

        // Check for potential SQL injection patterns
        if (this.detectSQLInjection(query)) {
            warnings.push('Potential SQL injection pattern detected');
            riskLevel = 'critical';
        }

        return {
            riskLevel,
            warnings,
            sensitiveOperations
        };
    }

    /**
     * Create security policy
     */
    async createSecurityPolicy(policy: Omit<SecurityPolicy, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
        const id = this.generateId();
        const now = new Date();
        
        const newPolicy: SecurityPolicy = {
            ...policy,
            id,
            createdAt: now,
            updatedAt: now
        };

        this.securityPolicies.push(newPolicy);
        await this.saveSecurityPolicies();
        
        return id;
    }

    /**
     * Create data masking rule
     */
    async createDataMaskingRule(rule: Omit<DataMaskingRule, 'id'>): Promise<string> {
        const id = this.generateId();
        
        const newRule: DataMaskingRule = {
            ...rule,
            id
        };

        this.dataMaskingRules.push(newRule);
        await this.saveDataMaskingRules();
        
        return id;
    }

    /**
     * Create encryption key
     */
    async createEncryptionKey(key: Omit<EncryptionKey, 'id' | 'createdAt' | 'key'>): Promise<string> {
        const id = this.generateId();
        const now = new Date();
        
        // Generate new key
        const keyBuffer = crypto.randomBytes(32);
        const encryptedKey = this.encryptWithMasterKey(keyBuffer.toString('hex'));
        
        const newKey: EncryptionKey = {
            ...key,
            id,
            key: encryptedKey,
            createdAt: now
        };

        this.encryptionKeys.push(newKey);
        await this.saveEncryptionKeys();
        
        return id;
    }

    /**
     * Get security audit logs
     */
    getAuditLogs(filters: {
        connectionId?: string;
        action?: string;
        riskLevel?: string;
        dateRange?: { start: Date; end: Date };
        limit?: number;
    } = {}): SecurityAuditLog[] {
        let filtered = [...this.auditLogs];

        if (filters.connectionId) {
            filtered = filtered.filter(log => log.connectionId === filters.connectionId);
        }

        if (filters.action) {
            filtered = filtered.filter(log => log.action === filters.action);
        }

        if (filters.riskLevel) {
            filtered = filtered.filter(log => log.details.riskLevel === filters.riskLevel);
        }

        if (filters.dateRange) {
            filtered = filtered.filter(log => 
                log.timestamp >= filters.dateRange!.start && 
                log.timestamp <= filters.dateRange!.end
            );
        }

        // Sort by timestamp (most recent first)
        filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

        if (filters.limit) {
            filtered = filtered.slice(0, filters.limit);
        }

        return filtered;
    }

    /**
     * Get security statistics
     */
    getSecurityStatistics(): {
        totalEvents: number;
        eventsByRiskLevel: Record<string, number>;
        eventsByAction: Record<string, number>;
        topConnections: Array<{ connectionId: string; count: number }>;
        recentViolations: SecurityAuditLog[];
    } {
        const eventsByRiskLevel: Record<string, number> = {};
        const eventsByAction: Record<string, number> = {};
        const connectionCounts = new Map<string, number>();

        this.auditLogs.forEach(log => {
            // Count by risk level
            eventsByRiskLevel[log.details.riskLevel] = (eventsByRiskLevel[log.details.riskLevel] || 0) + 1;
            
            // Count by action
            eventsByAction[log.action] = (eventsByAction[log.action] || 0) + 1;
            
            // Count by connection
            connectionCounts.set(log.connectionId, (connectionCounts.get(log.connectionId) || 0) + 1);
        });

        const topConnections = Array.from(connectionCounts.entries())
            .map(([connectionId, count]) => ({ connectionId, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        const recentViolations = this.auditLogs
            .filter(log => log.details.riskLevel === 'high' || log.details.riskLevel === 'critical')
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
            .slice(0, 20);

        return {
            totalEvents: this.auditLogs.length,
            eventsByRiskLevel,
            eventsByAction,
            topConnections,
            recentViolations
        };
    }

    /**
     * Export security audit logs
     */
    exportAuditLogs(format: 'json' | 'csv'): string {
        if (format === 'json') {
            return JSON.stringify(this.auditLogs.map(log => ({
                ...log,
                timestamp: log.timestamp.toISOString()
            })), null, 2);
        } else {
            // CSV format
            const headers = [
                'ID', 'Timestamp', 'Connection ID', 'Action', 'Success', 'Risk Level',
                'Query', 'Table', 'Database', 'IP Address', 'Error'
            ];
            
            const rows = this.auditLogs.map(log => [
                log.id,
                log.timestamp.toISOString(),
                log.connectionId,
                log.action,
                log.details.success,
                log.details.riskLevel,
                log.details.query ? `"${log.details.query.replace(/"/g, '""')}"` : '',
                log.details.table || '',
                log.details.database || '',
                log.details.ipAddress || '',
                log.details.error || ''
            ]);

            return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
        }
    }

    // Private helper methods
    private detectSQLInjection(query: string): boolean {
        const patterns = [
            /union\s+select/i,
            /drop\s+table/i,
            /delete\s+from/i,
            /insert\s+into/i,
            /update\s+set/i,
            /exec\s*\(/i,
            /execute\s*\(/i,
            /script\s*>/i,
            /<script/i,
            /javascript:/i,
            /vbscript:/i,
            /onload\s*=/i,
            /onerror\s*=/i
        ];

        return patterns.some(pattern => pattern.test(query));
    }

    private async evaluateSecurityPolicies(log: SecurityAuditLog): Promise<SecurityRule[]> {
        const violations: SecurityRule[] = [];

        for (const policy of this.securityPolicies) {
            if (!policy.enabled) {continue;}

            for (const rule of policy.rules) {
                if (this.evaluateRule(rule, log)) {
                    violations.push(rule);
                }
            }
        }

        return violations;
    }

    private evaluateRule(rule: SecurityRule, log: SecurityAuditLog): boolean {
        switch (rule.type) {
            case 'query_pattern':
                return this.evaluateQueryPatternRule(rule, log);
            case 'data_access':
                return this.evaluateDataAccessRule(rule, log);
            case 'time_based':
                return this.evaluateTimeBasedRule(rule, log);
            case 'user_based':
                return this.evaluateUserBasedRule(rule, log);
            case 'ip_based':
                return this.evaluateIPBasedRule(rule, log);
            default:
                return false;
        }
    }

    private evaluateQueryPatternRule(rule: SecurityRule, log: SecurityAuditLog): boolean {
        if (!log.details.query) {return false;}
        
        const pattern = new RegExp(rule.condition, 'i');
        return pattern.test(log.details.query);
    }

    private evaluateDataAccessRule(rule: SecurityRule, log: SecurityAuditLog): boolean {
        const table = rule.parameters.table;
        const column = rule.parameters.column;
        
        if (table && log.details.table !== table) {return false;}
        if (column && log.details.query && !log.details.query.toLowerCase().includes(column.toLowerCase())) {return false;}
        
        return true;
    }

    private evaluateTimeBasedRule(rule: SecurityRule, log: SecurityAuditLog): boolean {
        const startTime = rule.parameters.startTime;
        const endTime = rule.parameters.endTime;
        const dayOfWeek = rule.parameters.dayOfWeek;
        
        const logTime = log.timestamp;
        const logHour = logTime.getHours();
        const logDay = logTime.getDay();
        
        if (startTime && endTime) {
            if (logHour < startTime || logHour > endTime) {return true;}
        }
        
        if (dayOfWeek && dayOfWeek.includes(logDay)) {return true;}
        
        return false;
    }

    private evaluateUserBasedRule(rule: SecurityRule, log: SecurityAuditLog): boolean {
        const allowedUsers = rule.parameters.allowedUsers;
        const blockedUsers = rule.parameters.blockedUsers;
        
        if (allowedUsers && !allowedUsers.includes(log.userId)) {return true;}
        if (blockedUsers && blockedUsers.includes(log.userId)) {return true;}
        
        return false;
    }

    private evaluateIPBasedRule(rule: SecurityRule, log: SecurityAuditLog): boolean {
        const allowedIPs = rule.parameters.allowedIPs;
        const blockedIPs = rule.parameters.blockedIPs;
        const logIP = log.details.ipAddress;
        
        if (!logIP) {return false;}
        
        if (allowedIPs && !this.isIPInRange(logIP, allowedIPs)) {return true;}
        if (blockedIPs && this.isIPInRange(logIP, blockedIPs)) {return true;}
        
        return false;
    }

    private isIPInRange(ip: string, ranges: string[]): boolean {
        return ranges.some(range => {
            if (range.includes('/')) {
                // CIDR notation
                return this.isIPInCIDR(ip, range);
            } else if (range.includes('-')) {
                // IP range
                const [start, end] = range.split('-');
                return this.isIPBetween(ip, start.trim(), end.trim());
            } else {
                // Single IP
                return ip === range;
            }
        });
    }

    private isIPInCIDR(ip: string, cidr: string): boolean {
        // Simplified CIDR check - in production, use a proper IP library
        const [network, prefixLength] = cidr.split('/');
        return ip.startsWith(network.split('.').slice(0, parseInt(prefixLength) / 8).join('.'));
    }

    private isIPBetween(ip: string, startIP: string, endIP: string): boolean {
        // Simple IP range check implementation
        const ipToNumber = (ipStr: string) => {
            return ipStr.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet), 0) >>> 0;
        };

        const ipNum = ipToNumber(ip);
        const startNum = ipToNumber(startIP);
        const endNum = ipToNumber(endIP);

        return ipNum >= startNum && ipNum <= endNum;
    }

    private getHighestRiskLevel(violations: SecurityRule[]): 'low' | 'medium' | 'high' | 'critical' {
        const levels = ['low', 'medium', 'high', 'critical'];
        let highestIndex = 0;
        
        violations.forEach(violation => {
            const index = levels.indexOf(violation.severity);
            if (index > highestIndex) {
                highestIndex = index;
            }
        });
        
        return levels[highestIndex] as 'low' | 'medium' | 'high' | 'critical';
    }

    private async executeSecurityActions(violations: SecurityRule[], log: SecurityAuditLog): Promise<void> {
        for (const violation of violations) {
            const policy = this.securityPolicies.find(p => p.rules.some(r => r.id === violation.id));
            if (!policy) {continue;}

            for (const action of policy.actions) {
                await this.executeAction(action, log, violation);
            }
        }
    }

    private async executeAction(action: SecurityAction, log: SecurityAuditLog, violation: SecurityRule): Promise<void> {
        switch (action.type) {
            case 'block':
                log.details.success = false;
                log.details.error = `Blocked by security policy: ${violation.id}`;
                break;
            case 'warn':
                vscode.window.showWarningMessage(`Security warning: ${violation.id}`);
                break;
            case 'log':
                this.outputChannel.appendLine(`Security violation: ${violation.id} - ${log.id}`);
                break;
            case 'notify':
                // In production, this would send notifications
                this.outputChannel.appendLine(`Security notification: ${violation.id}`);
                break;
            case 'require_approval':
                // In production, this would require approval workflow
                this.outputChannel.appendLine(`Approval required: ${violation.id}`);
                break;
        }
    }

    private getDataMaskingRule(table: string, column: string): DataMaskingRule | undefined {
        return this.dataMaskingRules.find(rule => 
            rule.enabled && 
            rule.table === table && 
            rule.column === column
        );
    }

    private getEncryptionKey(keyId: string): EncryptionKey | undefined {
        return this.encryptionKeys.find(key => key.id === keyId);
    }

    private getDefaultEncryptionKey(): EncryptionKey | undefined {
        return this.encryptionKeys.find(key => key.usage.includes('default'));
    }

    private getOrCreateMasterKey(): string {
        const config = vscode.workspace.getConfiguration('ultimatedb.security');
        let masterKey = config.get<string>('masterKey');
        
        if (!masterKey) {
            masterKey = crypto.randomBytes(32).toString('hex');
            config.update('masterKey', masterKey, vscode.ConfigurationTarget.Global);
        }
        
        return masterKey;
    }

    private encryptWithMasterKey(data: string): string {
        const cipher = crypto.createCipher('aes-256-cbc', this.masterKey);
        let encrypted = cipher.update(data, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        return encrypted;
    }

    private decryptWithMasterKey(encryptedData: string): string {
        const decipher = crypto.createDecipher('aes-256-cbc', this.masterKey);
        let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    }

    private generateId(): string {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    private async loadSecurityData(): Promise<void> {
        try {
            const config = vscode.workspace.getConfiguration('ultimatedb.security');
            
            // Load audit logs
            const auditLogsData = config.get<any[]>('auditLogs', []);
            this.auditLogs = auditLogsData.map(log => ({
                ...log,
                timestamp: new Date(log.timestamp)
            }));

            // Load security policies
            this.securityPolicies = config.get<SecurityPolicy[]>('policies', []);

            // Load data masking rules
            this.dataMaskingRules = config.get<DataMaskingRule[]>('dataMaskingRules', []);

            // Load encryption keys
            const encryptionKeysData = config.get<any[]>('encryptionKeys', []);
            this.encryptionKeys = encryptionKeysData.map(key => ({
                ...key,
                createdAt: new Date(key.createdAt),
                expiresAt: key.expiresAt ? new Date(key.expiresAt) : undefined
            }));
        } catch (error) {
            console.error('Failed to load security data:', error);
        }
    }

    private async saveAuditLogs(): Promise<void> {
        try {
            const config = vscode.workspace.getConfiguration('ultimatedb.security');
            await config.update('auditLogs', this.auditLogs, vscode.ConfigurationTarget.Global);
        } catch (error) {
            console.error('Failed to save audit logs:', error);
        }
    }

    private async saveSecurityPolicies(): Promise<void> {
        try {
            const config = vscode.workspace.getConfiguration('ultimatedb.security');
            await config.update('policies', this.securityPolicies, vscode.ConfigurationTarget.Global);
        } catch (error) {
            console.error('Failed to save security policies:', error);
        }
    }

    private async saveDataMaskingRules(): Promise<void> {
        try {
            const config = vscode.workspace.getConfiguration('ultimatedb.security');
            await config.update('dataMaskingRules', this.dataMaskingRules, vscode.ConfigurationTarget.Global);
        } catch (error) {
            console.error('Failed to save data masking rules:', error);
        }
    }

    private async saveEncryptionKeys(): Promise<void> {
        try {
            const config = vscode.workspace.getConfiguration('ultimatedb.security');
            await config.update('encryptionKeys', this.encryptionKeys, vscode.ConfigurationTarget.Global);
        } catch (error) {
            console.error('Failed to save encryption keys:', error);
        }
    }

    /**
     * Dispose resources
     */
    dispose(): void {
        this.outputChannel.dispose();
    }
}
