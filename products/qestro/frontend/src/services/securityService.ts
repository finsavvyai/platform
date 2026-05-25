/**
 * Security Service
 * Frontend API client for the Security Center module
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3020';

export interface SecurityScan {
    id: string;
    projectId: string;
    target: string;
    scanType: ScanType;
    status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
    startTime: Date;
    endTime?: Date;
    findings: SecurityFinding[];
    summary: ScanSummary;
}

export type ScanType = 'full' | 'owasp-top-10' | 'sql-injection' | 'xss' | 'auth' | 'headers' | 'dependencies';

export interface SecurityFinding {
    id: string;
    severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
    category: string;
    title: string;
    description: string;
    location?: string;
    remediation?: string;
    cweId?: string;
    cvssScore?: number;
    falsePositive: boolean;
    status: 'open' | 'resolved' | 'ignored' | 'in-progress';
}

export interface ScanSummary {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
    totalFindings: number;
    riskScore: number;
    duration: number;
}

export interface OWASPCategory {
    id: string;
    name: string;
    score: number;
    status: 'pass' | 'warning' | 'fail';
}

export interface OWASPStatus {
    categories: OWASPCategory[];
    overallScore: number;
    passCount: number;
    warningCount: number;
    failCount: number;
}

export interface ComplianceFramework {
    id: string;
    name: string;
    version: string;
    overallScore: number;
    controlCount: number;
    compliantCount: number;
    lastAssessed: Date;
}

export interface ComplianceControl {
    id: string;
    category: string;
    name: string;
    description: string;
    status: 'compliant' | 'non-compliant' | 'partial' | 'not-applicable';
    evidence: string[];
    lastChecked: Date;
    remediationSteps?: string[];
}

export interface ComplianceFrameworkDetail extends ComplianceFramework {
    controls: ComplianceControl[];
}

const getAuthHeader = (): HeadersInit => {
    const token = localStorage.getItem('authToken');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
};

export const securityService = {
    // Scans
    async getScans(projectId?: string, limit = 20): Promise<SecurityScan[]> {
        const params = new URLSearchParams({ limit: String(limit) });
        if (projectId) params.set('projectId', projectId);
        const res = await fetch(`${API_BASE}/api/security/scans?${params}`, {
            headers: getAuthHeader()
        });
        const data = await res.json();
        return data.data || [];
    },

    async startScan(target: string, scanType: ScanType = 'full', projectId?: string): Promise<SecurityScan> {
        const res = await fetch(`${API_BASE}/api/security/scans`, {
            method: 'POST',
            headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ target, scanType, projectId })
        });
        const data = await res.json();
        return data.data;
    },

    async getScan(id: string): Promise<SecurityScan> {
        const res = await fetch(`${API_BASE}/api/security/scans/${id}`, {
            headers: getAuthHeader()
        });
        const data = await res.json();
        return data.data;
    },

    async cancelScan(id: string): Promise<void> {
        await fetch(`${API_BASE}/api/security/scans/${id}`, {
            method: 'DELETE',
            headers: getAuthHeader()
        });
    },

    // OWASP
    async getOWASPStatus(projectId?: string): Promise<OWASPStatus> {
        const params = projectId ? `?projectId=${projectId}` : '';
        const res = await fetch(`${API_BASE}/api/security/owasp${params}`, {
            headers: getAuthHeader()
        });
        const data = await res.json();
        return data.data;
    },

    // Compliance
    async getComplianceFrameworks(): Promise<ComplianceFramework[]> {
        const res = await fetch(`${API_BASE}/api/security/compliance`, {
            headers: getAuthHeader()
        });
        const data = await res.json();
        return data.data || [];
    },

    async getComplianceFramework(frameworkId: string): Promise<ComplianceFrameworkDetail> {
        const res = await fetch(`${API_BASE}/api/security/compliance/${frameworkId}`, {
            headers: getAuthHeader()
        });
        const data = await res.json();
        return data.data;
    },

    async updateControl(frameworkId: string, controlId: string, updates: {
        status?: string;
        evidence?: string[];
        remediationSteps?: string[];
    }): Promise<ComplianceControl> {
        const res = await fetch(`${API_BASE}/api/security/compliance/${frameworkId}/controls/${controlId}`, {
            method: 'PUT',
            headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
        });
        const data = await res.json();
        return data.data;
    },

    async runAssessment(frameworkId: string): Promise<ComplianceFrameworkDetail> {
        const res = await fetch(`${API_BASE}/api/security/compliance/${frameworkId}/assess`, {
            method: 'POST',
            headers: getAuthHeader()
        });
        const data = await res.json();
        return data.data;
    },

    async getComplianceReport(frameworkId: string): Promise<unknown> {
        const res = await fetch(`${API_BASE}/api/security/compliance/${frameworkId}/report`, {
            headers: getAuthHeader()
        });
        const data = await res.json();
        return data.data;
    }
};

export default securityService;
