import { useState, useEffect, useCallback } from 'react';
import {
    Shield, AlertTriangle, CheckCircle, XCircle, Play,
    FileText, Clock, TrendingUp, Bug, Lock, Globe
} from 'lucide-react';
import { Card, Button, Badge } from '../components/atoms';
import { motion } from 'framer-motion';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import securityService from '../services/securityService';

// Fallback mock data when API is unavailable
const defaultVulnerabilityData = [
    { name: 'Critical', value: 2, color: '#EF4444' },
    { name: 'High', value: 5, color: '#F97316' },
    { name: 'Medium', value: 12, color: '#EAB308' },
    { name: 'Low', value: 23, color: '#22C55E' },
];

const defaultOwaspTop10 = [
    { id: 'A01', name: 'Broken Access Control', status: 'pass' as const, score: 92 },
    { id: 'A02', name: 'Cryptographic Failures', status: 'pass' as const, score: 88 },
    { id: 'A03', name: 'Injection', status: 'warning' as const, score: 75 },
    { id: 'A04', name: 'Insecure Design', status: 'pass' as const, score: 95 },
    { id: 'A05', name: 'Security Misconfiguration', status: 'pass' as const, score: 90 },
    { id: 'A06', name: 'Vulnerable Components', status: 'fail' as const, score: 45 },
    { id: 'A07', name: 'Authentication Failures', status: 'pass' as const, score: 98 },
    { id: 'A08', name: 'Data Integrity Failures', status: 'pass' as const, score: 85 },
    { id: 'A09', name: 'Security Logging Failures', status: 'warning' as const, score: 70 },
    { id: 'A10', name: 'Server-Side Request Forgery', status: 'pass' as const, score: 100 },
];

const defaultRecentScans = [
    { id: '1', target: 'api.qestro.app', type: 'Full Scan', status: 'completed' as const, findings: 12, date: '2 hours ago' },
    { id: '2', target: 'app.qestro.app', type: 'OWASP Top 10', status: 'completed' as const, findings: 3, date: '5 hours ago' },
    { id: '3', target: 'auth.qestro.app', type: 'SQL Injection', status: 'running' as const, findings: 0, date: 'In progress' },
    { id: '4', target: 'storage.qestro.app', type: 'XSS Scan', status: 'completed' as const, findings: 1, date: 'Yesterday' },
];

interface OWASPItem {
    id: string;
    name: string;
    status: 'pass' | 'warning' | 'fail';
    score: number;
}

interface ScanItem {
    id: string;
    target: string;
    type: string;
    status: string;
    findings: number;
    date: string;
}

const formatDate = (date: Date | string) => {
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours} hours ago`;
    if (hours < 48) return 'Yesterday';
    return d.toLocaleDateString();
};

const SecurityCenter = () => {
    const [isScanning, setIsScanning] = useState(false);
    const [securityScore, setSecurityScore] = useState(84);
    const [owaspTop10, setOwaspTop10] = useState<OWASPItem[]>(defaultOwaspTop10);
    const [recentScans, setRecentScans] = useState<ScanItem[]>(defaultRecentScans);
    const [vulnerabilityData, setVulnerabilityData] = useState(defaultVulnerabilityData);

    const loadSecurityData = useCallback(async () => {
        try {
            // Load OWASP status
            const owaspStatus = await securityService.getOWASPStatus();
            if (owaspStatus?.categories?.length > 0) {
                setOwaspTop10(owaspStatus.categories);
                setSecurityScore(owaspStatus.overallScore);
            }

            // Load recent scans
            const scans = await securityService.getScans(undefined, 10);
            if (scans?.length > 0) {
                const mappedScans = scans.map(s => ({
                    id: s.id,
                    target: s.target,
                    type: s.scanType,
                    status: s.status,
                    findings: s.summary?.totalFindings || 0,
                    date: formatDate(s.startTime)
                }));
                setRecentScans(mappedScans);

                // Get vulnerability distribution from latest completed scan
                const latestCompleted = scans.find(s => s.status === 'completed');
                if (latestCompleted?.summary) {
                    setVulnerabilityData([
                        { name: 'Critical', value: latestCompleted.summary.critical, color: '#EF4444' },
                        { name: 'High', value: latestCompleted.summary.high, color: '#F97316' },
                        { name: 'Medium', value: latestCompleted.summary.medium, color: '#EAB308' },
                        { name: 'Low', value: latestCompleted.summary.low, color: '#22C55E' },
                    ]);
                }
            }
        } catch {
            console.log('Using default security data');
        }
    }, []);

    // Load security data on mount
    useEffect(() => {
        const timer = setTimeout(() => {
            void loadSecurityData();
        }, 0);
        return () => clearTimeout(timer);
    }, [loadSecurityData]);

    const handleStartScan = async () => {
        setIsScanning(true);
        try {
            await securityService.startScan('https://api.qestro.app', 'full');
            // Reload data after starting scan
            setTimeout(() => {
                void loadSecurityData();
            }, 1000);
        } catch {
            console.log('Scan start simulated');
        }
        setTimeout(() => setIsScanning(false), 3000);
    };

    return (
        <div className="p-6 max-w-[1600px] mx-auto space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold font-mono text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-orange-400">
                        SECURITY CENTER
                    </h2>
                    <p className="text-gray-400 mt-1">
                        OWASP Top 10 scanning, vulnerability detection, and security compliance
                    </p>
                </div>
                <div className="flex gap-3">
                    <Button
                        variant="glass"
                        size="sm"
                        leftIcon={<FileText size={16} />}
                    >
                        Export Report
                    </Button>
                    <Button
                        variant="neon"
                        size="sm"
                        leftIcon={isScanning ? <Clock size={16} className="animate-spin" /> : <Play size={16} />}
                        onClick={handleStartScan}
                        disabled={isScanning}
                        glow
                    >
                        {isScanning ? 'Scanning...' : 'Start Full Scan'}
                    </Button>
                </div>
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card variant="holographic" className="relative overflow-hidden">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-400 font-mono">SECURITY SCORE</p>
                            <h3 className="text-4xl font-bold text-white mt-1">{securityScore}%</h3>
                            <p className="text-xs text-green-400 mt-1">+5% from last scan</p>
                        </div>
                        <div className="relative w-16 h-16">
                            <svg className="transform -rotate-90 w-16 h-16">
                                <circle cx="32" cy="32" r="28" stroke="#333" strokeWidth="6" fill="none" />
                                <circle
                                    cx="32" cy="32" r="28"
                                    stroke={securityScore >= 80 ? '#22C55E' : securityScore >= 60 ? '#EAB308' : '#EF4444'}
                                    strokeWidth="6"
                                    fill="none"
                                    strokeDasharray={`${securityScore * 1.76} 176`}
                                    strokeLinecap="round"
                                />
                            </svg>
                            <Shield className="absolute inset-0 m-auto w-6 h-6 text-white" />
                        </div>
                    </div>
                </Card>

                <Card variant="glass">
                    <div className="flex items-center gap-3 mb-2">
                        <AlertTriangle className="text-red-400" size={20} />
                        <p className="text-sm text-gray-400 font-mono">CRITICAL ISSUES</p>
                    </div>
                    <h3 className="text-3xl font-bold text-red-400">2</h3>
                    <p className="text-xs text-gray-500 mt-1">Requires immediate attention</p>
                </Card>

                <Card variant="glass">
                    <div className="flex items-center gap-3 mb-2">
                        <Bug className="text-yellow-400" size={20} />
                        <p className="text-sm text-gray-400 font-mono">TOTAL VULNERABILITIES</p>
                    </div>
                    <h3 className="text-3xl font-bold text-white">42</h3>
                    <p className="text-xs text-green-400 mt-1">-8 from last week</p>
                </Card>

                <Card variant="glass">
                    <div className="flex items-center gap-3 mb-2">
                        <TrendingUp className="text-green-400" size={20} />
                        <p className="text-sm text-gray-400 font-mono">COMPLIANCE RATE</p>
                    </div>
                    <h3 className="text-3xl font-bold text-green-400">94%</h3>
                    <p className="text-xs text-gray-500 mt-1">OWASP Top 10 coverage</p>
                </Card>
            </div>

            {/* Main Content */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* OWASP Top 10 Checklist */}
                <Card variant="glass" padding="lg" className="lg:col-span-2">
                    <h3 className="text-xl font-bold text-white font-mono mb-6 flex items-center gap-2">
                        <Lock size={20} className="text-primary" />
                        OWASP TOP 10 COMPLIANCE
                    </h3>
                    <div className="space-y-3">
                        {owaspTop10.map((item, index) => (
                            <motion.div
                                key={item.id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.05 }}
                                className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5 hover:border-white/10 transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    {item.status === 'pass' && <CheckCircle size={18} className="text-green-400" />}
                                    {item.status === 'warning' && <AlertTriangle size={18} className="text-yellow-400" />}
                                    {item.status === 'fail' && <XCircle size={18} className="text-red-400" />}
                                    <span className="font-mono text-xs text-gray-500">{item.id}</span>
                                    <span className="text-sm text-white">{item.name}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-24 h-2 bg-white/10 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full ${item.score >= 80 ? 'bg-green-400' : item.score >= 60 ? 'bg-yellow-400' : 'bg-red-400'
                                                }`}
                                            style={{ width: `${item.score}%` }}
                                        />
                                    </div>
                                    <span className="text-sm font-mono text-gray-400 w-10">{item.score}%</span>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </Card>

                {/* Vulnerability Distribution */}
                <Card variant="glass" padding="lg">
                    <h3 className="text-lg font-bold text-white font-mono mb-4">
                        VULNERABILITY DISTRIBUTION
                    </h3>
                    <div className="h-48">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={vulnerabilityData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={40}
                                    outerRadius={70}
                                    paddingAngle={3}
                                    dataKey="value"
                                >
                                    {vulnerabilityData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #333' }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="flex flex-wrap justify-center gap-3 mt-4">
                        {vulnerabilityData.map((item) => (
                            <div key={item.name} className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                                <span className="text-xs text-gray-400">{item.name}: {item.value}</span>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>

            {/* Recent Scans */}
            <Card variant="glass" padding="lg">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-white font-mono flex items-center gap-2">
                        <Globe size={20} className="text-secondary" />
                        RECENT SECURITY SCANS
                    </h3>
                    <Button variant="glass" size="sm">View All</Button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="text-left text-xs text-gray-500 uppercase border-b border-white/10">
                                <th className="pb-3 font-medium">Target</th>
                                <th className="pb-3 font-medium">Scan Type</th>
                                <th className="pb-3 font-medium">Status</th>
                                <th className="pb-3 font-medium">Findings</th>
                                <th className="pb-3 font-medium">Date</th>
                                <th className="pb-3 font-medium">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {recentScans.map((scan) => (
                                <tr key={scan.id} className="border-b border-white/5 hover:bg-white/5">
                                    <td className="py-4 font-mono text-sm text-primary">{scan.target}</td>
                                    <td className="py-4 text-sm text-gray-300">{scan.type}</td>
                                    <td className="py-4">
                                        <Badge
                                            variant={scan.status === 'completed' ? 'success' : scan.status === 'running' ? 'warning' : 'outline'}
                                        >
                                            {scan.status}
                                        </Badge>
                                    </td>
                                    <td className="py-4">
                                        <span className={`font-mono ${scan.findings > 5 ? 'text-red-400' : scan.findings > 0 ? 'text-yellow-400' : 'text-green-400'}`}>
                                            {scan.findings}
                                        </span>
                                    </td>
                                    <td className="py-4 text-sm text-gray-500">{scan.date}</td>
                                    <td className="py-4">
                                        <Button variant="ghost" size="sm">View Report</Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
};

export default SecurityCenter;
