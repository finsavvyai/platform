// @ts-nocheck
/**
 * Policy List View for the main policies page
 */

'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Search,
  Filter,
  Shield,
  GitBranch,
  Edit,
  Play,
  Rocket,
  BarChart3,
  History,
  CheckCircle,
  Clock,
  RefreshCw,
  Loader2,
} from 'lucide-react';

import { Policy, PolicyStatus } from '@/types/policy-management';
import { getStatusBadge, getPriorityColor } from './policy-helpers';

// Using User icon inline to avoid name collision with lucide Edit
const User = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} width="24" height="24"
    viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

interface PolicyListViewProps {
  policies: Policy[];
  isLoading: boolean;
  searchQuery: string;
  filterCategory: string;
  filterStatus: string;
  onSearchChange: (query: string) => void;
  onCategoryChange: (category: string) => void;
  onStatusChange: (status: string) => void;
  onSelectPolicy: (policy: Policy, view: string) => void;
}

export function PolicyListView({
  policies,
  isLoading,
  searchQuery,
  filterCategory,
  filterStatus,
  onSearchChange,
  onCategoryChange,
  onStatusChange,
  onSelectPolicy,
}: PolicyListViewProps) {
  return (
    <div className="p-4">
      {/* Search and Filters */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input placeholder="Search policies..." value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)} className="pl-10" />
        </div>

        <Select value={filterCategory} onValueChange={onCategoryChange}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="authentication">Authentication</SelectItem>
            <SelectItem value="authorization">Authorization</SelectItem>
            <SelectItem value="data_access">Data Access</SelectItem>
            <SelectItem value="api_security">API Security</SelectItem>
            <SelectItem value="compliance">Compliance</SelectItem>
            <SelectItem value="privacy">Privacy</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterStatus} onValueChange={onStatusChange}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="testing">Testing</SelectItem>
            <SelectItem value="review">In Review</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="deployed">Deployed</SelectItem>
            <SelectItem value="deprecated">Deprecated</SelectItem>
          </SelectContent>
        </Select>

        <Button variant="outline" size="sm"><Filter className="h-4 w-4 mr-1" />More Filters</Button>
        <Button variant="outline" size="sm"><RefreshCw className="h-4 w-4" /></Button>
      </div>

      {/* Policy List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : (
        <div className="grid gap-4">
          {policies.map((policy) => (
            <Card key={policy.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-lg">{policy.name}</h3>
                      {getStatusBadge(policy.status)}
                      <Badge variant="outline" className={getPriorityColor(policy.priority)}>
                        {policy.priority}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">{policy.description}</p>
                    <div className="flex items-center gap-6 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1"><Shield className="h-3 w-3" /><span>{policy.category}</span></div>
                      <div className="flex items-center gap-1"><GitBranch className="h-3 w-3" /><span>v{policy.version}</span></div>
                      <div className="flex items-center gap-1"><User className="h-3 w-3" /><span>{policy.createdBy.split('@')[0]}</span></div>
                      <div className="flex items-center gap-1"><Clock className="h-3 w-3" /><span>{policy.updatedAt.toLocaleDateString()}</span></div>
                      {policy.deploymentStatus === 'deployed' && (
                        <div className="flex items-center gap-1"><CheckCircle className="h-3 w-3 text-green-500" /><span>Deployed</span></div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="ghost" onClick={() => onSelectPolicy(policy, 'builder')}><Edit className="h-3 w-3" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => onSelectPolicy(policy, 'test')}><Play className="h-3 w-3" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => onSelectPolicy(policy, 'deploy')}><Rocket className="h-3 w-3" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => onSelectPolicy(policy, 'impact')}><BarChart3 className="h-3 w-3" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => onSelectPolicy(policy, 'versions')}><History className="h-3 w-3" /></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
