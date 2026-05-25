'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Eye, EyeOff } from 'lucide-react'
import { UseFormReturn } from 'react-hook-form'
import { SecuritySettingsFormData } from './types'

interface EncryptionTabProps {
  form: UseFormReturn<SecuritySettingsFormData>
  onSubmit: (data: SecuritySettingsFormData) => void
  isLoading: boolean
  showEncryptionKey: boolean
  setShowEncryptionKey: (show: boolean) => void
  isRotatingKey: boolean
  onRotateKey: () => void
}

export function EncryptionTab({ form, onSubmit, isLoading, showEncryptionKey, setShowEncryptionKey, isRotatingKey, onRotateKey }: EncryptionTabProps) {
  return (
    <div className="space-y-4">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div>
            <h4 className="text-lg font-medium mb-4">Data at Rest Encryption</h4>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField control={form.control} name="encryption.atRest.enabled" render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5"><FormLabel className="text-base">Enable Encryption</FormLabel><FormDescription>Encrypt all data stored for this tenant</FormDescription></div>
                  <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="encryption.atRest.algorithm" render={({ field }) => (
                <FormItem><FormLabel>Encryption Algorithm</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select algorithm" /></SelectTrigger></FormControl>
                    <SelectContent><SelectItem value="AES-256-GCM">AES-256-GCM</SelectItem><SelectItem value="AES-128-GCM">AES-128-GCM</SelectItem><SelectItem value="ChaCha20-Poly1305">ChaCha20-Poly1305</SelectItem></SelectContent>
                  </Select><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="encryption.atRest.keyRotationDays" render={({ field }) => (
                <FormItem><FormLabel>Key Rotation (days)</FormLabel>
                  <FormControl><Input type="number" min="1" max="365" {...field} onChange={(e) => field.onChange(parseInt(e.target.value))} /></FormControl>
                  <FormDescription>Automatically rotate encryption keys</FormDescription><FormMessage /></FormItem>
              )} />
            </div>
          </div>

          <Separator />

          <div>
            <h4 className="text-lg font-medium mb-4">Key Management</h4>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField control={form.control} name="encryption.keyManagement.provider" render={({ field }) => (
                <FormItem><FormLabel>Key Provider</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select provider" /></SelectTrigger></FormControl>
                    <SelectContent><SelectItem value="aws-kms">AWS KMS</SelectItem><SelectItem value="azure-kv">Azure Key Vault</SelectItem><SelectItem value="gcp-kms">Google Cloud KMS</SelectItem><SelectItem value="hashicorp-vault">HashiCorp Vault</SelectItem><SelectItem value="cloudflare-secrets">Cloudflare Secrets</SelectItem></SelectContent>
                  </Select><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="encryption.keyManagement.hsmEnabled" render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5"><FormLabel className="text-base">HSM Enabled</FormLabel><FormDescription>Use Hardware Security Module for key storage</FormDescription></div>
                  <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                </FormItem>
              )} />
            </div>
            <div className="mt-4 p-4 rounded-lg border">
              <div className="flex items-center justify-between">
                <div><p className="font-medium">Tenant Encryption Key</p><p className="text-sm text-muted-foreground">Last rotated: 30 days ago</p></div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setShowEncryptionKey(!showEncryptionKey)}>
                    {showEncryptionKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button variant="outline" size="sm" onClick={onRotateKey} disabled={isRotatingKey}>{isRotatingKey ? 'Rotating...' : 'Rotate Key'}</Button>
                </div>
              </div>
              {showEncryptionKey && <div className="mt-2 p-2 bg-muted rounded"><code className="text-xs">tenant-enc-key-v2-xxxxx-xxxxx-xxxxx-xxxxxxxxxxxx</code></div>}
            </div>
          </div>

          <div className="flex justify-end"><Button type="submit" disabled={isLoading}>{isLoading ? 'Saving...' : 'Save Encryption Settings'}</Button></div>
        </form>
      </Form>
    </div>
  )
}
