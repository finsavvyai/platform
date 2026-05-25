// @ts-nocheck
/**
 * Version Management Header with search and filters
 */

'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { GitCommit, GitCompare, Download, Search, FileText, History, Database } from 'lucide-react';

interface VersionHeaderProps {
  compareMode: boolean;
  onToggleCompare: () => void;
  onExport: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  filterStatus: string;
  onFilterChange: (status: string) => void;
  viewMode: 'list' | 'timeline' | 'grid';
  onViewModeChange: (mode: 'list' | 'timeline' | 'grid') => void;
}

export function VersionHeader({
  compareMode, onToggleCompare, onExport,
  searchQuery, onSearchChange,
  filterStatus, onFilterChange,
  viewMode, onViewModeChange,
}: VersionHeaderProps) {
  return (
    <div className="border-b bg-gray-50 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Version Management</h2>
          <p className="text-sm text-muted-foreground">
            Manage policy versions, compare changes, and restore previous versions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant={compareMode ? 'default' : 'outline'} onClick={onToggleCompare}>
            <GitCompare className="h-4 w-4 mr-1" />Compare
          </Button>
          <Button size="sm" variant="outline" onClick={onExport}>
            <Download className="h-4 w-4 mr-1" />Export
          </Button>
          <Button size="sm" onClick={() => console.log('Create new version')}>
            <GitCommit className="h-4 w-4 mr-1" />New Version
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-4 mt-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input placeholder="Search versions by changelog..." value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)} className="pl-10" />
        </div>
        <Select value={filterStatus} onValueChange={onFilterChange}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Versions</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="deprecated">Deprecated</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1">
          <Button size="sm" variant={viewMode === 'list' ? 'default' : 'ghost'} onClick={() => onViewModeChange('list')}>
            <FileText className="h-4 w-4" />
          </Button>
          <Button size="sm" variant={viewMode === 'timeline' ? 'default' : 'ghost'} onClick={() => onViewModeChange('timeline')}>
            <History className="h-4 w-4" />
          </Button>
          <Button size="sm" variant={viewMode === 'grid' ? 'default' : 'ghost'} onClick={() => onViewModeChange('grid')}>
            <Database className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
