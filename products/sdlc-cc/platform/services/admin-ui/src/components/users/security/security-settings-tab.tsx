'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form'
import { securitySchema, SECURITY_FORM_DEFAULTS } from './types'
import type { SecurityFormData } from './types'

interface SecuritySettingsTabProps {
  isLoading: boolean
  onSubmit: (data: SecurityFormData) => void
}

export function SecuritySettingsTab({ isLoading, onSubmit }: SecuritySettingsTabProps) {
  const form = useForm<SecurityFormData>({
    resolver: zodResolver(securitySchema as any),
    defaultValues: SECURITY_FORM_DEFAULTS,
  })

  return (
    <div className="space-y-4">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="enforceMFA"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <FormLabel className="text-base">Enforce MFA</FormLabel>
                  <FormDescription>
                    Require multi-factor authentication for this user
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
              </FormItem>
            )}
          />

          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="sessionTimeout"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Session Timeout (minutes)</FormLabel>
                  <FormControl>
                    <Input type="number" min="5" max="1440" {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value))} />
                  </FormControl>
                  <FormDescription>Session will expire after this period of inactivity</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="maxConcurrentSessions"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Max Concurrent Sessions</FormLabel>
                  <FormControl>
                    <Input type="number" min="1" max="10" {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value))} />
                  </FormControl>
                  <FormDescription>Maximum number of active sessions allowed</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div>
            <h4 className="text-sm font-medium mb-3">Password Policy</h4>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="passwordPolicy.minLength"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Minimum Length</FormLabel>
                    <FormControl>
                      <Input type="number" min="8" max="128" {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value))} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="passwordPolicy.expirationDays"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expiration (days)</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" max="365" {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value))} />
                    </FormControl>
                    <FormDescription>0 for no expiration</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2 mt-4">
              <FormField
                control={form.control}
                name="passwordPolicy.requireUppercase"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                    <FormLabel className="text-sm">Require Uppercase</FormLabel>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="passwordPolicy.requireNumbers"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                    <FormLabel className="text-sm">Require Numbers</FormLabel>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Saving...' : 'Update Security Settings'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}
