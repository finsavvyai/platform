'use client';

import React from 'react';
import ReactFlow, {
    MiniMap,
    Controls,
    Background,
    OnNodesChange,
    OnEdgesChange,
    Connection,
    Edge,
    Node,
    BackgroundVariant,
    ReactFlowInstance,
} from 'reactflow';
import 'reactflow/dist/style.css';
import CustomAgentNode from './CustomAgentNode';

const nodeTypes = {
    custom: CustomAgentNode,
};

function getNodeColor(node: Node): string {
    if (node.type === 'input') return '#8b5cf6';
    if (node.type === 'output') return '#10b981';
    return '#404040';
}

interface FlowCanvasProps {
    nodes: Node[];
    edges: Edge[];
    onNodesChange: OnNodesChange;
    onEdgesChange: OnEdgesChange;
    onConnect: (params: Connection | Edge) => void;
    onInit: (instance: ReactFlowInstance) => void;
    onDrop: (event: React.DragEvent) => void;
    onDragOver: (event: React.DragEvent) => void;
    wrapperRef: React.RefObject<HTMLDivElement>;
}

export default function FlowCanvas({
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    onInit,
    onDrop,
    onDragOver,
    wrapperRef,
}: FlowCanvasProps) {
    return (
        <div
            className="flex-1 rounded-xl overflow-hidden border border-neutral-800 bg-neutral-950 relative"
            ref={wrapperRef}
        >
            <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onInit={onInit}
                onDrop={onDrop}
                onDragOver={onDragOver}
                fitView
                proOptions={{ hideAttribution: true }}
            >
                <Controls className="bg-neutral-800 border-neutral-700 fill-white" />
                <MiniMap
                    className="bg-neutral-900 border border-neutral-800"
                    nodeColor={getNodeColor}
                />
                <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#333" />
            </ReactFlow>
        </div>
    );
}
