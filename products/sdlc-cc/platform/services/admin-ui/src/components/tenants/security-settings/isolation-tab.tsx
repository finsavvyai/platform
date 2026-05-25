'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel } from '@/components/ui/form'
import { Database } from 'lucide-react'
import { UseFormReturn } from 'react-hook-form'
import { SecuritySettingsFormData } from './types'

interface IsolationTabProps {
  form: UseFormReturn<SecuritySettingsFormData>
  onSubmit: (data: SecuritySettingsFormData) => void
  isLoading: boolean
}

const isolationFields = [
  { name: 'isolation.databaseIsolation' as const, label: 'Database Isolation', desc: 'Separate database schema for this tenant' },
  { name: 'isolation.storageIsolation' as const, label: 'Storage Isolation', desc: 'Dedicated storage bucket for this tenant' },
  { name: 'isolation.networkIsolation' as const, label: 'Network Isolation', desc: 'Isolate network traffic for this tenant' },
  { name: 'isolation.auditTrail' as const, label: 'Audit Trail', desc: 'Log all access to tenant data' },
]

export function IsolationTab({ form, onSubmit, isLoading }: IsolationTabProps) {
  return (
    <div className="space-y-4">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <h4 className="text-lg font-medium mb-4">Tenant Isolation Controls</h4>
          <div className="grid gap-4 md:grid-cols-2">
            {isolationFields.map(({ name, label, desc }) => (
              <FormField key={name} control={form.control} name={name} render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5"><FormLabel className="text-base">{label}</FormLabel><FormDescription>{desc}</FormDescription></div>
                  <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                </FormItem>
              )} />
            ))}
          </div>
          <Alert><Database className="h-4 w-4" /><AlertTitle>Strict Isolation Mode</AlertTitle><AlertDescription>When enabled, tenant data will be completely isolated at all levels - database, storage, and network. This provides maximum security but may increase operational complexity.</AlertDescription></Alert>
          <div className="flex justify-end"><Button type="submit" disabled={isLoading}>{isLoading ? 'Saving...' : 'Save Isolation Settings'}</Button></div>
        </form>
      </Form>
    </div>
  )
}
