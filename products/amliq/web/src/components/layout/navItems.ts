import {
  LayoutDashboard, AlertCircle, Search, Settings,
  BarChart3, FileText, Eye, Package, CreditCard,
  Briefcase, Shield, UserCheck, Globe, Zap,
  Users, Activity, Server, ShoppingBag, List,
  Key, Webhook, Wallet, Database, Play, Clock,
  Ship,
} from 'lucide-react';

export interface NavSection {
  title: string;
  items: NavItem[];
  minRole?: string;
}

export interface NavItem {
  icon: typeof LayoutDashboard;
  label: string;
  path: string;
  minRole?: string;
}

const ROLE_RANK: Record<string, number> = {
  viewer: 0, auditor: 1, analyst: 2, admin: 3, superadmin: 4,
};

export function canAccess(userRole: string, minRole?: string): boolean {
  if (!minRole) return true;
  return (ROLE_RANK[userRole] ?? 0) >= (ROLE_RANK[minRole] ?? 99);
}

export const mainNav: NavSection = {
  title: 'Operations',
  items: [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
    { icon: AlertCircle, label: 'Alert Queue', path: '/alerts' },
    { icon: Search, label: 'Screen Entity', path: '/screen' },
    { icon: Eye, label: 'Monitoring', path: '/monitoring' },
    { icon: Package, label: 'Batch Jobs', path: '/batch' },
  ],
};

export const complianceNav: NavSection = {
  title: 'Compliance',
  items: [
    { icon: Briefcase, label: 'Case Management', path: '/compliance/cases' },
    { icon: Shield, label: 'Risk Assessment', path: '/compliance/risk' },
    { icon: UserCheck, label: 'PEP Screening', path: '/compliance/pep' },
    { icon: Globe, label: 'Adverse Media', path: '/compliance/media' },
    { icon: Zap, label: 'Transaction Monitoring', path: '/compliance/txn' },
    { icon: Wallet, label: 'Crypto Screening', path: '/compliance/crypto' },
    { icon: Ship, label: 'Vessel Screening', path: '/compliance/vessel' },
  ],
};

export const systemNav: NavSection = {
  title: 'Settings',
  items: [
    { icon: BarChart3, label: 'Analytics', path: '/analytics' },
    { icon: FileText, label: 'Audit Log', path: '/audit', minRole: 'auditor' },
    { icon: List, label: 'Sanctions Lists', path: '/lists' },
    { icon: ShoppingBag, label: 'List Marketplace', path: '/lists/marketplace' },
    { icon: Key, label: 'API Keys', path: '/keys', minRole: 'admin' },
    { icon: Webhook, label: 'Webhooks', path: '/webhooks', minRole: 'admin' },
    { icon: Clock, label: 'Task History', path: '/tasks' },
    { icon: Settings, label: 'Configuration', path: '/config', minRole: 'admin' },
    { icon: CreditCard, label: 'Billing', path: '/billing', minRole: 'admin' },
    { icon: Users, label: 'Team', path: '/team', minRole: 'admin' },
  ],
};

export const adminNav: NavSection = {
  title: 'Administration',
  minRole: 'admin',
  items: [
    { icon: Server, label: 'Tenants', path: '/admin/tenants' },
    { icon: Activity, label: 'System Health', path: '/admin/health' },
    { icon: Activity, label: 'List Sync Health', path: '/admin/list-health' },
    { icon: Database, label: 'Data Sources', path: '/admin/data-sources' },
    { icon: Play, label: 'Operations', path: '/admin/operations' },
    { icon: Clock, label: 'Scheduled Tasks', path: '/admin/tasks' },
  ],
};

export const navSections: NavSection[] = [
  mainNav, complianceNav, systemNav, adminNav,
];
