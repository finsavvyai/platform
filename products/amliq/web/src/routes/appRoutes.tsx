import React from 'react'
import { Route } from 'react-router-dom'
import { ProtectedRoute } from '../components/layout/ProtectedRoute'
import LandingV2 from '../pages/v2/LandingV2'
import DashboardV2 from '../pages/v2/DashboardV2'
import {
  Dashboard, AlertQueue, AlertDetailPage, ScreenEntity,
  Configuration, Analytics, AuditTrail, Monitoring,
  BatchJobs, SanctionsLists, SanctionsListsSettings, ListsMarketplace, Login, Signup,
  LandingPage, BillingPage, Onboarding,
  AdminTenants, TenantDetail, SystemHealth, ListSyncHealth, DataSources,
  AdminOperations, AdminScheduledTasks, AdminLeads,
  Team, TermsOfService, PrivacyPolicy, ForgotPassword, SecurityPage, CompliancePage, AboutPage, ProductPage, ContactPage, DocsPage,
  BlogPage, CareersPage, ChangelogPage, StatusPage, DPAPage, CompareWorldCheckPage, BenchmarksPage,
  APIKeysPage, WebhooksPage, CryptoScreening, TxnScreening,
  MFASetup, ResetPassword, TaskHistory, DataCoverage, SourceHealth,
  NotFoundPage, CustomerImport, AutomationRules, SARFormPage,
} from './lazyPages'

type PWrapper = ({ children }: { children: React.ReactNode }) => JSX.Element

export function appRoutes(
  P: PWrapper,
  PublicLayout: React.ComponentType<{ children: React.ReactNode }>,
) {
  return (
    <>
      <Route path="/" element={<LandingV2 />} />
      <Route path="/v1" element={<PublicLayout><LandingPage /></PublicLayout>} />
      <Route path="/dashboard-v2" element={<DashboardV2 />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/terms" element={<PublicLayout><TermsOfService /></PublicLayout>} />
      <Route path="/privacy" element={<PublicLayout><PrivacyPolicy /></PublicLayout>} />
      <Route path="/security" element={<PublicLayout><SecurityPage /></PublicLayout>} />
      <Route path="/compliance" element={<PublicLayout><CompliancePage /></PublicLayout>} />
      <Route path="/about" element={<PublicLayout><AboutPage /></PublicLayout>} />
      <Route path="/product" element={<PublicLayout><ProductPage /></PublicLayout>} />
      <Route path="/contact" element={<PublicLayout><ContactPage /></PublicLayout>} />
      <Route path="/docs" element={<PublicLayout><DocsPage /></PublicLayout>} />
      <Route path="/blog" element={<PublicLayout><BlogPage /></PublicLayout>} />
      <Route path="/careers" element={<PublicLayout><CareersPage /></PublicLayout>} />
      <Route path="/changelog" element={<PublicLayout><ChangelogPage /></PublicLayout>} />
      <Route path="/status" element={<PublicLayout><StatusPage /></PublicLayout>} />
      <Route path="/vs/world-check" element={<CompareWorldCheckPage />} />
      <Route path="/benchmarks" element={<BenchmarksPage />} />
      <Route path="/dpa" element={<PublicLayout><DPAPage /></PublicLayout>} />
      <Route path="/dashboard" element={<P><Dashboard /></P>} />
      <Route path="/alerts" element={<P><AlertQueue /></P>} />
      <Route path="/alerts/:id" element={<P><AlertDetailPage /></P>} />
      <Route path="/screen" element={<P><ScreenEntity /></P>} />
      <Route path="/config" element={<P><Configuration /></P>} />
      <Route path="/analytics" element={<P><Analytics /></P>} />
      <Route path="/audit" element={<P><AuditTrail /></P>} />
      <Route path="/monitoring" element={<P><Monitoring /></P>} />
      <Route path="/monitoring/import" element={<P><CustomerImport /></P>} />
      <Route path="/automations" element={<P><AutomationRules /></P>} />
      <Route path="/reports/sar" element={<P><SARFormPage /></P>} />
      <Route path="/batch" element={<P><BatchJobs /></P>} />
      <Route path="/lists" element={<P><SanctionsLists /></P>} />
      <Route path="/lists/settings" element={<P><SanctionsListsSettings /></P>} />
      <Route path="/lists/marketplace" element={<P><ListsMarketplace /></P>} />
      <Route path="/billing" element={<P><BillingPage /></P>} />
      <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
      <Route path="/admin/tenants" element={<ProtectedRoute requiredRole="admin"><AdminTenants /></ProtectedRoute>} />
      <Route path="/admin/tenants/:id" element={<ProtectedRoute requiredRole="admin"><TenantDetail /></ProtectedRoute>} />
      <Route path="/admin/health" element={<ProtectedRoute requiredRole="admin"><SystemHealth /></ProtectedRoute>} />
      <Route path="/admin/list-health" element={<ProtectedRoute requiredRole="admin"><ListSyncHealth /></ProtectedRoute>} />
      <Route path="/admin/data-sources" element={<ProtectedRoute requiredRole="admin"><DataSources /></ProtectedRoute>} />
      <Route path="/admin/operations" element={<ProtectedRoute requiredRole="admin"><AdminOperations /></ProtectedRoute>} />
      <Route path="/admin/tasks" element={<ProtectedRoute requiredRole="admin"><AdminScheduledTasks /></ProtectedRoute>} />
      <Route path="/admin/leads" element={<ProtectedRoute requiredRole="admin"><AdminLeads /></ProtectedRoute>} />
      <Route path="/source-health" element={<P><SourceHealth /></P>} />
      <Route path="/data-coverage" element={<P><DataCoverage /></P>} />
      <Route path="/team" element={<P><Team /></P>} />
      <Route path="/keys" element={<P><APIKeysPage /></P>} />
      <Route path="/webhooks" element={<P><WebhooksPage /></P>} />
      <Route path="/settings/mfa" element={<P><MFASetup /></P>} />
      <Route path="/tasks" element={<P><TaskHistory /></P>} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="*" element={<NotFoundPage />} />
    </>
  )
}
