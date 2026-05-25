/**
 * Policy Impact Analysis Component
 *
 * Enterprise-grade policy impact analysis with change prediction,
 * security implications assessment, and risk evaluation
 */

'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  Info,
  Shield,
  Users,
  Database,
  Activity,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Zap,
  Clock,
  GitBranch,
  GitCompare,
  Eye,
  Download,
  RefreshCw,
  Loader2,
  FileText,
  Key,
  Lock,
  Target,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Server,
  Globe,
  Cpu,
  HardDrive,
  Wifi,
  UserCheck,
  UserX,
  Settings,
  Search,
  Filter
} from 'lucide-react';

import {
  Policy,
  PolicyImpact,
  ResourceImpact,
  UserImpact,
  SystemImpact,
  PerformanceImpact,
  AvailabilityImpact,
  SecurityImpact,
  RiskLevel
} from '@/types/policy-management';

interface PolicyImpactAnalysisProps {
  policy: Policy;
  compareTo?: Policy;
  onAnalyze?: (impact: PolicyImpact) => void;
}

interface ImpactMetric {
  name: string;
  current: number;
  projected: number;
  change: number;
  changePercent: number;
  unit: string;
  trend: 'up' | 'down' | 'stable';
  severity: 'low' | 'medium' | 'high' | 'critical';
}

interface AffectedResource {
  id: string;
  name: string;
  type: 'api' | 'database' | 'service' | 'user' | 'data';
  impact: 'none' | 'read' | 'write' | 'delete' | 'admin';
  description: string;
  risk: RiskLevel;
  dependencies: string[];
  estimatedDowntime?: number;
  rollbackComplexity: 'simple' | 'moderate' | 'complex';
}

interface SecurityImplication {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  affectedControls: string[];
  mitigations: string[];
  complianceImpact: string[];
}

interface PredictionModel {
  name: string;
  accuracy: number;
  confidence: number;
  factors: string[];
  predictions: {
    userImpact: number;
    systemLoad: number;
    errorRate: number;
    responseTime: number;
  };
}

export default function PolicyImpactAnalysis({
  policy,
  compareTo,
  onAnalyze
}: PolicyImpactAnalysisProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [impact, setImpact] = useState<PolicyImpact | null>(null);
  const [selectedView, setSelectedView] = useState<'overview' | 'resources' | 'users' | 'security' | 'performance'>('overview');
  const [timeRange, setTimeRange] = useState('24h');
  const [confidence, setConfidence] = useState(85);

  // Mock impact data
  const mockImpact: PolicyImpact = {
    affectedResources: [
      {
        type: 'api',
        id: 'api-auth-service',
        name: 'Authentication API',
        impact: 'write',
        description: 'All authentication endpoints will be affected',
        risk: 'medium'
      },
      {
        type: 'database',
        id: 'db-user-sessions',
        name: 'User Sessions Database',
        impact: 'read',
        description: 'Read access to user sessions for validation',
        risk: 'low'
      },
      {
        type: 'service',
        id: 'svc-gateway',
        name: 'API Gateway',
        impact: 'write',
        description: 'Gateway configuration will be updated',
        risk: 'high'
      },
      {
        type: 'user',
        id: 'users-all',
        name: 'All Active Users',
        impact: 'read',
        description: 'User permissions will be evaluated',
        risk: 'low'
      },
      {
        type: 'data',
        id: 'data-phi',
        name: 'Protected Health Information',
        impact: 'admin',
        description: 'PHI access controls will be enforced',
        risk: 'critical'
      }
    ],
    estimatedChanges: 23,
    riskLevel: 'medium',
    downtimeRisk: 'minimal',
    rollbackComplexity: 'moderate',
    userImpact: {
      affectedUsers: 15420,
      impactLevel: 'moderate',
      notifications: [
        'Security policy update notification',
        'New authentication requirements',
        'Session timeout changes'
      ],
      trainingRequired: true,
      downtimeWindows: [
        {
          start: new Date('2024-01-15T02:00:00Z'),
          end: new Date('2024-01-15T02:30:00Z'),
          duration: 30,
          affectedServices: ['Authentication API', 'User Management'],
          reason: 'Policy deployment and validation'
        }
      ]
    },
    systemImpact: {
      services: ['auth-service', 'user-service', 'gateway'],
      databases: ['users', 'sessions', 'audit_logs'],
      apis: ['/api/v1/auth/*', '/api/v1/users/*'],
      performance: {
        latencyIncrease: 15,
        throughputDecrease: 5,
        memoryIncrease: 128,
        cpuIncrease: 10
      },
      availability: {
        downtimeRisk: 'minimal',
        recoveryTime: 30,
        failoverRequired: false,
        backupRequired: true
      },
      security: {
        authenticationChanges: ['MFA requirement for all users', 'Session timeout reduction'],
        authorizationChanges: ['Role-based access updates', 'Resource-level permissions'],
        dataAccessChanges: ['PHI access logging', 'Data classification enforcement'],
        auditChanges: ['Enhanced logging', 'Real-time monitoring'],
        newRisks: ['Policy complexity may impact performance', 'Training required for users'],
        mitigations: ['Gradual rollout', 'Comprehensive testing', 'User training sessions']
      }
    }
  };

  // Mock impact metrics
  const impactMetrics: ImpactMetric[] = [
    {
      name: 'Response Time',
      current: 50,
      projected: 58,
      change: 8,
      changePercent: 16,
      unit: 'ms',
      trend: 'up',
      severity: 'medium'
    },
    {
      name: 'Request Rate',
      current: 1000,
      projected: 950,
      change: -50,
      changePercent: -5,
      unit: 'req/s',
      trend: 'down',
      severity: 'low'
    },
    {
      name: 'Memory Usage',
      current: 512,
      projected: 640,
      change: 128,
      changePercent: 25,
      unit: 'MB',
      trend: 'up',
      severity: 'medium'
    },
    {
      name: 'CPU Usage',
      current: 30,
      projected: 40,
      change: 10,
      changePercent: 33,
      unit: '%',
      trend: 'up',
      severity: 'high'
    },
    {
      name: 'Error Rate',
      current: 0.1,
      projected: 0.2,
      change: 0.1,
      changePercent: 100,
      unit: '%',
      trend: 'up',
      severity: 'high'
    },
    {
      name: 'Throughput',
      current: 50000,
      projected: 47500,
      change: -2500,
      changePercent: -5,
      unit: 'req/min',
      trend: 'down',
      severity: 'low'
    }
  ];

  // Mock security implications
  const securityImplications: SecurityImplication[] = [
    {
      type: 'Authentication Strengthening',
      severity: 'medium',
      description: 'Multi-factor authentication will be required for all privileged operations',
      affectedControls: ['AC-2', 'AC-3', 'IA-2'],
      mitigations: ['Graceful rollout', 'User communication', 'Backup authentication methods'],
      complianceImpact: ['SOX', 'HIPAA', 'PCI-DSS']
    },
    {
      type: 'Data Access Logging',
      severity: 'low',
      description: 'All data access will be logged with user context and timestamp',
      affectedControls: ['AU-2', 'AU-3', 'AU-12'],
      mitigations: ['Log rotation', 'Secure storage', 'Access controls on logs'],
      complianceImpact: ['GDPR', 'CCPA', 'HIPAA']
    },
    {
      type: 'Session Management',
      severity: 'medium',
      description: 'Session timeout reduced to 30 minutes for enhanced security',
      affectedControls: ['SC-23', 'AC-11'],
      mitigations: ['Session refresh mechanism', 'User notifications'],
      complianceImpact: ['NIST SP 800-53']
    },
    {
      type: 'Privilege Escalation',
      severity: 'high',
      description: 'New controls prevent privilege escalation through policy chaining',
      affectedControls: ['AC-6', 'AC-5'],
      mitigations: ['Thorough testing', 'Fallback mechanisms'],
      complianceImpact: ['SOX', 'PCI-DSS']
    }
  ];

  // Mock prediction models
  const predictionModels: PredictionModel[] = [
    {
      name: 'ML-Based Impact Prediction',
      accuracy: 92,
      confidence: 88,
      factors: ['Historical data', 'Policy complexity', 'System load'],
      predictions: {
        userImpact: 15,
        systemLoad: 12,
        errorRate: 0.15,
        responseTime: 55
      }
    },
    {
      name: 'Statistical Analysis',
      accuracy: 85,
      confidence: 82,
      factors: ['Resource usage', 'Dependencies', 'User patterns'],
      predictions: {
        userImpact: 18,
        systemLoad: 15,
        errorRate: 0.2,
        responseTime: 60
      }
    },
    {
      name: 'Expert System',
      accuracy: 78,
      confidence: 75,
      factors: ['Rule-based analysis', 'Security policies', 'Best practices'],
      predictions: {
        userImpact: 12,
        systemLoad: 10,
        errorRate: 0.1,
        responseTime: 52
      }
    }
  ];

  // Run impact analysis
  const runAnalysis = useCallback(async () => {
    setIsAnalyzing(true);

    // Simulate analysis
    await new Promise(resolve => setTimeout(resolve, 3000));

    setImpact(mockImpact);
    setIsAnalyzing(false);

    if (onAnalyze) {
      onAnalyze(mockImpact);
    }
  }, [onAnalyze]);

  // Get risk level color
  const getRiskLevelColor = (level: RiskLevel) => {
    switch (level) {
      case 'low': return 'text-green-600 bg-green-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'high': return 'text-orange-600 bg-orange-100';
      case 'critical': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  // Get impact severity color
  const getSeverityColor = (severity: 'low' | 'medium' | 'high' | 'critical') => {
    switch (severity) {
      case 'low': return 'text-green-600';
      case 'medium': return 'text-yellow-600';
      case 'high': return 'text-orange-600';
      case 'critical': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  // Get trend icon
  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up': return <TrendingUp className="h-4 w-4" />;
      case 'down': return <TrendingDown className="h-4 w-4" />;
      case 'stable': return <Activity className="h-4 w-4" />;
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b bg-gray-50 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Policy Impact Analysis</h2>
            <p className="text-sm text-muted-foreground">
              Analyze the impact of policy changes on systems, users, and security
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1h">Last Hour</SelectItem>
                <SelectItem value="24h">Last 24h</SelectItem>
                <SelectItem value="7d">Last Week</SelectItem>
                <SelectItem value="30d">Last Month</SelectItem>
              </SelectContent>
            </Select>

            <Badge variant="outline">
              Confidence: {confidence}%
            </Badge>

            <Button
              variant="outline"
              onClick={runAnalysis}
              disabled={isAnalyzing}
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Re-analyze
                </>
              )}
            </Button>

            <Button
              onClick={() => {
                const data = {
                  policy: policy.name,
                  impact,
                  metrics: impactMetrics,
                  timestamp: new Date().toISOString()
                };
                const blob = new Blob([JSON.stringify(data, null, 2)], {
                  type: 'application/json'
                });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `policy-impact-${policy.name}-${Date.now()}.json`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              disabled={!impact}
            >
              <Download className="h-4 w-4 mr-1" />
              Export
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex">
        {/* Summary Panel */}
        <div className="w-80 border-r bg-gray-50 p-4 overflow-y-auto">
          <div className="space-y-4">
            {/* Overall Risk Assessment */}
            <div>
              <h3 className="text-sm font-semibold mb-3">Risk Assessment</h3>
              <Card className={`border-2 ${impact?.riskLevel === 'critical' ? 'border-red-500' : impact?.riskLevel === 'high' ? 'border-orange-500' : impact?.riskLevel === 'medium' ? 'border-yellow-500' : 'border-green-500'}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Risk Level</span>
                    <Badge className={getRiskLevelColor(impact?.riskLevel || 'medium')}>
                      {impact?.riskLevel?.toUpperCase() || 'MEDIUM'}
                    </Badge>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Changes Required:</span>
                      <span>{impact?.estimatedChanges || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Downtime Risk:</span>
                      <span className="capitalize">{impact?.downtimeRisk || 'minimal'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Rollback Complexity:</span>
                      <span className="capitalize">{impact?.rollbackComplexity || 'moderate'}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Separator />

            {/* User Impact Summary */}
            <div>
              <h3 className="text-sm font-semibold mb-3">User Impact</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Affected Users</span>
                  <span className="font-semibold">
                    {impact?.userImpact.affectedUsers?.toLocaleString() || 0}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Impact Level</span>
                  <Badge variant={impact?.userImpact.impactLevel === 'significant' ? 'destructive' : 'secondary'}>
                    {impact?.userImpact.impactLevel || 'moderate'}
                  </Badge>
                </div>

                {impact?.userImpact.trainingRequired && (
                  <Alert className="border-blue-200 bg-blue-50">
                    <Info className="h-4 w-4" />
                    <AlertDescription className="text-blue-800 text-xs">
                      User training required
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </div>

            <Separator />

            {/* System Impact */}
            <div>
              <h3 className="text-sm font-semibold mb-3">System Impact</h3>
              <div className="space-y-2">
                {impact?.systemImpact.services.map((service, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm">
                    <Server className="h-3 w-3 text-gray-500" />
                    <span>{service}</span>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Prediction Models */}
            <div>
              <h3 className="text-sm font-semibold mb-3">Prediction Models</h3>
              <div className="space-y-2">
                {predictionModels.map((model, index) => (
                  <div key={index} className="p-2 bg-white rounded border">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium">{model.name}</span>
                      <Badge variant="outline" className="text-xs">
                        {model.accuracy}% accuracy
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Confidence</span>
                      <span>{model.confidence}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Main Analysis Panel */}
        <div className="flex-1 p-4 overflow-y-auto">
          <Tabs value={selectedView} onValueChange={(value: any) => setSelectedView(value)}>
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="resources">Resources</TabsTrigger>
              <TabsTrigger value="users">Users</TabsTrigger>
              <TabsTrigger value="security">Security</TabsTrigger>
              <TabsTrigger value="performance">Performance</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-6">
              <div className="space-y-6">
                {/* Impact Metrics */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">Impact Metrics</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {impactMetrics.map((metric, index) => (
                      <Card key={index}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium">{metric.name}</span>
                            <div className={`flex items-center gap-1 text-${getSeverityColor(metric.severity)}`}>
                              {getTrendIcon(metric.trend)}
                              <span className="text-xs font-semibold">
                                {metric.change > 0 ? '+' : ''}{metric.changePercent}%
                              </span>
                            </div>
                          </div>

                          <div className="flex items-end gap-2">
                            <span className="text-2xl font-bold">{metric.projected}</span>
                            <span className="text-sm text-muted-foreground mb-1">{metric.unit}</span>
                          </div>

                          <div className="mt-2">
                            <Progress
                              value={Math.min(Math.abs(metric.changePercent), 100)}
                              className="h-1"
                            />
                          </div>

                          <div className="flex items-center justify-between mt-1 text-xs text-muted-foreground">
                            <span>Current: {metric.current}{metric.unit}</span>
                            <span>Projected: {metric.projected}{metric.unit}</span>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>

                {/* Risk Breakdown */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">Risk Breakdown</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Shield className="h-4 w-4" />
                          Security Risks
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {securityImplications.slice(0, 3).map((impl, index) => (
                          <div key={index} className="flex items-start gap-2">
                            <AlertTriangle className={`h-4 w-4 mt-0.5 text-${getSeverityColor(impl.severity)}`} />
                            <div className="flex-1">
                              <p className="text-sm font-medium">{impl.type}</p>
                              <p className="text-xs text-muted-foreground">
                                {impl.description}
                              </p>
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Activity className="h-4 w-4" />
                          Operational Risks
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Performance Impact</span>
                          <Badge className={getRiskLevelColor('medium')}>
                            Medium
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Downtime Risk</span>
                          <Badge className={getRiskLevelColor('low')}>
                            Low
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Rollback Complexity</span>
                          <Badge className={getRiskLevelColor('medium')}>
                            Moderate
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                {/* Recommendations */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">Recommendations</h3>
                  <div className="space-y-2">
                    <Alert className="border-blue-200 bg-blue-50">
                      <Info className="h-4 w-4" />
                      <AlertDescription className="text-blue-800">
                        Deploy gradually with canary releases to monitor impact
                      </AlertDescription>
                    </Alert>
                    <Alert className="border-yellow-200 bg-yellow-50">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription className="text-yellow-800">
                        Monitor CPU usage closely after deployment
                      </AlertDescription>
                    </Alert>
                    <Alert className="border-green-200 bg-green-50">
                      <CheckCircle className="h-4 w-4" />
                      <AlertDescription className="text-green-800">
                        Have rollback plan ready for quick recovery
                      </AlertDescription>
                    </Alert>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="resources" className="mt-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Affected Resources</h3>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline">
                      <Filter className="h-3 w-3 mr-1" />
                      Filter
                    </Button>
                    <Button size="sm" variant="outline">
                      <Search className="h-3 w-3 mr-1" />
                      Search
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {impact?.affectedResources.map((resource, index) => (
                    <Card key={index}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {resource.type === 'api' && <Globe className="h-4 w-4 text-blue-500" />}
                            {resource.type === 'database' && <Database className="h-4 w-4 text-green-500" />}
                            {resource.type === 'service' && <Server className="h-4 w-4 text-purple-500" />}
                            {resource.type === 'user' && <Users className="h-4 w-4 text-orange-500" />}
                            {resource.type === 'data' && <HardDrive className="h-4 w-4 text-gray-500" />}

                            <div>
                              <p className="font-medium">{resource.name}</p>
                              <p className="text-xs text-muted-foreground">{resource.id}</p>
                            </div>
                          </div>

                          <Badge className={getRiskLevelColor(resource.risk)}>
                            {resource.risk}
                          </Badge>
                        </div>

                        <p className="text-sm text-muted-foreground mb-3">
                          {resource.description}
                        </p>

                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Impact:</span>
                          <Badge variant="outline" className="text-xs">
                            {resource.impact}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="users" className="mt-6">
              <div className="space-y-6">
                {/* User Impact Summary */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Users className="h-5 w-5 text-blue-500" />
                        <span className="font-medium">Affected Users</span>
                      </div>
                      <p className="text-2xl font-bold">
                        {impact?.userImpact.affectedUsers?.toLocaleString() || 0}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Total active users
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="h-5 w-5 text-yellow-500" />
                        <span className="font-medium">Impact Level</span>
                      </div>
                      <p className="text-2xl font-bold capitalize">
                        {impact?.userImpact.impactLevel || 'moderate'}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Expected impact
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className="h-5 w-5 text-green-500" />
                        <span className="font-medium">Downtime</span>
                      </div>
                      <p className="text-2xl font-bold">
                        {impact?.userImpact.downtimeWindows?.[0]?.duration || 0}m
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Expected downtime
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Notifications */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">User Notifications</h3>
                  <div className="space-y-2">
                    {impact?.userImpact.notifications.map((notification, index) => (
                      <Alert key={index}>
                        <Info className="h-4 w-4" />
                        <AlertDescription>{notification}</AlertDescription>
                      </Alert>
                    ))}
                  </div>
                </div>

                {/* Training Requirements */}
                {impact?.userImpact.trainingRequired && (
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Training Requirements</h3>
                    <Alert className="border-orange-200 bg-orange-50">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription className="text-orange-800">
                        Users will require training on the new authentication requirements and session management policies.
                      </AlertDescription>
                    </Alert>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="security" className="mt-6">
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-4">Security Implications</h3>
                  <div className="space-y-4">
                    {securityImplications.map((impl, index) => (
                      <Card key={index}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Shield className={`h-4 w-4 text-${getSeverityColor(impl.severity)}`} />
                              <span className="font-medium">{impl.type}</span>
                            </div>
                            <Badge className={getRiskLevelColor(impl.severity as RiskLevel)}>
                              {impl.severity}
                            </Badge>
                          </div>

                          <p className="text-sm text-muted-foreground mb-3">
                            {impl.description}
                          </p>

                          <div className="space-y-2">
                            <div>
                              <span className="text-xs font-semibold text-muted-foreground">Affected Controls:</span>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {impl.affectedControls.map((control, idx) => (
                                  <Badge key={idx} variant="outline" className="text-xs">
                                    {control}
                                  </Badge>
                                ))}
                              </div>
                            </div>

                            <div>
                              <span className="text-xs font-semibold text-muted-foreground">Mitigations:</span>
                              <ul className="mt-1 space-y-1">
                                {impl.mitigations.map((mitigation, idx) => (
                                  <li key={idx} className="text-xs text-muted-foreground flex items-start gap-1">
                                    <span>•</span>
                                    <span>{mitigation}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="performance" className="mt-6">
              <div className="space-y-6">
                {/* Performance Charts */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">Performance Impact</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {impactMetrics.map((metric, index) => (
                      <Card key={index}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-3">
                            <span className="font-medium">{metric.name}</span>
                            <div className={`flex items-center gap-1 text-${getSeverityColor(metric.severity)}`}>
                              {getTrendIcon(metric.trend)}
                              <span className="text-sm font-semibold">
                                {metric.change > 0 ? '+' : ''}{metric.changePercent}%
                              </span>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Current</span>
                              <span>{metric.current}{metric.unit}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Projected</span>
                              <span className="font-semibold">{metric.projected}{metric.unit}</span>
                            </div>
                          </div>

                          <div className="mt-3">
                            <div className="relative h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className={`absolute h-full transition-all duration-500 ${
                                  metric.changePercent > 0 ? 'bg-red-500' : 'bg-green-500'
                                }`}
                                style={{
                                  width: `${Math.min(Math.abs(metric.changePercent), 100)}%`,
                                  left: metric.changePercent < 0 ? 'auto' : '0',
                                  right: metric.changePercent < 0 ? '0' : 'auto'
                                }}
                              />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>

                {/* Resource Utilization */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">Resource Utilization</h3>
                  <Card>
                    <CardContent className="p-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium">CPU Usage</span>
                            <span className="text-sm">+10%</span>
                          </div>
                          <Progress value={40} className="h-2" />
                          <p className="text-xs text-muted-foreground mt-1">
                            From 30% to 40%
                          </p>
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium">Memory Usage</span>
                            <span className="text-sm">+128MB</span>
                          </div>
                          <Progress value={65} className="h-2" />
                          <p className="text-xs text-muted-foreground mt-1">
                            From 512MB to 640MB
                          </p>
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium">Response Time</span>
                            <span className="text-sm">+8ms</span>
                          </div>
                          <Progress value={58} className="h-2" />
                          <p className="text-xs text-muted-foreground mt-1">
                            From 50ms to 58ms
                          </p>
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium">Error Rate</span>
                            <span className="text-sm">+0.1%</span>
                          </div>
                          <Progress value={20} className="h-2" />
                          <p className="text-xs text-muted-foreground mt-1">
                            From 0.1% to 0.2%
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
