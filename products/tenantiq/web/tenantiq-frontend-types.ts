/**
 * TenantIQ Frontend Type Contract
 * ================================
 * Self-contained type definitions for the TenantIQ SvelteKit frontend.
 * Extracted from @tenantiq/shared, @tenantiq/db, and apps/web/src/**
 * on 2026-05-19.
 *
 * This file is the single source of truth for a frontend rebuild.
 * No external imports required.
 *
 * Domains:
 *   1. Core Enums & Literals
 *   2. Auth & Users
 *   3. Tenant & Organization
 *   4. Alerts & Remediation
 *   5. Audit & Compliance
 *   6. CIS Benchmark
 *   7. Security — General
 *   8. Security — Email
 *   9. Security — Copilot
 *  10. Security — Hardening
 *  11. Security — Drift & Config Snapshots
 *  12. Security — PIM (Privileged Identity)
 *  13. Security — Inbox Rules (Mailbox Rule Auditor)
 *  14. Licenses
 *  15. Workflows
 *  16. Billing & Plans
 *  17. Skills & Marketplace
 *  18. AI Agent
 *  19. Backups
 *  20. Governance & Storage
 *  21. MSP Multi-Tenant
 *  22. Notifications & WebSocket
 *  23. Settings — SSO / SCIM / Integrations / Branding
 *  24. Reports
 *  25. Behavior Analytics (UEBA)
 *  26. Prospect Scan (Public)
 *  27. Changelog
 *  28. Compare / Competitive
 *  29. Design System Tokens
 *  30. Constants & Config
 */

// ============================================================
// 1. Core Enums & Literals
// ============================================================

/** Alert / finding severity level, ordered critical > high > medium > low. */
export type Severity = 'critical' | 'high' | 'medium' | 'low';

/** Extended severity that includes an informational level (used by some scan pages). */
export type SeverityExtended = 'critical' | 'high' | 'medium' | 'low' | 'info';

/** Top-level alert categorization. */
export type AlertCategory = 'security' | 'optimization' | 'compliance' | 'operational';

/** Current lifecycle status of an alert. */
export type AlertStatus = 'active' | 'acknowledged' | 'resolved' | 'dismissed';

/** How a remediation can be executed. */
export type RemediationType = 'automatic' | 'semi_automatic' | 'manual';

/** Tenant connection status in the platform. */
export type TenantStatus = 'active' | 'suspended' | 'disconnected';

/** Platform-level user roles (RBAC). viewer < operator < admin < super_admin < platform_admin. */
export type UserRole = 'viewer' | 'operator' | 'admin' | 'super_admin' | 'platform_admin';

/** Organization billing model. */
export type OrganizationType = 'direct' | 'msp';

/** Remediation execution status. */
export type RemediationStatus = 'pending' | 'executing' | 'success' | 'failed' | 'rolled_back';

/** How a workflow is triggered. */
export type WorkflowTriggerType = 'cron' | 'webhook' | 'manual' | 'conditional';

/** Workflow run lifecycle status. */
export type WorkflowRunStatus = 'pending_approval' | 'running' | 'completed' | 'failed' | 'cancelled';

/** UI theme mode. */
export type ThemeMode = 'light' | 'dark' | 'auto';

/** Mobile platform detection. */
export type Platform = 'web' | 'ios' | 'android';

// ============================================================
// 2. Auth & Users
// ============================================================

/**
 * Authenticated user object returned by GET /api/auth/me.
 * Stored in the auth Svelte store.
 */
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  organizationId: string;
  /** Tenant IDs the user has access to (multi-tenant aware). */
  tenantIds: string[];
  role: UserRole;
  status?: 'active' | 'suspended';
  /** Current billing plan slug (e.g. 'free', 'core', 'professional'). */
  plan?: string;
  /** ISO date string when trial expires, null if not on trial. */
  trialEndsAt?: string | null;
  /**
   * 'admin' = full Graph scopes via tenant admin consent.
   * 'personal' = user-only delegated scopes; tenant-wide features blocked.
   */
  scopeLevel?: 'admin' | 'personal';
}

/** Auth store state wrapper. */
export interface AuthState {
  user: AuthUser | null;
  loading: boolean;
}

/** Platform user (admin panel view of any user in the system). */
export interface PlatformUser {
  id: string;
  organizationId: string;
  email: string;
  name: string;
  role: UserRole;
  azureOid: string | null;
  lastLoginAt: string | null;
  createdAt: string;
}

/** Cached Microsoft 365 user synced from Graph API. */
export interface CachedUser {
  id: string;
  tenantId: string;
  azureUserId: string;
  displayName: string;
  email: string;
  userType: 'member' | 'guest';
  accountEnabled: boolean;
  lastSignIn: string | null;
  lastNonInteractiveSignIn: string | null;
  assignedLicenses: string[];
  assignedGroups: string[];
  createdAt: string;
  updatedAt: string;
}

/** User profile as seen on the /portal/me self-service page. */
export interface UserProfile {
  id: string;
  displayName: string;
  email: string;
  jobTitle: string | null;
}

/** User's M365 license assignment (portal view). */
export interface UserLicense {
  skuId: string;
  skuPartNumber: string;
}

/** User sign-in entry (portal view). */
export interface UserSignIn {
  date: string;
  location: string;
  device: string;
  status: string;
}

// ============================================================
// 3. Tenant & Organization
// ============================================================

/** A connected Microsoft 365 tenant. */
export interface Tenant {
  id: string;
  organizationId: string;
  azureTenantId: string;
  displayName: string;
  domain: string;
  lastSyncAt: string | null;
  status: TenantStatus;
  createdAt: string;
}

/** Lightweight tenant for the store / tenant-switcher dropdown. */
export interface TenantStoreItem {
  id: string;
  displayName: string;
  domain: string;
  status: TenantStatus;
  lastSyncAt: string | null;
}

/** Tenant store state. */
export interface TenantState {
  currentTenantId: string | null;
  tenants: TenantStoreItem[];
  tenantsLoading: boolean;
}

/** Organization record. */
export interface Organization {
  id: string;
  name: string;
  type: OrganizationType;
  billingPlan: string;
  createdAt: string;
}

/** Organization record as seen in the platform admin org list. */
export interface AdminOrganization {
  id: string;
  name: string;
  slug: string;
  subscriptionTier: string;
  subscriptionStatus: string;
  status: string;
  primaryContactEmail: string;
  maxUsers: number;
  createdAt: string;
}

// ============================================================
// 4. Alerts & Remediation
// ============================================================

/** A security / compliance / optimization alert. Core domain object. */
export interface Alert {
  id: string;
  tenantId: string;
  ruleId: string;
  severity: Severity;
  category: AlertCategory;
  title: string;
  description: string;
  businessImpact: string | null;
  affectedResources: unknown[];
  recommendedAction: string | null;
  remediationType: RemediationType;
  status: AlertStatus;
  createdAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
  metadata?: Record<string, unknown>;
}

/** A candidate alert generated by the intelligence engine (pre-persistence). */
export interface AlertCandidate {
  ruleId: string;
  title: string;
  description: string;
  businessImpact: string | null;
  affectedResources: unknown[];
  recommendedAction: string | null;
}

/** A logged remediation action. */
export interface RemediationLog {
  id: string;
  tenantId: string;
  alertId: string;
  actionId: string;
  executedBy: string;
  status: RemediationStatus;
  beforeState: unknown;
  afterState: unknown;
  errorMessage: string | null;
  executedAt: string;
  rollbackAvailable: boolean;
  rollbackExpiresAt: string | null;
}

/**
 * Remediation plan returned by GET /api/alerts/:id/remediation-plan.
 * Displayed in AlertDetailPanel.
 */
export interface RemediationPlan {
  impactLevel: string;
  impactExplanation: string;
  riskScore: number;
  affectedUsers: Array<{ name: string; email: string; role: string }>;
  affectedResources: unknown[];
  steps: Array<{ title: string; description: string; effect: string }>;
  estimatedMinutes: number;
  reversible: boolean;
  positiveOutcomes: string[];
  negativeOutcomes: string[];
  userEffects: string[];
}

/** Alert trend data for analytics charts. */
export interface AlertTrendData {
  date: string;
  critical: number;
  high: number;
  medium: number;
  low: number;
}

/** Alert distribution by category. */
export interface AlertDistributionData {
  category: string;
  count: number;
}

// ============================================================
// 5. Audit & Compliance
// ============================================================

/** Audit log entry from GET /api/audit. */
export interface AuditLogEntry {
  id: string;
  tenantId: string;
  actor: string;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  details: unknown;
  ipAddress: string | null;
  createdAt: string;
}

/** Policy snapshot for the audit history page. */
export interface PolicySnapshot {
  id: string;
  policyName: string;
  changedBy: string;
  changedAt: string;
  changeType: string;
  before: unknown;
  after: unknown;
}

/** Role change record in audit history. */
export interface RoleChange {
  id: string;
  user: string;
  previousRole: string;
  newRole: string;
  changedBy: string;
  changedAt: string;
}

/** Compliance framework (ISO 27001, SOC 2, etc.). */
export interface ComplianceFramework {
  id: string;
  name: string;
  score: number;
  controlsTotal: number;
  controlsPass: number;
}

/** Compliance control result within a framework. */
export interface ComplianceControlResult {
  controlId: string;
  title: string;
  status: 'pass' | 'fail' | 'not_applicable' | 'manual_review';
  severity: Severity;
  evidence: string;
}

/** Compliance trend data point. */
export interface ComplianceTrendPoint {
  date: string;
  score: number;
  assessmentsThatDay: number;
}

/** Compliance trend summary. */
export interface ComplianceTrendSummary {
  windowDays: number;
  scanCount: number;
  latestScore: number | null;
  earliestScore: number | null;
  scoreDelta: number;
  direction: 'improving' | 'regressing' | 'stable';
}

/** Compliance trend API response. */
export interface ComplianceTrendResponse {
  framework: string;
  points: ComplianceTrendPoint[];
  summary: ComplianceTrendSummary;
}

// ============================================================
// 6. CIS Benchmark
// ============================================================

/**
 * CIS scan result returned by POST /api/cis-benchmark/scan
 * and GET /api/cis-benchmark/results.
 */
export interface CisScanResult {
  overallScore: number | null;
  passCount: number;
  failCount: number;
  partialCount: number;
  totalControls: number;
  sectionScores: Record<string, {
    pass: number;
    fail: number;
    total: number;
    score: number;
  }>;
  controls: CisControl[];
  scannedAt?: string;
}

/** Individual CIS control result (used in ControlTable). */
export interface CisControl {
  id: string;
  title: string;
  description: string;
  section: string;
  level: 'L1' | 'L2';
  status: 'pass' | 'fail' | 'partial' | 'not_applicable' | 'error';
  severity: Severity;
  evidence: string;
  remediation: string;
  remediationSteps?: string[];
  remediationScript?: string;
  /** Time-to-complete in minutes (dynamic, from remediation_log history). */
  estimatedMinutes?: number;
  /** Present when a per-tenant override applies to this control. */
  overrideDecision?: CisOverrideDecision;
  overrideJustification?: string;
}

/** CIS score trend data point. */
export interface CisTrendPoint {
  date: string;
  score: number;
  passCount: number;
  failCount: number;
  partialCount: number;
  scansThatDay: number;
}

/** CIS score trend summary. */
export interface CisTrendSummary {
  windowDays: number;
  scanCount: number;
  latestScore: number | null;
  earliestScore: number | null;
  scoreDelta: number;
  direction: 'improving' | 'regressing' | 'stable';
}

/** CIS scan history entry (shown in ScanHistoryPanel). */
export interface CisHistoryScan {
  id: string;
  score: number;
  passCount: number;
  failCount: number;
  partialCount: number;
  totalControls: number;
  scannedAt: string;
  duration: number;
}

/** CIS failed control for critical fix summary. */
export interface CisFailedControl {
  id: string;
  title: string;
  section: string;
  level: 'L1' | 'L2';
  severity: Severity;
  remediation: string;
}

/** Per-tenant CIS control override decision (accepted_risk or omit). */
export type CisOverrideDecision = 'accepted_risk' | 'omit';

/** Per-tenant CIS control override record. */
export interface CisTenantOverride {
  id: string;
  tenantId: string;
  controlId: string;
  decision: CisOverrideDecision;
  justification: string;
  expiresAt: string | null;
  createdAt: string;
  createdBy: string;
}

/** Input payload for creating/updating a CIS override. */
export interface CisOverrideUpsertInput {
  controlId: string;
  decision: CisOverrideDecision;
  justification: string;
  expiresAt?: string | null;
}

// ============================================================
// 7. Security — General
// ============================================================

/** Certificate info for the security health page. */
export interface Certificate {
  name: string;
  expiresAt: string;
  issuer: string;
  status: 'valid' | 'expiring' | 'expired';
}

/** Conditional Access policy summary. */
export interface ConditionalAccessPolicy {
  id: string;
  displayName: string;
  state: 'enabled' | 'disabled' | 'report';
  createdDateTime: string;
}

/** Policy summary for the security overview page. */
export interface PolicySummary {
  total: number;
  enabled: number;
  disabled: number;
  reportOnly: number;
}

/** Sign-in log entry for the /security/signin-logs page. */
export interface SignInLog {
  id: string;
  userDisplayName: string;
  userPrincipalName: string;
  ipAddress: string;
  location: string;
  status: string;
  createdDateTime: string;
}

/** Sign-in summary stats. */
export interface SignInSummary {
  total: number;
  success: number;
  failure: number;
  riskySigns: number;
}

/** Security dashboard data (aggregate view). */
export interface SecurityDashboardData {
  secureScore: number | null;
  secureScoreMax: number | null;
  alertCounts: { critical: number; high: number; medium: number; low: number };
  mfaCoverage: number;
  riskyUsers: number;
  staleGuests: number;
  lastScanAt: string | null;
}

/** Security posture data. */
export interface SecurityPostureData {
  overallRisk: Severity;
  complianceScore: number;
  identityScore: number;
  dataProtectionScore: number;
  deviceScore: number;
}

/** Security priority control shown in SecurityPriorities component. */
export interface SecurityControl {
  id: string;
  title: string;
  description: string;
  severity: Severity;
  category: string;
  status: 'pass' | 'fail' | 'partial';
  remediation: string;
  product: string;
  estimatedMinutes: number;
}

/** Security baseline response. */
export interface SecurityBaselineResponse {
  baselineName: string;
  createdAt: string;
  controls: SecurityControl[];
}

/** Session / TokenForge security status. */
export interface TokenForgeStatus {
  enabled: boolean;
  boundDevices: number;
  lastVerifiedAt: string | null;
}

// ============================================================
// 8. Security — Email
// ============================================================

/** Email threat record. */
export interface EmailThreat {
  id: string;
  subject: string;
  sender: string;
  recipient: string;
  receivedAt: string;
  threatType: string;
  confidence: number;
  severity: Severity;
  status: 'blocked' | 'quarantined' | 'delivered' | 'released';
  indicators: string[];
}

/** Email authentication record (SPF, DKIM, DMARC). */
export interface MailAuthRecord {
  domain: string;
  spf: 'pass' | 'fail' | 'none';
  dkim: 'pass' | 'fail' | 'none';
  dmarc: 'pass' | 'fail' | 'none';
  dmarcPolicy: string;
  lastChecked: string;
}

/** Mail relay / transport rule. */
export interface MailRelayRule {
  id: string;
  name: string;
  priority: number;
  state: 'enabled' | 'disabled';
  conditions: string;
  actions: string;
  mode: string;
  scope: string;
  createdDate: string;
}

// ============================================================
// 9. Security — Copilot
// ============================================================

/** Individual copilot readiness check. */
export interface CopilotCheck {
  name: string;
  status: 'pass' | 'fail' | 'warning' | 'error';
  detail: string;
  errorMessage?: string;
}

/** Copilot readiness category result. */
export interface CopilotCategoryResult {
  score: number;
  checks: CopilotCheck[];
}

/** Copilot readiness recommendation. */
export interface CopilotRecommendation {
  category: string;
  priority: Severity;
  title: string;
  description: string;
}

/** Full copilot readiness assessment result. */
export interface CopilotReadinessResult {
  overallScore: number;
  categoryScores: Record<string, number>;
  categories: Record<string, CopilotCategoryResult>;
  recommendations: CopilotRecommendation[];
}

/** Copilot readiness history entry. */
export interface CopilotHistoryEntry {
  id: string;
  score: number;
  categoryScores: Record<string, number>;
  assessedAt: string;
}

/** Copilot license summary. */
export interface CopilotLicenseSummary {
  copilotLicensed: number;
  totalLicensed: number;
  overshareRiskCount: number;
  labelGapCount: number;
}

/** Copilot usage stats. */
export interface CopilotUsage {
  totalLicensed: number;
  activeUsers: number;
  inactiveUsers: number;
  adoptionRate: number;
}

/** Copilot usage user adoption detail. */
export interface CopilotUserAdoption {
  userId: string;
  displayName: string;
  email: string;
  lastActive: string | null;
  actionsThisWeek: number;
}

/** Copilot inactive user (usage page). */
export interface CopilotInactiveUser {
  userId: string;
  displayName: string;
  email: string;
  licensedSince: string;
  daysInactive: number;
  monthlyCost: number;
}

/** Copilot ROI data. */
export interface CopilotRoiData {
  totalMonthlyCost: number;
  activeUserCost: number;
  wastedCost: number;
  estimatedProductivityGain: number;
}

// ============================================================
// 10. Security — Hardening
// ============================================================

/** A hardening action that can be applied to a tenant. */
export interface HardeningAction {
  id: string;
  title: string;
  description: string;
  impact: 'Critical' | 'High' | 'Medium';
  affectedCount: number;
  reversible: boolean;
  enabled: boolean;
  status: 'pending' | 'running' | 'success' | 'failed';
  error?: string;
  /** Graph API action to call. */
  apiAction?: string;
  /** Microsoft product area. */
  product?: string;
  options?: Record<string, unknown>;
}

/** Hardening assessment data. */
export interface HardeningAssessmentData {
  score: number;
  maxScore: number;
  categories: Record<string, { score: number; maxScore: number }>;
  recommendations: string[];
}

/** Hardening dry-run result. */
export interface HardeningDryRunResult {
  actionId: string;
  wouldAffect: number;
  details: string[];
  reversible: boolean;
  estimatedMinutes: number;
}

/** Hardening guide (manual remediation instructions). */
export interface HardeningGuide {
  id: string;
  title: string;
  severity: string;
  product: string;
  steps: string[];
}

/** Security template for one-click hardening profiles. */
export interface SecurityTemplate {
  id: string;
  name: string;
  description: string;
  actionIds: string[];
  category: string;
  estimatedMinutes: number;
  tags: string[];
}

// ============================================================
// 11. Security — Drift & Config Snapshots
// ============================================================

/** A detected security configuration drift. */
export interface SecurityDrift {
  id: string;
  product: string;
  field: string;
  previousValue: unknown;
  currentValue: unknown;
  severity: Severity;
  recommendation: string;
  acknowledged?: boolean;
  detectedAt?: string;
}

/** Security stack snapshot (point-in-time capture). */
export interface SecurityStackSnapshot {
  conditionalAccess: {
    policyCount: number;
    mfaEnabled: boolean;
    legacyBlocked: boolean;
  };
  dlp: {
    policyCount: number;
    labelsCount: number;
  };
  identity: {
    mfaCoverage: number;
    riskyUsers: number;
    signInRiskPolicy: boolean;
  };
  email: {
    safeLinks: boolean;
    safeAttachments: boolean;
    antiPhishing: boolean;
  };
  timestamp: string;
}

/** GET /api/security-stack/monitor response. */
export interface SecurityStackMonitorResponse {
  lastScan: string | null;
  drifts: SecurityDrift[];
  snapshot: SecurityStackSnapshot | null;
}

/** Config snapshot (from /backups/config page). */
export interface ConfigSnapshot {
  id: string;
  tenantId: string;
  category: string;
  data: unknown;
  createdAt: string;
  version: number;
}

/** Config drift record. */
export interface ConfigDrift {
  id: string;
  snapshotId: string;
  previousSnapshotId: string;
  field: string;
  previousValue: unknown;
  currentValue: unknown;
  severity: Severity;
  category: string;
  detectedAt: string;
}

/** Drift summary for the dashboard widget. */
export interface DriftSummaryData {
  total: number;
  critical: number;
  warning: number;
  info: number;
  unacknowledged: number;
}

/** Category-level diff data for config comparison. */
export interface CategoryDiffData {
  categoryId: string;
  name: string;
  changes: Array<{
    path: string;
    type: 'added' | 'removed' | 'changed';
    oldValue?: unknown;
    newValue?: unknown;
  }>;
  changeCount: number;
}

// ============================================================
// 12. Security — PIM (Privileged Identity Management)
// ============================================================

/** PIM role kind. */
export type PimRoleKind = 'standing' | 'eligible' | 'active';

/** PIM principal (user with privileged role). */
export interface PimPrincipal {
  id: string;
  displayName: string;
  email: string;
  roles: string[];
  kind: PimRoleKind;
  lastSignIn: string | null;
}

/** PIM finding from privileged access scan. */
export interface PimFinding {
  id: string;
  severity: SeverityExtended;
  title: string;
  description: string;
  principalId: string;
  recommendation: string;
}

/** PIM scan summary. */
export interface PimSummary {
  standingAdmins: number;
  eligibleAdmins: number;
  mfaGapCount: number;
  staleAdmins: number;
}

/** PIM scan API response. */
export interface PimScanResponse {
  scannedAt: string;
  summary: PimSummary;
  findings: PimFinding[];
  principals: PimPrincipal[];
}

// ============================================================
// 13. Security — Inbox Rules (Mailbox Rule Auditor)
// ============================================================

/** Risk type for mailbox rule findings (BEC indicators). */
export type InboxRuleRiskType =
  | 'external_forwarding'
  | 'external_redirect'
  | 'auto_delete'
  | 'move_to_hidden'
  | 'keyword_filter'
  | 'broad_scope';

/** Inbox rule finding. */
export interface InboxRuleFinding {
  id: string;
  userId: string;
  userDisplayName: string;
  userEmail: string;
  ruleName: string;
  riskType: InboxRuleRiskType;
  severity: Severity;
  description: string;
  forwardTo?: string;
  redirectTo?: string;
  targetFolder?: string;
  keywords?: string[];
  createdAt: string;
}

/** Inbox rule scan summary. */
export interface InboxRuleSummary {
  usersScanned: number;
  rulesScanned: number;
  findingsCount: number;
  criticalCount: number;
  highCount: number;
}

// ============================================================
// 14. Licenses
// ============================================================

/** Cached license SKU from Graph API sync. */
export interface LicenseCache {
  id: string;
  tenantId: string;
  skuId: string;
  skuName: string;
  total: number;
  assigned: number;
  costPerUnit: number | null;
  updatedAt: string;
}

/** License SKU breakdown (used in dashboard and license page). */
export interface LicenseSkuBreakdown {
  skuName: string;
  assigned: number;
  total: number;
  costPerUnit: number;
}

/** License page summary stats. */
export interface LicenseSummary {
  totalLicenses: number;
  assignedLicenses: number;
  unassignedLicenses: number;
  monthlySpend: number;
}

/** License waste item. */
export interface LicenseWasteItem {
  skuName: string;
  unassigned: number;
  monthlyCost: number;
}

// ============================================================
// 15. Workflows
// ============================================================

/** Workflow definition. */
export interface Workflow {
  id: string;
  tenantId: string;
  name: string;
  workflowType: string;
  triggerType: WorkflowTriggerType;
  triggerConfig: unknown;
  steps: WorkflowStep[];
  requiresApproval: boolean;
  enabled: boolean;
  lastRunAt: string | null;
  lastRunStatus: string | null;
  createdAt: string;
}

/** A single step in a workflow definition. */
export interface WorkflowStep {
  action: string;
  condition?: string;
  onFailure: 'skip' | 'abort' | 'retry';
}

/** Workflow run (execution instance). */
export interface WorkflowRun {
  id: string;
  workflowId: string;
  tenantId: string;
  status: WorkflowRunStatus;
  stepsCompleted: number;
  stepsTotal: number;
  results: unknown;
  startedAt: string;
  completedAt: string | null;
  approvedBy: string | null;
}

/** Workflow run step detail (shown in WorkflowRunPanel). */
export interface WorkflowRunStepItem {
  index: number;
  action: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

/** Workflow run step result. */
export interface WorkflowRunStepResult {
  stepIndex: number;
  action: string;
  status: 'completed' | 'failed' | 'skipped';
  output: unknown;
  duration: number;
  error?: string;
}

/** Workflow run results aggregate. */
export interface WorkflowRunResults {
  steps: WorkflowRunStepResult[];
  totalDuration: number;
  successCount: number;
  failureCount: number;
}

// --- Workflow DSL (template system) ---

/** Step type in workflow template. */
export type WorkflowDslStepType = 'action' | 'condition' | 'delay' | 'approval' | 'notification';

/** Trigger type for workflow templates. */
export type WorkflowDslTriggerType = 'schedule' | 'event' | 'manual' | 'ai';

/** Workflow template category. */
export type WorkflowTemplateCategory = 'license' | 'security' | 'lifecycle' | 'governance';

/** Step in a workflow template. */
export interface WorkflowTemplateStep {
  id: string;
  type: WorkflowDslStepType;
  name: string;
  config: Record<string, unknown>;
  onSuccess?: string;
  onFailure?: string;
}

/** Reusable workflow template. */
export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: WorkflowTemplateCategory;
  triggerType: WorkflowDslTriggerType;
  steps: WorkflowTemplateStep[];
  tags: string[];
  estimatedDurationMinutes: number;
}

/** An installed workflow (template instantiated on a tenant). */
export interface InstalledWorkflow {
  id: string;
  templateId: string;
  tenantId: string;
  orgId: string;
  name: string;
  enabled: boolean;
  overrides: Record<string, unknown>;
  installedAt: string;
  installedBy: string;
}

// ============================================================
// 16. Billing & Plans
// ============================================================

/**
 * Plan tiers — ordered from lowest to highest.
 * 'all' means included in every plan (e.g., dashboard).
 */
export type PlanTier = 'all' | 'core' | 'professional' | 'security_suite' | 'enterprise';

/**
 * Plan keys used internally (includes trial/free).
 */
export type PlanKey = 'trial' | 'free' | 'core' | 'professional' | 'security_suite' | 'enterprise';

/**
 * Feature keys for plan-limit lookups.
 */
export type FeatureKey =
  | 'tenants'
  | 'cisControls'
  | 'alerts'
  | 'users'
  | 'licenses'
  | 'complianceFrameworks'
  | 'remediations'
  | 'aiQueries'
  | 'reports'
  | 'backups'
  | 'hardening'
  | 'driftMonitoring'
  | 'securityStack';

/**
 * Plan limits per tier. Infinity means unlimited.
 * Use canAccess(plan, feature) or getLimit(plan, feature) helpers.
 */
export const PLAN_LIMITS: Record<PlanKey, Record<FeatureKey, number>> = {
  trial: {
    tenants: 1, cisControls: 10, alerts: 5, users: 25, licenses: 10,
    complianceFrameworks: 1, remediations: 0, aiQueries: 5, reports: 1,
    backups: 0, hardening: 0, driftMonitoring: 0, securityStack: 0,
  },
  free: {
    tenants: 1, cisControls: 10, alerts: 5, users: 25, licenses: 10,
    complianceFrameworks: 1, remediations: 0, aiQueries: 5, reports: 1,
    backups: 0, hardening: 0, driftMonitoring: 0, securityStack: 0,
  },
  core: {
    tenants: 5, cisControls: Infinity, alerts: Infinity, users: Infinity,
    licenses: Infinity, complianceFrameworks: 1, remediations: 3,
    aiQueries: 25, reports: 5, backups: 1, hardening: 0,
    driftMonitoring: 0, securityStack: 0,
  },
  professional: {
    tenants: 25, cisControls: Infinity, alerts: Infinity, users: Infinity,
    licenses: Infinity, complianceFrameworks: 3, remediations: Infinity,
    aiQueries: Infinity, reports: Infinity, backups: Infinity,
    hardening: 1, driftMonitoring: 0, securityStack: 0,
  },
  security_suite: {
    tenants: 50, cisControls: Infinity, alerts: Infinity, users: Infinity,
    licenses: Infinity, complianceFrameworks: Infinity, remediations: Infinity,
    aiQueries: Infinity, reports: Infinity, backups: Infinity,
    hardening: Infinity, driftMonitoring: Infinity, securityStack: Infinity,
  },
  enterprise: {
    tenants: Infinity, cisControls: Infinity, alerts: Infinity, users: Infinity,
    licenses: Infinity, complianceFrameworks: Infinity, remediations: Infinity,
    aiQueries: Infinity, reports: Infinity, backups: Infinity,
    hardening: Infinity, driftMonitoring: Infinity, securityStack: Infinity,
  },
};

/**
 * Plan hierarchy for meetsMinimumPlan checks.
 */
export const PLAN_HIERARCHY: PlanKey[] = [
  'trial', 'free', 'core', 'professional', 'security_suite', 'enterprise',
];

/**
 * License-upgrade-required upsell payload (402 response).
 * Displayed in UpsellCard component when a remediation requires a higher M365 license.
 */
export interface UpsellInfo {
  required: {
    display: string;
    reason: string;
    priceUsdPerUserPerMonth: number;
    anyOf: string[];
  };
  suggestedSeats: number;
  estimatedMonthlyCostUsd: number;
}

// ============================================================
// 17. Skills & Marketplace
// ============================================================

/** Skill activation status. */
export type SkillStatus = 'active' | 'locked' | 'trial';

/** Skill category (maps to sidebar sections). */
export type SkillCategory = 'foundation' | 'management' | 'security' | 'analytics' | 'enterprise';

/** A skill in the marketplace / skills hub. */
export interface Skill {
  id: string;
  name: string;
  /** Lucide icon name. */
  icon: string;
  description: string;
  category: SkillCategory;
  /** Route path for this skill's page. */
  href: string;
  status: SkillStatus;
  /** Monthly price in USD (0 = included in plan). */
  price: number;
  /** Minimum plan tier that includes this skill. */
  includedIn: PlanTier;
  trialDaysLeft?: number;
}

/** Category display labels for the skills hub. */
export const SKILL_CATEGORY_LABELS: Record<SkillCategory, string> = {
  foundation: 'Foundation',
  management: 'Management',
  security: 'Security',
  analytics: 'Analytics',
  enterprise: 'Enterprise',
};

/** Microsoft Marketplace subscription resolution. */
export interface MarketplaceResolveResponse {
  subscriptionId: string;
  planId: string;
  offerId: string;
  quantity: number;
}

/** Partner integration entry (marketplace partners page). */
export interface PartnerIntegration {
  id: string;
  name: string;
  type: string;
  status: string;
  lastSyncAt: string | null;
  tenantCount: number;
}

// ============================================================
// 18. AI Agent
// ============================================================

/** AI agent status from GET /api/ai/status. */
export interface AIStatus {
  model: string;
  provider: string;
  available: boolean;
  conversationCount: number;
}

/** AI security analysis result. */
export interface AISecurityAnalysis {
  riskLevel: Severity;
  summary: string;
  findings: string[];
  recommendations: string[];
}

/** AI license analysis result. */
export interface AILicenseAnalysis {
  totalSavings: number;
  recommendations: Array<{
    sku: string;
    action: string;
    savings: number;
    affectedUsers: number;
  }>;
}

/** AI chat message (displayed in ChatTab). */
export interface AIChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: Date;
  toolExecutions?: AIToolExecution[];
  suggestedActions?: AISuggestedAction[];
}

/** AI tool execution log entry. */
export interface AIToolExecution {
  name: string;
  input?: Record<string, unknown>;
  duration?: number;
  success: boolean;
  summary?: string;
  error?: string;
}

/** AI suggested action (rendered as action chips). */
export interface AISuggestedAction {
  label: string;
  type: 'navigate' | 'remediate' | 'scan' | 'export';
  target: string;
  description: string;
}

/** AI agent recipe option (pre-built analysis flows). */
export interface AIRecipeOption {
  id: string;
  label: string;
  description: string;
  prompt: string;
}

/** AI chain preset types. */
export type AIChainPreset = 'security-audit' | 'compliance-check' | 'cost-review' | 'full-assessment';

// ============================================================
// 19. Backups
// ============================================================

/** Backup type (M365 service). */
export type BackupType = 'exchange' | 'sharepoint' | 'teams';

/** Backup job status. */
export type BackupStatus = 'pending' | 'running' | 'completed' | 'failed';

/** Backup record. */
export interface Backup {
  id: string;
  tenantId: string;
  type: BackupType;
  status: BackupStatus;
  sizeBytes: number;
  itemCount: number;
  startedAt: string;
  completedAt: string | null;
  error?: string;
}

/** Backup schedule configuration. */
export interface BackupSchedule {
  id: string;
  type: BackupType;
  cronExpression: string;
  enabled: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
}

/** Backup analysis / health assessment. */
export interface BackupAnalysis {
  lastBackupAge: number;
  sizeAnomaly: boolean;
  encryptionStatus: 'active' | 'expired' | 'none';
  retentionCompliance: boolean;
}

/** Backup restore data (restore point selection). */
export interface BackupRestoreData {
  backupId: string;
  availableItems: number;
  sizeBytes: number;
  createdAt: string;
}

/** Data backup job (for /backups/data page). */
export interface DataBackupJob {
  id: string;
  type: BackupType;
  status: BackupStatus;
  startedAt: string;
  completedAt: string | null;
  sizeBytes: number;
  itemCount: number;
  error?: string;
}

/** Storage usage for data backups. */
export interface BackupStorageUsage {
  totalBytes: number;
  exchangeBytes: number;
  sharepointBytes: number;
  teamsBytes: number;
  retentionDays: number;
}

// ============================================================
// 20. Governance & Storage
// ============================================================

/** Workspace / group summary for /governance. */
export interface GovernanceSummary {
  total: number;
  teams: number;
  withGuests: number;
  noOwner: number;
  totalStorageBytes: number;
}

/** Storage analytics overview. */
export interface StorageOverviewData {
  totalUsedGB: number;
  totalAllocatedGB: number;
  utilizationPct: number;
  oneDriveUsedGB: number;
  oneDriveAllocatedGB: number;
  sharePointUsedGB: number;
  sharePointAllocatedGB: number;
  userCount: number;
  siteCount: number;
  scannedAt: string;
}

/** OneDrive user storage record. */
export interface OneDriveUser {
  userId: string;
  displayName: string;
  email: string;
  usedGB: number;
  allocatedGB: number;
  utilizationPct: number;
}

/** SharePoint site storage record. */
export interface SharePointSite {
  siteId: string;
  name: string;
  url: string;
  usedGB: number;
  allocatedGB: number;
  utilizationPct: number;
}

/** Storage recommendation. */
export interface StorageRecommendation {
  id: string;
  type: string;
  severity: Severity;
  title: string;
  description: string;
  potentialSavingsGB: number;
  affectedItems: number;
}

/** Storage-license utilization cross-reference. */
export interface StorageLicenseUser {
  userId: string;
  displayName: string;
  email: string;
  licenseName: string;
  allocatedGB: number;
  usedGB: number;
  utilizationPct: number;
  lastActivityDate: string | null;
  monthlyInactive: boolean;
}

/** SharePoint site info for governance/sites page. */
export interface SiteInfo {
  id: string;
  name: string;
  url: string;
  storageUsedGB: number;
  storageAllocatedGB: number;
  lastModified: string;
  externalSharingEnabled: boolean;
}

/** AI governance audit row. */
export interface AIGovernanceAuditRow {
  id: string;
  action: string;
  provider: string;
  model: string;
  status: string;
  timestamp: string;
  costUsdMicros: number;
}

/** AI governance usage data. */
export interface AIGovernanceUsage {
  totalRequests: number;
  totalCostUsd: number;
  byProvider: Array<{ key: string; count: number; cost_usd_micros: number }>;
  byStatus: Array<{ key: string; count: number }>;
}

// ============================================================
// 21. MSP Multi-Tenant
// ============================================================

/** MSP dashboard summary across all managed tenants. */
export interface MspSummary {
  totalTenants: number;
  activeTenants: number;
  totalUsers: number;
  totalAlerts: number;
  avgCisScore: number | null;
  avgLicenseUtilization: number;
}

/** MSP per-tenant summary row. */
export interface MspTenantSummary {
  tenantId: string;
  displayName: string;
  domain: string;
  status: TenantStatus;
  userCount: number;
  alertCount: number;
  cisScore: number | null;
  licenseUtilization: number;
  lastSyncAt: string | null;
}

/** MSP benchmark comparison metrics. */
export interface MspBenchmarks {
  avgActiveRate: number;
  avgLicenseUtil: number;
  avgCisScore: number | null;
  totalAlerts: number;
  totalUsers: number;
}

/** MSP per-tenant benchmark metric. */
export interface MspTenantMetric {
  tenantId: string;
  displayName: string;
  activeRate: number;
  licenseUtil: number;
  cisScore: number | null;
  alertCount: number;
  userCount: number;
}

/** MSP backup health level. */
export type MspBackupHealth = 'ok' | 'warning' | 'error' | 'off';

/** MSP cross-tenant backup summary. */
export interface MspBackupSummary {
  healthy: number;
  warning: number;
  error: number;
  disabled: number;
}

/** MSP per-tenant backup row. */
export interface MspBackupTenantRow {
  tenantId: string;
  displayName: string;
  health: MspBackupHealth;
  lastBackupAt: string | null;
  sizeBytes: number;
  backupCount: number;
}

/** MSP per-tenant profit row. */
export interface MspTenantProfit {
  tenantId: string;
  displayName: string;
  revenue: number;
  licenseCost: number;
  laborCost: number;
  profit: number;
  margin: number;
}

/** MSP profit totals. */
export interface MspProfitTotals {
  totalRevenue: number;
  totalLicenseCost: number;
  totalLaborCost: number;
  totalProfit: number;
  avgMargin: number;
}

/** GDAP partner info. */
export interface GdapPartnerInfo {
  partner_id: string;
  partner_tenant_id: string;
  created_at: number;
}

/** GDAP relationship. */
export interface GdapRelationship {
  id: string;
  customerId: string;
  customerName: string;
  roles: string[];
  status: string;
  createdAt: string;
  expiresAt: string | null;
}

// ============================================================
// 22. Notifications & WebSocket
// ============================================================

/** WebSocket message types (real-time events). */
export type WSMessageType =
  | 'connected'
  | 'alert'
  | 'alerts_updated'
  | 'sync_progress'
  | 'drift'
  | 'notification'
  | 'workflow_update';

/** WebSocket message payload. */
export interface WSMessage {
  type: WSMessageType;
  [key: string]: unknown;
}

/** Notification store state. */
export interface NotificationState {
  connected: boolean;
  transport: 'websocket' | 'sse' | 'none';
  unreadCount: number;
  desktopPermission: NotificationPermission | 'default';
}

/** In-app notification item (NotificationBell dropdown). */
export interface InAppNotification {
  id: string;
  title: string;
  body: string;
  type: 'alert' | 'sync' | 'drift' | 'workflow' | 'system';
  read: boolean;
  createdAt: string;
  href?: string;
}

/** Toast notification. */
export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  duration: number;
}

// ============================================================
// 23. Settings — SSO / SCIM / Integrations / Branding
// ============================================================

/** SSO connection record. */
export interface SSOConnection {
  id: string;
  protocol: 'saml' | 'oidc';
  displayName: string;
  issuer: string;
  metadataUrl?: string;
  clientId?: string;
  enabled: boolean;
  createdAt: string;
  lastUsedAt: string | null;
}

/** SSO form data for creating/editing connections. */
export interface SSOFormData {
  protocol: 'saml' | 'oidc';
  displayName: string;
  issuer: string;
  metadataUrl: string;
  clientId: string;
  clientSecret: string;
  ssoUrl: string;
  certificate: string;
  signRequests: boolean;
  wantEncrypted: boolean;
  nameIdFormat: string;
}

/** SSO test check result. */
export interface SSOTestCheck {
  name: string;
  passed: boolean;
  message: string;
}

/** SCIM provisioning token. */
export interface ScimToken {
  id: string;
  name: string;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  status: 'active' | 'revoked';
}

/** Newly created SCIM token (includes plaintext token once). */
export interface ScimCreatedToken extends ScimToken {
  /** Plaintext token — only shown once at creation time. */
  token: string;
}

/** Integration configuration. */
export interface Integration {
  id: string;
  name: string;
  type: 'connectwise' | 'datto' | 'kaseya' | 'openclaw' | 'generic_webhook';
  enabled: boolean;
  lastSyncAt: string | null;
  status: 'connected' | 'disconnected' | 'error';
}

/** Integration sync status. */
export interface IntegrationSyncStatus {
  lastSyncAt: string | null;
  status: 'idle' | 'syncing' | 'error';
  companiesSynced: number;
  lastError: string | null;
  nextSyncAt: string | null;
}

/** Integration company-to-tenant mapping. */
export interface IntegrationMapping {
  externalId: string;
  externalName: string;
  tenantId: string | null;
  tenantName: string | null;
}

/** Integration sync history entry. */
export interface IntegrationHistoryEntry {
  id: string;
  startedAt: string;
  status: string;
  companiesSynced: number;
  errors: number;
}

/** White-label org branding. */
export interface OrgBranding {
  orgId: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  companyName: string;
  customDomain: string | null;
  emailFromName: string | null;
}

/** Custom domain DNS verification initiation response. */
export interface DomainInitResponse {
  domain: string;
  txtRecord: string;
  cnameRecord: string;
  status: 'pending_verification';
}

/** Custom domain DNS verification result. */
export interface DomainVerifyResponse {
  domain: string;
  verified: boolean;
  errors: string[];
}

/** API key row (settings/api-keys). */
export interface ApiKeyRow {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  scopes: string[];
}

/** MCP client server config. */
export interface McpServer {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  hasBearer: boolean;
}

/** MCP server tool listing. */
export interface McpServerWithTools {
  serverId: string;
  serverName: string;
  tools: Array<{ name: string; description: string }>;
  error?: string;
}

/** Migration plan item. */
export interface MigrationPlanItem {
  type: string;
  name: string;
  action: string;
}

/** Migration plan. */
export interface MigrationPlan {
  items: MigrationPlanItem[];
  estimatedMinutes: number;
  riskLevel: Severity;
}

/** Migration status. */
export interface MigrationStatus {
  status: 'idle' | 'planning' | 'running' | 'completed' | 'failed';
  progress: number;
  currentStep: string | null;
  error: string | null;
}

// ============================================================
// 24. Reports
// ============================================================

/** Executive report summary. */
export interface ExecutiveReport {
  id: string;
  title: string;
  period: string;
  generatedAt: string;
  sections: ReportSection[];
  financial: FinancialSummary;
  actions: ReportAction[];
}

/** Report section (security, compliance, etc.). */
export interface ReportSection {
  title: string;
  icon: string;
  summary: string;
  kpis: ReportKPI[];
  highlights: string[];
  risks: string[];
}

/** Report KPI metric. */
export interface ReportKPI {
  label: string;
  value: string;
  change?: number;
  changeDirection: string;
  isPositive: boolean;
  icon: string;
}

/** Financial summary in executive report. */
export interface FinancialSummary {
  totalSpend: number;
  wastedSpend: number;
  savingsRealized: number;
  projectedSavings: number;
  costPerUser: number;
  roi: number;
}

/** Report recommended action. */
export interface ReportAction {
  priority: string;
  title: string;
  description: string;
  estimatedSavings?: number;
}

/** Saved/generated report metadata. */
export interface Report {
  id: string;
  title: string;
  type: string;
  generatedAt: string;
  status: 'ready' | 'generating' | 'failed';
  downloadUrl?: string;
}

/** Report builder metric definition. */
export interface ReportMetricDef {
  id: string;
  name: string;
  category: string;
  type: string;
}

/** Report builder widget. */
export interface ReportWidget {
  metricId: string;
  name: string;
  type: string;
  category: string;
  value: number;
}

/** Report builder output. */
export interface ReportBuilderData {
  title: string;
  period: string;
  generatedAt: string;
  widgets: ReportWidget[];
}

// ============================================================
// 25. Behavior Analytics (UEBA)
// ============================================================

/** User behavior anomaly. */
export interface BehaviorAnomaly {
  type: string;
  detail: string;
  timestamp: string;
  severity: string;
}

/** UEBA user risk profile. */
export interface UebaUser {
  userId: string;
  displayName: string;
  email: string;
  riskScore: number;
  anomalies: BehaviorAnomaly[];
  lastActivity: string;
}

/** UEBA summary stats. */
export interface UebaSummary {
  totalUsers: number;
  riskyUsers: number;
  anomalyCount: number;
}

/** UEBA API response. */
export interface UebaResponse {
  users: UebaUser[];
  summary: UebaSummary;
}

// ============================================================
// 26. Prospect Scan (Public, No Auth)
// ============================================================

/** Public prospect scan finding. */
export interface ProspectFinding {
  title: string;
  severity: Severity;
  description: string;
  recommendation: string;
}

/** Public prospect scan result. */
export interface ProspectScanResult {
  domain: string;
  score: number;
  findings: ProspectFinding[];
  scannedAt: string;
}

/** Domain scan finding (SSE-streamed, more detailed). */
export interface DomainScanFinding {
  id: string;
  title: string;
  severity: SeverityExtended;
  category: string;
  description: string;
  recommendation: string;
  evidence?: string;
}

/** Domain scan DNS authentication record. */
export interface DomainScanDnsAuth {
  spf: 'pass' | 'fail' | 'none';
  dkim: 'pass' | 'fail' | 'none';
  dmarc: 'pass' | 'fail' | 'none';
  dmarcPolicy: string;
}

/** Domain scan result. */
export interface DomainScanResult {
  domain: string;
  score: number;
  grade: string;
  findings: DomainScanFinding[];
  dnsAuth: DomainScanDnsAuth;
  scannedAt: string;
}

/** SSE stage event during domain scan. */
export interface DomainScanStageEvent {
  stage: string;
  status: 'running' | 'done' | 'error';
  message?: string;
}

// ============================================================
// 27. Changelog
// ============================================================

/** Changelog entry type. */
export type ChangelogEntryType = 'feat' | 'fix' | 'docs' | 'security' | 'infra';

/** Single changelog entry. */
export interface ChangelogEntry {
  /** ISO date yyyy-mm-dd. */
  date: string;
  type: ChangelogEntryType;
  title: string;
  body: string;
  /** Short commit SHAs. */
  commits?: string[];
}

/** A week's worth of changelog entries. */
export interface ChangelogWeek {
  label: string;
  entries: ChangelogEntry[];
}

// ============================================================
// 28. Compare / Competitive
// ============================================================

/** Feature comparison status. */
export type CompareStatus = 'yes' | 'no' | 'partial' | 'unique';

/** A row in the competitor comparison table. */
export interface CompetitorRow {
  feature: string;
  detail?: string;
  tenantiq: { status: CompareStatus; note?: string };
  them: { status: CompareStatus; note?: string };
}

/** Competitor vendor metadata. */
export interface VendorMeta {
  slug: string;
  name: string;
  tagline: string;
  subhead: string;
  /** Features where we explicitly don't compete. */
  dontFightOn: string[];
  dossierUrl?: string;
}

// ============================================================
// 29. Design System Tokens (Apple HIG)
// ============================================================

/** Color palette — Apple System Colors with semantic usage. */
export const colorTokens = {
  blue: {
    50: '#E5F2FF', 100: '#CCE5FF', 200: '#99CBFF', 300: '#66B0FF',
    400: '#3396FF', 500: '#007AFF', 600: '#0062CC', 700: '#004A99',
    800: '#003166', 900: '#001933',
  },
  green: {
    50: '#E8F9F0', 100: '#D1F3E1', 200: '#A3E7C3', 300: '#75DBA5',
    400: '#47CF87', 500: '#34C759', 600: '#2A9F47', 700: '#1F7735',
    800: '#154F23', 900: '#0A2711',
  },
  red: {
    50: '#FFE8E6', 100: '#FFD1CD', 200: '#FFA39B', 300: '#FF7569',
    400: '#FF4737', 500: '#FF3B30', 600: '#CC2F26', 700: '#99231D',
    800: '#661713', 900: '#330B0A',
  },
  orange: {
    50: '#FFF3E5', 100: '#FFE7CC', 200: '#FFCF99', 300: '#FFB766',
    400: '#FF9F33', 500: '#FF9500', 600: '#CC7700', 700: '#995900',
    800: '#663B00', 900: '#331E00',
  },
  gray: {
    50: '#F9F9F9', 100: '#F2F2F7', 200: '#E5E5EA', 300: '#D1D1D6',
    400: '#C7C7CC', 500: '#8E8E93', 600: '#717176', 700: '#555559',
    800: '#38383B', 900: '#1C1C1E',
  },
  background: {
    primary: '#FFFFFF', secondary: '#F9F9F9', tertiary: '#F2F2F7',
    elevated: '#FFFFFF', grouped: '#F2F2F7',
  },
  text: {
    primary: '#000000', secondary: '#8E8E93', tertiary: '#C7C7CC',
    disabled: '#D1D1D6', inverse: '#FFFFFF',
  },
  border: { default: '#E5E5EA', strong: '#D1D1D6', subtle: '#F2F2F7' },
  success: '#34C759',
  warning: '#FF9500',
  error: '#FF3B30',
  info: '#007AFF',
} as const;

/** Typography tokens — Apple SF Pro scale. */
export const typographyTokens = {
  fontFamily: {
    sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", "SF Pro Text", "SF Pro Display", system-ui, sans-serif',
    mono: '"SF Mono", "Monaco", "Consolas", monospace',
  },
  fontSize: {
    xs: '11px', sm: '13px', base: '15px', lg: '17px', xl: '20px',
    '2xl': '24px', '3xl': '28px', '4xl': '34px', '5xl': '48px', '6xl': '60px',
  },
  fontWeight: { regular: '400', medium: '500', semibold: '600', bold: '700' },
  lineHeight: { tight: '1.2', normal: '1.4', relaxed: '1.5', loose: '1.6' },
  letterSpacing: { tight: '-0.02em', normal: '0', wide: '0.02em' },
} as const;

/** Spacing tokens — 4px/8px base unit. */
export const spacingTokens = {
  0: '0px', 1: '4px', 2: '8px', 3: '12px', 4: '16px', 5: '20px',
  6: '24px', 7: '28px', 8: '32px', 9: '36px', 10: '40px',
  12: '48px', 16: '64px', 20: '80px', 24: '96px',
} as const;

/** Border radius tokens — Apple soft rounded corners. */
export const borderRadiusTokens = {
  none: '0', sm: '6px', md: '8px', lg: '12px', xl: '16px',
  '2xl': '20px', '3xl': '24px', full: '9999px',
} as const;

/** Shadow / elevation tokens. */
export const shadowTokens = {
  sm: '0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.06)',
  md: '0 4px 6px rgba(0, 0, 0, 0.07), 0 2px 4px rgba(0, 0, 0, 0.05)',
  lg: '0 10px 25px rgba(0, 0, 0, 0.1), 0 5px 10px rgba(0, 0, 0, 0.08)',
  xl: '0 20px 40px rgba(0, 0, 0, 0.12), 0 10px 20px rgba(0, 0, 0, 0.1)',
} as const;

/** Animation / motion tokens. */
export const animationTokens = {
  duration: { instant: '100ms', fast: '200ms', normal: '300ms', slow: '400ms', slower: '500ms' },
  easing: {
    default: 'cubic-bezier(0.4, 0.0, 0.2, 1)',
    in: 'cubic-bezier(0.4, 0.0, 1, 1)',
    out: 'cubic-bezier(0.0, 0.0, 0.2, 1)',
    inOut: 'cubic-bezier(0.4, 0.0, 0.2, 1)',
    spring: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
  },
} as const;

/** Touch target tokens — Apple HIG minimum 44pt. */
export const touchTargetTokens = {
  minimum: '44px', comfortable: '48px', large: '56px',
} as const;

/** Responsive grid tokens. */
export const gridTokens = {
  columns: { mobile: 4, tablet: 8, desktop: 12 },
  gutters: { mobile: '16px', tablet: '20px', desktop: '24px' },
  margins: { mobile: '16px', tablet: '20px', desktop: '24px' },
} as const;

// ============================================================
// 30. Constants & Config
// ============================================================

/** Severity display order (lower = more severe). */
export const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 0, high: 1, medium: 2, low: 3,
};

/** Severity badge colors. */
export const SEVERITY_COLORS: Record<Severity, string> = {
  critical: '#d13438', high: '#ff8c00', medium: '#ffb900', low: '#0078d4',
};

/** Alert category display labels. */
export const ALERT_CATEGORY_LABELS: Record<AlertCategory, string> = {
  security: 'Security', optimization: 'Optimization',
  compliance: 'Compliance', operational: 'Operational',
};

/**
 * Intelligence engine rule IDs.
 * Each maps to an alert rule evaluated by the backend.
 */
export const RULE_IDS = {
  // Security
  SEC_001: 'SEC-001', // MFA not enforced for admins
  SEC_002: 'SEC-002', // Legacy authentication enabled
  SEC_003: 'SEC-003', // Impossible travel detection
  SEC_004: 'SEC-004', // Failed login spike
  SEC_005: 'SEC-005', // Risky sign-ins unaddressed
  SEC_006: 'SEC-006', // External sharing overshare
  // Optimization
  OPT_001: 'OPT-001', // Inactive users (30/60/90 days)
  OPT_002: 'OPT-002', // Underutilized E5 licenses
  OPT_003: 'OPT-003', // Unassigned licenses
  // Compliance
  CMP_001: 'CMP-001', // Stale guest users
  CMP_002: 'CMP-002', // Groups without owners
  CMP_003: 'CMP-003', // Conditional access policy disabled
  // Operational
  OPS_001: 'OPS-001', // Service health degradation
  OPS_002: 'OPS-002', // Sync errors detected
  // Backup Health
  BKP_001: 'BKP-001', // Backup stale (no backup in 48+ hours)
  BKP_002: 'BKP-002', // Backup size anomaly (>50% drop)
  BKP_003: 'BKP-003', // Backup encryption key not rotated
  BKP_004: 'BKP-004', // Backup failure
  // CI/CD Security
  CICD_005: 'CICD-005', // Federated identity credentials not repo-scoped
  // After-Hours Escalation
  AH_001: 'AH-001', // After-hours config change
  AH_002: 'AH-002', // Weekend config change
  AH_003: 'AH-003', // No business-hours login for 48+ hours
  // Copilot Security
  CPG_001: 'CPG-001', // Copilot prompt injection detected
  CPG_002: 'CPG-002', // Copilot sensitivity escalation
  CPG_003: 'CPG-003', // Copilot bulk data access
} as const;

/** Remediation action IDs. */
export const REMEDIATION_ACTION_IDS = {
  REM_001: 'REM-001', // Decommission User
  REM_002: 'REM-002', // Enable MFA Policy
  REM_003: 'REM-003', // Block IP Range
  REM_004: 'REM-004', // Downgrade License
  REM_005: 'REM-005', // Revoke Sessions
  REM_006: 'REM-006', // Force Password Reset
  REM_007: 'REM-007', // Remove Guest User
  REM_008: 'REM-008', // Restrict External Sharing
  REM_009: 'REM-009', // Enable Conditional Access
} as const;

/** Microsoft 365 license SKU approximate monthly costs (USD). */
export const LICENSE_COSTS: Record<string, number> = {
  'Microsoft 365 E5': 57.0,
  'Microsoft 365 E3': 36.0,
  'Microsoft 365 E1': 10.0,
  'Microsoft 365 Business Premium': 22.0,
  'Microsoft 365 Business Standard': 12.5,
  'Microsoft 365 Business Basic': 6.0,
  'Exchange Online (Plan 2)': 8.0,
  'Exchange Online (Plan 1)': 4.0,
};

/** Cron schedule expressions for background jobs. */
export const SCAN_SCHEDULES = {
  USER_SYNC: '0 */6 * * *',
  SECURITY_SCAN: '0 * * * *',
  COMPLIANCE_SCAN: '0 3 * * *',
  WORKFLOW_CHECK: '*/15 * * * *',
} as const;

/** Rate limits enforced by the API. */
export const RATE_LIMITS = {
  AI_CHAT_PER_HOUR: 50,
  REMEDIATION_PER_MINUTE: 10,
  API_PER_MINUTE: 120,
  BATCH_OPERATION_MAX: 50,
} as const;

// ============================================================
// Dashboard (aggregate view)
// ============================================================

/** User count breakdown for dashboard. */
export interface UserBreakdown {
  total: number;
  active: number;
  inactive: number;
  guests: number;
  disabled: number;
}

/** Risky user summary for dashboard. */
export interface RiskyUser {
  displayName: string;
  email: string;
  riskReason: string;
  daysSinceSignIn: number | null;
  accountEnabled: boolean;
}

/**
 * Full dashboard metrics payload returned by GET /api/dashboard.
 * The primary data contract for the home page.
 */
export interface DashboardMetrics {
  secureScore: number | null;
  secureScoreTrend: number[];
  activeAlerts: { critical: number; high: number; medium: number; low: number };
  totalUsers: number;
  activeUsers: number;
  licenseWaste: number;
  totalLicenseSpend: number;
  userBreakdown: UserBreakdown;
  topRiskyUsers: RiskyUser[];
  licenseUtilization: number;
  licenseBreakdown: LicenseSkuBreakdown[];
  recentAlerts: Alert[];
  lastSyncAt: string | null;
}

// ============================================================
// Threat Detection
// ============================================================

/** Threat user (identity involved in a threat). */
export interface ThreatUser {
  id: string;
  displayName: string;
  email: string;
  riskLevel: string;
  lastSignIn: string | null;
}

/** Threat suggested action. */
export interface ThreatAction {
  id: string;
  label: string;
  type: 'remediate' | 'investigate' | 'dismiss';
  description: string;
  apiAction?: string;
}

/** A detected identity threat. */
export interface Threat {
  id: string;
  severity: Severity;
  type: string;
  title: string;
  description: string;
  user: ThreatUser | null;
  affectedUsers?: number;
  details: Record<string, unknown>;
  riskScore: number;
  timestamp: string;
  firstSeen?: string;
  lastSeen?: string;
  status: string;
  suggestedActions: string[];
  actions?: ThreatAction[];
  occurrences?: number;
  occurrenceDates?: string[];
}

// ============================================================
// Platform Admin
// ============================================================

/** System alert for platform admin. */
export interface SystemAlert {
  id: string;
  level: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  component: string;
  createdAt: string;
  resolvedAt: string | null;
}

/** Platform announcement. */
export interface Announcement {
  id: string;
  title: string;
  body: string;
  type: 'info' | 'warning' | 'maintenance';
  publishedAt: string;
  expiresAt: string | null;
  active: boolean;
}

/** Feature flag rule (platform admin). */
export interface FeatureFlagRule {
  id: string;
  flag: string;
  condition: string;
  value: boolean;
  orgIds?: string[];
  percentage?: number;
}

/** Platform admin user listing. */
export interface AdminPlatformUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  organizationId: string;
  organizationName: string;
  lastLoginAt: string | null;
  status: 'active' | 'suspended';
  createdAt: string;
}

/** Recent org for platform overview. */
export interface RecentOrg {
  id: string;
  name: string;
  tier: string;
  status: string;
  users: number;
  mrr: number;
}

// ============================================================
// SDLC (AI Compliance)
// ============================================================

/** SDLC proxy/gateway configuration. */
export interface SdlcConfig {
  enabled: boolean;
  proxyUrl: string;
  piiClasses: string[];
  policies: string[];
}

/** SDLC stats. */
export interface SdlcStats {
  totalRequests: number;
  blockedRequests: number;
  piiDetections: number;
  costUsd: number;
}

// ============================================================
// Leaderboard (Gamification)
// ============================================================

/** Leaderboard entry. */
export interface LeaderboardEntry {
  tenantId: string;
  displayName: string;
  score: number;
  rank: number;
  cisScore: number | null;
  alertsResolved: number;
  remediationsApplied: number;
}

/** Leaderboard stats. */
export interface LeaderboardStats {
  totalParticipants: number;
  avgScore: number;
  topScore: number;
}

// ============================================================
// Onboarding
// ============================================================

/** Onboarding checklist keys. */
export type OnboardingChecklistKey = 'cisScanDone' | 'licensesReviewed' | 'aiTried';

/** Onboarding checklist state (persisted to localStorage). */
export interface OnboardingChecklistState {
  cisScanDone: boolean;
  licensesReviewed: boolean;
  aiTried: boolean;
}

// ============================================================
// CI Health (Settings)
// ============================================================

/** CI self-heal event. */
export interface CiHealEvent {
  id: string;
  file: string;
  issue: string;
  fix: string;
  timestamp: string;
  automated: boolean;
  linesChanged: number;
}

/** CI health stats. */
export interface CiHealStats {
  totalHeals: number;
  automatedHeals: number;
  linesFixed: number;
  avgTimeToFix: number;
}

// ============================================================
// Page Info (metadata for pages)
// ============================================================

/** Static page metadata used by layout components. */
export interface PageInfo {
  title: string;
  tagline: string;
  description: string;
  bullets: string[];
}

// ============================================================
// Agents
// ============================================================

/** Autonomous agent action log. */
export interface AgentAction {
  id: string;
  type: string;
  description: string;
  status: 'completed' | 'failed' | 'pending';
  timestamp: string;
  duration?: number;
}

/** Agent summary stats. */
export interface AgentSummary {
  totalActions: number;
  successRate: number;
  avgDuration: number;
  lastRunAt: string | null;
}

// ============================================================
// Purview (Microsoft Information Protection)
// ============================================================

/** DLP policy record. */
export interface DlpPolicy {
  id: string;
  name: string;
  state: 'enabled' | 'disabled';
  mode: string;
  priority: number;
  conditions: string;
  actions: string;
  scope: string;
  createdDate: string;
}

/** Sensitivity label record. */
export interface SensitivityLabel {
  id: string;
  name: string;
  description: string;
  priority: number;
  scope: string;
  enabled: boolean;
  autoLabelingEnabled: boolean;
  createdDate: string;
}

/** Purview feature overview card data. */
export interface PurviewFeature {
  id: string;
  name: string;
  description: string;
  status: 'configured' | 'partial' | 'not_configured';
  policies: Array<{ name: string; state: string }>;
}

// ============================================================
// Operations (Platform)
// ============================================================

/** Health card for platform operations page. */
export interface OperationsHealthCard {
  service: string;
  status: 'healthy' | 'degraded' | 'down';
  latencyMs: number;
  lastChecked: string;
}

/** CI card for platform operations. */
export interface OperationsCICard {
  pipeline: string;
  status: 'passing' | 'failing' | 'pending';
  lastRun: string;
  duration: number;
}

/** Agent card for platform operations. */
export interface OperationsAgentCard {
  name: string;
  status: 'running' | 'idle' | 'error';
  lastAction: string;
  actionsToday: number;
}
