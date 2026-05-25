import {
    Search, TestTube, ClipboardList, Wrench, Rocket,
    FileText, ShieldCheck, Package,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export const categoryIcons: Record<string, LucideIcon> = {
    review: Search,
    testing: TestTube,
    planning: ClipboardList,
    solution: Wrench,
    devops: Rocket,
    documentation: FileText,
    security: ShieldCheck,
};

export const defaultCategoryIcon = Package;
