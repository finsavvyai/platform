// @ts-nocheck
/**
 * Impact Analysis Resources Tab
 */

'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Filter,
  Search,
  Globe,
  Database,
  Server,
  Users,
  HardDrive,
} from 'lucide-react';

import { PolicyImpact } from '@/types/policy-management';
import { getRiskLevelColor } from './helpers';

interface ResourcesTabProps {
  impact: PolicyImpact | null;
}

export function ResourcesTab({ impact }: ResourcesTabProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Affected Resources</h3>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline">
            <Filter className="h-3 w-3 mr-1" />
            Filter
          </Button>
          <Button size="sm" variant="outline">
            <Search className="h-3 w-3 mr-1" />
            Search
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {impact?.affectedResources.map((resource, index) => (
          <Card key={index}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  {resource.type === 'api' && <Globe className="h-4 w-4 text-blue-500" />}
                  {resource.type === 'database' && <Database className="h-4 w-4 text-green-500" />}
                  {resource.type === 'service' && <Server className="h-4 w-4 text-purple-500" />}
                  {resource.type === 'user' && <Users className="h-4 w-4 text-orange-500" />}
                  {resource.type === 'data' && <HardDrive className="h-4 w-4 text-gray-500" />}

                  <div>
                    <p className="font-medium">{resource.name}</p>
                    <p className="text-xs text-muted-foreground">{resource.id}</p>
                  </div>
                </div>

                <Badge className={getRiskLevelColor(resource.risk)}>
                  {resource.risk}
                </Badge>
              </div>

              <p className="text-sm text-muted-foreground mb-3">
                {resource.description}
              </p>

              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Impact:</span>
                <Badge variant="outline" className="text-xs">
                  {resource.impact}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
