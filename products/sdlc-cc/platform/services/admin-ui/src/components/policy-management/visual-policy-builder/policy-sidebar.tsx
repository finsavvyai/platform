// @ts-nocheck
/** Sidebar component for the Visual Policy Builder */
'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Save,
  Download,
  Play,
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Filter,
  Zap,
  CheckSquare,
  Activity
} from 'lucide-react';

import { Policy } from '@/types/policy-management';
import { securityRuleTemplates } from './security-rule-templates';

interface PolicySidebarProps {
  policy?: Policy;
  readOnly?: boolean;
  isValid: boolean | null;
  isSaving: boolean;
  validationErrors: string[];
  showSecurityPanel: boolean;
  onSave: () => void;
  onTest?: (policy: Policy) => void;
  onExport: () => void;
  onToggleSecurityPanel: () => void;
}

export function PolicySidebar({
  policy,
  readOnly,
  isValid,
  isSaving,
  validationErrors,
  onSave,
  onTest,
  onExport,
  onToggleSecurityPanel
}: PolicySidebarProps) {
  return (
    <div className="w-80 border-r bg-gray-50 p-4 overflow-y-auto">
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold mb-3">Security Rule Templates</h3>
          <div className="space-y-2">
            {Object.entries(securityRuleTemplates).map(([key, template]) => (
              <Card
                key={key}
                className="cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/reactflow', key);
                  e.dataTransfer.effectAllowed = 'move';
                }}
              >
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    {template.type === 'condition' && <Filter className="h-4 w-4 text-blue-500" />}
                    {template.type === 'action' && <Zap className="h-4 w-4 text-purple-500" />}
                    {template.type === 'validation' && <CheckSquare className="h-4 w-4 text-green-500" />}
                    {template.type === 'compliance' && <Shield className="h-4 w-4 text-red-500" />}
                    {template.type === 'decision' && <Activity className="h-4 w-4 text-green-600" />}
                    <div className="flex-1">
                      <p className="text-sm font-medium">{template.data?.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {template.data?.description}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <Separator />

        <div>
          <h3 className="text-sm font-semibold mb-3">Policy Information</h3>
          <div className="space-y-3">
            <div>
              <Label htmlFor="policy-name">Policy Name</Label>
              <Input
                id="policy-name"
                defaultValue={policy?.name || ''}
                placeholder="Enter policy name"
                readOnly={readOnly}
              />
            </div>
            <div>
              <Label htmlFor="policy-category">Category</Label>
              <Select defaultValue={policy?.category || 'authorization'}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="authentication">Authentication</SelectItem>
                  <SelectItem value="authorization">Authorization</SelectItem>
                  <SelectItem value="data_access">Data Access</SelectItem>
                  <SelectItem value="api_security">API Security</SelectItem>
                  <SelectItem value="compliance">Compliance</SelectItem>
                  <SelectItem value="privacy">Privacy</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="policy-description">Description</Label>
              <Textarea
                id="policy-description"
                defaultValue={policy?.description || ''}
                placeholder="Describe the policy purpose"
                rows={3}
                readOnly={readOnly}
              />
            </div>
          </div>
        </div>

        <Separator />

        <div>
          <h3 className="text-sm font-semibold mb-3">Validation Status</h3>
          {isValid !== null && (
            <Alert className={isValid ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
              <div className="flex items-center gap-2">
                {isValid ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600" />
                )}
                <AlertDescription className={isValid ? 'text-green-800' : 'text-red-800'}>
                  {isValid ? 'Policy is valid' : 'Policy has validation errors'}
                </AlertDescription>
              </div>
            </Alert>
          )}
          {validationErrors.length > 0 && (
            <div className="mt-3 space-y-1">
              {validationErrors.map((error, index) => (
                <div key={index} className="text-xs text-red-600 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {error}
                </div>
              ))}
            </div>
          )}
        </div>

        <Separator />

        <div className="space-y-2">
          <Button onClick={onSave} disabled={!isValid || isSaving || readOnly} className="w-full">
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save Policy'}
          </Button>
          <Button
            variant="outline"
            onClick={() => onTest && onTest(policy!)}
            disabled={!policy || !isValid}
            className="w-full"
          >
            <Play className="h-4 w-4 mr-2" />
            Test Policy
          </Button>
          <Button variant="outline" onClick={onExport} className="w-full">
            <Download className="h-4 w-4 mr-2" />
            Export Policy
          </Button>
          <Button variant="outline" onClick={onToggleSecurityPanel} className="w-full">
            <Shield className="h-4 w-4 mr-2" />
            Security Settings
          </Button>
        </div>
      </div>
    </div>
  );
}
