// @ts-nocheck
/**
 * Custom node type components for the Visual Policy Builder
 */

'use client';

import React from 'react';
import { NodeTypes } from 'reactflow';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Database,
  Filter,
  Zap,
  CheckSquare,
  GitBranch,
  Activity,
  Shield,
  FileText
} from 'lucide-react';
import { NodeData } from '@/types/policy-management';

interface NodeComponentProps {
  data: NodeData;
  selected: boolean;
}

const InputNode = ({ data, selected }: NodeComponentProps) => (
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
);

const ConditionNode = ({ data, selected }: NodeComponentProps) => (
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
);

const ActionNode = ({ data, selected }: NodeComponentProps) => (
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
);

const ValidationNode = ({ data, selected }: NodeComponentProps) => (
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
);

const TransformNode = ({ data, selected }: NodeComponentProps) => (
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
);

const DecisionNode = ({ data, selected }: NodeComponentProps) => (
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
);

const ComplianceNode = ({ data, selected }: NodeComponentProps) => (
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
);

const OutputNode = ({ data, selected }: NodeComponentProps) => (
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
);

export const CustomNodeTypes: NodeTypes = {
  input: InputNode,
  condition: ConditionNode,
  action: ActionNode,
  validation: ValidationNode,
  transform: TransformNode,
  decision: DecisionNode,
  compliance: ComplianceNode,
  output: OutputNode
};
