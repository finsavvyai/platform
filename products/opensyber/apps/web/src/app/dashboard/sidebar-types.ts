import type { LucideIcon } from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export interface NavSubGroup {
  label: string;
  items: NavItem[];
}

export interface SidebarGroup {
  id: string;
  title: string;
  icon: LucideIcon;
  /** Top-level items shown directly under the group header */
  items?: NavItem[];
  /** Nested sub-groups with their own headers (max 5-7 items each per HIG) */
  subGroups?: NavSubGroup[];
  planGated?: boolean;
}
