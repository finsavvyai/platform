// @ts-nocheck
/**
 * Security settings panel for the Visual Policy Builder
 */

'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Lock, Key, Eye, XCircle } from 'lucide-react';

interface SecuritySettingsPanelProps {
  onClose: () => void;
}

export function SecuritySettingsPanel({ onClose }: SecuritySettingsPanelProps) {
  return (
    <div className="w-80 border-l bg-gray-50 p-4 overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Security Settings</h3>
        <Button size="sm" variant="ghost" onClick={onClose}>
          <XCircle className="h-4 w-4" />
        </Button>
      </div>

      <Tabs defaultValue="encryption" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="encryption">Encryption</TabsTrigger>
          <TabsTrigger value="access">Access Control</TabsTrigger>
          <TabsTrigger value="audit">Audit</TabsTrigger>
        </TabsList>

        <TabsContent value="encryption" className="space-y-4">
          <Alert>
            <Lock className="h-4 w-4" />
            <AlertDescription>
              Configure encryption settings for policy data
            </AlertDescription>
          </Alert>
          <div className="space-y-3">
            <div>
              <Label>Data at Rest</Label>
              <Select defaultValue="aes-256">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="aes-256">AES-256</SelectItem>
                  <SelectItem value="aes-192">AES-192</SelectItem>
                  <SelectItem value="chacha20">ChaCha20</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data in Transit</Label>
              <Select defaultValue="tls-1.3">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="tls-1.3">TLS 1.3</SelectItem>
                  <SelectItem value="tls-1.2">TLS 1.2</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Key Rotation</Label>
              <Input type="number" defaultValue="90" suffix="days" />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="access" className="space-y-4">
          <Alert>
            <Key className="h-4 w-4" />
            <AlertDescription>
              Manage access controls and permissions
            </AlertDescription>
          </Alert>
          <div className="space-y-3">
            <div>
              <Label>Access Control Model</Label>
              <Select defaultValue="rbac">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="rbac">Role-Based (RBAC)</SelectItem>
                  <SelectItem value="abac">Attribute-Based (ABAC)</SelectItem>
                  <SelectItem value="acl">Access Control List (ACL)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Required Permissions</Label>
              <div className="space-y-1 mt-2">
                {['policy:read', 'policy:write', 'policy:deploy', 'policy:test'].map(perm => (
                  <label key={perm} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" defaultChecked={perm !== 'policy:write'} />
                    {perm}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <Alert>
            <Eye className="h-4 w-4" />
            <AlertDescription>
              Configure audit logging and monitoring
            </AlertDescription>
          </Alert>
          <div className="space-y-3">
            <div>
              <Label>Log Level</Label>
              <Select defaultValue="info">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="debug">Debug</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="warn">Warning</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Log Retention (days)</Label>
              <Input type="number" defaultValue="365" />
            </div>
            <div className="space-y-1">
              <Label>Log Events</Label>
              {['Policy Creation', 'Policy Updates', 'Policy Deletion', 'Deployments', 'Test Runs'].map(event => (
                <label key={event} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" defaultChecked />
                  {event}
                </label>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
