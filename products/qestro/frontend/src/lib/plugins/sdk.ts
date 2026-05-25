import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export type IntegrationCategory =
    | 'Communication'
    | 'Project Management'
    | 'Development'
    | 'Infrastructure'
    | 'Design & Quality';

export interface IntegrationPlugin {
    id: string;
    name: string;
    description: string;
    icon: LucideIcon; // We'll use Lucide icons for now across the board for consistency
    categories: IntegrationCategory[];

    // Feature flags to drive UI
    features: {
        hasSettings: boolean;
        hasOAuth: boolean;
        hasWebhook: boolean;
    };

    // The primary action label (e.g., "Connect", "Install", "Link")
    actionLabel: string;

    // Status checker (simulated)
    checkStatus: () => Promise<{
        isConnected: boolean;
        metadata?: Record<string, unknown>; // e.g., { channel: "#general", workspace: "Acme" }
    }>;

    // Connect flow
    connect: () => Promise<boolean>;

    // Disconnect flow
    disconnect: () => Promise<boolean>;

    // Optional: Custom Settings/Configuration UI
    renderSettings?: (props: { onClose: () => void }) => ReactNode;
}

export class PluginRegistry {
    private static instance: PluginRegistry;
    private plugins: Map<string, IntegrationPlugin> = new Map();

    private constructor() { }

    public static getInstance(): PluginRegistry {
        if (!PluginRegistry.instance) {
            PluginRegistry.instance = new PluginRegistry();
        }
        return PluginRegistry.instance;
    }

    public register(plugin: IntegrationPlugin) {
        if (this.plugins.has(plugin.id)) {
            console.warn(`Plugin ${plugin.id} is already registered. Overwriting.`);
        }
        this.plugins.set(plugin.id, plugin);
    }

    public getAll(): IntegrationPlugin[] {
        return Array.from(this.plugins.values());
    }

    public get(id: string): IntegrationPlugin | undefined {
        return this.plugins.get(id);
    }
}

export const registry = PluginRegistry.getInstance();
