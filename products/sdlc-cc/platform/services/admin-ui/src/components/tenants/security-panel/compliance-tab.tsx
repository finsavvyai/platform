'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel } from '@/components/ui/form'
import { Progress } from '@/components/ui/progress'
import { AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { UseFormReturn } from 'react-hook-form'
import { SecurityFormData, ComplianceReport } from './types'
import { getStatusIcon, getStatusColor } from './helpers'

interface ComplianceTabProps {
  form: UseFormReturn<SecurityFormData>
  onSubmit: (data: SecurityFormData) => void
  complianceReports: ComplianceReport[]
}

export function ComplianceTab({ form, onSubmit, complianceReports }: ComplianceTabProps) {
  return (
    <div className="space-y-4">
      {complianceReports.map((report, index) => (
        <Card key={index}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">{report.framework}</CardTitle>
              <div className="flex items-center gap-2">
                {getStatusIcon(report.status)}
                <Badge className={getStatusColor(report.status)}>{report.status}</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span>Compliance Score</span>
                <span className="font-medium">{report.score}/100</span>
              </div>
              <Progress value={report.score} />
              <div className="text-xs text-muted-foreground">
                Last audit: {new Date(report.lastAudit).toLocaleDateString()}
              </div>
              {report.issues.length > 0 && (
                <div className="mt-3 space-y-2">
                  <h5 className="text-sm font-medium">Identified Issues:</h5>
                  {report.issues.map((issue, idx) => (
                    <Alert key={idx}>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        <span className={cn('font-medium',
                          issue.severity === 'high' ? 'text-red-600' :
                          issue.severity === 'medium' ? 'text-yellow-600' : 'text-blue-600'
                        )}>[{issue.severity.toUpperCase()}]</span>
                        {' '}{issue.description}
                        <br />
                        <span className="text-xs">Recommendation: {issue.recommendation}</span>
                      </AlertDescription>
                    </Alert>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <h4 className="text-sm font-medium mb-3">Compliance Frameworks</h4>
            <div className="space-y-3">
              <FormField control={form.control} name="compliance.gdprCompliant"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                    <div>
                      <FormLabel className="text-sm">GDPR Compliance</FormLabel>
                      <FormDescription className="text-xs">General Data Protection Regulation</FormDescription>
                    </div>
                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                  </FormItem>
                )}
              />
              <FormField control={form.control} name="compliance.soc2Compliant"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                    <div>
                      <FormLabel className="text-sm">SOC 2 Type II</FormLabel>
                      <FormDescription className="text-xs">Service Organization Control 2</FormDescription>
                    </div>
                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                  </FormItem>
                )}
              />
            </div>
          </div>
        </form>
      </Form>
    </div>
  )
}
