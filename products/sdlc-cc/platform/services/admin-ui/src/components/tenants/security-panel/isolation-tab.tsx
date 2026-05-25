'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Lock } from 'lucide-react'
import { UseFormReturn } from 'react-hook-form'
import { SecurityFormData } from './types'

interface IsolationTabProps {
  form: UseFormReturn<SecurityFormData>
  onSubmit: (data: SecurityFormData) => void
  isLoading: boolean
}

export function IsolationTab({ form, onSubmit, isLoading }: IsolationTabProps) {
  return (
    <div className="space-y-4">
      <Alert>
        <Lock className="h-4 w-4" />
        <AlertTitle>Tenant Isolation</AlertTitle>
        <AlertDescription>Ensure strict isolation of tenant resources and data.</AlertDescription>
      </Alert>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField control={form.control} name="isolation.strictIsolation"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <FormLabel className="text-base">Strict Isolation</FormLabel>
                  <FormDescription>Complete isolation of tenant resources with dedicated infrastructure</FormDescription>
                </div>
                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
              </FormItem>
            )}
          />

          <div>
            <h4 className="text-sm font-medium mb-3">Resource Quotas</h4>
            <div className="grid gap-4 md:grid-cols-2">
              {(['maxCPU', 'maxMemory', 'maxStorage', 'maxAPIRequests'] as const).map((field) => (
                <FormField key={field} control={form.control} name={`isolation.resourceQuotas.${field}`}
                  render={({ field: formField }) => (
                    <FormItem>
                      <FormLabel>{field === 'maxCPU' ? 'Max CPU (vCPUs)' : field === 'maxMemory' ? 'Max Memory (MB)' : field === 'maxStorage' ? 'Max Storage (GB)' : 'Max API Requests / Month'}</FormLabel>
                      <FormControl>
                        <Input type="number" {...formField} onChange={(e) => formField.onChange(parseInt(e.target.value))} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Saving...' : 'Update Isolation Settings'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}
