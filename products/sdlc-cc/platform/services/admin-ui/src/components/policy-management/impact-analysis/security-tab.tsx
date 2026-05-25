// @ts-nocheck
/**
 * Impact Analysis Security Tab
 */

'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Shield } from 'lucide-react';

import { RiskLevel } from '@/types/policy-management';
import { SecurityImplication } from './types';
import { getRiskLevelColor, getSeverityColor } from './helpers';

interface SecurityTabProps {
  securityImplications: SecurityImplication[];
}

export function SecurityTab({ securityImplications }: SecurityTabProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Security Implications</h3>
        <div className="space-y-4">
          {securityImplications.map((impl, index) => (
            <Card key={index}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Shield className={`h-4 w-4 text-${getSeverityColor(impl.severity)}`} />
                    <span className="font-medium">{impl.type}</span>
                  </div>
                  <Badge className={getRiskLevelColor(impl.severity as RiskLevel)}>
                    {impl.severity}
                  </Badge>
                </div>

                <p className="text-sm text-muted-foreground mb-3">
                  {impl.description}
                </p>

                <div className="space-y-2">
                  <div>
                    <span className="text-xs font-semibold text-muted-foreground">
                      Affected Controls:
                    </span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {impl.affectedControls.map((control, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {control}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div>
                    <span className="text-xs font-semibold text-muted-foreground">
                      Mitigations:
                    </span>
                    <ul className="mt-1 space-y-1">
                      {impl.mitigations.map((mitigation, idx) => (
                        <li key={idx} className="text-xs text-muted-foreground flex items-start gap-1">
                          <span>-</span>
                          <span>{mitigation}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
