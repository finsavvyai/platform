'use client'

import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ComplianceReport } from './types'
import { getComplianceStatusColor } from './helpers'

interface ComplianceTabProps {
  complianceReports: ComplianceReport[]
}

export function ComplianceTab({ complianceReports }: ComplianceTabProps) {
  return (
    <div className="space-y-4">
      {complianceReports.map((report) => (
        <Card key={report.framework}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium">{report.framework}</h4>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={getComplianceStatusColor(report.status)}>
                  {report.status.toUpperCase()}
                </Badge>
                <span className="text-sm font-medium">{report.score}/100</span>
              </div>
            </div>
            <Progress value={report.score} className="mb-3" />
            <div className="text-sm text-muted-foreground mb-3">
              Last assessed: {new Date(report.lastAssessment).toLocaleDateString()}
            </div>
            {report.findings.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Findings:</p>
                {report.findings.map((finding, index) => (
                  <div key={index} className="p-2 rounded border">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">{finding.category}</span>
                      <Badge variant="outline" className={getComplianceStatusColor(finding.severity)}>{finding.severity}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{finding.description}</p>
                    <p className="text-sm text-blue-600 mt-1">{finding.recommendation}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
