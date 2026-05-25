// @ts-nocheck
/**
 * Policy Management Page
 *
 * Main policy management interface with visual builder, code editor,
 * testing, deployment, impact analysis, and version management
 *
 * TODO: Fix mock data types to match policy-management interfaces
 */

'use client';

// Skip static prerendering — this page wires up monaco-editor + reactflow,
// which rely on browser APIs and regressed the build under static export.
export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Upload, Download } from 'lucide-react';

import VisualPolicyBuilder from '@/components/policy-management/visual-policy-builder';
import RegoEditor from '@/components/policy-management/rego-editor';
import PolicyTestPanel from '@/components/policy-management/policy-test-panel';
import PolicyDeploymentPanel from '@/components/policy-management/policy-deployment-panel';
import PolicyImpactAnalysis from '@/components/policy-management/policy-impact-analysis';
import PolicyVersionManagement from '@/components/policy-management/policy-version-management';

import { Policy } from '@/types/policy-management';
import { mockPolicies } from './components/mock-policies';
import { createNewPolicy } from './components/policy-helpers';
import { PolicyListView } from './components/policy-list-view';
import { PolicyNavBreadcrumb } from './components/policy-nav-breadcrumb';

export default function PolicyManagementPage() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [selectedPolicy, setSelectedPolicy] = useState<Policy | null>(null);
  const [activeView, setActiveView] = useState<string>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    setTimeout(() => { setPolicies(mockPolicies); setIsLoading(false); }, 1000);
  }, []);

  const filteredPolicies = policies.filter(policy => {
    if (searchQuery && !policy.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !policy.description.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (filterCategory !== 'all' && policy.category !== filterCategory) return false;
    if (filterStatus !== 'all' && policy.status !== filterStatus) return false;
    return true;
  });

  const handleSavePolicy = async (policy: Partial<Policy>) => {
    console.log('Saving policy:', policy);
  };

  const handleValidatePolicy = (valid: boolean, errors: any) => {
    console.log('Policy validation:', { valid, errors });
  };

  const handleTestPolicy = (policy: Policy) => {
    console.log('Testing policy:', policy.name);
    setActiveView('test');
  };

  const handleDeployPolicy = (policy: Policy) => {
    console.log('Deploying policy:', policy.name);
    setActiveView('deploy');
  };

  const handleSelectPolicy = (policy: Policy, view: string) => {
    setSelectedPolicy(policy);
    setActiveView(view);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b bg-gray-50 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Policy Management</h1>
            <p className="text-sm text-muted-foreground">
              Create, test, and manage security policies with enterprise-grade controls
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => {
              setSelectedPolicy(createNewPolicy());
              setActiveView('builder');
            }}>
              <Plus className="h-4 w-4 mr-1" />New Policy
            </Button>
            <Button variant="outline"><Upload className="h-4 w-4 mr-1" />Import</Button>
            <Button variant="outline"><Download className="h-4 w-4 mr-1" />Export</Button>
          </div>
        </div>
      </div>

      <PolicyNavBreadcrumb selectedPolicy={selectedPolicy} activeView={activeView}
        onViewChange={setActiveView} />

      {/* Main Content */}
      <div className="flex-1">
        {activeView === 'list' && (
          <PolicyListView policies={filteredPolicies} isLoading={isLoading}
            searchQuery={searchQuery} filterCategory={filterCategory} filterStatus={filterStatus}
            onSearchChange={setSearchQuery} onCategoryChange={setFilterCategory}
            onStatusChange={setFilterStatus} onSelectPolicy={handleSelectPolicy} />
        )}

        {activeView === 'builder' && selectedPolicy && (
          <VisualPolicyBuilder policy={selectedPolicy} onSave={handleSavePolicy}
            onValidate={handleValidatePolicy} onTest={handleTestPolicy} onDeploy={handleDeployPolicy} />
        )}

        {activeView === 'code' && selectedPolicy && (
          <div className="h-full">
            <RegoEditor value={selectedPolicy.regoCode}
              onChange={(value) => setSelectedPolicy({ ...selectedPolicy, regoCode: value })}
              onSave={() => handleSavePolicy(selectedPolicy)}
              onTest={() => handleTestPolicy(selectedPolicy)} height="100%" />
          </div>
        )}

        {activeView === 'test' && selectedPolicy && (
          <PolicyTestPanel policyId={selectedPolicy.id} version={selectedPolicy.version} />
        )}

        {activeView === 'deploy' && selectedPolicy && (
          <PolicyDeploymentPanel policy={selectedPolicy} deployments={[]}
            environments={['development', 'testing', 'staging', 'production']} />
        )}

        {activeView === 'impact' && selectedPolicy && (
          <PolicyImpactAnalysis policy={selectedPolicy} />
        )}

        {activeView === 'versions' && selectedPolicy && (
          <PolicyVersionManagement policyId={selectedPolicy.id} versions={selectedPolicy.versionHistory} />
        )}
      </div>
    </div>
  );
}
