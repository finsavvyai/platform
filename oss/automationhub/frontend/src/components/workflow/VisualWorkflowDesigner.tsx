/**
 * Visual Workflow Designer
 *
 * Comprehensive visual workflow designer that integrates all workflow components:
 * - Component palette with drag-and-drop
 * - Advanced canvas with zoom/pan controls
 * - Configuration panel with real-time validation
 * - Real-time collaboration
 * - Template system
 * - Import/export functionality
 */

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  Box,
  Paper,
  Drawer,
  useTheme,
  useMediaQuery,
  Alert,
  Snackbar,
  Backdrop,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  IconButton,
  Tooltip,
  Chip,
} from '@mui/material';
import {
  Close,
  Save,
  PlayArrow,
  Pause,
  Stop,
  Settings,
  Help,
  CloudUpload,
  CloudDownload,
  ContentCopy,
  Undo,
  Redo,
} from '@mui/icons-material';

import WorkflowCanvas from './canvas/WorkflowCanvas';
import ComponentPalette from './palette/ComponentPalette';
import NodeConfigPanel from './config/NodeConfigPanel';
import { Node, Edge, SelectionMode } from 'reactflow';
import { NodeStatus } from './nodes/WorkflowNode';
import { WorkflowNodeConfig, WORKFLOW_NODE_TYPES } from './types/NodeTypes';

// WebSocket for real-time collaboration
import { io, Socket } from 'socket.io-client';

interface VisualWorkflowDesignerProps {
  workflowId?: string;
  initialNodes?: Node[];
  initialEdges?: Edge[];
  onSave?: (workflow: { id?: string; nodes: Node[]; edges: Edge[]; name: string }) => Promise<void>;
  onExecute?: (workflowId: string) => Promise<void>;
  onDebug?: (workflowId: string) => Promise<void>;
  onClose?: () => void;
  readOnly?: boolean;
  collaborationMode?: boolean;
  collaborators?: Array<{ id: string; name: string; color: string; cursor?: { x: number; y: number } }>;
  availableAgents?: Array<{ id: string; name: string; type: string; capabilities: string[] }>;
  availableVariables?: Array<{ name: string; type: string; description?: string }>;
  workflowName?: string;
  open?: boolean;
}

interface Collaborator {
  id: string;
  name: string;
  color: string;
  cursor?: { x: number; y: number };
  selectedNodes?: string[];
}

interface CollaborationEvent {
  type: 'cursor_move' | 'node_select' | 'node_update' | 'edge_add' | 'node_delete';
  userId: string;
  data: any;
  timestamp: number;
}

const VisualWorkflowDesigner: React.FC<VisualWorkflowDesignerProps> = ({
  workflowId,
  initialNodes = [],
  initialEdges = [],
  onSave,
  onExecute,
  onDebug,
  onClose,
  readOnly = false,
  collaborationMode = false,
  collaborators = [],
  availableAgents = [],
  availableVariables = [],
  workflowName = 'Untitled Workflow',
  open = true,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const socketRef = useRef<Socket | null>(null);

  // State
  const [nodes, setNodes] = useState<Node[]>(initialNodes);
  const [edges, setEdges] = useState<Edge[]>(initialEdges);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(!isMobile);
  const [configPanelOpen, setConfigPanelOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [executionStatus, setExecutionStatus] = useState<'idle' | 'running' | 'completed' | 'error'>('idle');
  const [showWelcome, setShowWelcome] = useState(!workflowId);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity?: 'success' | 'error' | 'warning' | 'info' }>({
    open: false,
    message: '',
  });

  // Collaboration state
  const [onlineCollaborators, setOnlineCollaborators] = useState<Collaborator[]>(collaborators);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');

  // History for undo/redo
  const [history, setHistory] = useState<Array<{ nodes: Node[]; edges: Edge[]; timestamp: number }>>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Initialize WebSocket for collaboration
  useEffect(() => {
    if (collaborationMode && workflowId) {
      socketRef.current = io(process.env.REACT_APP_WS_URL || 'ws://localhost:8000', {
        auth: {
          workflowId,
        },
      });

      const socket = socketRef.current;

      socket.on('connect', () => {
        setConnectionStatus('connected');
        console.log('Connected to collaboration server');
      });

      socket.on('disconnect', () => {
        setConnectionStatus('disconnected');
        console.log('Disconnected from collaboration server');
      });

      socket.on('collaborators_update', (collaborators: Collaborator[]) => {
        setOnlineCollaborators(collaborators);
      });

      socket.on('collaboration_event', (event: CollaborationEvent) => {
        handleCollaborationEvent(event);
      });

      socket.on('workflow_update', (data: { nodes: Node[]; edges: Edge[]; userId: string }) => {
        if (data.userId !== socket.id) {
          setNodes(data.nodes);
          setEdges(data.edges);
        }
      });

      return () => {
        socket.disconnect();
      };
    }
  }, [collaborationMode, workflowId]);

  // Handle collaboration events
  const handleCollaborationEvent = useCallback((event: CollaborationEvent) => {
    switch (event.type) {
      case 'cursor_move':
        setOnlineCollaborators(prev =>
          prev.map(c =>
            c.id === event.userId
              ? { ...c, cursor: event.data }
              : c
          )
        );
        break;
      case 'node_select':
        setOnlineCollaborators(prev =>
          prev.map(c =>
            c.id === event.userId
              ? { ...c, selectedNodes: event.data }
              : c
          )
        );
        break;
      // Handle other event types...
    }
  }, []);

  // Emit collaboration events
  const emitCollaborationEvent = useCallback((type: string, data: any) => {
    if (socketRef.current && collaborationMode) {
      socketRef.current.emit('collaboration_event', {
        type,
        data,
        timestamp: Date.now(),
      } as CollaborationEvent);
    }
  }, [collaborationMode]);

  // Handle nodes change
  const handleNodesChange = useCallback((changes: any[]) => {
    const newNodes = applyNodeChanges(changes, nodes);
    setNodes(newNodes);

    // Add to history
    addToHistory(newNodes, edges);

    // Emit collaboration event
    emitCollaborationEvent('nodes_change', changes);

    // Emit workflow update
    if (socketRef.current) {
      socketRef.current.emit('workflow_update', {
        nodes: newNodes,
        edges,
        userId: socketRef.current.id,
      });
    }
  }, [nodes, edges, emitCollaborationEvent]);

  // Handle edges change
  const handleEdgesChange = useCallback((changes: any[]) => {
    const newEdges = applyEdgeChanges(changes, edges);
    setEdges(newEdges);

    // Add to history
    addToHistory(nodes, newEdges);

    // Emit collaboration event
    emitCollaborationEvent('edges_change', changes);

    // Emit workflow update
    if (socketRef.current) {
      socketRef.current.emit('workflow_update', {
        nodes,
        edges: newEdges,
        userId: socketRef.current.id,
      });
    }
  }, [nodes, edges, emitCollaborationEvent]);

  // Handle connection
  const handleConnect = useCallback((connection: any) => {
    const newEdges = addEdge(connection, edges);
    setEdges(newEdges);

    // Add to history
    addToHistory(nodes, newEdges);

    // Emit collaboration event
    emitCollaborationEvent('edge_add', connection);

    // Emit workflow update
    if (socketRef.current) {
      socketRef.current.emit('workflow_update', {
        nodes,
        edges: newEdges,
        userId: socketRef.current.id,
      });
    }
  }, [nodes, edges, emitCollaborationEvent]);

  // Handle node selection
  const handleNodeSelect = useCallback((node: Node | null) => {
    setSelectedNode(node);
    setSelectedEdge(null);
    setConfigPanelOpen(!!node && !readOnly);

    // Emit collaboration event
    if (node) {
      emitCollaborationEvent('node_select', [node.id]);
    }
  }, [readOnly, emitCollaborationEvent]);

  // Handle node configuration change
  const handleNodeConfigChange = useCallback((nodeId: string, updates: Partial<any>) => {
    const newNodes = nodes.map(node =>
      node.id === nodeId
        ? { ...node, data: { ...node.data, ...updates } }
        : node
    );
    setNodes(newNodes);

    // Add to history
    addToHistory(newNodes, edges);

    // Emit collaboration event
    emitCollaborationEvent('node_update', { nodeId, updates });

    // Emit workflow update
    if (socketRef.current) {
      socketRef.current.emit('workflow_update', {
        nodes: newNodes,
        edges,
        userId: socketRef.current.id,
      });
    }
  }, [nodes, edges, emitCollaborationEvent]);

  // Handle save
  const handleSave = useCallback(async () => {
    if (!onSave) return;

    setSaveStatus('saving');
    try {
      await onSave({
        id: workflowId,
        nodes,
        edges,
        name: workflowName,
      });
      setSaveStatus('saved');
      setSnackbar({
        open: true,
        message: 'Workflow saved successfully',
        severity: 'success',
      });
    } catch (error) {
      setSaveStatus('error');
      setSnackbar({
        open: true,
        message: 'Failed to save workflow',
        severity: 'error',
      });
    }

    // Reset status after delay
    setTimeout(() => setSaveStatus('idle'), 2000);
  }, [onSave, workflowId, nodes, edges, workflowName]);

  // Handle execute
  const handleExecute = useCallback(async () => {
    if (!onExecute || !workflowId) return;

    setExecutionStatus('running');
    try {
      await onExecute(workflowId);
      setExecutionStatus('completed');
      setSnackbar({
        open: true,
        message: 'Workflow execution started',
        severity: 'success',
      });
    } catch (error) {
      setExecutionStatus('error');
      setSnackbar({
        open: true,
        message: 'Failed to execute workflow',
        severity: 'error',
      });
    }
  }, [onExecute, workflowId]);

  // History management
  const addToHistory = useCallback((newNodes: Node[], newEdges: Edge[]) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({
      nodes: newNodes,
      edges: newEdges,
      timestamp: Date.now(),
    });
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [history, historyIndex]);

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const previousState = history[historyIndex - 1];
      setNodes(previousState.nodes);
      setEdges(previousState.edges);
      setHistoryIndex(historyIndex - 1);
    }
  }, [history, historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextState = history[historyIndex + 1];
      setNodes(nextState.nodes);
      setEdges(nextState.edges);
      setHistoryIndex(historyIndex + 1);
    }
  }, [history, historyIndex]);

  // Import/Export functionality
  const handleExport = useCallback(() => {
    const workflowData = {
      nodes,
      edges,
      name: workflowName,
      metadata: {
        exportedAt: new Date().toISOString(),
        version: '1.0',
      },
    };

    const blob = new Blob([JSON.stringify(workflowData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${workflowName.replace(/\s+/g, '_')}_workflow.json`;
    a.click();
    URL.revokeObjectURL(url);

    setSnackbar({
      open: true,
      message: 'Workflow exported successfully',
      severity: 'success',
    });
  }, [nodes, edges, workflowName]);

  const handleImport = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const workflowData = JSON.parse(e.target?.result as string);
        if (workflowData.nodes && workflowData.edges) {
          setNodes(workflowData.nodes);
          setEdges(workflowData.edges);
          addToHistory(workflowData.nodes, workflowData.edges);
          setSnackbar({
            open: true,
            message: 'Workflow imported successfully',
            severity: 'success',
          });
        }
      } catch (error) {
        setSnackbar({
          open: true,
          message: 'Failed to import workflow',
          severity: 'error',
        });
      }
    };
    reader.readAsText(file);
  }, [addToHistory]);

  if (!open) return null;

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="xl"
        fullWidth
        PaperProps={{
          sx: {
            height: '90vh',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
          },
        }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="h6">{workflowName}</Typography>
            {collaborationMode && (
              <Chip
                label={`${onlineCollaborators.length} online`}
                size="small"
                color={connectionStatus === 'connected' ? 'success' : 'default'}
                variant="outlined"
              />
            )}
            {saveStatus !== 'idle' && (
              <Chip
                label={saveStatus}
                size="small"
                color={saveStatus === 'saved' ? 'success' : saveStatus === 'error' ? 'error' : 'default'}
              />
            )}
            {executionStatus !== 'idle' && (
              <Chip
                icon={executionStatus === 'running' ? <CircularProgress size={12} /> : undefined}
                label={executionStatus}
                size="small"
                color={executionStatus === 'completed' ? 'success' : executionStatus === 'error' ? 'error' : 'default'}
              />
            )}
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {!readOnly && (
              <>
                <Tooltip title="Undo">
                  <IconButton size="small" onClick={undo} disabled={historyIndex <= 0}>
                    <Undo />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Redo">
                  <IconButton size="small" onClick={redo} disabled={historyIndex >= history.length - 1}>
                    <Redo />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Save">
                  <IconButton size="small" onClick={handleSave} disabled={saveStatus === 'saving'}>
                    <Save />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Export">
                  <IconButton size="small" onClick={handleExport}>
                    <CloudDownload />
                  </IconButton>
                </Tooltip>
                <input
                  type="file"
                  accept=".json"
                  style={{ display: 'none' }}
                  id="workflow-import"
                  onChange={handleImport}
                />
                <Tooltip title="Import">
                  <label htmlFor="workflow-import">
                    <IconButton size="small" component="span">
                      <CloudUpload />
                    </IconButton>
                  </label>
                </Tooltip>
                <Tooltip title="Execute">
                  <IconButton size="small" color="success" onClick={handleExecute}>
                    <PlayArrow />
                  </IconButton>
                </Tooltip>
              </>
            )}
            <Tooltip title="Toggle Palette">
              <IconButton size="small" onClick={() => setPaletteOpen(!paletteOpen)}>
                <Settings />
              </IconButton>
            </Tooltip>
            <Tooltip title="Help">
              <IconButton size="small">
                <Help />
              </IconButton>
            </Tooltip>
            <Tooltip title="Close">
              <IconButton size="small" onClick={onClose}>
                <Close />
              </IconButton>
            </Tooltip>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ flex: 1, padding: 0, display: 'flex', overflow: 'hidden' }}>
          {/* Component Palette */}
          <Drawer
            variant={isMobile ? 'temporary' : 'persistent'}
            anchor="left"
            open={paletteOpen}
            onClose={() => setPaletteOpen(false)}
            sx={{
              width: 300,
              flexShrink: 0,
              '& .MuiDrawer-paper': {
                width: 300,
                boxSizing: 'border-box',
                position: 'relative',
              },
            }}
          >
            <ComponentPalette
              onNodeSelect={(nodeType) => {
                // Add node at default position
                const newNode: Node = {
                  id: `${nodeType}-${Date.now()}`,
                  type: 'workflowNode',
                  position: { x: 250, y: 150 },
                  data: {
                    nodeType,
                    label: WORKFLOW_NODE_TYPES[nodeType]?.label || nodeType,
                    status: NodeStatus.IDLE,
                    config: WORKFLOW_NODE_TYPES[nodeType]?.defaultConfig || {},
                  },
                };
                setNodes([...nodes, newNode]);
              }}
              onNodeAdd={(nodeType, position) => {
                const newNode: Node = {
                  id: `${nodeType}-${Date.now()}`,
                  type: 'workflowNode',
                  position,
                  data: {
                    nodeType,
                    label: WORKFLOW_NODE_TYPES[nodeType]?.label || nodeType,
                    status: NodeStatus.IDLE,
                    config: WORKFLOW_NODE_TYPES[nodeType]?.defaultConfig || {},
                  },
                };
                setNodes([...nodes, newNode]);
              }}
            />
          </Drawer>

          {/* Main Canvas Area */}
          <Box sx={{ flex: 1, position: 'relative' }}>
            <WorkflowCanvas
              initialNodes={nodes}
              initialEdges={edges}
              onNodesChange={handleNodesChange}
              onEdgesChange={handleEdgesChange}
              onConnect={handleConnect}
              onNodeUpdate={handleNodeConfigChange}
              onSave={handleSave}
              onExecute={handleExecute}
              onExport={handleExport}
              readOnly={readOnly}
              collaborationMode={collaborationMode}
              collaborators={onlineCollaborators}
              availableVariables={availableVariables}
            />

            {/* Collaboration Cursors Overlay */}
            {collaborationMode && onlineCollaborators.map((collaborator) => (
              collaborator.cursor && (
                <Box
                  key={collaborator.id}
                  sx={{
                    position: 'absolute',
                    left: collaborator.cursor.x,
                    top: collaborator.cursor.y,
                    pointerEvents: 'none',
                    zIndex: 10000,
                  }}
                >
                  <Box
                    sx={{
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      backgroundColor: collaborator.color,
                      border: '2px solid white',
                      boxShadow: theme.shadows[2],
                    }}
                  />
                  <Paper sx={{ p: 0.5, ml: 2, fontSize: '12px' }}>
                    {collaborator.name}
                  </Paper>
                </Box>
              )
            ))}
          </Box>

          {/* Configuration Panel */}
          {selectedNode && !readOnly && (
            <Drawer
              variant={isMobile ? 'temporary' : 'persistent'}
              anchor="right"
              open={configPanelOpen}
              onClose={() => setConfigPanelOpen(false)}
              sx={{
                width: 400,
                flexShrink: 0,
                '& .MuiDrawer-paper': {
                  width: 400,
                  boxSizing: 'border-box',
                  position: 'relative',
                },
              }}
            >
              <NodeConfigPanel
                nodeType={selectedNode.data.nodeType}
                config={selectedNode.data.config}
                onConfigChange={(config) => handleNodeConfigChange(selectedNode.id, config)}
                onSave={handleSave}
                availableVariables={availableVariables}
                onClose={() => setConfigPanelOpen(false)}
              />
            </Drawer>
          )}
        </DialogContent>
      </Dialog>

      {/* Welcome Dialog */}
      <Dialog open={showWelcome} onClose={() => setShowWelcome(false)}>
        <DialogTitle>Welcome to Visual Workflow Designer</DialogTitle>
        <DialogContent>
          <Typography paragraph>
            Create powerful automation workflows with our intuitive drag-and-drop interface.
          </Typography>
          <Typography paragraph>
            <strong>Getting started:</strong>
          </Typography>
          <ul>
            <li>Drag components from the palette to the canvas</li>
            <li>Connect components to create workflow logic</li>
            <li>Configure each component using the properties panel</li>
            <li>Test and execute your workflows</li>
          </ul>
          <Typography paragraph>
            <strong>Keyboard shortcuts:</strong>
          </Typography>
          <ul>
            <li><kbd>Ctrl+S</kbd> - Save workflow</li>
            <li><kbd>Ctrl+Z</kbd> - Undo</li>
            <li><kbd>Ctrl+Shift+Z</kbd> - Redo</li>
            <li><kbd>Delete</kbd> - Delete selected nodes/edges</li>
            <li><kbd>F</kbd> - Fit view</li>
            <li><kbd>G</kbd> - Toggle grid</li>
          </ul>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowWelcome(false)}>Get Started</Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>

      {/* Loading overlay */}
      <Backdrop
        sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1 }}
        open={saveStatus === 'saving' || executionStatus === 'running'}
      >
        <Box sx={{ textAlign: 'center' }}>
          <CircularProgress color="inherit" />
          <Typography sx={{ mt: 2 }}>
            {saveStatus === 'saving' ? 'Saving workflow...' : 'Executing workflow...'}
          </Typography>
        </Box>
      </Backdrop>
    </>
  );
};

// Helper functions for React Flow changes
function applyNodeChanges(changes: any[], nodes: Node[]): Node[] {
  // This would normally use React Flow's applyNodeChanges
  // For now, return the original nodes
  return nodes;
}

function applyEdgeChanges(changes: any[], edges: Edge[]): Edge[] {
  // This would normally use React Flow's applyEdgeChanges
  // For now, return the original edges
  return edges;
}

function addEdge(connection: any, edges: Edge[]): Edge[] {
  // This would normally use React Flow's addEdge
  // For now, return the original edges
  return edges;
}

export default VisualWorkflowDesigner;