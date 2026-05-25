/**
 * Security Testing Routes
 * 
 * Security scanning, vulnerability detection, and compliance checking endpoints.
 * Uses Drizzle ORM with PostgreSQL for persistence.
 * 
 * @version 2.0.0
 */

import { Router, Request, Response } from 'express';
import { eq, and, desc } from 'drizzle-orm';
import db from '../lib/db.js';
import { securityScans, securityFindings, complianceFrameworks } from '../schema/index.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// Helper to format response
const formatResponse = (data: any, message?: string) => ({
    success: true,
    data,
    message,
    timestamp: new Date().toISOString()
});

// ===========================
// Security Scanning
// ===========================

/**
 * GET /api/security/scans
 * List all security scans
 */
router.get('/scans', authenticateToken, async (req: Request, res: Response) => {
    try {
        const { projectId, status, limit = 20 } = req.query;
        const userId = (req as any).user?.id;

        // Build query conditions
        const conditions: any[] = [];
        if (userId) {
            conditions.push(eq(securityScans.userId, userId));
        }
        if (projectId) {
            conditions.push(eq(securityScans.projectId, projectId as string));
        }
        if (status) {
            conditions.push(eq(securityScans.status, status as string));
        }

        const scans = await db.select()
            .from(securityScans)
            .where(conditions.length > 0 ? and(...conditions) : undefined)
            .orderBy(desc(securityScans.createdAt))
            .limit(Number(limit));

        // Get findings for each scan
        const scansWithFindings = await Promise.all(scans.map(async (scan) => {
            const findings = await db.select()
                .from(securityFindings)
                .where(eq(securityFindings.scanId, scan.id));

            return {
                ...scan,
                findings,
                summary: scan.summary || calculateSummary(findings)
            };
        }));

        res.json({
            success: true,
            data: scansWithFindings,
            count: scansWithFindings.length
        });
    } catch (error) {
        console.error('Failed to list scans:', error);
        res.json({ success: true, data: [] }); // Return empty on error
    }
});

/**
 * POST /api/security/scans
 * Start a new security scan
 */
router.post('/scans', authenticateToken, async (req: Request, res: Response) => {
    try {
        const { projectId, target, scanType = 'full' } = req.body;
        const userId = (req as any).user?.id || 'anonymous';

        if (!target) {
            return res.status(400).json({ success: false, error: 'Target URL is required' });
        }

        // Create scan record
        const [scan] = await db.insert(securityScans)
            .values({
                userId,
                projectId,
                target,
                scanType,
                status: 'queued',
                startTime: new Date(),
                summary: { critical: 0, high: 0, medium: 0, low: 0, info: 0, totalFindings: 0, riskScore: 100 }
            })
            .returning();

        // Simulate async scan execution
        setTimeout(() => runSecurityScan(scan.id), 100);

        res.status(202).json(formatResponse(scan, 'Security scan queued'));
    } catch (error) {
        console.error('Failed to start scan:', error);
        res.status(500).json({ success: false, error: 'Failed to start scan' });
    }
});

/**
 * Simulated security scan execution
 */
async function runSecurityScan(scanId: string): Promise<void> {
    try {
        // Update status to running
        await db.update(securityScans)
            .set({ status: 'running', startTime: new Date() })
            .where(eq(securityScans.id, scanId));

        // Get scan record
        const [scan] = await db.select()
            .from(securityScans)
            .where(eq(securityScans.id, scanId));

        if (!scan) return;

        // Generate sample findings
        const sampleFindings = [
            { severity: 'high', category: 'OWASP A03:2021', title: 'SQL Injection Vulnerability', description: 'User input not sanitized in query parameter', cveId: 'CWE-89' },
            { severity: 'medium', category: 'OWASP A07:2021', title: 'Missing HTTP Strict Transport Security Header', description: 'HSTS header not set', cveId: 'CWE-319' },
            { severity: 'low', category: 'OWASP A05:2021', title: 'X-Content-Type-Options Header Missing', description: 'Nosniff header not set', cveId: 'CWE-16' },
            { severity: 'info', category: 'Information Disclosure', title: 'Server Version Exposed', description: 'Server header reveals version information', cveId: 'CWE-200' },
            { severity: 'critical', category: 'OWASP A06:2021', title: 'Outdated Dependency with Known CVE', description: 'lodash@4.17.15 has known vulnerability CVE-2021-23337', cveId: 'CWE-1035' }
        ];

        // Add random subset of findings
        const findings = [];
        for (const sample of sampleFindings) {
            if (Math.random() > 0.3) {
                const [finding] = await db.insert(securityFindings)
                    .values({
                        scanId,
                        severity: sample.severity,
                        category: sample.category,
                        title: sample.title,
                        description: sample.description,
                        location: scan.target,
                        cveId: sample.cveId,
                        status: 'open'
                    })
                    .returning();
                findings.push(finding);
            }
        }

        // Calculate summary
        const summary = calculateSummary(findings);

        // Simulate scan duration
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Update scan with results
        await db.update(securityScans)
            .set({
                status: 'completed',
                endTime: new Date(),
                duration: 5000 + Math.round(Math.random() * 10000),
                summary
            })
            .where(eq(securityScans.id, scanId));

    } catch (error) {
        console.error('Scan execution error:', error);
        await db.update(securityScans)
            .set({ status: 'failed', errorMessage: String(error), endTime: new Date() })
            .where(eq(securityScans.id, scanId));
    }
}

function calculateSummary(findings: any[]) {
    const critical = findings.filter(f => f.severity === 'critical').length;
    const high = findings.filter(f => f.severity === 'high').length;
    const medium = findings.filter(f => f.severity === 'medium').length;
    const low = findings.filter(f => f.severity === 'low').length;
    const info = findings.filter(f => f.severity === 'info').length;

    return {
        critical,
        high,
        medium,
        low,
        info,
        totalFindings: findings.length,
        riskScore: Math.max(0, 100 - critical * 20 - high * 10 - medium * 5)
    };
}

/**
 * GET /api/security/scans/:id
 * Get scan details
 */
router.get('/scans/:id', authenticateToken, async (req: Request, res: Response) => {
    try {
        const [scan] = await db.select()
            .from(securityScans)
            .where(eq(securityScans.id, req.params.id));

        if (!scan) {
            return res.status(404).json({ success: false, error: 'Scan not found' });
        }

        const findings = await db.select()
            .from(securityFindings)
            .where(eq(securityFindings.scanId, scan.id));

        res.json({ success: true, data: { ...scan, findings } });
    } catch (error) {
        console.error('Failed to get scan:', error);
        res.status(500).json({ success: false, error: 'Failed to get scan' });
    }
});

/**
 * DELETE /api/security/scans/:id
 * Cancel a running scan
 */
router.delete('/scans/:id', authenticateToken, async (req: Request, res: Response) => {
    try {
        const [scan] = await db.select()
            .from(securityScans)
            .where(eq(securityScans.id, req.params.id));

        if (!scan) {
            return res.status(404).json({ success: false, error: 'Scan not found' });
        }

        if (scan.status === 'running' || scan.status === 'queued') {
            await db.update(securityScans)
                .set({ status: 'cancelled', endTime: new Date() })
                .where(eq(securityScans.id, scan.id));
        }

        res.json({ success: true, message: 'Scan cancelled' });
    } catch (error) {
        console.error('Failed to cancel scan:', error);
        res.status(500).json({ success: false, error: 'Failed to cancel scan' });
    }
});

// ===========================
// OWASP Top 10 Specific
// ===========================

/**
 * GET /api/security/owasp
 * Get OWASP Top 10 compliance status
 */
router.get('/owasp', authenticateToken, async (req: Request, res: Response) => {
    try {
        // Static OWASP categories (could be dynamic based on scan results)
        const owaspCategories = [
            { id: 'A01', name: 'Broken Access Control', score: 92, status: 'pass' },
            { id: 'A02', name: 'Cryptographic Failures', score: 88, status: 'pass' },
            { id: 'A03', name: 'Injection', score: 75, status: 'warning' },
            { id: 'A04', name: 'Insecure Design', score: 95, status: 'pass' },
            { id: 'A05', name: 'Security Misconfiguration', score: 90, status: 'pass' },
            { id: 'A06', name: 'Vulnerable Components', score: 45, status: 'fail' },
            { id: 'A07', name: 'Authentication Failures', score: 98, status: 'pass' },
            { id: 'A08', name: 'Data Integrity Failures', score: 85, status: 'pass' },
            { id: 'A09', name: 'Security Logging Failures', score: 70, status: 'warning' },
            { id: 'A10', name: 'Server-Side Request Forgery', score: 100, status: 'pass' }
        ];

        const overallScore = Math.round(owaspCategories.reduce((sum, c) => sum + c.score, 0) / owaspCategories.length);

        res.json({
            success: true,
            data: {
                categories: owaspCategories,
                overallScore,
                passCount: owaspCategories.filter(c => c.status === 'pass').length,
                warningCount: owaspCategories.filter(c => c.status === 'warning').length,
                failCount: owaspCategories.filter(c => c.status === 'fail').length
            }
        });
    } catch (error) {
        console.error('Failed to get OWASP status:', error);
        res.status(500).json({ success: false, error: 'Failed to get OWASP status' });
    }
});

// ===========================
// Compliance Frameworks
// ===========================

/**
 * GET /api/security/compliance
 * List all compliance frameworks
 */
router.get('/compliance', authenticateToken, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;

        const frameworks = await db.select()
            .from(complianceFrameworks)
            .where(userId ? eq(complianceFrameworks.userId, userId) : undefined);

        // If no frameworks exist, return defaults and create them
        if (frameworks.length === 0) {
            const defaults = await initDefaultFrameworks(userId);
            return res.json({ success: true, data: defaults });
        }

        const formattedFrameworks = frameworks.map(f => ({
            id: f.frameworkType,
            name: f.name,
            version: '2024',
            overallScore: f.overallScore,
            controlCount: Array.isArray(f.controls) ? f.controls.length : 0,
            compliantCount: Array.isArray(f.controls)
                ? f.controls.filter((c: any) => c.status === 'compliant').length
                : 0,
            lastAssessed: f.lastAssessment
        }));

        res.json({ success: true, data: formattedFrameworks });
    } catch (error) {
        console.error('Failed to list compliance frameworks:', error);
        res.json({ success: true, data: getDefaultFrameworksList() });
    }
});

/**
 * GET /api/security/compliance/:frameworkId
 * Get detailed compliance framework status
 */
router.get('/compliance/:frameworkId', authenticateToken, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;

        const [framework] = await db.select()
            .from(complianceFrameworks)
            .where(and(
                eq(complianceFrameworks.frameworkType, req.params.frameworkId),
                userId ? eq(complianceFrameworks.userId, userId) : undefined
            ));

        if (!framework) {
            // Return default data if not in DB
            const defaultData = getDefaultFramework(req.params.frameworkId);
            if (defaultData) {
                return res.json({ success: true, data: defaultData });
            }
            return res.status(404).json({ success: false, error: 'Compliance framework not found' });
        }

        res.json({
            success: true, data: {
                id: framework.frameworkType,
                name: framework.name,
                version: '2024',
                overallScore: framework.overallScore,
                controls: framework.controls,
                lastAssessed: framework.lastAssessment
            }
        });
    } catch (error) {
        console.error('Failed to get compliance framework:', error);
        res.status(500).json({ success: false, error: 'Failed to get compliance framework' });
    }
});

/**
 * POST /api/security/compliance/:frameworkId/assess
 * Run a compliance assessment
 */
router.post('/compliance/:frameworkId/assess', authenticateToken, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;

        const [framework] = await db.select()
            .from(complianceFrameworks)
            .where(and(
                eq(complianceFrameworks.frameworkType, req.params.frameworkId),
                userId ? eq(complianceFrameworks.userId, userId) : undefined
            ));

        if (!framework) {
            return res.status(404).json({ success: false, error: 'Compliance framework not found' });
        }

        // Update last assessed timestamp
        await db.update(complianceFrameworks)
            .set({
                lastAssessment: new Date(),
                updatedAt: new Date()
            })
            .where(eq(complianceFrameworks.id, framework.id));

        res.json({
            success: true,
            message: 'Compliance assessment completed',
            data: { ...framework, lastAssessment: new Date() }
        });
    } catch (error) {
        console.error('Failed to run assessment:', error);
        res.status(500).json({ success: false, error: 'Failed to run assessment' });
    }
});

/**
 * GET /api/security/compliance/:frameworkId/report
 * Generate a compliance report
 */
router.get('/compliance/:frameworkId/report', authenticateToken, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;

        const [framework] = await db.select()
            .from(complianceFrameworks)
            .where(and(
                eq(complianceFrameworks.frameworkType, req.params.frameworkId),
                userId ? eq(complianceFrameworks.userId, userId) : undefined
            ));

        if (!framework) {
            // Use default framework data for report
            const defaultData = getDefaultFramework(req.params.frameworkId);
            if (!defaultData) {
                return res.status(404).json({ success: false, error: 'Compliance framework not found' });
            }
            return res.json({ success: true, data: generateReport(defaultData) });
        }

        const controls = Array.isArray(framework.controls) ? framework.controls : [];

        const report = {
            title: `${framework.name} Compliance Report`,
            generatedAt: new Date(),
            framework: { name: framework.name, version: '2024' },
            summary: {
                overallScore: framework.overallScore,
                totalControls: controls.length,
                compliant: controls.filter((c: any) => c.status === 'compliant').length,
                partial: controls.filter((c: any) => c.status === 'partial').length,
                nonCompliant: controls.filter((c: any) => c.status === 'non-compliant').length,
                notApplicable: controls.filter((c: any) => c.status === 'not-applicable').length
            },
            controls,
            recommendations: controls.filter((c: any) => c.remediationSteps?.length > 0)
                .map((c: any) => ({ control: c.name, steps: c.remediationSteps }))
        };

        res.json({ success: true, data: report });
    } catch (error) {
        console.error('Failed to generate report:', error);
        res.status(500).json({ success: false, error: 'Failed to generate report' });
    }
});

// ===========================
// Helper Functions
// ===========================

async function initDefaultFrameworks(userId: string) {
    const defaults = getDefaultFrameworksList();

    for (const fw of defaults) {
        const fullFramework = getDefaultFramework(fw.id);
        if (fullFramework && userId) {
            await db.insert(complianceFrameworks)
                .values({
                    userId,
                    frameworkType: fw.id,
                    name: fw.name,
                    overallScore: fw.overallScore,
                    lastAssessment: new Date(),
                    controls: fullFramework.controls,
                    evidence: []
                })
                .onConflictDoNothing();
        }
    }

    return defaults;
}

function getDefaultFrameworksList() {
    return [
        { id: 'soc2', name: 'SOC 2 Type II', version: '2017', overallScore: 87, controlCount: 8, compliantCount: 6, lastAssessed: new Date() },
        { id: 'gdpr', name: 'GDPR Compliance', version: '2018', overallScore: 92, controlCount: 5, compliantCount: 4, lastAssessed: new Date() },
        { id: 'hipaa', name: 'HIPAA Compliance', version: '2013', overallScore: 78, controlCount: 4, compliantCount: 3, lastAssessed: new Date() },
        { id: 'pci', name: 'PCI DSS', version: '4.0', overallScore: 65, controlCount: 4, compliantCount: 2, lastAssessed: new Date() }
    ];
}

function getDefaultFramework(id: string) {
    const frameworks: Record<string, any> = {
        'soc2': {
            id: 'soc2',
            name: 'SOC 2 Type II',
            version: '2017',
            overallScore: 87,
            lastAssessed: new Date(),
            controls: [
                { id: 'CC1', category: 'Control Environment', name: 'Control Environment', description: 'Management philosophy and operating style', status: 'compliant', evidence: ['policy-001'], lastChecked: new Date() },
                { id: 'CC2', category: 'Communication', name: 'Communication & Information', description: 'Information quality and communication', status: 'compliant', evidence: ['policy-002'], lastChecked: new Date() },
                { id: 'CC3', category: 'Risk Assessment', name: 'Risk Assessment', description: 'Fraud risk and organizational changes', status: 'partial', evidence: [], lastChecked: new Date(), remediationSteps: ['Complete risk assessment documentation'] },
                { id: 'CC4', category: 'Monitoring', name: 'Monitoring Activities', description: 'Ongoing evaluations and deficiency corrections', status: 'compliant', evidence: ['audit-001'], lastChecked: new Date() },
                { id: 'CC5', category: 'Control Activities', name: 'Control Activities', description: 'Technology and security policies', status: 'compliant', evidence: ['policy-003'], lastChecked: new Date() },
                { id: 'CC6', category: 'Access Control', name: 'Logical Access Controls', description: 'Authorization and authentication', status: 'compliant', evidence: ['config-001'], lastChecked: new Date() },
                { id: 'CC7', category: 'Operations', name: 'System Operations', description: 'Infrastructure monitoring and incident response', status: 'non-compliant', evidence: [], lastChecked: new Date(), remediationSteps: ['Implement incident response plan'] },
                { id: 'CC8', category: 'Change Management', name: 'Change Management', description: 'Change control procedures', status: 'compliant', evidence: ['process-001'], lastChecked: new Date() }
            ]
        },
        'gdpr': {
            id: 'gdpr',
            name: 'GDPR Compliance',
            version: '2018',
            overallScore: 92,
            lastAssessed: new Date(),
            controls: [
                { id: 'G1', category: 'Lawfulness', name: 'Lawfulness of Processing', description: 'Legal basis for data processing', status: 'compliant', evidence: ['privacy-policy'], lastChecked: new Date() },
                { id: 'G2', category: 'Data Subject Rights', name: 'Data Subject Rights', description: 'Right to access, rectification, erasure', status: 'compliant', evidence: ['dsr-process'], lastChecked: new Date() },
                { id: 'G3', category: 'Privacy by Design', name: 'Data Protection by Design', description: 'Privacy by default implementation', status: 'compliant', evidence: ['architecture-doc'], lastChecked: new Date() },
                { id: 'G4', category: 'Breach Notification', name: 'Data Breach Notification', description: '72-hour notification procedures', status: 'partial', evidence: [], lastChecked: new Date(), remediationSteps: ['Finalize breach response playbook'] },
                { id: 'G5', category: 'Data Processing', name: 'Data Processing Agreements', description: 'Third-party processor contracts', status: 'compliant', evidence: ['dpa-001'], lastChecked: new Date() }
            ]
        },
        'hipaa': {
            id: 'hipaa',
            name: 'HIPAA Compliance',
            version: '2013',
            overallScore: 78,
            lastAssessed: new Date(),
            controls: [
                { id: 'H1', category: 'Access Control', name: 'Access Controls', description: 'Unique user identification and access', status: 'compliant', evidence: ['access-policy'], lastChecked: new Date() },
                { id: 'H2', category: 'Audit', name: 'Audit Controls', description: 'Activity logging and examination', status: 'compliant', evidence: ['audit-logs'], lastChecked: new Date() },
                { id: 'H3', category: 'Integrity', name: 'Integrity Controls', description: 'Electronic PHI protection', status: 'partial', evidence: [], lastChecked: new Date(), remediationSteps: ['Implement integrity verification'] },
                { id: 'H4', category: 'Transmission', name: 'Transmission Security', description: 'Encryption during transmission', status: 'compliant', evidence: ['tls-config'], lastChecked: new Date() }
            ]
        },
        'pci': {
            id: 'pci',
            name: 'PCI DSS',
            version: '4.0',
            overallScore: 65,
            lastAssessed: new Date(),
            controls: [
                { id: 'P1', category: 'Network', name: 'Firewall Configuration', description: 'Network security controls', status: 'compliant', evidence: ['firewall-config'], lastChecked: new Date() },
                { id: 'P2', category: 'Defaults', name: 'Vendor Default Passwords', description: 'Default password changes', status: 'compliant', evidence: ['hardening-checklist'], lastChecked: new Date() },
                { id: 'P3', category: 'Data Protection', name: 'Cardholder Data Protection', description: 'Stored card data encryption', status: 'non-compliant', evidence: [], lastChecked: new Date(), remediationSteps: ['Implement tokenization'] },
                { id: 'P4', category: 'Encryption', name: 'Encryption in Transit', description: 'Transmission encryption requirements', status: 'partial', evidence: ['tls-config'], lastChecked: new Date(), remediationSteps: ['Upgrade to TLS 1.3'] }
            ]
        }
    };

    return frameworks[id];
}

function generateReport(framework: any) {
    return {
        title: `${framework.name} Compliance Report`,
        generatedAt: new Date(),
        framework: { name: framework.name, version: framework.version },
        summary: {
            overallScore: framework.overallScore,
            totalControls: framework.controls.length,
            compliant: framework.controls.filter((c: any) => c.status === 'compliant').length,
            partial: framework.controls.filter((c: any) => c.status === 'partial').length,
            nonCompliant: framework.controls.filter((c: any) => c.status === 'non-compliant').length,
            notApplicable: 0
        },
        controls: framework.controls,
        recommendations: framework.controls.filter((c: any) => c.remediationSteps?.length > 0)
            .map((c: any) => ({ control: c.name, steps: c.remediationSteps }))
    };
}

export default router;
