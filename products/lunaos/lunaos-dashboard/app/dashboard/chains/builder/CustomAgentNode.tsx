import React from 'react';
import { Handle, Position, NodeProps } from 'reactflow';

export default function CustomAgentNode({ data, isConnectable }: NodeProps) {
    return (
        <div className="bg-neutral-800 border-2 border-neutral-600 text-white rounded-lg shadow-lg w-64">
            <Handle
                type="target"
                position={Position.Top}
                isConnectable={isConnectable}
                className="w-3 h-3 bg-violet-500 border-2 border-neutral-900"
            />

            <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
                <span className="font-semibold text-sm truncate pr-2">{data.label}</span>
                <div className="h-2 w-2 rounded-full bg-emerald-500 shrink-0"></div>
            </div>

            <div className="px-4 py-3 space-y-3 bg-black/20 rounded-b-lg">
                <label className="flex items-center gap-2 text-xs text-neutral-300 cursor-pointer group">
                    <input
                        type="checkbox"
                        className="form-checkbox text-violet-500 rounded border-white/20 bg-black/50 focus:ring-violet-500/50"
                        checked={data.requiresApproval || false}
                        onChange={(e) => {
                            if (data.onChangeApproval) {
                                data.onChangeApproval(e.target.checked);
                            }
                        }}
                    />
                    <span className="group-hover:text-white transition-colors">Require Human Approval (HITL)</span>
                </label>
            </div>

            <Handle
                type="source"
                position={Position.Bottom}
                isConnectable={isConnectable}
                className="w-3 h-3 bg-violet-500 border-2 border-neutral-900"
            />
        </div>
    );
}
