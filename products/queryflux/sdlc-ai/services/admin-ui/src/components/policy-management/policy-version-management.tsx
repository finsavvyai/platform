/**
 * Policy Version Management Component
 *
 * Enterprise-grade policy version management with rollback capabilities,
 * version comparison, and comprehensive audit trails
 */

'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  GitCommit,
  GitBranch,
  GitMerge,
  GitCompare,
  History,
  RotateCcw,
  Download,
  Upload,
  Copy,
  Eye,
  EyeOff,
  Search,
  Filter,
  Calendar,
  User,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Info,
  ChevronLeft,
  ChevronRight,
  FileText,
  Code,
  Shield,
  Activity,
  BarChart3,
  Users,
  Settings,
  Tag,
  Archive,
  Trash2,
  RefreshCw,
  Loader2,
  ExternalLink,
  Lock,
  Unlock,
  Key,
  Zap,
  Database,
  Server,
  Globe
} from 'lucide-react';

import {
  PolicyVersion,
  Policy,
  PolicyTestResult,
  PolicyDeployment
} from '@/types/policy-management';

interface PolicyVersionManagementProps {
  policyId: string;
  versions: PolicyVersion[];
  onVersionSelect?: (version: PolicyVersion) => void;
  onVersionCompare?: (v1: PolicyVersion, v2: PolicyVersion) => void;
  onVersionRestore?: (version: PolicyVersion) => void;
}

interface VersionComparison {
  version1: PolicyVersion;
  version2: PolicyVersion;
  differences: VersionDiff[];
  summary: {
    added: number;
    removed: number;
    modified: number;
    total: number;
  };
}

interface VersionDiff {
  type: 'added' | 'removed' | 'modified';
  path: string;
  oldValue?: string;
  newValue?: string;
  lineNumber?: number;
  impact: 'low' | 'medium' | 'high' | 'critical';
}

interface VersionMetrics {
  deployments: number;
  rollbacks: number;
  avgPerformance: number;
  errorRate: number;
  lastDeployed?: Date;
  successRate: number;
}

export default function PolicyVersionManagement({
  policyId,
  versions = [],
  onVersionSelect,
  onVersionCompare,
  onVersionRestore
}: PolicyVersionManagementProps) {
  const [selectedVersion, setSelectedVersion] = useState<PolicyVersion | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [compareVersions, setCompareVersions] = useState<[PolicyVersion?, PolicyVersion?]>([null, null]);
  const [viewMode, setViewMode] = useState<'list' | 'timeline' | 'grid'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'deprecated' | 'draft'>('all');
  const [showDiffView, setShowDiffView] = useState(false);
  const [comparison, setComparison] = useState<VersionComparison | null>(null);
  const [versionMetrics, setVersionMetrics] = useState<Record<string, VersionMetrics>>({});
  const [isRestoring, setIsRestoring] = useState(false);
  const [selectedTab, setSelectedTab] = useState('overview');

  // Mock versions data
  const mockVersions: PolicyVersion[] = [
    {
      version: 5,
      createdAt: new Date('2024-01-10T10:30:00Z'),
      createdBy: 'john.doe@example.com',
      changelog: 'Added MFA requirement for privileged operations',
      regoCode: 'package sdlc.policy\n\ndefault allow = false\n\nallow {\n    input.user.authenticated\n    input.user.mfa_verified\n    time.now_ns() - input.user.last_login < 86400000000000\n}',
      metadata: {
        version: '5.0.0',
        schema: 'rego-v1',
        compatibility: ['opa-v1.0'],
        requirements: ['MFA infrastructure'],
        limitations: ['None'],
        performance: {
          maxExecutionTime: 5000,
          averageExecutionTime: 1200,
          memoryUsage: 256,
          cpuUsage: 0.8,
          throughput: 800,
          errorRate: 0.02
        },
        compliance: {
          frameworks: ['SOX', 'HIPAA', 'PCI-DSS'],
          controls: ['AC-2', 'AC-3', 'IA-2'],
          certifications: ['ISO 27001'],
          lastAudit: new Date('2024-01-05T00:00:00Z'),
          nextAudit: new Date('2024-04-05T00:00:00Z'),
          auditScore: 95
        },
        risk: {
          level: 'medium',
          score: 45,
          factors: ['MFA dependency', 'User training required'],
          mitigations: ['Backup auth methods', 'Graceful rollout'],
          lastAssessed: new Date('2024-01-10T10:30:00Z')
        }
      },
      checksum: 'sha256:abc123...',
      signature: '-----BEGIN SIGNATURE-----\n...',
      approvedBy: 'jane.smith@example.com',
      approvedAt: new Date('2024-01-10T11:00:00Z')
    },
    {
      version: 4,
      createdAt: new Date('2024-01-05T14:20:00Z'),
      createdBy: 'jane.smith@example.com',
      changelog: 'Enhanced session management with secure token handling',
      regoCode: 'package sdlc.policy\n\ndefault allow = false\n\nallow {\n    input.user.authenticated\n    valid_session(input.user.session_id)\n    time.now_ns() - input.user.last_login < 172800000000000\n}',
      metadata: {
        version: '4.2.1',
        schema: 'rego-v1',
        compatibility: ['opa-v1.0'],
        requirements: ['Redis session store'],
        limitations: ['Session size limited'],
        performance: {
          maxExecutionTime: 3000,
          averageExecutionTime: 800,
          memoryUsage: 192,
          cpuUsage: 0.5,
          throughput: 1000,
          errorRate: 0.01
        },
        compliance: {
          frameworks: ['SOX', 'HIPAA'],
          controls: ['AC-2', 'SC-23'],
          certifications: ['ISO 27001'],
          lastAudit: new Date('2024-01-01T00:00:00Z'),
          nextAudit: new Date('2024-04-01T00:00:00Z'),
          auditScore: 92
        },
        risk: {
          level: 'low',
          score: 25,
          factors: ['Session persistence'],
          mitigations: ['Session failover', 'Token refresh'],
          lastAssessed: new Date('2024-01-05T14:20:00Z')
        }
      },
      checksum: 'sha256:def456...',
      signature: '-----BEGIN SIGNATURE-----\n...',
      approvedBy: 'mike.johnson@example.com',
      approvedAt: new Date('2024-01-05T15:00:00Z')
    },
    {
      version: 3,
      createdAt: new Date('2023-12-20T09:15:00Z'),
      createdBy: 'mike.johnson@example.com',
      changelog: 'Fixed RBAC evaluation logic for nested roles',
      regoCode: 'package sdlc.policy\n\ndefault allow = false\n\nallow {\n    user_roles := data.roles[input.user.id]\n    required_roles := data.resources[input.resource.id].roles\n    count(user_roles & required_roles) > 0\n}',
      metadata: {
        version: '3.1.0',
        schema: 'rego-v1',
        compatibility: ['opa-v1.0'],
        requirements: ['Role database'],
        limitations: ['Max 10 nested roles'],
        performance: {
          maxExecutionTime: 2000,
          averageExecutionTime: 500,
          memoryUsage: 128,
          cpuUsage: 0.3,
          throughput: 1200,
          errorRate: 0.005
        },
        compliance: {
          frameworks: ['SOX'],
          controls: ['AC-2', 'AC-3'],
          certifications: ['ISO 27001'],
          lastAudit: new Date('2023-12-15T00:00:00Z'),
          nextAudit: new Date('2024-03-15T00:00:00Z'),
          auditScore: 88
        },
        risk: {
          level: 'low',
          score: 20,
          factors: ['Role complexity'],
          mitigations: ['Role caching', 'Optimized queries'],
          lastAssessed: new Date('2023-12-20T09:15:00Z')
        }
      },
      checksum: 'sha256:ghi789...',
      signature: '-----BEGIN SIGNATURE-----\n...',
      approvedBy: 'john.doe@example.com',
      approvedAt: new Date('2023-12-20T10:00:00Z')
    }
  ];

  const allVersions = versions.length > 0 ? versions : mockVersions;

  // Initialize version metrics
  useEffect(() => {
    const metrics: Record<string, VersionMetrics> = {};

    allVersions.forEach(version => {
      metrics[version.version] = {
        deployments: Math.floor(Math.random() * 10) + 1,
        rollbacks: Math.floor(Math.random() * 2),
        avgPerformance: 85 + Math.random() * 15,
        errorRate: Math.random() * 0.05,
        lastDeployed: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
        successRate: 95 + Math.random() * 5
      };
    });

    setVersionMetrics(metrics);
  }, [allVersions]);

  // Filter versions
  const filteredVersions = allVersions.filter(version => {
    if (searchQuery && !version.changelog.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }

    if (filterStatus === 'active' && version.metadata.version.includes('-rc')) {
      return false;
    }

    if (filterStatus === 'deprecated' && !version.metadata.version.includes('-deprecated')) {
      return false;
    }

    return true;
  });

  // Compare versions
  const compareVersions = useCallback((v1: PolicyVersion, v2: PolicyVersion) => {
    const differences: VersionDiff[] = [];
    let added = 0;
    let removed = 0;
    let modified = 0;

    // Simple diff simulation
    const lines1 = v1.regoCode.split('\n');
    const lines2 = v2.regoCode.split('\n');

    lines2.forEach((line, index) => {
      if (!lines1[index]) {
        differences.push({
          type: 'added',
          path: `rego:${index + 1}`,
          newValue: line,
          lineNumber: index + 1,
          impact: line.includes('allow') ? 'high' : 'low'
        });
        added++;
      } else if (lines1[index] !== line) {
        differences.push({
          type: 'modified',
          path: `rego:${index + 1}`,
          oldValue: lines1[index],
          newValue: line,
          lineNumber: index + 1,
          impact: line.includes('allow') ? 'high' : 'medium'
        });
        modified++;
      }
    });

    if (lines1.length > lines2.length) {
      lines1.slice(lines2.length).forEach((line, index) => {
        differences.push({
          type: 'removed',
          path: `rego:${lines2.length + index + 1}`,
          oldValue: line,
          lineNumber: lines2.length + index + 1,
          impact: line.includes('allow') ? 'high' : 'medium'
        });
        removed++;
      });
    }

    const comparison: VersionComparison = {
      version1: v1,
      version2: v2,
      differences,
      summary: {
        added,
        removed,
        modified,
        total: added + removed + modified
      }
    };

    setComparison(comparison);
    setShowDiffView(true);

    if (onVersionCompare) {
      onVersionCompare(v1, v2);
    }
  }, [onVersionCompare]);

  // Restore version
  const handleRestore = useCallback(async (version: PolicyVersion) => {
    setIsRestoring(true);

    // Simulate restore process
    await new Promise(resolve => setTimeout(resolve, 2000));

    if (onVersionRestore) {
      onVersionRestore(version);
    }

    setIsRestoring(false);
  }, [onVersionRestore]);

  // Get version status badge
  const getVersionStatusBadge = (version: PolicyVersion) => {
    if (version.version === allVersions[0]?.version) {
      return <Badge className="bg-green-100 text-green-800">Current</Badge>;
    }
    if (version.metadata.version.includes('-rc')) {
      return <Badge variant="secondary">Release Candidate</Badge>;
    }
    if (version.metadata.version.includes('-deprecated')) {
      return <Badge variant="destructive">Deprecated</Badge>;
    }
    return <Badge variant="outline">Previous</Badge>;
  };

  // Get risk level color
  const getRiskLevelColor = (level: string) => {
    switch (level) {
      case 'low': return 'text-green-600 bg-green-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'high': return 'text-orange-600 bg-orange-100';
      case 'critical': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b bg-gray-50 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Version Management</h2>
            <p className="text-sm text-muted-foreground">
              Manage policy versions, compare changes, and restore previous versions
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={compareMode ? 'default' : 'outline'}
              onClick={() => {
                setCompareMode(!compareMode);
                setCompareVersions([null, null]);
                setShowDiffView(false);
              }}
            >
              <GitCompare className="h-4 w-4 mr-1" />
              Compare
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const data = {
                  versions: allVersions,
                  timestamp: new Date().toISOString()
                };
                const blob = new Blob([JSON.stringify(data, null, 2)], {
                  type: 'application/json'
                });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `policy-versions-${policyId}-${Date.now()}.json`;
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              <Download className="h-4 w-4 mr-1" />
              Export
            </Button>

            <Button
              size="sm"
              onClick={() => {
                // Create new version
                console.log('Create new version');
              }}
            >
              <GitCommit className="h-4 w-4 mr-1" />
              New Version
            </Button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex items-center gap-4 mt-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search versions by changelog..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <Select value={filterStatus} onValueChange={(value: any) => setFilterStatus(value)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Versions</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="deprecated">Deprecated</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              onClick={() => setViewMode('list')}
            >
              <FileText className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant={viewMode === 'timeline' ? 'default' : 'ghost'}
              onClick={() => setViewMode('timeline')}
            >
              <History className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              onClick={() => setViewMode('grid')}
            >
              <Database className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex">
        {compareMode && !showDiffView ? (
          /* Compare Mode Selection */
          <div className="flex-1 p-8">
            <div className="max-w-4xl mx-auto">
              <h3 className="text-lg font-semibold mb-6">Select Versions to Compare</h3>

              <div className="grid grid-cols-2 gap-8">
                <div>
                  <Label className="text-sm font-medium mb-3 block">Version 1</Label>
                  <div className="space-y-2">
                    {allVersions.map(version => (
                      <Card
                        key={version.version}
                        className={`cursor-pointer transition-colors ${
                          compareVersions[0]?.version === version.version
                            ? 'border-blue-500 bg-blue-50'
                            : 'hover:bg-gray-50'
                        }`}
                        onClick={() => {
                          if (compareVersions[1]?.version === version.version) return;
                          setCompareVersions([version, compareVersions[1]]);
                        }}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">v{version.version}</span>
                            {getVersionStatusBadge(version)}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {version.changelog}
                          </p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium mb-3 block">Version 2</Label>
                  <div className="space-y-2">
                    {allVersions.map(version => (
                      <Card
                        key={version.version}
                        className={`cursor-pointer transition-colors ${
                          compareVersions[1]?.version === version.version
                            ? 'border-blue-500 bg-blue-50'
                            : 'hover:bg-gray-50'
                        } ${compareVersions[0]?.version === version.version ? 'opacity-50' : ''}`}
                        onClick={() => {
                          if (compareVersions[0]?.version === version.version) return;
                          setCompareVersions([compareVersions[0], version]);
                        }}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">v{version.version}</span>
                            {getVersionStatusBadge(version)}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {version.changelog}
                          </p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-center mt-8">
                <Button
                  onClick={() => {
                    if (compareVersions[0] && compareVersions[1]) {
                      compareVersions(compareVersions[0], compareVersions[1]);
                    }
                  }}
                  disabled={!compareVersions[0] || !compareVersions[1]}
                  className="px-8"
                >
                  <GitCompare className="h-4 w-4 mr-2" />
                  Compare Versions
                </Button>
              </div>
            </div>
          </div>
        ) : showDiffView && comparison ? (
          /* Diff View */
          <div className="flex-1 p-4 overflow-auto">
            <div className="max-w-6xl mx-auto">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Badge>v{comparison.version1.version}</Badge>
                    <ChevronRight className="h-4 w-4" />
                    <Badge>v{comparison.version2.version}</Badge>
                  </div>

                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <div className="w-3 h-3 bg-green-500" />
                      Added: {comparison.summary.added}
                    </span>
                    <span className="flex items-center gap-1">
                      <div className="w-3 h-3 bg-red-500" />
                      Removed: {comparison.summary.removed}
                    </span>
                    <span className="flex items-center gap-1">
                      <div className="w-3 h-3 bg-yellow-500" />
                      Modified: {comparison.summary.modified}
                    </span>
                  </div>
                </div>

                <Button
                  variant="outline"
                  onClick={() => {
                    setShowDiffView(false);
                    setCompareMode(false);
                    setComparison(null);
                  }}
                >
                  Close
                </Button>
              </div>

              <div className="space-y-2">
                {comparison.differences.map((diff, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded font-mono text-sm ${
                      diff.type === 'added' ? 'bg-green-50 border-l-4 border-green-500' :
                      diff.type === 'removed' ? 'bg-red-50 border-l-4 border-red-500' :
                      'bg-yellow-50 border-l-4 border-yellow-500'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-muted-foreground">
                        Line {diff.lineNumber}
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-xs ${
                          diff.impact === 'critical' ? 'border-red-500 text-red-600' :
                          diff.impact === 'high' ? 'border-orange-500 text-orange-600' :
                          diff.impact === 'medium' ? 'border-yellow-500 text-yellow-600' :
                          'border-gray-500'
                        }`}
                      >
                        {diff.impact}
                      </Badge>
                    </div>

                    {diff.type === 'added' && (
                      <div className="text-green-700">
                        + {diff.newValue}
                      </div>
                    )}

                    {diff.type === 'removed' && (
                      <div className="text-red-700">
                        - {diff.oldValue}
                      </div>
                    )}

                    {diff.type === 'modified' && (
                      <div className="space-y-1">
                        <div className="text-red-700">
                          - {diff.oldValue}
                        </div>
                        <div className="text-green-700">
                          + {diff.newValue}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Version List */
          <div className="flex-1 flex">
            <div className="flex-1 overflow-y-auto">
              <ScrollArea className="h-full">
                <div className="p-4 space-y-4">
                  {filteredVersions.map((version) => (
                    <Card
                      key={version.version}
                      className={`cursor-pointer transition-all hover:shadow-md ${
                        selectedVersion?.version === version.version ? 'border-blue-500' : ''
                      }`}
                      onClick={() => setSelectedVersion(version)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <div className="flex items-center gap-2">
                                <GitCommit className="h-4 w-4 text-gray-500" />
                                <span className="font-semibold">Version {version.version}</span>
                                {getVersionStatusBadge(version)}
                              </div>

                              <Badge className={getRiskLevelColor(version.metadata.risk.level)}>
                                {version.metadata.risk.level} risk
                              </Badge>
                            </div>

                            <p className="text-sm text-muted-foreground mb-3">
                              {version.changelog}
                            </p>

                            <div className="flex items-center gap-6 text-xs text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                <span>{version.createdBy.split('@')[0]}</span>
                              </div>

                              <div className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                <span>{version.createdAt.toLocaleDateString()}</span>
                              </div>

                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                <span>{version.createdAt.toLocaleTimeString()}</span>
                              </div>

                              {version.approvedBy && (
                                <div className="flex items-center gap-1">
                                  <CheckCircle className="h-3 w-3 text-green-500" />
                                  <span>Approved by {version.approvedBy.split('@')[0]}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 ml-4">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedVersion(version);
                                setSelectedTab('overview');
                              }}
                            >
                              <Eye className="h-3 w-3" />
                            </Button>

                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (compareVersions[0] && !compareVersions[1]) {
                                  setCompareVersions([compareVersions[0], version]);
                                  compareVersions(compareVersions[0], version);
                                } else {
                                  setCompareVersions([version, null]);
                                  setCompareMode(true);
                                }
                              }}
                            >
                              <GitCompare className="h-3 w-3" />
                            </Button>

                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRestore(version);
                              }}
                              disabled={isRestoring || version.version === allVersions[0]?.version}
                            >
                              {isRestoring && selectedVersion?.version === version.version ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <RotateCcw className="h-3 w-3" />
                              )}
                            </Button>
                          </div>
                        </div>

                        {/* Version Metrics */}
                        {versionMetrics[version.version] && (
                          <div className="mt-4 pt-3 border-t">
                            <div className="grid grid-cols-4 gap-4 text-xs">
                              <div>
                                <span className="text-muted-foreground">Deployments:</span>
                                <span className="ml-1 font-medium">
                                  {versionMetrics[version.version].deployments}
                                </span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Success Rate:</span>
                                <span className="ml-1 font-medium">
                                  {versionMetrics[version.version].successRate.toFixed(1)}%
                                </span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Avg Performance:</span>
                                <span className="ml-1 font-medium">
                                  {versionMetrics[version.version].avgPerformance.toFixed(0)}%
                                </span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Error Rate:</span>
                                <span className="ml-1 font-medium">
                                  {(versionMetrics[version.version].errorRate * 100).toFixed(2)}%
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {/* Version Details Panel */}
            {selectedVersion && (
              <div className="w-96 border-l bg-gray-50 overflow-y-auto">
                <div className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold">Version Details</h3>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setSelectedVersion(null)}
                    >
                      <XCircle className="h-4 w-4" />
                    </Button>
                  </div>

                  <Tabs value={selectedTab} onValueChange={setSelectedTab}>
                    <TabsList className="grid w-full grid-cols-3 mb-4">
                      <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
                      <TabsTrigger value="code" className="text-xs">Code</TabsTrigger>
                      <TabsTrigger value="metrics" className="text-xs">Metrics</TabsTrigger>
                    </TabsList>

                    <TabsContent value="overview" className="space-y-4">
                      <div>
                        <Label className="text-xs font-semibold text-muted-foreground">Version</Label>
                        <p className="font-medium">{selectedVersion.version}</p>
                      </div>

                      <div>
                        <Label className="text-xs font-semibold text-muted-foreground">Created By</Label>
                        <p className="text-sm">{selectedVersion.createdBy}</p>
                      </div>

                      <div>
                        <Label className="text-xs font-semibold text-muted-foreground">Created At</Label>
                        <p className="text-sm">{selectedVersion.createdAt.toLocaleString()}</p>
                      </div>

                      <div>
                        <Label className="text-xs font-semibold text-muted-foreground">Changelog</Label>
                        <p className="text-sm">{selectedVersion.changelog}</p>
                      </div>

                      <div>
                        <Label className="text-xs font-semibold text-muted-foreground">Risk Level</Label>
                        <Badge className={getRiskLevelColor(selectedVersion.metadata.risk.level)}>
                          {selectedVersion.metadata.risk.level.toUpperCase()}
                        </Badge>
                      </div>

                      <div>
                        <Label className="text-xs font-semibold text-muted-foreground">Risk Score</Label>
                        <p className="text-sm">{selectedVersion.metadata.risk.score}/100</p>
                      </div>

                      <Separator />

                      <div>
                        <Label className="text-xs font-semibold text-muted-foreground">Compliance</Label>
                        <div className="space-y-1 mt-2">
                          {selectedVersion.metadata.compliance.frameworks.map((framework, index) => (
                            <Badge key={index} variant="outline" className="text-xs mr-1">
                              {framework}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      <div>
                        <Label className="text-xs font-semibold text-muted-foreground">Audit Score</Label>
                        <p className="text-sm">{selectedVersion.metadata.compliance.auditScore}/100</p>
                      </div>
                    </TabsContent>

                    <TabsContent value="code">
                      <div className="mt-2">
                        <pre className="text-xs bg-gray-900 text-gray-100 p-3 rounded overflow-x-auto">
                          <code>{selectedVersion.regoCode}</code>
                        </pre>
                      </div>
                    </TabsContent>

                    <TabsContent value="metrics" className="space-y-4">
                      {versionMetrics[selectedVersion.version] && (
                        <div className="space-y-3">
                          <div>
                            <Label className="text-xs font-semibold text-muted-foreground">Performance</Label>
                            <div className="mt-1 space-y-1">
                              <div className="flex justify-between text-sm">
                                <span>Max Execution Time</span>
                                <span>{selectedVersion.metadata.performance.maxExecutionTime}ms</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span>Avg Execution Time</span>
                                <span>{selectedVersion.metadata.performance.averageExecutionTime}ms</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span>Memory Usage</span>
                                <span>{selectedVersion.metadata.performance.memoryUsage}MB</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span>CPU Usage</span>
                                <span>{(selectedVersion.metadata.performance.cpuUsage * 100).toFixed(1)}%</span>
                              </div>
                            </div>
                          </div>

                          <div>
                            <Label className="text-xs font-semibold text-muted-foreground">Deployment History</Label>
                            <div className="mt-1 space-y-1">
                              <div className="flex justify-between text-sm">
                                <span>Total Deployments</span>
                                <span>{versionMetrics[selectedVersion.version].deployments}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span>Rollbacks</span>
                                <span>{versionMetrics[selectedVersion.version].rollbacks}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span>Success Rate</span>
                                <span>{versionMetrics[selectedVersion.version].successRate.toFixed(1)}%</span>
                              </div>
                            </div>
                          </div>

                          {versionMetrics[selectedVersion.version].lastDeployed && (
                            <div>
                              <Label className="text-xs font-semibold text-muted-foreground">Last Deployed</Label>
                              <p className="text-sm">
                                {versionMetrics[selectedVersion.version].lastDeployed.toLocaleString()}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
