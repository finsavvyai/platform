'use client';

import { useState, useCallback, useRef } from 'react';
import {
    useNodesState,
    useEdgesState,
    addEdge,
    Connection,
    Edge,
    Node,
    ReactFlowInstance,
} from 'reactflow';
import { useRouter } from 'next/navigation';
import SidebarPalette from './SidebarPalette';
import FlowCanvas from './FlowCanvas';

const initialNodes: Node[] = [
    {
        id: '1',
        type: 'input',
        data: { label: 'Start (Input Context)' },
        position: { x: 250, y: 5 },
        className: 'bg-violet-900 border-2 border-violet-500 text-white font-bold rounded-lg shadow-lg py-2 px-4'
    },
];

const initialEdges: Edge[] = [];

export default function FlowBuilderPage() {
    const router = useRouter();
    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

    const [chainName, setChainName] = useState('My Custom Chain');
    const [saving, setSaving] = useState(false);

    const reactFlowWrapper = useRef<HTMLDivElement>(null);
    const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);

    const onConnect = useCallback(
        (params: Connection | Edge) => setEdges((eds) => addEdge(params, eds)),
        [setEdges],
    );

    const onDragOver = useCallback((event: React.DragEvent) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }, []);

    const onDrop = useCallback(
        (event: React.DragEvent) => {
            event.preventDefault();
            if (!reactFlowWrapper.current || !reactFlowInstance) return;

            const type = event.dataTransfer.getData('application/reactflow');
            const agentName = event.dataTransfer.getData('agent/name') || 'New Node';
            if (typeof type === 'undefined' || !type) return;

            const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
            const position = reactFlowInstance.project({
                x: event.clientX - reactFlowBounds.left,
                y: event.clientY - reactFlowBounds.top,
            });

            const newNode: Node = {
                id: `node_${new Date().getTime()}`,
                type,
                position,
                data: {
                    label: `${agentName}`,
                    requiresApproval: false,
                    onChangeApproval: (val: boolean) => {
                        setNodes(nds => nds.map(n => {
                            if (n.id === newNode.id) {
                                return { ...n, data: { ...n.data, requiresApproval: val } };
                            }
                            return n;
                        }));
                    }
                },
                className: type === 'custom'
                    ? undefined
                    : 'bg-neutral-800 border-2 border-neutral-600 text-white rounded-lg shadow-lg py-3 px-6 hover:border-violet-500 transition-colors'
            };

            setNodes((nds) => nds.concat(newNode));
        },
        [reactFlowInstance, setNodes],
    );

    const onDragStart = (event: React.DragEvent, nodeType: string, agentName: string) => {
        event.dataTransfer.setData('application/reactflow', nodeType);
        event.dataTransfer.setData('agent/name', agentName);
        event.dataTransfer.effectAllowed = 'move';
    };

    const handleSave = async () => {
        setSaving(true);
        const chainData = {
            name: chainName,
            nodes: reactFlowInstance?.getNodes(),
            edges: reactFlowInstance?.getEdges(),
        };

        setTimeout(() => {
            alert(`Saved Visual Chain: ${chainName}`);
            setSaving(false);
        }, 800);
    };

    return (
        <div className="flex flex-col h-[calc(100vh-6rem)] animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between mb-4 shrink-0">
                <div>
                    <input
                        className="text-2xl font-bold bg-transparent border-b border-transparent hover:border-white/20 focus:border-violet-500 focus:outline-none text-white transition-colors"
                        value={chainName}
                        onChange={(e) => setChainName(e.target.value)}
                    />
                    <p className="text-sm text-neutral-400 mt-1">
                        Drag agents from the left onto the canvas to build a workflow.
                    </p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => router.push('/dashboard/chains')}
                        className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg transition-colors font-medium text-sm"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg transition-colors font-medium text-sm disabled:opacity-50"
                    >
                        {saving ? 'Saving...' : 'Save Chain'}
                    </button>
                </div>
            </div>

            <div className="flex flex-1 gap-4 overflow-hidden">
                <SidebarPalette onDragStart={onDragStart} />
                <FlowCanvas
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    onInit={setReactFlowInstance}
                    onDrop={onDrop}
                    onDragOver={onDragOver}
                    wrapperRef={reactFlowWrapper}
                />
            </div>
        </div>
    );
}
