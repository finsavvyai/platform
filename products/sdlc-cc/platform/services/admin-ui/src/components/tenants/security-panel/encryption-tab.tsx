'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ShieldCheck, Key, Eye, EyeOff } from 'lucide-react'
import { UseFormReturn } from 'react-hook-form'
import { SecurityFormData } from './types'

interface EncryptionTabProps {
  form: UseFormReturn<SecurityFormData>
  onSubmit: (data: SecurityFormData) => void
  isLoading: boolean
  showEncryptionKey: boolean
  setShowEncryptionKey: (show: boolean) => void
  isRotatingKeys: boolean
  onRotateKeys: () => void
}

export function EncryptionTab({
  form, onSubmit, isLoading,
  showEncryptionKey, setShowEncryptionKey,
  isRotatingKeys, onRotateKeys,
}: EncryptionTabProps) {
  return (
    <div className="space-y-4">
      <Alert>
        <ShieldCheck className="h-4 w-4" />
        <AlertTitle>End-to-End Encryption</AlertTitle>
        <AlertDescription>
          Your tenant data is encrypted using AES-256-GCM at rest and TLS 1.3 in transit.
        </AlertDescription>
      </Alert>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField control={form.control} name="encryptionEnabled"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <FormLabel className="text-base">Enable Encryption</FormLabel>
                  <FormDescription>Encrypt all tenant data with tenant-specific keys</FormDescription>
                </div>
                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
              </FormItem>
            )}
          />

          <FormField control={form.control} name="encryptionKeyId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Encryption Key ID</FormLabel>
                <div className="flex gap-2">
                  <FormControl>
                    <Input {...field} type={showEncryptionKey ? 'text' : 'password'}
                      placeholder="Key will be generated automatically" readOnly />
                  </FormControl>
                  <Button type="button" variant="outline" size="icon"
                    onClick={() => setShowEncryptionKey(!showEncryptionKey)}>
                    {showEncryptionKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button type="button" variant="outline" onClick={onRotateKeys} disabled={isRotatingKeys}>
                    <Key className="h-4 w-4 mr-2" />{isRotatingKeys ? 'Rotating...' : 'Rotate Key'}
                  </Button>
                </div>
                <FormDescription>Current encryption key identifier</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField control={form.control} name="dataResidency"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Data Residency Region</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Select region" /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="us">United States</SelectItem>
                    <SelectItem value="eu">European Union</SelectItem>
                    <SelectItem value="apac">Asia Pacific</SelectItem>
                    <SelectItem value="global">Global</SelectItem>
                  </SelectContent>
                </Select>
                <FormDescription>Geographic location where your data will be stored</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex justify-end">
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Saving...' : 'Update Encryption Settings'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}
