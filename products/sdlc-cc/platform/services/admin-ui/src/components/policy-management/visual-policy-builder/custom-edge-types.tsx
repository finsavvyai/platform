// @ts-nocheck
/**
 * Custom edge type components for the Visual Policy Builder
 */

'use client';

import React from 'react';
import { EdgeTypes } from 'reactflow';

export const CustomEdgeTypes: EdgeTypes = {
  success: ({ id, sourceX, sourceY, targetX, targetY, style = {} }) => {
    const edgePath = `M${sourceX},${sourceY} L${targetX},${targetY}`;
    return (
      <g>
        <path
          id={id}
          style={style}
          className="react-flow__edge-path stroke-green-500 stroke-2"
          d={edgePath}
          markerEnd="url(#success-arrow)"
        />
        <text>
          <textPath href={`#${id}`} startOffset="50%" textAnchor="middle" className="text-xs fill-green-600">
            Success
          </textPath>
        </text>
      </g>
    );
  },

  failure: ({ id, sourceX, sourceY, targetX, targetY, style = {} }) => {
    const edgePath = `M${sourceX},${sourceY} L${targetX},${targetY}`;
    return (
      <g>
        <path
          id={id}
          style={style}
          className="react-flow__edge-path stroke-red-500 stroke-2"
          d={edgePath}
          markerEnd="url(#failure-arrow)"
        />
        <text>
          <textPath href={`#${id}`} startOffset="50%" textAnchor="middle" className="text-xs fill-red-600">
            Failure
          </textPath>
        </text>
      </g>
    );
  }
};

export function EdgeMarkerDefs() {
  return (
    <svg>
      <defs>
        <marker
          id="success-arrow"
          markerWidth="10"
          markerHeight="10"
          refX="9"
          refY="3"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M0,0 L0,6 L9,3 z" fill="#10b981" />
        </marker>
        <marker
          id="failure-arrow"
          markerWidth="10"
          markerHeight="10"
          refX="9"
          refY="3"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M0,0 L0,6 L9,3 z" fill="#ef4444" />
        </marker>
      </defs>
    </svg>
  );
}
