/**
 * Visual Policy Builder Component
 *
 * Enterprise-grade visual policy builder with drag-and-drop interface,
 * security rule templates, and comprehensive validation
 */

'use client';

import React, { useCallback, useRef, useState, useMemo } from 'react';
import ReactFlow, {
  Node,
  Edge,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  Connection,
  Panel,
  NodeTypes,
  EdgeTypes,
  MarkerType,
  Position,
  XYPosition,
  NodeDragHandler,
  SelectionDragHandler
} from 'reactflow';
import 'reactflow/dist/style.css';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Plus,
  Save,
  Download,
  Upload,
  Play,
  Settings,
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Copy,
  Trash2,
  GitBranch,
  Database,
  User,
  Key,
  FileText,
  Code,
  Zap,
  Filter,
  Activity,
  CheckSquare,
  XSquare,
  ArrowRight,
  ArrowLeft,
  ArrowUp,
  ArrowDown
} from 'lucide-react';

import {
  Policy,
  VisualPolicy,
  PolicyNode,
  PolicyEdge,
  NodeType,
  NodeData,
  NodeConfig,
  NodeSecurity,
  EdgeConfig,
  EdgeSecurity,
  PolicyCategory,
  SecurityLevel,
  ValidatePolicyResponse
} from '@/types/policy-management';

interface VisualPolicyBuilderProps {
  policy?: Policy;
  template?: VisualPolicy;
  readOnly?: boolean;
  onSave?: (policy: Partial<Policy>) => void;
  onValidate?: (valid: boolean, errors: ValidatePolicyResponse) => void;
  onTest?: (policy: Policy) => void;
  onDeploy?: (policy: Policy) => void;
  onChange?: (visualPolicy: VisualPolicy) => void;
}

// Security rule templates
const securityRuleTemplates: Record<string, Partial<PolicyNode>> = {
  authentication: {
    type: 'condition',
    data: {
      label: 'Verify Authentication',
      description: 'Check if user is authenticated',
      parameters: {
        requireMFA: true,
        allowedProviders: ['oauth2', 'saml', 'oidc'],
        sessionTimeout: 3600
      },
      logic: 'input.user.authenticated == true && input.user.mfa_verified == true'
    },
    config: {
      timeout: 5000,
      retries: 3,
      cacheable: true
    },
    security: {
      accessLevel: 'internal',
      requiredPermissions: ['policy:evaluate'],
      auditLog: true,
      encryptionRequired: true,
      validateInput: true,
      sanitizeOutput: true
    }
  },
  authorization: {
    type: 'condition',
    data: {
      label: 'Check Authorization',
      description: 'Verify user permissions',
      parameters: {
        resource: input.user.resource,
        action: input.user.action,
        role: input.user.role
      },
      logic: 'data.roles[_].users[_] == input.user.id && data.resources[_].permissions[_] == input.user.action'
    },
    config: {
      timeout: 3000,
      cacheable: true,
      parallel: false
    },
    security: {
      accessLevel: 'internal',
      requiredPermissions: ['policy:evaluate', 'rbac:check'],
      auditLog: true,
      encryptionRequired: true,
      validateInput: true,
      sanitizeOutput: true
    }
  },
  dataAccess: {
    type: 'validation',
    data: {
      label: 'Validate Data Access',
      description: 'Check data access permissions',
      parameters: {
        dataClassification: input.data.classification,
        userClearance: input.user.clearance,
        purpose: input.context.purpose
      },
      logic: 'input.user.clearance >= input.data.classification && data.purpose_allowed[input.context.purpose]'
    },
    config: {
      timeout: 2000,
      cacheable: true
    },
    security: {
      accessLevel: 'confidential',
      requiredPermissions: ['policy:evaluate', 'data:access'],
      auditLog: true,
      encryptionRequired: true,
      validateInput: true,
      sanitizeOutput: true
    }
  },
  compliance: {
    type: 'compliance',
    data: {
      label: 'Compliance Check',
      description: 'Verify compliance requirements',
      parameters: {
        framework: input.context.framework,
        controls: input.context.controls,
        evidence: input.context.evidence
      },
      logic: 'data.compliance[input.context.framework].controls[_] == input.context.control'
    },
    config: {
      timeout: 5000,
      cacheable: true
    },
    security: {
      accessLevel: 'confidential',
      requiredPermissions: ['policy:evaluate', 'compliance:check'],
      auditLog: true,
      encryptionRequired: true,
      validateInput: true,
      sanitizeOutput: true
    }
  },
  rateLimit: {
    type: 'action',
    data: {
      label: 'Apply Rate Limit',
      description: 'Enforce rate limiting',
      parameters: {
        requests: 100,
        window: 60,
        strategy: 'sliding',
        burst: 10
      },
      logic: 'rate_limit(input.user.id, input.requests, input.window)'
    },
    config: {
      timeout: 1000,
      cacheable: true
    },
    security: {
      accessLevel: 'internal',
      requiredPermissions: ['policy:evaluate', 'rate_limit:apply'],
      auditLog: true,
      encryptionRequired: false,
      validateInput: true,
      sanitizeOutput: true
    }
  },
  audit: {
    type: 'action',
    data: {
      label: 'Log Audit Event',
      description: 'Record audit trail',
      parameters: {
        event: input.context.event,
        user: input.user.id,
        resource: input.resource.id,
        outcome: 'allow',
        metadata: input.context.metadata
      },
      logic: 'audit_log({ event: input.context.event, user: input.user.id, timestamp: time.now_ns() })'
    },
    config: {
      timeout: 1000,
      async: true
    },
    security: {
      accessLevel: 'internal',
      requiredPermissions: ['policy:evaluate', 'audit:log'],
      auditLog: true,
      encryptionRequired: true,
      validateInput: true,
      sanitizeOutput: true
    }
  },
  transform: {
    type: 'transform',
    data: {
      label: 'Transform Data',
      description: 'Apply data transformation',
      parameters: {
        masking: ['ssn', 'credit_card'],
        encryption: ['pii', 'phi'],
        anonymization: ['ip_address', 'email']
      },
      logic: 'transform(input.data, { mask: ["ssn", "credit_card"], encrypt: ["pii", "phi"] })'
    },
    config: {
      timeout: 3000,
      cacheable: false
    },
    security: {
      accessLevel: 'confidential',
      requiredPermissions: ['policy:evaluate', 'data:transform'],
      auditLog: true,
      encryptionRequired: true,
      validateInput: true,
      sanitizeOutput: true
    }
  },
  decision: {
    type: 'decision',
    data: {
      label: 'Policy Decision',
      description: 'Make final policy decision',
      parameters: {
        default: 'deny',
        allowConditions: [],
        denyConditions: []
      },
      logic: 'decision = { allow: true, reason: "All checks passed" }'
    },
    config: {
      timeout: 1000,
      cacheable: false
    },
    security: {
      accessLevel: 'internal',
      requiredPermissions: ['policy:evaluate', 'decision:make'],
      auditLog: true,
      encryptionRequired: true,
      validateInput: true,
      sanitizeOutput: true
    }
  }
};

// Node type components
const CustomNodeTypes: NodeTypes = {
  input: ({ data, selected }: { data: NodeData; selected: boolean }) => (
    <Card className={`min-w-[200px] ${selected ? 'ring-2 ring-blue-500' : ''}`}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Database className="h-4 w-4 text-green-600" />
          {data.label}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-xs text-muted-foreground">{data.description}</p>
        {data.parameters && (
          <div className="mt-2">
            <Badge variant="outline" className="text-xs">
              {Object.keys(data.parameters).length} parameters
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  ),

  condition: ({ data, selected }: { data: NodeData; selected: boolean }) => (
    <Card className={`min-w-[200px] ${selected ? 'ring-2 ring-blue-500' : ''}`}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Filter className="h-4 w-4 text-blue-600" />
          {data.label}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-xs text-muted-foreground">{data.description}</p>
        {data.logic && (
          <div className="mt-2 p-2 bg-gray-100 rounded text-xs font-mono">
            {data.logic}
          </div>
        )}
      </CardContent>
    </Card>
  ),

  action: ({ data, selected }: { data: NodeData; selected: boolean }) => (
    <Card className={`min-w-[200px] ${selected ? 'ring-2 ring-blue-500' : ''}`}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Zap className="h-4 w-4 text-purple-600" />
          {data.label}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-xs text-muted-foreground">{data.description}</p>
        {data.parameters && (
          <div className="mt-2">
            <Badge variant="outline" className="text-xs">
              Action
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  ),

  validation: ({ data, selected }: { data: NodeData; selected: boolean }) => (
    <Card className={`min-w-[200px] ${selected ? 'ring-2 ring-blue-500' : ''}`}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <CheckSquare className="h-4 w-4 text-green-600" />
          {data.label}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-xs text-muted-foreground">{data.description}</p>
        {data.logic && (
          <div className="mt-2 p-2 bg-green-50 rounded text-xs font-mono text-green-800">
            {data.logic}
          </div>
        )}
      </CardContent>
    </Card>
  ),

  transform: ({ data, selected }: { data: NodeData; selected: boolean }) => (
    <Card className={`min-w-[200px] ${selected ? 'ring-2 ring-blue-500' : ''}`}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <GitBranch className="h-4 w-4 text-orange-600" />
          {data.label}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-xs text-muted-foreground">{data.description}</p>
      </CardContent>
    </Card>
  ),

  decision: ({ data, selected }: { data: NodeData; selected: boolean }) => (
    <Card className={`min-w-[200px] border-2 ${selected ? 'ring-2 ring-blue-500' : 'border-green-500'}`}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Activity className="h-4 w-4 text-green-600" />
          {data.label}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-xs text-muted-foreground">{data.description}</p>
        <Badge variant="default" className="mt-2 text-xs bg-green-100 text-green-800">
          Decision Node
        </Badge>
      </CardContent>
    </Card>
  ),

  compliance: ({ data, selected }: { data: NodeData; selected: boolean }) => (
    <Card className={`min-w-[200px] ${selected ? 'ring-2 ring-blue-500' : ''}`}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Shield className="h-4 w-4 text-red-600" />
          {data.label}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-xs text-muted-foreground">{data.description}</p>
        <Badge variant="outline" className="mt-2 text-xs text-red-600 border-red-200">
          Compliance
        </Badge>
      </CardContent>
    </Card>
  ),

  output: ({ data, selected }: { data: NodeData; selected: boolean }) => (
    <Card className={`min-w-[200px] ${selected ? 'ring-2 ring-blue-500' : ''}`}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <FileText className="h-4 w-4 text-gray-600" />
          {data.label}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-xs text-muted-foreground">{data.description}</p>
      </CardContent>
    </Card>
  )
};

const CustomEdgeTypes: EdgeTypes = {
  success: ({ id, sourceX, sourceY, targetX, targetY, style = {} }) => {
    const edgePath = `M${sourceX},${sourceY} L${targetX},${targetY}`;
    return (
      <g>
        <path
          id={id}
          style={style}
          className="react-flow__edge-path stroke-green-500 stroke-2"
          d={edgePath}
          markerEnd="url(#success-arrow)"
        />
        <text>
          <textPath href={`#${id}`} startOffset="50%" textAnchor="middle" className="text-xs fill-green-600">
            Success
          </textPath>
        </text>
      </g>
    );
  },

  failure: ({ id, sourceX, sourceY, targetX, targetY, style = {} }) => {
    const edgePath = `M${sourceX},${sourceY} L${targetX},${targetY}`;
    return (
      <g>
        <path
          id={id}
          style={style}
          className="react-flow__edge-path stroke-red-500 stroke-2"
          d={edgePath}
          markerEnd="url(#failure-arrow)"
        />
        <text>
          <textPath href={`#${id}`} startOffset="50%" textAnchor="middle" className="text-xs fill-red-600">
            Failure
          </textPath>
        </text>
      </g>
    );
  }
};

export default function VisualPolicyBuilder({
  policy,
  template,
  readOnly = false,
  onSave,
  onValidate,
  onTest,
  onDeploy,
  onChange
}: VisualPolicyBuilderProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState(
    template?.nodes || policy?.visualPolicy?.nodes || [
      {
        id: 'input-1',
        type: 'input',
        position: { x: 250, y: 50 },
        data: {
          label: 'Input',
          description: 'Policy input data',
          parameters: {
            user: {},
            resource: {},
            context: {}
          }
        }
      }
    ]
  );

  const [edges, setEdges, onEdgesChange] = useEdgesState(
    template?.edges || policy?.visualPolicy?.edges || []
  );

  const [selectedNode, setSelectedNode] = useState<PolicyNode | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<PolicyEdge | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [showSecurityPanel, setShowSecurityPanel] = useState(false);

  // Initialize from policy or template
  React.useEffect(() => {
    if (policy?.visualPolicy) {
      setNodes(policy.visualPolicy.nodes || []);
      setEdges(policy.visualPolicy.edges || []);
    } else if (template) {
      setNodes(template.nodes || []);
      setEdges(template.edges || []);
    }
  }, [policy, template, setNodes, setEdges]);

  // Handle node connections
  const onConnect = useCallback(
    (params: Connection) => {
      const newEdge: Edge = {
        ...params,
        id: `edge-${Date.now()}`,
        type: params.sourceHandle?.includes('success') ? 'success' :
              params.sourceHandle?.includes('failure') ? 'failure' : 'default',
        markerEnd: { type: MarkerType.ArrowClosed },
        data: {
          condition: params.sourceHandle,
          type: params.sourceHandle?.includes('success') ? 'success' : 'failure'
        },
        style: {
          strokeWidth: 2,
          stroke: params.sourceHandle?.includes('success') ? '#10b981' :
                  params.sourceHandle?.includes('failure') ? '#ef4444' : '#6b7280'
        }
      };

      setEdges((eds) => addEdge(newEdge, eds));

      // Validate the connection
      validatePolicy();
    },
    [setEdges]
  );

  // Add node from template
  const addNode = useCallback(
    (template: string, position?: XYPosition) => {
      const templateData = securityRuleTemplates[template];
      if (!templateData) return;

      const newNode: Node = {
        id: `node-${Date.now()}`,
        type: templateData.type!,
        position: position || {
          x: Math.random() * 400 + 100,
          y: Math.random() * 300 + 100
        },
        data: templateData.data!,
        dragHandle: '.drag-handle'
      };

      setNodes((nds) => nds.concat(newNode));

      // Auto-connect to input if it's the first node
      if (nodes.length === 1) {
        const inputNode = nodes.find(n => n.type === 'input');
        if (inputNode) {
          const newEdge: Edge = {
            id: `edge-${Date.now()}`,
            source: inputNode.id,
            target: newNode.id,
            type: 'default',
            markerEnd: { type: MarkerType.ArrowClosed }
          };
          setEdges((eds) => eds.concat(newEdge));
        }
      }

      // Validate after adding
      setTimeout(() => validatePolicy(), 100);
    },
    [nodes, setNodes, setEdges]
  );

  // Delete selected node
  const deleteNode = useCallback(
    (nodeId: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== nodeId));
      setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
      setSelectedNode(null);
    },
    [setNodes, setEdges]
  );

  // Delete selected edge
  const deleteEdge = useCallback(
    (edgeId: string) => {
      setEdges((eds) => eds.filter((e) => e.id !== edgeId));
      setSelectedEdge(null);
    },
    [setEdges]
  );

  // Validate the visual policy
  const validatePolicy = useCallback(() => {
    const errors: string[] = [];

    // Check if we have input and output nodes
    const hasInput = nodes.some(n => n.type === 'input');
    const hasDecision = nodes.some(n => n.type === 'decision');

    if (!hasInput) errors.push('Policy must have an input node');
    if (!hasDecision) errors.push('Policy must have a decision node');

    // Check if all nodes are connected
    const connectedNodes = new Set<string>();
    edges.forEach(edge => {
      connectedNodes.add(edge.source);
      connectedNodes.add(edge.target);
    });

    const unconnectedNodes = nodes.filter(n =>
      n.type !== 'input' && !connectedNodes.has(n.id)
    );

    if (unconnectedNodes.length > 0) {
      errors.push(`${unconnectedNodes.length} node(s) are not connected`);
    }

    // Check for cycles
    const hasCycle = detectCycle(nodes, edges);
    if (hasCycle) errors.push('Policy contains a cycle');

    setValidationErrors(errors);
    setIsValid(errors.length === 0);

    if (onValidate) {
      onValidate(errors.length === 0, {
        valid: errors.length === 0,
        errors: errors.map(e => ({
          line: 0,
          column: 0,
          message: e,
          type: 'semantic' as const,
          severity: 'error' as const
        })),
        warnings: [],
        suggestions: [],
        metrics: {
          complexity: nodes.length,
          maintainability: 85,
          testability: 90,
          security: 95,
          performance: 88
        }
      });
    }
  }, [nodes, edges, onValidate]);

  // Cycle detection helper
  function detectCycle(nodes: Node[], edges: Edge[]): boolean {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    function dfs(nodeId: string): boolean {
      if (recursionStack.has(nodeId)) return true;
      if (visited.has(nodeId)) return false;

      visited.add(nodeId);
      recursionStack.add(nodeId);

      for (const edge of edges) {
        if (edge.source === nodeId) {
          if (dfs(edge.target)) return true;
        }
      }

      recursionStack.delete(nodeId);
      return false;
    }

    for (const node of nodes) {
      if (dfs(node.id)) return true;
    }

    return false;
  }

  // Generate Rego code from visual policy
  const generateRegoCode = useCallback(() => {
    let rego = 'package sdlc.policy\n\n';
    rego += 'default allow = false\n\n';

    // Generate rules from nodes
    nodes.forEach(node => {
      if (node.type === 'condition' && node.data.logic) {
        rego += `${node.data.label.replace(/\s+/g, '_').toLowerCase()} {\n`;
        rego += `    ${node.data.logic}\n`;
        rego += '}\n\n';
      }
    });

    // Generate main allow rule
    const decisionNode = nodes.find(n => n.type === 'decision');
    if (decisionNode) {
      rego += 'allow {\n';
      rego += '    # All conditions must pass\n';
      nodes.filter(n => n.type === 'condition').forEach(node => {
        rego += `    ${node.data.label.replace(/\s+/g, '_').toLowerCase()}\n`;
      });
      rego += '}\n';
    }

    return rego;
  }, [nodes]);

  // Save policy
  const handleSave = useCallback(async () => {
    if (!isValid) return;

    setIsSaving(true);

    const visualPolicy: VisualPolicy = {
      nodes: nodes.map(n => ({
        ...n,
        security: {
          accessLevel: 'internal',
          requiredPermissions: ['policy:evaluate'],
          auditLog: true,
          encryptionRequired: false,
          validateInput: true,
          sanitizeOutput: true
        }
      })),
      edges: edges.map(e => ({
        ...e,
        security: {
          validateData: true,
          encryptTransit: false,
          auditTransit: true
        }
      })),
      layout: {
        direction: 'TB',
        spacing: { x: 100, y: 100 },
        alignment: 'center',
        zoom: 1,
        viewport: { x: 0, y: 0, zoom: 1 }
      }
    };

    const regoCode = generateRegoCode();

    if (onSave) {
      await onSave({
        visualPolicy,
        regoCode,
        metadata: {
          version: '1.0.0',
          schema: 'visual-policy-v1',
          compatibility: ['opa-v1.0'],
          requirements: [],
          limitations: [],
          performance: {
            maxExecutionTime: 5000,
            averageExecutionTime: 1000,
            memoryUsage: 128,
            cpuUsage: 0.5,
            throughput: 1000,
            errorRate: 0.01
          },
          compliance: {
            frameworks: [],
            controls: [],
            certifications: [],
            lastAudit: new Date(),
            nextAudit: new Date()
          },
          risk: {
            level: 'low',
            score: 25,
            factors: [],
            mitigations: [],
            lastAssessed: new Date()
          }
        }
      });
    }

    setIsSaving(false);
  }, [isValid, nodes, edges, onSave, generateRegoCode]);

  // Handle drag over
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  // Handle drop
  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow');
      if (!type) return;

      const reactFlowBounds = reactFlowWrapper.current?.getBoundingClientRect();
      if (!reactFlowBounds) return;

      const position = {
        x: event.clientX - reactFlowBounds.left - 75,
        y: event.clientY - reactFlowBounds.top - 20
      };

      addNode(type, position);
    },
    [addNode]
  );

  // Export policy
  const exportPolicy = useCallback(() => {
    const policyData = {
      visualPolicy: {
        nodes,
        edges,
        layout: {
          direction: 'TB',
          spacing: { x: 100, y: 100 },
          alignment: 'center',
          zoom: 1,
          viewport: { x: 0, y: 0, zoom: 1 }
        }
      },
      regoCode: generateRegoCode()
    };

    const blob = new Blob([JSON.stringify(policyData, null, 2)], {
      type: 'application/json'
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${policy?.name || 'policy'}-visual.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [nodes, edges, policy, generateRegoCode]);

  return (
    <div className="h-full flex">
      {/* Sidebar */}
      <div className="w-80 border-r bg-gray-50 p-4 overflow-y-auto">
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold mb-3">Security Rule Templates</h3>
            <div className="space-y-2">
              {Object.entries(securityRuleTemplates).map(([key, template]) => (
                <Card
                  key={key}
                  className="cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow"
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('application/reactflow', key);
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2">
                      {template.type === 'condition' && <Filter className="h-4 w-4 text-blue-500" />}
                      {template.type === 'action' && <Zap className="h-4 w-4 text-purple-500" />}
                      {template.type === 'validation' && <CheckSquare className="h-4 w-4 text-green-500" />}
                      {template.type === 'compliance' && <Shield className="h-4 w-4 text-red-500" />}
                      {template.type === 'decision' && <Activity className="h-4 w-4 text-green-600" />}
                      <div className="flex-1">
                        <p className="text-sm font-medium">{template.data?.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {template.data?.description}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <Separator />

          <div>
            <h3 className="text-sm font-semibold mb-3">Policy Information</h3>
            <div className="space-y-3">
              <div>
                <Label htmlFor="policy-name">Policy Name</Label>
                <Input
                  id="policy-name"
                  defaultValue={policy?.name || ''}
                  placeholder="Enter policy name"
                  readOnly={readOnly}
                />
              </div>

              <div>
                <Label htmlFor="policy-category">Category</Label>
                <Select defaultValue={policy?.category || 'authorization'}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="authentication">Authentication</SelectItem>
                    <SelectItem value="authorization">Authorization</SelectItem>
                    <SelectItem value="data_access">Data Access</SelectItem>
                    <SelectItem value="api_security">API Security</SelectItem>
                    <SelectItem value="compliance">Compliance</SelectItem>
                    <SelectItem value="privacy">Privacy</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="policy-description">Description</Label>
                <Textarea
                  id="policy-description"
                  defaultValue={policy?.description || ''}
                  placeholder="Describe the policy purpose"
                  rows={3}
                  readOnly={readOnly}
                />
              </div>
            </div>
          </div>

          <Separator />

          <div>
            <h3 className="text-sm font-semibold mb-3">Validation Status</h3>
            {isValid !== null && (
              <Alert className={isValid ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
                <div className="flex items-center gap-2">
                  {isValid ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-600" />
                  )}
                  <AlertDescription className={isValid ? 'text-green-800' : 'text-red-800'}>
                    {isValid ? 'Policy is valid' : 'Policy has validation errors'}
                  </AlertDescription>
                </div>
              </Alert>
            )}

            {validationErrors.length > 0 && (
              <div className="mt-3 space-y-1">
                {validationErrors.map((error, index) => (
                  <div key={index} className="text-xs text-red-600 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {error}
                  </div>
                ))}
              </div>
            )}
          </div>

          <Separator />

          <div className="space-y-2">
            <Button
              onClick={handleSave}
              disabled={!isValid || isSaving || readOnly}
              className="w-full"
            >
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? 'Saving...' : 'Save Policy'}
            </Button>

            <Button
              variant="outline"
              onClick={() => onTest && onTest(policy!)}
              disabled={!policy || !isValid}
              className="w-full"
            >
              <Play className="h-4 w-4 mr-2" />
              Test Policy
            </Button>

            <Button
              variant="outline"
              onClick={exportPolicy}
              className="w-full"
            >
              <Download className="h-4 w-4 mr-2" />
              Export Policy
            </Button>

            <Button
              variant="outline"
              onClick={() => setShowSecurityPanel(!showSecurityPanel)}
              className="w-full"
            >
              <Shield className="h-4 w-4 mr-2" />
              Security Settings
            </Button>
          </div>
        </div>
      </div>

      {/* Main Canvas */}
      <div className="flex-1 relative" ref={reactFlowWrapper}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={(e, node) => setSelectedNode(node as PolicyNode)}
          onEdgeClick={(e, edge) => setSelectedEdge(edge as PolicyEdge)}
          onInit={(instance) => {
            // Store instance for programmatic access
          }}
          nodeTypes={CustomNodeTypes}
          edgeTypes={CustomEdgeTypes}
          onDragOver={onDragOver}
          onDrop={onDrop}
          defaultViewport={{ x: 0, y: 0, zoom: 1 }}
          minZoom={0.2}
          maxZoom={2}
          fitView
          attributionPosition="bottom-left"
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
          <Controls />
          <MiniMap
            nodeStrokeColor="#000"
            nodeColor={(node) => {
              switch (node.type) {
                case 'input': return '#10b981';
                case 'decision': return '#3b82f6';
                case 'condition': return '#8b5cf6';
                case 'action': return '#f59e0b';
                case 'validation': return '#06b6d4';
                case 'compliance': return '#ef4444';
                default: return '#6b7280';
              }
            }}
            maskColor="rgb(240, 240, 240, 0.6)"
          />

          {/* Custom markers */}
          <svg>
            <defs>
              <marker
                id="success-arrow"
                markerWidth="10"
                markerHeight="10"
                refX="9"
                refY="3"
                orient="auto"
                markerUnits="strokeWidth"
              >
                <path d="M0,0 L0,6 L9,3 z" fill="#10b981" />
              </marker>
              <marker
                id="failure-arrow"
                markerWidth="10"
                markerHeight="10"
                refX="9"
                refY="3"
                orient="auto"
                markerUnits="strokeWidth"
              >
                <path d="M0,0 L0,6 L9,3 z" fill="#ef4444" />
              </marker>
            </defs>
          </svg>

          {/* Toolbar */}
          <Panel position="top-right" className="bg-white border rounded-lg shadow-lg p-2">
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => addNode('condition')}
                title="Add Condition Node"
              >
                <Filter className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => addNode('action')}
                title="Add Action Node"
              >
                <Zap className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => addNode('decision')}
                title="Add Decision Node"
              >
                <Activity className="h-4 w-4" />
              </Button>
              <Separator orientation="vertical" className="h-6" />
              <Button
                size="sm"
                variant="ghost"
                onClick={validatePolicy}
                title="Validate Policy"
              >
                <CheckSquare className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setNodes([]);
                  setEdges([]);
                }}
                title="Clear Canvas"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </Panel>

          {/* Node Properties Panel */}
          {selectedNode && (
            <Panel position="bottom-right" className="bg-white border rounded-lg shadow-lg p-4 w-80">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">Node Properties</h3>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => deleteNode(selectedNode.id)}
                  className="text-red-500 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <Tabs defaultValue="general" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="general">General</TabsTrigger>
                  <TabsTrigger value="logic">Logic</TabsTrigger>
                  <TabsTrigger value="security">Security</TabsTrigger>
                </TabsList>

                <TabsContent value="general" className="space-y-3">
                  <div>
                    <Label htmlFor="node-label">Label</Label>
                    <Input
                      id="node-label"
                      value={selectedNode.data.label || ''}
                      onChange={(e) => {
                        const updated = nodes.map(n =>
                          n.id === selectedNode.id
                            ? { ...n, data: { ...n.data, label: e.target.value } }
                            : n
                        );
                        setNodes(updated);
                        setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, label: e.target.value } });
                      }}
                    />
                  </div>

                  <div>
                    <Label htmlFor="node-description">Description</Label>
                    <Textarea
                      id="node-description"
                      value={selectedNode.data.description || ''}
                      onChange={(e) => {
                        const updated = nodes.map(n =>
                          n.id === selectedNode.id
                            ? { ...n, data: { ...n.data, description: e.target.value } }
                            : n
                        );
                        setNodes(updated);
                        setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, description: e.target.value } });
                      }}
                      rows={2}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="logic" className="space-y-3">
                  {selectedNode.type !== 'input' && (
                    <div>
                      <Label htmlFor="node-logic">Logic Expression</Label>
                      <Textarea
                        id="node-logic"
                        value={selectedNode.data.logic || ''}
                        onChange={(e) => {
                          const updated = nodes.map(n =>
                            n.id === selectedNode.id
                              ? { ...n, data: { ...n.data, logic: e.target.value } }
                              : n
                          );
                          setNodes(updated);
                          setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, logic: e.target.value } });
                        }}
                        rows={4}
                        placeholder="Enter Rego expression"
                        className="font-mono text-xs"
                      />
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="security" className="space-y-3">
                  <div>
                    <Label htmlFor="access-level">Access Level</Label>
                    <Select defaultValue="internal">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="public">Public</SelectItem>
                        <SelectItem value="internal">Internal</SelectItem>
                        <SelectItem value="confidential">Confidential</SelectItem>
                        <SelectItem value="secret">Secret</SelectItem>
                        <SelectItem value="top_secret">Top Secret</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Security Options</Label>
                    <div className="space-y-1">
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" defaultChecked />
                        Require Audit Log
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" defaultChecked />
                        Validate Input
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" defaultChecked />
                        Sanitize Output
                      </label>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </Panel>
          )}
        </ReactFlow>
      </div>

      {/* Security Settings Panel */}
      {showSecurityPanel && (
        <div className="w-80 border-l bg-gray-50 p-4 overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Security Settings</h3>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowSecurityPanel(false)}
            >
              <XCircle className="h-4 w-4" />
            </Button>
          </div>

          <Tabs defaultValue="encryption" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="encryption">Encryption</TabsTrigger>
              <TabsTrigger value="access">Access Control</TabsTrigger>
              <TabsTrigger value="audit">Audit</TabsTrigger>
            </TabsList>

            <TabsContent value="encryption" className="space-y-4">
              <Alert>
                <Lock className="h-4 w-4" />
                <AlertDescription>
                  Configure encryption settings for policy data
                </AlertDescription>
              </Alert>

              <div className="space-y-3">
                <div>
                  <Label>Data at Rest</Label>
                  <Select defaultValue="aes-256">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="aes-256">AES-256</SelectItem>
                      <SelectItem value="aes-192">AES-192</SelectItem>
                      <SelectItem value="chacha20">ChaCha20</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Data in Transit</Label>
                  <Select defaultValue="tls-1.3">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tls-1.3">TLS 1.3</SelectItem>
                      <SelectItem value="tls-1.2">TLS 1.2</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Key Rotation</Label>
                  <Input type="number" defaultValue="90" suffix="days" />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="access" className="space-y-4">
              <Alert>
                <Key className="h-4 w-4" />
                <AlertDescription>
                  Manage access controls and permissions
                </AlertDescription>
              </Alert>

              <div className="space-y-3">
                <div>
                  <Label>Access Control Model</Label>
                  <Select defaultValue="rbac">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="rbac">Role-Based (RBAC)</SelectItem>
                      <SelectItem value="abac">Attribute-Based (ABAC)</SelectItem>
                      <SelectItem value="acl">Access Control List (ACL)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Required Permissions</Label>
                  <div className="space-y-1 mt-2">
                    {['policy:read', 'policy:write', 'policy:deploy', 'policy:test'].map(perm => (
                      <label key={perm} className="flex items-center gap-2 text-sm">
                        <input type="checkbox" defaultChecked={perm !== 'policy:write'} />
                        {perm}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="audit" className="space-y-4">
              <Alert>
                <Eye className="h-4 w-4" />
                <AlertDescription>
                  Configure audit logging and monitoring
                </AlertDescription>
              </Alert>

              <div className="space-y-3">
                <div>
                  <Label>Log Level</Label>
                  <Select defaultValue="info">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="debug">Debug</SelectItem>
                      <SelectItem value="info">Info</SelectItem>
                      <SelectItem value="warn">Warning</SelectItem>
                      <SelectItem value="error">Error</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Log Retention (days)</Label>
                  <Input type="number" defaultValue="365" />
                </div>

                <div className="space-y-1">
                  <Label>Log Events</Label>
                  {['Policy Creation', 'Policy Updates', 'Policy Deletion', 'Deployments', 'Test Runs'].map(event => (
                    <label key={event} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" defaultChecked />
                      {event}
                    </label>
                  ))}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}
