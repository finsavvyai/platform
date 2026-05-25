// @ts-nocheck
/**
 * Node properties panel for the Visual Policy Builder
 */

'use client';

import React from 'react';
import { Node, Panel } from 'reactflow';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trash2 } from 'lucide-react';
import { PolicyNode } from '@/types/policy-management';

interface NodePropertiesPanelProps {
  selectedNode: PolicyNode;
  nodes: Node[];
  setNodes: (nodes: Node[] | ((nds: Node[]) => Node[])) => void;
  setSelectedNode: (node: PolicyNode | null) => void;
  onDelete: (nodeId: string) => void;
}

export function NodePropertiesPanel({
  selectedNode,
  nodes,
  setNodes,
  setSelectedNode,
  onDelete
}: NodePropertiesPanelProps) {
  return (
    <Panel position="bottom-right" className="bg-white border rounded-lg shadow-lg p-4 w-80">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold">Node Properties</h3>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onDelete(selectedNode.id)}
          className="text-red-500 hover:text-red-700"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="logic">Logic</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-3">
          <div>
            <Label htmlFor="node-label">Label</Label>
            <Input
              id="node-label"
              value={selectedNode.data.label || ''}
              onChange={(e) => {
                const updated = nodes.map(n =>
                  n.id === selectedNode.id
                    ? { ...n, data: { ...n.data, label: e.target.value } }
                    : n
                );
                setNodes(updated);
                setSelectedNode({
                  ...selectedNode,
                  data: { ...selectedNode.data, label: e.target.value }
                });
              }}
            />
          </div>
          <div>
            <Label htmlFor="node-description">Description</Label>
            <Textarea
              id="node-description"
              value={selectedNode.data.description || ''}
              onChange={(e) => {
                const updated = nodes.map(n =>
                  n.id === selectedNode.id
                    ? { ...n, data: { ...n.data, description: e.target.value } }
                    : n
                );
                setNodes(updated);
                setSelectedNode({
                  ...selectedNode,
                  data: { ...selectedNode.data, description: e.target.value }
                });
              }}
              rows={2}
            />
          </div>
        </TabsContent>

        <TabsContent value="logic" className="space-y-3">
          {selectedNode.type !== 'input' && (
            <div>
              <Label htmlFor="node-logic">Logic Expression</Label>
              <Textarea
                id="node-logic"
                value={selectedNode.data.logic || ''}
                onChange={(e) => {
                  const updated = nodes.map(n =>
                    n.id === selectedNode.id
                      ? { ...n, data: { ...n.data, logic: e.target.value } }
                      : n
                  );
                  setNodes(updated);
                  setSelectedNode({
                    ...selectedNode,
                    data: { ...selectedNode.data, logic: e.target.value }
                  });
                }}
                rows={4}
                placeholder="Enter Rego expression"
                className="font-mono text-xs"
              />
            </div>
          )}
        </TabsContent>

        <TabsContent value="security" className="space-y-3">
          <div>
            <Label htmlFor="access-level">Access Level</Label>
            <Select defaultValue="internal">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="public">Public</SelectItem>
                <SelectItem value="internal">Internal</SelectItem>
                <SelectItem value="confidential">Confidential</SelectItem>
                <SelectItem value="secret">Secret</SelectItem>
                <SelectItem value="top_secret">Top Secret</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Security Options</Label>
            <div className="space-y-1">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" defaultChecked />
                Require Audit Log
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" defaultChecked />
                Validate Input
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" defaultChecked />
                Sanitize Output
              </label>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </Panel>
  );
}
