'use client';

import React, { useCallback, useEffect, useState } from 'react';
import ReactFlow, {
    Background,
    Controls,
    Edge,
    Node,
    useNodesState,
    useEdgesState,
    MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { generateMockStep, GLMStep, getRandomMetrics } from '../../lib/investor-mode';
import { Card, CardContent, CardHeader, CardTitle, Badge } from '../ui'; // Fixed import path

// If UI components don't exist, we fallback to basic HTML in the render
// For now, I'll assume standard Shadcn/UI structure or generic divs if imports fail.
// I will keep imports minimal to avoid breakage.

const NODE_WIDTH = 250;
const NODE_HEIGHT = 80;

export function GLMVisualizer({ investorMode = false }: { investorMode?: boolean }) {
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [stepIndex, setStepIndex] = useState(0);
    const [metrics, setMetrics] = useState({ tps: 0, cost: 0, latency: 0 });
    const [isRunning, setIsRunning] = useState(false);

    // Simulation Loop
    useEffect(() => {
        if (!investorMode || !isRunning) return;

        const interval = setInterval(() => {
            const newStep = generateMockStep(0, stepIndex); // Using scenario 0 for now

            if (newStep) {
                // Add Node
                const newNode: Node = {
                    id: newStep.id,
                    type: 'default', // Using default node type for simplicity
                    data: { label: newStep.content },
                    position: { x: 250 - (NODE_WIDTH / 2), y: stepIndex * 100 + 50 },
                    style: {
                        background: newStep.type === 'reasoning' ? '#eef2ff' : '#f0fdf4',
                        border: '1px solid #777',
                        borderRadius: '8px',
                        width: NODE_WIDTH,
                        fontSize: '12px'
                    },
                };

                setNodes((nds) => [...nds, newNode]);

                // Add Edge if not first node
                if (stepIndex > 0) {
                    const prevStepId = nodes[nodes.length - 1]?.id;
                    if (prevStepId) {
                        const newEdge: Edge = {
                            id: `e-${prevStepId}-${newStep.id}`,
                            source: prevStepId,
                            target: newStep.id,
                            animated: true,
                            markerEnd: { type: MarkerType.ArrowClosed },
                        };
                        setEdges((eds) => [...eds, newEdge]);
                    }
                }

                // Update Metrics
                setMetrics(getRandomMetrics());
                setStepIndex((prev) => prev + 1);
            } else {
                setIsRunning(false); // End of scenario
            }
        }, 1500); // New step every 1.5s

        return () => clearInterval(interval);
    }, [investorMode, isRunning, stepIndex, nodes, setNodes, setEdges]);

    const startDemo = useCallback(() => {
        setNodes([]);
        setEdges([]);
        setStepIndex(0);
        setIsRunning(true);
    }, [setNodes, setEdges]);

    return (
        <div className="w-full h-[600px] border rounded-xl overflow-hidden bg-slate-50 dark:bg-slate-900 flex flex-col">
            <div className="p-4 border-b bg-white dark:bg-slate-950 flex justify-between items-center">
                <div>
                    <h2 className="text-lg font-bold">GLM Reasoning Engine</h2>
                    <div className="text-xs text-muted-foreground flex gap-4 mt-1">
                        <span>TPS: <b className="text-green-600">{metrics.tps}</b></span>
                        <span>Latency: <b className="text-blue-600">{metrics.latency}ms</b></span>
                        <span>Cost: <b className="text-amber-600">${metrics.cost}</b></span>
                    </div>
                </div>
                {investorMode && (
                    <button
                        onClick={startDemo}
                        disabled={isRunning}
                        className="px-4 py-2 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700 disabled:opacity-50"
                    >
                        {isRunning ? 'Processing...' : 'Run Simulation'}
                    </button>
                )}
            </div>

            <div className="flex-1 relative">
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    fitView
                    fitViewOptions={{ padding: 0.2 }}
                >
                    <Background color="#aaa" gap={16} />
                    <Controls />
                </ReactFlow>
            </div>
        </div>
    );
}
