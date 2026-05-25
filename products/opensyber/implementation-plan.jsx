import React, { useState } from 'react';
import { ChevronDown, ChevronRight, CheckCircle, Clock, AlertCircle, Target, TrendingUp, Shield } from 'lucide-react';

const OpenSyberImplementationPlan = () => {
  const [expandedPhase, setExpandedPhase] = useState(1);
  const [expandedTasks, setExpandedTasks] = useState({});

  const toggleTask = (taskId) => {
    setExpandedTasks(prev => ({
      ...prev,
      [taskId]: !prev[taskId]
    }));
  };

  const phases = [
    {
      id: 1,
      name: 'Production Hardening',
      months: '1-2',
      dateRange: 'Apr-May',
      color: 'from-purple-600 to-purple-700',
      status: 'current'
    },
    {
      id: 2,
      name: 'Governance & Self-Service',
      months: '2-3',
      dateRange: 'May-Jun',
      color: 'from-cyan-500 to-cyan-600',
      status: 'upcoming'
    },
    {
      id: 3,
      name: 'New Integrations',
      months: '3-4',
      dateRange: 'Jun-Jul',
      color: 'from-blue-600 to-blue-700',
      status: 'upcoming'
    },
    {
      id: 4,
      name: 'Platform & Moat',
      months: '4-6',
      dateRange: 'Jul-Sep',
      color: 'from-indigo-600 to-indigo-700',
      status: 'upcoming'
    }
  ];

  const tasks = {
    1: [
      {
        id: 'p1-dlq',
        title: 'Dead-Letter Queues & Retry Scheduler',
        description: 'Implement resilient message handling with exponential backoff',
        details: {
          implementation: 'Cloudflare Queues with exponential backoff (1s→5min), max 5 attempts, ±20% jitter',
          dod: [
            'DLQ captures all failed messages',
            'Retry mechanism with configurable delays',
            'Dashboard visibility into DLQ status',
            'Automated retry triggers',
            'Failed message persistence & analysis'
          ],
          priority: 'Critical',
          effort: '5 days',
          notes: 'Foundation for reliability; unblocks Phase 2 governance features'
        }
      },
      {
        id: 'p1-dedup',
        title: 'Global Deduplication Layer',
        description: 'Prevent duplicate processing across integrations',
        details: {
          implementation: 'Composite dedup key per integration, KV cache TTL 2 hours',
          dod: [
            'Composite key generation per integration',
            'KV cache with 2hr TTL configured',
            'Dedup metrics & monitoring',
            'Collision handling strategy',
            'Performance benchmarks <50ms lookup'
          ],
          priority: 'Critical',
          effort: '4 days',
          notes: 'Reduces duplicate alerts by 70-90%; saves compute & storage'
        }
      },
      {
        id: 'p1-health',
        title: 'Per-Integration Health Dashboard',
        description: 'Monitor SLOs per integration with real-time metrics',
        details: {
          implementation: 'Cloud: ≤10min/99.5%, IDE: ≤6min/99%, SIEM: ≤30s/99.9%',
          dod: [
            'SLO definitions per integration type',
            'Real-time metric ingestion',
            'Alert thresholds configured',
            'Historical trend visualization',
            'Incident correlation layer'
          ],
          priority: 'High',
          effort: '6 days',
          notes: 'Visibility into system health; enables proactive remediation'
        }
      },
      {
        id: 'p1-multitenancy',
        title: 'Multi-Tenant KV Namespace Isolation',
        description: 'Enforce data isolation for tenant credentials and configs',
        details: {
          implementation: 'Prefix: tenant:{tenantId}:credentials:{slug}, D1 RLS audit enabled',
          dod: [
            'Tenant-scoped KV namespace prefixes',
            'D1 row-level security configured',
            'Audit trail for all access',
            'Credential encryption in transit & at rest',
            'Isolation test coverage >95%'
          ],
          priority: 'Critical',
          effort: '7 days',
          notes: 'Enterprise requirement; enables SOC 2 compliance'
        }
      },
      {
        id: 'p1-socket',
        title: 'Socket.dev npm Threat Feed Integration',
        description: 'Ingest npm supply chain threats',
        details: {
          implementation: 'Real-time API polling, malware/typosquatting/CVSS scoring',
          dod: [
            'Feed ingestion pipeline configured',
            'Threat classification & scoring',
            'Alert routing to SIEM',
            'Historical tracking',
            'Performance <2s poll latency'
          ],
          priority: 'High',
          effort: '3 days',
          notes: 'First external threat data; validates integration pattern'
        }
      },
      {
        id: 'p1-defender',
        title: 'Defender for Office 365 ThreatIntelligence',
        description: 'Process Microsoft threat intelligence records',
        details: {
          implementation: 'RecordType filtering, M365 API integration, threat correlation',
          dod: [
            'M365 ThreatIntelligence API connected',
            'RecordType parsing & enrichment',
            'Email threat correlation',
            'UI display for threat context',
            'Alert routing to SIEM integration'
          ],
          priority: 'High',
          effort: '4 days',
          notes: 'Enables M365 email security workflow'
        }
      }
    ],
    2: [
      {
        id: 'p2-rbac',
        title: 'RBAC: 3 Core Roles',
        description: 'SOC Analyst, Integration Engineer, Admin with permission boundaries',
        details: {
          implementation: '3 roles: SOC Analyst (read/triage), Integration Engineer (config/test), Admin (full)',
          dod: [
            'Role definitions & permissions matrix',
            'API authorization gates',
            'UI-level permission enforcement',
            'Audit log for privilege use',
            'Role assignment workflows'
          ],
          priority: 'Critical',
          effort: '5 days',
          notes: 'Foundation for Phase 2 governance; required for SSO integration'
        }
      },
      {
        id: 'p2-sso',
        title: 'SAML/OIDC SSO + SCIM 2.0',
        description: 'Enterprise identity & provisioning',
        details: {
          implementation: 'SAML 2.0 & OIDC support, SCIM 2.0 auto-provisioning',
          dod: [
            'SAML metadata endpoint',
            'OIDC discovery & token validation',
            'SCIM user/group endpoints',
            'SCIM attribute mapping',
            'Test with Okta/Azure AD'
          ],
          priority: 'Critical',
          effort: '8 days',
          notes: 'Major enterprise requirement; enables customer onboarding'
        }
      },
      {
        id: 'p2-wizard',
        title: 'Self-Service Integration Wizards',
        description: 'Guided setup for AWS, Azure, M365, GitHub',
        details: {
          implementation: 'Multi-step wizards with credential validation, permission scopes, test connections',
          dod: [
            'AWS IAM role templates',
            'Azure SP credential flow',
            'M365 API consent screens',
            'GitHub OAuth app creation',
            'Credential validation & testing'
          ],
          priority: 'High',
          effort: '10 days',
          notes: 'Dramatically reduces onboarding friction; self-serve reduces support load'
        }
      },
      {
        id: 'p2-versioning',
        title: 'Config Versioning & Immutable Audit',
        description: 'Track all integration config changes',
        details: {
          implementation: 'Git-style versioning, immutable history, rollback capability',
          dod: [
            'Version control for all configs',
            'Immutable change history',
            'Rollback mechanism',
            'Diff visualization',
            'Change approval workflow'
          ],
          priority: 'High',
          effort: '6 days',
          notes: 'Critical for compliance & incident investigation'
        }
      },
      {
        id: 'p2-policy',
        title: 'Policy/Rule Engine v1 + 10 Detection Packs',
        description: 'Custom detection logic & pre-built threat packs',
        details: {
          implementation: '10 pre-built packs: lateral movement, exfil, privilege escalation, persistence, etc.',
          dod: [
            'Rule engine DSL',
            '10 detection packs released',
            'Rule composition UI',
            'Performance: <200ms per rule',
            'Testing framework for rules'
          ],
          priority: 'High',
          effort: '12 days',
          notes: 'Enables custom threat detection; key differentiator vs competitors'
        }
      },
      {
        id: 'p2-killchain',
        title: 'Kill Chain Correlation v1',
        description: 'Link multi-step attack patterns',
        details: {
          implementation: 'MITRE ATT&CK mapping, temporal correlation, event chain visualization',
          dod: [
            'Kill chain correlation rules',
            'MITRE ATT&CK mapping',
            'Incident grouping',
            'Visual attack timeline',
            'Confidence scoring'
          ],
          priority: 'Medium',
          effort: '7 days',
          notes: 'Moves from isolated alerts to narratives; key for SOC efficiency'
        }
      }
    ],
    3: [
      {
        id: 'p3-mcp',
        title: 'MCP Server Monitoring',
        description: 'Monitor Claude agents via MCP (discovery, tool logging, secret detection)',
        details: {
          implementation: 'MCP tool invocation logging, static secret scanning, agent activity tracking',
          dod: [
            'MCP server discovery mechanism',
            'Tool invocation logging',
            'Output/input secret detection',
            'Agent workflow visualization',
            'Compliance audit trail'
          ],
          priority: 'High',
          effort: '8 days',
          notes: 'Addresses critical gap in AI agent supply chain visibility'
        }
      },
      {
        id: 'p3-langsmith',
        title: 'LangSmith SDK Wrapper + OTEL Ingestion',
        description: 'Monitor LLM ops via LangSmith & OpenTelemetry',
        details: {
          implementation: 'LangSmith SDK integration, OTEL span exporter, trace correlation',
          dod: [
            'LangSmith SDK wrapper',
            'OpenTelemetry exporter',
            'Trace correlation IDs',
            'Cost tracking per invocation',
            'Model performance metrics'
          ],
          priority: 'High',
          effort: '6 days',
          notes: 'Enables observability into LLM supply chain costs & performance'
        }
      },
      {
        id: 'p3-copilot',
        title: 'Copilot Studio Agent Monitoring',
        description: 'Monitor Microsoft Copilot agents via M365 Management API',
        details: {
          implementation: 'M365 Management Activity API, Copilot Studio webhook events',
          dod: [
            'M365 Management API setup',
            'Agent action logging',
            'Conversation tracking',
            'Anomaly detection',
            'Compliance export'
          ],
          priority: 'Medium',
          effort: '5 days',
          notes: 'Covers Microsoft AI agent supply chain'
        }
      },
      {
        id: 'p3-wiz',
        title: 'Wiz Security Webhook Integration',
        description: 'Ingest cloud security findings',
        details: {
          implementation: 'Webhook receiver, finding classification, enrichment, alert routing',
          dod: [
            'Webhook endpoint configured',
            'Finding type classification',
            'Risk scoring integration',
            'Routing to SIEM',
            'Deduplication'
          ],
          priority: 'Medium',
          effort: '3 days',
          notes: 'Expands cloud security coverage'
        }
      },
      {
        id: 'p3-classifier',
        title: 'AI Agent Command Intent Classifier',
        description: 'Classify agent commands for behavior analysis',
        details: {
          implementation: 'LLM-based command intent classification, behavior categorization',
          dod: [
            'Intent classifier model',
            'Command categorization',
            'Behavioral anomaly detection',
            'Feedback loop for training',
            'Performance >95% accuracy'
          ],
          priority: 'High',
          effort: '7 days',
          notes: 'Key for detecting agent misbehavior & supply chain attacks'
        }
      }
    ],
    4: [
      {
        id: 'p4-ai-act',
        title: 'EU AI Act Compliance Module',
        description: 'Framework for EU AI Act Aug 2026 deadline',
        details: {
          implementation: 'Model transparency, bias detection, audit trails, risk classification',
          dod: [
            'AI model registry',
            'Bias & fairness metrics',
            'Transparency documentation',
            'Audit trail for AI decisions',
            'High-risk AI classification'
          ],
          priority: 'Critical',
          effort: '10 days',
          notes: 'Regulatory requirement; impacts all AI features'
        }
      },
      {
        id: 'p4-crowdstrike',
        title: 'CrowdStrike Falcon Bi-Directional',
        description: 'Sync events & auto-remediation via CrowdStrike API',
        details: {
          implementation: 'Webhook ingestion, API response actions, credential management',
          dod: [
            'Event ingestion from Falcon',
            'Bi-directional sync',
            'Response action automation',
            'Credential rotation',
            'Scaling to 1M+ events/day'
          ],
          priority: 'High',
          effort: '8 days',
          notes: 'Flagship enterprise integration; enables auto-remediation workflows'
        }
      },
      {
        id: 'p4-servicenow',
        title: 'ServiceNow ITSM Integration',
        description: 'Create/update tickets, sync ticket status',
        details: {
          implementation: 'ServiceNow REST API, incident creation, runbook linking',
          dod: [
            'ITSM incident creation',
            'Bi-directional sync',
            'Runbook linking',
            'Assignment routing',
            'Custom field mapping'
          ],
          priority: 'High',
          effort: '6 days',
          notes: 'Closes loop between detection & incident management'
        }
      },
      {
        id: 'p4-public-api',
        title: 'Public Ingestion API + Connector SDK',
        description: 'Enable partners to build custom integrations',
        details: {
          implementation: 'OpenAPI spec, SDK generators (Python, Go, JS), auth & rate limiting',
          dod: [
            'Public REST API',
            'SDK generators',
            'Authentication (API key + OAuth)',
            'Rate limiting (1K req/min)',
            'Partner onboarding docs'
          ],
          priority: 'High',
          effort: '10 days',
          notes: 'Enables ecosystem; creates partner network effect'
        }
      },
      {
        id: 'p4-sbom',
        title: 'SBOM Generation',
        description: 'Export software bill of materials for compliance',
        details: {
          implementation: 'SPDX/CycloneDX formats, dependency graph analysis',
          dod: [
            'SBOM generation',
            'SPDX & CycloneDX output',
            'Dependency tracking',
            'License compliance',
            'Vulnerability mapping'
          ],
          priority: 'Medium',
          effort: '5 days',
          notes: 'Growing regulatory requirement; differentiator'
        }
      },
      {
        id: 'p4-mitre',
        title: 'MITRE ATLAS Mapping',
        description: 'Map all detections to MITRE ATLAS (AI threat matrix)',
        details: {
          implementation: 'Framework mapping, attack pattern matching, narrative generation',
          dod: [
            'MITRE ATLAS framework integration',
            'Attack pattern mapping',
            'Automatic tagging',
            'Dashboard visualization',
            'Export for CISO reporting'
          ],
          priority: 'High',
          effort: '6 days',
          notes: 'Unique positioning: only vendor mapping AI attacks to ATLAS'
        }
      },
      {
        id: 'p4-registry',
        title: 'Agent Registry (Flagship Differentiator)',
        description: 'Public registry for OpenClaw agents & MCP servers',
        details: {
          implementation: 'Web UI, agent metadata, capability discovery, threat scoring',
          dod: [
            'Agent registry schema',
            'UI for browsing agents',
            'Capability indexing',
            'Threat score per agent',
            'Integration with connector SDK'
          ],
          priority: 'Critical',
          effort: '12 days',
          notes: 'Key market differentiator vs competitors; flagship feature for Phase 4'
        }
      },
      {
        id: 'p4-gemini',
        title: 'Google Gemini for Workspace',
        description: 'Monitor Gemini agents in Google Workspace',
        details: {
          implementation: 'Google Workspace Admin API, Gemini activity tracking, intent classification',
          dod: [
            'Workspace Admin API integration',
            'Gemini activity ingestion',
            'User behavior tracking',
            'Anomaly detection',
            'Workspace audit integration'
          ],
          priority: 'Medium',
          effort: '6 days',
          notes: 'Covers Google AI agent supply chain'
        }
      }
    ]
  };

  const criticalGaps = [
    {
      dimension: 'Threat Coverage',
      gap: 'MCP Server Monitoring',
      description: 'Agents running custom MCP servers lack visibility into tool invocations, secret exfil, anomalies',
      phase: 3,
      impact: 'Supply chain blindness for AI agents'
    },
    {
      dimension: 'Engineering Maturity',
      gap: 'Deduplication & Resilience',
      description: 'Without DLQ + dedup, system suffers false positives, duplicate alerts, message loss under load',
      phase: 1,
      impact: 'Alert fatigue, data loss, poor SLOs'
    },
    {
      dimension: 'Enterprise Readiness',
      gap: 'RBAC, SSO, SCIM',
      description: 'Self-service, governance, and multi-tenant isolation impossible without identity federation',
      phase: 2,
      impact: 'Cannot scale to Fortune 500 enterprises'
    }
  ];

  const marketContext = [
    { metric: 'Market Size', value: '$9.1B→$139B', label: 'CAGR opportunity 2024-2026' },
    { metric: 'Penetration', value: '80%', label: 'Fortune 500 enterprises' },
    { metric: 'Avg Breach Cost', value: '$4.88M', label: 'Direct + indirect' },
    { metric: 'Compliance Deadline', value: 'Aug 2026', label: 'EU AI Act enforcement' }
  ];

  const TaskCard = ({ task, isExpanded, onToggle }) => (
    <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden hover:border-cyan-500 transition-colors">
      <button
        onClick={onToggle}
        className="w-full p-4 flex items-start justify-between hover:bg-slate-750 transition-colors"
      >
        <div className="flex items-start gap-3 flex-1 text-left">
          <div className="mt-1">
            {isExpanded ? (
              <ChevronDown className="w-5 h-5 text-cyan-400" />
            ) : (
              <ChevronRight className="w-5 h-5 text-slate-500" />
            )}
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-slate-100">{task.title}</h4>
            <p className="text-sm text-slate-400 mt-1">{task.description}</p>
          </div>
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-slate-700 bg-slate-850 p-4 space-y-4">
          <div>
            <h5 className="text-xs font-semibold text-cyan-400 uppercase tracking-wider mb-2">Implementation</h5>
            <p className="text-sm text-slate-300">{task.details.implementation}</p>
          </div>

          <div>
            <h5 className="text-xs font-semibold text-cyan-400 uppercase tracking-wider mb-2">Definition of Done</h5>
            <ul className="space-y-1">
              {task.details.dod.map((item, idx) => (
                <li key={idx} className="text-sm text-slate-300 flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">Priority</p>
              <p className={`text-sm font-semibold ${
                task.details.priority === 'Critical' ? 'text-red-400' :
                task.details.priority === 'High' ? 'text-yellow-400' :
                'text-slate-300'
              }`}>
                {task.details.priority}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">Effort</p>
              <p className="text-sm text-slate-300">{task.details.effort}</p>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-700">
            <p className="text-xs text-slate-400">
              <span className="text-cyan-400 font-semibold">Note:</span> {task.details.notes}
            </p>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      {/* Header */}
      <div className="bg-gradient-to-b from-slate-800 to-slate-900 border-b border-slate-700 px-8 py-12">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-400 to-cyan-400">
            OpenSyber Implementation Roadmap
          </h1>
          <p className="text-slate-400 mt-2 text-lg">Strategic 6-month execution plan: April–September 2026</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-8 space-y-8">
        {/* Market Context */}
        <div className="grid grid-cols-4 gap-4">
          {marketContext.map((item, idx) => (
            <div key={idx} className="bg-slate-800 border border-slate-700 rounded-lg p-4">
              <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">{item.metric}</p>
              <p className="text-2xl font-bold text-cyan-400 mt-2">{item.value}</p>
              <p className="text-xs text-slate-400 mt-1">{item.label}</p>
            </div>
          ))}
        </div>

        {/* Phase Progress Bar */}
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">4-Phase Roadmap</h2>
          <div className="flex gap-3">
            {phases.map((phase) => (
              <button
                key={phase.id}
                onClick={() => setExpandedPhase(phase.id)}
                className={`flex-1 p-4 rounded-lg border-2 transition-all cursor-pointer ${
                  expandedPhase === phase.id
                    ? `border-cyan-400 bg-gradient-to-r ${phase.color}`
                    : 'border-slate-600 bg-slate-700 hover:border-slate-500'
                }`}
              >
                <p className={`font-semibold text-sm ${expandedPhase === phase.id ? 'text-white' : 'text-slate-200'}`}>
                  {phase.name}
                </p>
                <p className={`text-xs mt-1 ${expandedPhase === phase.id ? 'text-slate-100' : 'text-slate-400'}`}>
                  {phase.dateRange}
                </p>
                <p className={`text-xs mt-0.5 ${expandedPhase === phase.id ? 'text-slate-200' : 'text-slate-500'}`}>
                  Months {phase.months}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Tasks for Selected Phase */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-6">
            <Target className="w-5 h-5 text-cyan-400" />
            <h2 className="text-xl font-bold text-slate-100">
              Phase {expandedPhase}: {phases[expandedPhase - 1].name}
            </h2>
          </div>

          <div className="space-y-3">
            {tasks[expandedPhase].map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                isExpanded={expandedTasks[task.id]}
                onToggle={() => toggleTask(task.id)}
              />
            ))}
          </div>
        </div>

        {/* Critical Gaps Summary */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-800 border border-slate-700 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-6">
            <AlertCircle className="w-5 h-5 text-yellow-400" />
            <h2 className="text-xl font-bold text-slate-100">Critical Gaps Addressed</h2>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {criticalGaps.map((gap, idx) => (
              <div key={idx} className="bg-slate-750 border border-slate-600 rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">{gap.dimension}</p>
                    <h3 className="text-sm font-bold text-slate-100 mt-1">{gap.gap}</h3>
                  </div>
                  <span className="bg-slate-700 text-cyan-300 text-xs font-semibold px-2 py-1 rounded">
                    Phase {gap.phase}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-3">{gap.description}</p>
                <div className="mt-3 pt-3 border-t border-slate-600">
                  <p className="text-xs text-yellow-400">
                    <span className="font-semibold">Impact:</span> {gap.impact}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Summary Stats */}
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp className="w-5 h-5 text-green-400" />
            <h2 className="text-xl font-bold text-slate-100">Roadmap Summary</h2>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold text-slate-100 mb-3">Key Outcomes</h3>
              <ul className="space-y-2">
                <li className="text-sm text-slate-300 flex items-start gap-2">
                  <span className="text-cyan-400 font-bold">•</span>
                  Production-grade resilience (DLQ, retry, dedup, SLOs)
                </li>
                <li className="text-sm text-slate-300 flex items-start gap-2">
                  <span className="text-cyan-400 font-bold">•</span>
                  Enterprise governance (RBAC, SSO, SCIM, audit)
                </li>
                <li className="text-sm text-slate-300 flex items-start gap-2">
                  <span className="text-cyan-400 font-bold">•</span>
                  AI agent supply chain coverage (MCP, LangSmith, Copilot, Gemini)
                </li>
                <li className="text-sm text-slate-300 flex items-start gap-2">
                  <span className="text-cyan-400 font-bold">•</span>
                  Market-leading platform & moat (agent registry, public API, ecosystem)
                </li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-slate-100 mb-3">Competitive Positioning</h3>
              <ul className="space-y-2">
                <li className="text-sm text-slate-300 flex items-start gap-2">
                  <span className="text-purple-400 font-bold">•</span>
                  Only vendor monitoring all AI agent platforms
                </li>
                <li className="text-sm text-slate-300 flex items-start gap-2">
                  <span className="text-purple-400 font-bold">•</span>
                  MITRE ATLAS mapping (unique market position)
                </li>
                <li className="text-sm text-slate-300 flex items-start gap-2">
                  <span className="text-purple-400 font-bold">•</span>
                  Agent registry differentiator (ecosystem network effect)
                </li>
                <li className="text-sm text-slate-300 flex items-start gap-2">
                  <span className="text-purple-400 font-bold">•</span>
                  EU AI Act compliance (regulatory leadership)
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center py-8 border-t border-slate-700 text-slate-500 text-sm">
          <p>OpenSyber | 6-Month Strategic Roadmap | April–September 2026</p>
          <p className="mt-1">Interactive implementation plan with 4 phases, 27 initiatives, comprehensive gap mitigation</p>
        </div>
      </div>
    </div>
  );
};

export default OpenSyberImplementationPlan;
