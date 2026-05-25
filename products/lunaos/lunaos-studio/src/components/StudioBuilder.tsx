/**
 * StudioBuilder — root layout. Authenticated app shell with
 * visual workflow builder, toolbar, and all panels.
 */

import React, { useState, useCallback, useMemo } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { NodePalette } from './NodePalette';
import { WorkflowCanvas } from './WorkflowCanvas';
import { NodeConfig } from './NodeConfig';
import { TemplateLibrary } from './TemplateLibrary';
import { Toolbar } from './Toolbar';
import { StatusBar } from './StatusBar';
import { ToastContainer } from './Toast';
import { MobileGate } from './MobileGate';
import { EmptyCanvas } from './EmptyCanvas';
import { AuthGate } from './AuthGate';
import { OnboardingOverlay } from './OnboardingOverlay';
import { WorkflowManager } from './WorkflowManager';
import { useWorkflowStore } from '../hooks/useWorkflowStore';
import { useToast } from '../hooks/useToast';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useDarkMode } from '../hooks/useDarkMode';
import { serializePipeline, exportToFile, importFromFile, deserializePipeline } from '../lib/pipeline-serializer';
import { executeWorkflow } from '../lib/workflow-runner';
import type { User } from '../lib/api-client';
import type { WorkflowTemplate } from '../types';
import { colors, fontFamily } from '../lib/theme';

export function StudioBuilder() {
  return (
    <MobileGate>
      <AuthGate>
        {(user) => <AuthenticatedStudio user={user} />}
      </AuthGate>
    </MobileGate>
  );
}

function AuthenticatedStudio({ user: initialUser }: { user: User }) {
  const isDark = useDarkMode();
  const c = isDark ? colors.dark : colors.light;
  const [user, setUser] = useState(initialUser);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [workflowsOpen, setWorkflowsOpen] = useState(false);
  const { toasts, show: toast, dismiss } = useToast();
  const store = useWorkflowStore();

  const shortcutActions = useMemo(() => ({
    onDelete: () => {
      if (store.selectedNodeId) { store.deleteNode(store.selectedNodeId); toast('Node deleted', 'info'); }
    },
    onExport: () => {
      exportToFile(serializePipeline(store.nodes, store.edges, store.workflowName));
      toast('Workflow exported', 'success');
    },
    getSnapshot: () => ({ nodes: structuredClone(store.nodes), edges: structuredClone(store.edges) }),
    restoreSnapshot: (e: { nodes: typeof store.nodes; edges: typeof store.edges }) => {
      store.loadWorkflow(e.nodes, e.edges, store.workflowName); toast('Undo', 'info');
    },
  }), [store, toast]);

  const { saveCheckpoint } = useKeyboardShortcuts(shortcutActions);

  const handleRun = useCallback(async () => {
    store.setIsRunning(true); toast('Workflow started...', 'info');
    try {
      await executeWorkflow(serializePipeline(store.nodes, store.edges, store.workflowName), {
        onNodeStart: (id) => store.setNodeStatus(id, 'running'),
        onNodeComplete: (id) => store.setNodeStatus(id, 'success'),
        onError: () => toast('Workflow error', 'error'),
      });
      toast('Workflow completed', 'success');
    } catch { toast('Workflow failed', 'error'); }
    finally { store.setIsRunning(false); }
  }, [store, toast]);

  const handleExport = useCallback(() => {
    exportToFile(serializePipeline(store.nodes, store.edges, store.workflowName));
    toast('Exported', 'success');
  }, [store, toast]);

  const handleImport = useCallback(async () => {
    try {
      saveCheckpoint();
      const p = await importFromFile();
      const { nodes, edges } = deserializePipeline(p);
      store.loadWorkflow(nodes, edges, p.name);
      toast(`Imported "${p.name}"`, 'success');
    } catch { /* cancelled */ }
  }, [store, toast, saveCheckpoint]);

  const handleTemplate = useCallback((tpl: WorkflowTemplate) => {
    saveCheckpoint();
    store.loadWorkflow(
      tpl.nodes.map((n) => ({ ...n, type: 'workflow-node' })),
      tpl.edges.map((e) => ({ ...e, type: 'smoothstep', animated: true })),
      tpl.name,
    );
    toast(`Loaded "${tpl.name}"`, 'success');
  }, [store, toast, saveCheckpoint]);

  const handleClear = useCallback(() => {
    saveCheckpoint(); store.clearWorkflow(); toast('Canvas cleared', 'info');
  }, [store, toast, saveCheckpoint]);

  const handleLogout = () => { setUser(null as unknown as User); window.location.reload(); };

  const shell: React.CSSProperties = {
    fontFamily, display: 'flex', flexDirection: 'column',
    height: '100vh', width: '100vw', background: c.bg, color: c.text, overflow: 'hidden',
  };

  return (
    <ReactFlowProvider>
      <div style={shell} data-testid="studio-builder">
        <Toolbar workflowName={store.workflowName} isRunning={store.isRunning} user={user}
          onNameChange={store.setWorkflowName} onRun={handleRun} onExport={handleExport}
          onImport={handleImport} onTemplates={() => setTemplatesOpen(true)}
          onClear={handleClear} onWorkflows={() => setWorkflowsOpen(true)} onLogout={handleLogout} />
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <NodePalette />
          <div style={{ flex: 1, overflow: 'hidden', position: 'relative' as const }}>
            <WorkflowCanvas nodes={store.nodes} edges={store.edges}
              onNodesChange={store.onNodesChange} onEdgesChange={store.onEdgesChange}
              onConnect={store.onConnect} onNodeSelect={store.setSelectedNodeId}
              onDropNode={store.addNode} />
            {store.nodes.length === 0 && <EmptyCanvas onOpenTemplates={() => setTemplatesOpen(true)} />}
          </div>
          <NodeConfig node={store.selectedNode} onUpdateConfig={store.updateNodeConfig}
            onUpdateLabel={store.updateNodeLabel} onDelete={store.deleteNode} />
        </div>
        <StatusBar nodeCount={store.nodes.length} edgeCount={store.edges.length}
          isRunning={store.isRunning} workflowName={store.workflowName} />
        <TemplateLibrary open={templatesOpen} onClose={() => setTemplatesOpen(false)} onSelect={handleTemplate} />
        <WorkflowManager open={workflowsOpen} onClose={() => setWorkflowsOpen(false)}
          onOpen={() => toast('Opening workflow...', 'info')} onNew={() => { saveCheckpoint(); store.clearWorkflow(); }} />
        <ToastContainer toasts={toasts} onDismiss={dismiss} />
        <OnboardingOverlay
          onStartTemplate={() => setTemplatesOpen(true)}
          onBlankCanvas={() => {/* dismiss only */}}
        />
      </div>
    </ReactFlowProvider>
  );
}
