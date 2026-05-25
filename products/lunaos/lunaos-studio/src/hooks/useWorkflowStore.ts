/**
 * Lightweight workflow state hook using React.useState.
 * Manages nodes, edges, selection, and execution state.
 * Persists workflow to localStorage for cross-session recovery.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { Node, Edge, OnNodesChange, OnEdgesChange, OnConnect } from '@xyflow/react';
import { applyNodeChanges, applyEdgeChanges, addEdge } from '@xyflow/react';
import type { WorkflowNodeData } from '../types';
import { getNodeTypeById } from '../lib/node-registry';

const STORAGE_KEY = 'lunaos_studio_workflow';

let nextId = 1;
function genId(): string {
  return `node_${Date.now()}_${nextId++}`;
}

interface PersistedState {
  nodes: Node<WorkflowNodeData>[];
  edges: Edge[];
  workflowName: string;
}

function loadPersistedState(): PersistedState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedState;
    if (Array.isArray(parsed.nodes) && Array.isArray(parsed.edges)) {
      return parsed;
    }
  } catch {
    // Corrupted data — ignore
  }
  return null;
}

function saveState(nodes: Node<WorkflowNodeData>[], edges: Edge[], workflowName: string) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ nodes, edges, workflowName }));
  } catch {
    // Storage full or unavailable — silently fail
  }
}

export function useWorkflowStore() {
  const initial = useRef(loadPersistedState());
  const [nodes, setNodes] = useState<Node<WorkflowNodeData>[]>(initial.current?.nodes ?? []);
  const [edges, setEdges] = useState<Edge[]>(initial.current?.edges ?? []);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [workflowName, setWorkflowName] = useState(initial.current?.workflowName ?? 'Untitled Workflow');
  const [isRunning, setIsRunning] = useState(false);

  // Persist on every change
  useEffect(() => {
    saveState(nodes, edges, workflowName);
  }, [nodes, edges, workflowName]);

  const onNodesChange: OnNodesChange<Node<WorkflowNodeData>> = useCallback(
    (changes) =>
      setNodes((nds) =>
        applyNodeChanges(changes, nds) as Node<WorkflowNodeData>[]
      ),
    []
  );

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) =>
      setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );

  const onConnect: OnConnect = useCallback(
    (connection) =>
      setEdges((eds) =>
        addEdge({ ...connection, type: 'smoothstep', animated: true }, eds)
      ),
    []
  );

  const addNode = useCallback(
    (typeId: string, position: { x: number; y: number }) => {
      const def = getNodeTypeById(typeId);
      if (!def) return;

      const defaults: Record<string, string | number | boolean> = {};
      for (const [key, field] of Object.entries(def.configSchema)) {
        defaults[key] = field.default;
      }

      const newNode: Node<WorkflowNodeData> = {
        id: genId(),
        type: 'workflow-node',
        position,
        data: {
          typeId: def.id,
          label: def.name,
          category: def.category,
          icon: def.icon,
          color: def.color,
          config: defaults,
          inputs: def.inputs,
          outputs: def.outputs,
          status: 'idle',
        },
      };

      setNodes((nds) => [...nds, newNode]);
    },
    []
  );

  const updateNodeConfig = useCallback(
    (nodeId: string, config: Record<string, string | number | boolean>) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === nodeId ? { ...n, data: { ...n.data, config } } : n
        )
      );
    },
    []
  );

  const updateNodeLabel = useCallback(
    (nodeId: string, label: string) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === nodeId ? { ...n, data: { ...n.data, label } } : n
        )
      );
    },
    []
  );

  const deleteNode = useCallback(
    (nodeId: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== nodeId));
      setEdges((eds) =>
        eds.filter((e) => e.source !== nodeId && e.target !== nodeId)
      );
      if (selectedNodeId === nodeId) setSelectedNodeId(null);
    },
    [selectedNodeId]
  );

  const setNodeStatus = useCallback(
    (nodeId: string, status: WorkflowNodeData['status'], error?: string) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === nodeId
            ? { ...n, data: { ...n.data, status, error } }
            : n
        )
      );
    },
    []
  );

  const loadWorkflow = useCallback(
    (loadedNodes: Node<WorkflowNodeData>[], loadedEdges: Edge[], name: string) => {
      setNodes(loadedNodes);
      setEdges(loadedEdges);
      setWorkflowName(name);
      setSelectedNodeId(null);
    },
    []
  );

  const clearWorkflow = useCallback(() => {
    setNodes([]);
    setEdges([]);
    setSelectedNodeId(null);
    setWorkflowName('Untitled Workflow');
  }, []);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? null;

  return {
    nodes, edges, selectedNode, selectedNodeId,
    workflowName, isRunning,
    setWorkflowName, setSelectedNodeId, setIsRunning,
    onNodesChange, onEdgesChange, onConnect,
    addNode, updateNodeConfig, updateNodeLabel,
    deleteNode, setNodeStatus, loadWorkflow, clearWorkflow,
  };
}
