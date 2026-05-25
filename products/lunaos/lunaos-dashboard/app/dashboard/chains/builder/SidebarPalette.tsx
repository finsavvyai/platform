'use client';

import React from 'react';

interface SidebarPaletteProps {
    onDragStart: (event: React.DragEvent, nodeType: string, agentName: string) => void;
}

export default function SidebarPalette({ onDragStart }: SidebarPaletteProps) {
    return (
        <div className="w-64 shrink-0 bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex flex-col gap-3 overflow-y-auto">
            <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider mb-2">Available Nodes</h3>

            <div className="space-y-2">
                <div className="text-xs font-semibold text-neutral-500">Inputs</div>
                <div
                    className="bg-neutral-800 border border-neutral-700 p-3 rounded-lg cursor-grab hover:border-violet-500 transition-colors text-sm text-white"
                    onDragStart={(event) => onDragStart(event, 'default', 'Read File / Context')} draggable
                >
                    📄 Read File / Context
                </div>
            </div>

            <div className="space-y-2 mt-2">
                <div className="text-xs font-semibold text-neutral-500">Agents</div>
                <div
                    className="bg-neutral-800 border border-neutral-700 p-3 rounded-lg cursor-grab hover:border-violet-500 transition-colors text-sm text-white flex items-center gap-2"
                    onDragStart={(event) => onDragStart(event, 'custom', 'Architect Agent')} draggable
                >
                    <span>🧠</span> Architect Agent
                </div>
                <div
                    className="bg-neutral-800 border border-neutral-700 p-3 rounded-lg cursor-grab hover:border-violet-500 transition-colors text-sm text-white flex items-center gap-2"
                    onDragStart={(event) => onDragStart(event, 'custom', 'Review Agent')} draggable
                >
                    <span>🔍</span> Review Agent
                </div>
                <div
                    className="bg-neutral-800 border border-neutral-700 p-3 rounded-lg cursor-grab hover:border-violet-500 transition-colors text-sm text-white flex items-center gap-2"
                    onDragStart={(event) => onDragStart(event, 'custom', 'Testing Agent')} draggable
                >
                    <span>🧪</span> Testing Agent
                </div>
            </div>

            <div className="space-y-2 mt-2">
                <div className="text-xs font-semibold text-neutral-500">Logic</div>
                <div
                    className="bg-neutral-800 border border-neutral-700 p-3 rounded-lg cursor-grab hover:border-amber-500 transition-colors text-sm text-white"
                    onDragStart={(event) => onDragStart(event, 'default', 'Condition (IF/ELSE)')} draggable
                >
                    🔀 Condition (IF/ELSE)
                </div>
                <div
                    className="bg-neutral-800 border border-neutral-700 p-3 rounded-lg cursor-grab hover:border-emerald-500 transition-colors text-sm text-white"
                    onDragStart={(event) => onDragStart(event, 'output', 'Emit Final Output')} draggable
                >
                    💾 Emit Output
                </div>
            </div>
        </div>
    );
}
