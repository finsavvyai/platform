import React from 'react';
import VisualWorkflowDesigner from '../workflow/VisualWorkflowDesigner';
import {
  Box,
  Typography,
  Button,
  Paper,
} from '@mui/material';
import {
  Add,
  PlayArrow,
  Settings,
} from '@mui/icons-material';

// Legacy component that wraps the new Visual Workflow Designer
// This maintains backward compatibility while providing the enhanced features

interface WorkflowBuilderProps {
  workflow?: any;
  onSave?: (workflow: any) => void;
  onCancel?: () => void;
  onExecute?: (workflowId: string) => void;
  initialNodes?: any[];
  initialEdges?: any[];
  open?: boolean;
}

const WorkflowBuilder: React.FC<WorkflowBuilderProps> = ({
  workflow,
  onSave,
  onCancel,
  onExecute,
  initialNodes = [],
  initialEdges = [],
  open = true,
}) => {
  // Convert legacy nodes/edges to new format if needed
  const convertedNodes = initialNodes.map((node: any) => ({
    id: node.id,
    type: 'workflowNode',
    position: node.position || { x: 100, y: 100 },
    data: {
      nodeType: node.type?.replace('Node', '') || 'data-input',
      label: node.data?.label || node.data?.name || 'Node',
      status: 'idle',
      config: node.data || {},
      ...node.data,
    },
    ...node,
  }));

  const convertedEdges = initialEdges.map((edge: any) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: edge.type || 'default',
    animated: edge.animated || false,
    ...edge,
  }));

  const handleSave = async (workflowData: any) => {
    if (onSave) {
      // Convert back to legacy format if needed
      const legacyFormat = {
        ...workflowData,
        name: workflowData.name,
        definition: {
          nodes: workflowData.nodes,
          edges: workflowData.edges,
        },
      };
      await onSave(legacyFormat);
    }
  };

  return (
    <VisualWorkflowDesigner
      workflowId={workflow?.id}
      initialNodes={convertedNodes}
      initialEdges={convertedEdges}
      workflowName={workflow?.name || 'Untitled Workflow'}
      onSave={handleSave}
      onExecute={onExecute ? () => onExecute(workflow?.id || 'new') : undefined}
      onClose={onCancel}
      open={open}
    />
  );
};

export default WorkflowBuilder;