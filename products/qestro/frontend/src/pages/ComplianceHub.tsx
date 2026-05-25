import { useState, useEffect, useCallback } from 'react';
import {
    CheckSquare, FileText, Download, Clock, CheckCircle,
    XCircle, AlertTriangle, Shield, Building, ArrowRight
} from 'lucide-react';
import { Card, Button, Badge } from '../components/atoms';
import { motion } from 'framer-motion';
import securityService from '../services/securityService';

interface ComplianceControl {
    id: string;
    name: string;
    description: string;
    status: 'compliant' | 'non-compliant' | 'in-progress' | 'not-started';
    evidence: number;
    lastAssessed: string;
}

interface ComplianceFramework {
    id: string;
    name: string;
    shortName: string;
    color: string;
    progress: number;
    controls: ComplianceControl[];
}

// Fallback mock data when API is unavailable
const defaultFrameworks: ComplianceFramework[] = [
    {
        id: 'soc2',
        name: 'SOC 2 Type II',
        shortName: 'SOC 2',
        color: '#8B5CF6',
        progress: 87,
        controls: [
            { id: 'CC1', name: 'Control Environment', description: 'Management philosophy and operating style', status: 'compliant', evidence: 12, lastAssessed: '2 days ago' },
            { id: 'CC2', name: 'Communication & Information', description: 'Information quality and communication', status: 'compliant', evidence: 8, lastAssessed: '2 days ago' },
            { id: 'CC3', name: 'Risk Assessment', description: 'Fraud risk and organizational changes', status: 'in-progress', evidence: 5, lastAssessed: '5 days ago' },
            { id: 'CC4', name: 'Monitoring Activities', description: 'Ongoing evaluations and deficiency corrections', status: 'compliant', evidence: 15, lastAssessed: '1 day ago' },
            { id: 'CC5', name: 'Control Activities', description: 'Technology and security policies', status: 'compliant', evidence: 22, lastAssessed: '1 day ago' },
            { id: 'CC6', name: 'Logical Access Controls', description: 'Authorization and authentication', status: 'compliant', evidence: 18, lastAssessed: '3 hours ago' },
            { id: 'CC7', name: 'System Operations', description: 'Infrastructure monitoring and incident response', status: 'non-compliant', evidence: 3, lastAssessed: '1 week ago' },
            { id: 'CC8', name: 'Change Management', description: 'Change control procedures', status: 'compliant', evidence: 10, lastAssessed: '4 days ago' },
        ]
    },
    {
        id: 'gdpr',
        name: 'GDPR Compliance',
        shortName: 'GDPR',
        color: '#06B6D4',
        progress: 92,
        controls: [
            { id: 'G1', name: 'Lawfulness of Processing', description: 'Legal basis for data processing', status: 'compliant', evidence: 6, lastAssessed: '1 day ago' },
            { id: 'G2', name: 'Data Subject Rights', description: 'Right to access, rectification, erasure', status: 'compliant', evidence: 9, lastAssessed: '2 days ago' },
            { id: 'G3', name: 'Data Protection by Design', description: 'Privacy by default implementation', status: 'compliant', evidence: 11, lastAssessed: '3 days ago' },
            { id: 'G4', name: 'Data Breach Notification', description: '72-hour notification procedures', status: 'in-progress', evidence: 4, lastAssessed: '1 week ago' },
            { id: 'G5', name: 'Data Processing Agreements', description: 'Third-party processor contracts', status: 'compliant', evidence: 7, lastAssessed: '5 days ago' },
        ]
    },
    {
        id: 'hipaa',
        name: 'HIPAA Compliance',
        shortName: 'HIPAA',
        color: '#10B981',
        progress: 78,
        controls: [
            { id: 'H1', name: 'Access Controls', description: 'Unique user identification and access', status: 'compliant', evidence: 8, lastAssessed: '1 day ago' },
            { id: 'H2', name: 'Audit Controls', description: 'Activity logging and examination', status: 'compliant', evidence: 12, lastAssessed: '1 day ago' },
            { id: 'H3', name: 'Integrity Controls', description: 'Electronic PHI protection', status: 'in-progress', evidence: 5, lastAssessed: '4 days ago' },
            { id: 'H4', name: 'Transmission Security', description: 'Encryption during transmission', status: 'compliant', evidence: 6, lastAssessed: '2 days ago' },
        ]
    },
    {
        id: 'pci',
        name: 'PCI DSS',
        shortName: 'PCI',
        color: '#F97316',
        progress: 65,
        controls: [
            { id: 'P1', name: 'Firewall Configuration', description: 'Network security controls', status: 'compliant', evidence: 7, lastAssessed: '2 days ago' },
            { id: 'P2', name: 'Vendor Default Passwords', description: 'Default password changes', status: 'compliant', evidence: 4, lastAssessed: '3 days ago' },
            { id: 'P3', name: 'Cardholder Data Protection', description: 'Stored card data encryption', status: 'non-compliant', evidence: 2, lastAssessed: '1 week ago' },
            { id: 'P4', name: 'Encryption in Transit', description: 'Transmission encryption requirements', status: 'in-progress', evidence: 5, lastAssessed: '5 days ago' },
        ]
    },
];

const frameworkColors: Record<string, string> = {
    'soc2': '#8B5CF6',
    'gdpr': '#06B6D4',
    'hipaa': '#10B981',
    'pci': '#F97316',
};

const ComplianceHub = () => {
    const [frameworks, setFrameworks] = useState<ComplianceFramework[]>(defaultFrameworks);
    const [selectedFramework, setSelectedFramework] = useState<ComplianceFramework>(defaultFrameworks[0]);
    const [isLoading, setIsLoading] = useState(false);

    const loadComplianceData = useCallback(async () => {
        try {
            setIsLoading(true);
            const apiFrameworks = await securityService.getComplianceFrameworks();
            if (apiFrameworks?.length > 0) {
                // Map API response to local format
                const mapped: ComplianceFramework[] = await Promise.all(
                    apiFrameworks.map(async (f) => {
                        const detail = await securityService.getComplianceFramework(f.id);
                        return {
                            id: f.id,
                            name: f.name,
                            shortName: f.name.split(' ')[0],
                            color: frameworkColors[f.id] || '#8B5CF6',
                            progress: f.overallScore,
                            controls: detail?.controls?.map(c => ({
                                id: c.id,
                                name: c.name,
                                description: c.description,
                                status: mapControlStatus(c.status),
                                evidence: c.evidence?.length || 0,
                                lastAssessed: formatDate(c.lastChecked)
                            })) || []
                        };
                    })
                );
                setFrameworks(mapped);
                setSelectedFramework(mapped[0]);
            }
        } catch {
            console.log('Using default compliance data');
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Load compliance data on mount
    useEffect(() => {
        void loadComplianceData();
    }, [loadComplianceData]);

    const mapControlStatus = (status: string): 'compliant' | 'non-compliant' | 'in-progress' | 'not-started' => {
        switch (status) {
            case 'compliant': return 'compliant';
            case 'non-compliant': return 'non-compliant';
            case 'partial': return 'in-progress';
            default: return 'not-started';
        }
    };

    const formatDate = (date: Date | string) => {
        const d = new Date(date);
        const now = new Date();
        const diff = now.getTime() - d.getTime();
        const hours = Math.floor(diff / (1000 * 60 * 60));
        if (hours < 1) return 'Just now';
        if (hours < 24) return `${hours} hours ago`;
        if (hours < 48) return 'Yesterday';
        if (hours < 168) return `${Math.floor(hours / 24)} days ago`;
        return '1 week ago';
    };

    const handleRunAssessment = async () => {
        setIsLoading(true);
        try {
            await securityService.runAssessment(selectedFramework.id);
            // Reload data after assessment
            await loadComplianceData();
        } catch {
            console.log('Assessment simulated');
        }
        setIsLoading(false);
    };

    const handleExportReport = async () => {
        try {
            const report = await securityService.getComplianceReport(selectedFramework.id);
            // Download as JSON (in real implementation, would be PDF)
            const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${selectedFramework.id}-compliance-report.json`;
            a.click();
        } catch {
            console.log('Export simulated');
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'compliant': return <CheckCircle size={16} className="text-green-400" />;
            case 'non-compliant': return <XCircle size={16} className="text-red-400" />;
            case 'in-progress': return <Clock size={16} className="text-yellow-400" />;
            default: return <AlertTriangle size={16} className="text-gray-400" />;
        }
    };

    const getStatusBadge = (status: string): 'success' | 'error' | 'warning' | 'secondary' => {
        switch (status) {
            case 'compliant': return 'success';
            case 'non-compliant': return 'error';
            case 'in-progress': return 'warning';
            default: return 'secondary';
        }
    };

    const compliantCount = selectedFramework.controls.filter(c => c.status === 'compliant').length;
    const totalControls = selectedFramework.controls.length;

    return (
        <div className="p-6 max-w-[1600px] mx-auto space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold font-mono text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-400">
                        COMPLIANCE HUB
                    </h2>
                    <p className="text-gray-400 mt-1">
                        SOC 2, GDPR, HIPAA, and PCI DSS compliance tracking with automated evidence collection
                    </p>
                </div>
                <div className="flex gap-3">
                    <Button
                        variant="glass"
                        size="sm"
                        leftIcon={<Download size={16} />}
                        onClick={handleExportReport}
                    >
                        Export Audit Report
                    </Button>
                    <Button
                        variant="neon"
                        size="sm"
                        leftIcon={isLoading ? <Clock size={16} className="animate-spin" /> : <CheckSquare size={16} />}
                        glow
                        onClick={handleRunAssessment}
                        disabled={isLoading}
                    >
                        {isLoading ? 'Running...' : 'Run Assessment'}
                    </Button>
                </div>
            </div>

            {/* Framework Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {frameworks.map((framework) => (
                    <motion.div
                        key={framework.id}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                    >
                        <Card
                            variant="glass"
                            className={`cursor-pointer transition-all ${selectedFramework.id === framework.id
                                ? 'ring-2 ring-primary border-primary/50'
                                : 'hover:border-white/20'
                                }`}
                            onClick={() => setSelectedFramework(framework)}
                        >
                            <div className="flex items-center justify-between mb-4">
                                <div
                                    className="w-12 h-12 rounded-lg flex items-center justify-center"
                                    style={{ backgroundColor: `${framework.color}20` }}
                                >
                                    <Shield size={24} style={{ color: framework.color }} />
                                </div>
                                <div className="text-right">
                                    <p className="text-2xl font-bold" style={{ color: framework.color }}>
                                        {framework.progress}%
                                    </p>
                                    <p className="text-xs text-gray-500">Compliant</p>
                                </div>
                            </div>
                            <h4 className="font-semibold text-white">{framework.name}</h4>
                            <div className="mt-3 h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                                <div
                                    className="h-full rounded-full transition-all duration-500"
                                    style={{ width: `${framework.progress}%`, backgroundColor: framework.color }}
                                />
                            </div>
                        </Card>
                    </motion.div>
                ))}
            </div>

            {/* Controls Table */}
            <Card variant="glass" padding="lg">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h3 className="text-xl font-bold text-white font-mono flex items-center gap-2">
                            <Building size={20} style={{ color: selectedFramework.color }} />
                            {selectedFramework.name} CONTROLS
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">
                            {compliantCount} of {totalControls} controls compliant
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <Badge variant="success">{frameworks[0].controls.filter(c => c.status === 'compliant').length} Compliant</Badge>
                        <Badge variant="warning">{frameworks[0].controls.filter(c => c.status === 'in-progress').length} In Progress</Badge>
                        <Badge variant="error">{frameworks[0].controls.filter(c => c.status === 'non-compliant').length} Non-Compliant</Badge>
                    </div>
                </div>

                <div className="space-y-3">
                    {selectedFramework.controls.map((control, index) => (
                        <motion.div
                            key={control.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5 hover:border-white/10 transition-all group cursor-pointer"
                        >
                            <div className="flex items-center gap-4">
                                {getStatusIcon(control.status)}
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono text-xs text-gray-500">{control.id}</span>
                                        <span className="font-semibold text-white">{control.name}</span>
                                    </div>
                                    <p className="text-sm text-gray-500 mt-0.5">{control.description}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="text-right">
                                    <p className="text-sm text-gray-400">{control.evidence} evidence items</p>
                                    <p className="text-xs text-gray-600">Assessed {control.lastAssessed}</p>
                                </div>
                                <Badge variant={getStatusBadge(control.status)}>
                                    {control.status.replace('-', ' ')}
                                </Badge>
                                <ArrowRight size={16} className="text-gray-600 group-hover:text-primary transition-colors" />
                            </div>
                        </motion.div>
                    ))}
                </div>
            </Card>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card variant="glass" className="group hover:border-primary/50 cursor-pointer transition-all">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-lg bg-purple-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <FileText className="text-purple-400" size={24} />
                        </div>
                        <div>
                            <h4 className="font-semibold text-white">Generate Audit Report</h4>
                            <p className="text-sm text-gray-500">Create comprehensive compliance documentation</p>
                        </div>
                    </div>
                </Card>

                <Card variant="glass" className="group hover:border-green-500/50 cursor-pointer transition-all">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-lg bg-green-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <CheckSquare className="text-green-400" size={24} />
                        </div>
                        <div>
                            <h4 className="font-semibold text-white">Collect Evidence</h4>
                            <p className="text-sm text-gray-500">Auto-collect compliance evidence from systems</p>
                        </div>
                    </div>
                </Card>

                <Card variant="glass" className="group hover:border-blue-500/50 cursor-pointer transition-all">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-lg bg-blue-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Clock className="text-blue-400" size={24} />
                        </div>
                        <div>
                            <h4 className="font-semibold text-white">Schedule Assessment</h4>
                            <p className="text-sm text-gray-500">Set up recurring compliance checks</p>
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default ComplianceHub;
