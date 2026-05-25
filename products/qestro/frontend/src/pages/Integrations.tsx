import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Plug, Check, ExternalLink, RefreshCw, X } from 'lucide-react';
import { registry } from '../lib/plugins/sdk';
import type { IntegrationPlugin, IntegrationCategory } from '../lib/plugins/sdk';
import '../lib/plugins/registry'; // Ensure registry is populated
import { Button } from '../components/atoms';

export default function Integrations() {
    const [plugins, setPlugins] = useState<IntegrationPlugin[]>([]);
    const [statusMap, setStatusMap] = useState<Record<string, boolean>>({});
    const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});
    const [filter, setFilter] = useState<string>('All');
    const [search, setSearch] = useState('');

    // Modal State
    const [selectedPlugin, setSelectedPlugin] = useState<IntegrationPlugin | null>(null);

    const refreshStatus = async () => {
        const allPlugins = registry.getAll();
        setPlugins(allPlugins);
        const map: Record<string, boolean> = {};
        for (const p of allPlugins) {
            const { isConnected } = await p.checkStatus();
            map[p.id] = isConnected;
        }
        setStatusMap(map);
    };

    useEffect(() => {
        refreshStatus();
    }, []);

    const handleAction = async (plugin: IntegrationPlugin) => {
        const isConnected = statusMap[plugin.id];

        console.log(`[Action] ${plugin.name} (Connected: ${isConnected}, HasSettings: ${!!plugin.renderSettings})`);

        // 1. If trying to Connect AND plugin implements custom settings -> Open Modal
        if (!isConnected && plugin.renderSettings) {
            console.log('[Action] Opening Settings Modal...');
            setSelectedPlugin(plugin);
            return;
        }

        // 2. If trying to Connect/Disconnect normally
        setLoadingMap(prev => ({ ...prev, [plugin.id]: true }));
        try {
            if (isConnected) {
                if (confirm(`Disconnect ${plugin.name}?`)) {
                    await plugin.disconnect();
                }
            } else {
                await plugin.connect();
            }
            await refreshStatus(); // Refresh all
        } catch (e) {
            console.error(e);
            alert(`Failed with ${plugin.name}`);
        } finally {
            setLoadingMap(prev => ({ ...prev, [plugin.id]: false }));
        }
    };

    const handleSettingsClose = async () => {
        setSelectedPlugin(null);
        await refreshStatus(); // Refresh status in case settings saved = connected
    };

    const categories: ('All' | IntegrationCategory)[] = [
        'All', 'Communication', 'Project Management', 'Development', 'Infrastructure', 'Design & Quality'
    ];

    const filteredPlugins = plugins.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
        const matchesCategory = filter === 'All' || p.categories.includes(filter as IntegrationCategory);
        return matchesSearch && matchesCategory;
    });

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: { staggerChildren: 0.05 }
        }
    };

    const cardVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0 }
    };

    return (
        <div className="min-h-screen bg-bg-primary p-8 relative">
            <motion.div
                className={`max-w-7xl mx-auto space-y-8 ${selectedPlugin ? 'blur-sm pointer-events-none' : ''}`}
                variants={containerVariants}
                initial="hidden"
                animate="visible"
            >
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-text-primary tracking-tight flex items-center gap-3">
                            <Plug className="w-8 h-8 text-primary" />
                            Integrations Ecosystem
                        </h1>
                        <p className="text-text-muted mt-1">
                            Supercharge Qestro by connecting your favorite tools.
                        </p>
                    </div>

                    {/* Search */}
                    <div className="relative w-full md:w-96">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                        <input
                            type="text"
                            placeholder="Find an integration..."
                            className="w-full pl-10 pr-4 py-2 bg-black/20 border border-white/10 rounded-xl text-text-primary focus:outline-none focus:border-primary/50 transition-all"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </div>

                {/* Filter Tabs */}
                <div className="flex flex-wrap gap-2 pb-4 border-b border-white/5">
                    {categories.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setFilter(cat)}
                            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${filter === cat
                                ? 'bg-primary/20 text-primary border border-primary/20'
                                : 'bg-white/5 text-text-muted hover:bg-white/10 hover:text-white'
                                }`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>

                {/* Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredPlugins.map(plugin => {
                        const isConnected = statusMap[plugin.id];
                        const isLoading = loadingMap[plugin.id];
                        const Icon = plugin.icon;

                        return (
                            <motion.div
                                key={plugin.id}
                                variants={cardVariants}
                                className={`group relative p-6 bg-bg-secondary/50 backdrop-blur-md border rounded-xl transition-all duration-300 ${isConnected
                                    ? 'border-emerald-500/30 bg-emerald-500/5'
                                    : 'border-border hover:border-primary/30'
                                    }`}
                            >
                                {/* Header */}
                                <div className="flex justify-between items-start mb-4">
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center border transition-colors ${isConnected
                                        ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
                                        : 'bg-black/20 border-white/10 text-white group-hover:text-primary group-hover:border-primary/30'
                                        }`}>
                                        <Icon className="w-6 h-6" />
                                    </div>
                                    {isConnected && (
                                        <span className="px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold border border-emerald-500/20 flex items-center gap-1">
                                            <Check className="w-3 h-3" /> Active
                                        </span>
                                    )}
                                </div>

                                {/* Content */}
                                <h3 className="text-lg font-bold text-text-primary mb-1">{plugin.name}</h3>
                                <p className="text-sm text-text-muted h-10 mb-6 line-clamp-2">
                                    {plugin.description}
                                </p>

                                {/* Action */}
                                <Button
                                    onClick={() => handleAction(plugin)}
                                    disabled={isLoading}
                                    variant={isConnected ? "outline" : "primary"}
                                    className={`w-full justify-center ${isConnected ? 'border-white/10 hover:bg-red-500/10 hover:text-red-400' : ''}`}
                                    leftIcon={isLoading ? <RefreshCw className="animate-spin w-4 h-4" /> : isConnected ? <ExternalLink className="w-4 h-4" /> : undefined}
                                >
                                    {isLoading
                                        ? (isConnected ? 'Disconnecting...' : 'Connecting...')
                                        : (isConnected ? 'Manage' : plugin.actionLabel)
                                    }
                                </Button>

                            </motion.div>
                        );
                    })}
                </div>
            </motion.div>

            {/* Config Modal */}
            <AnimatePresence>
                {selectedPlugin && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                        onClick={() => setSelectedPlugin(null)} // Click outside to close
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()} // Prevent click through
                            className="w-full max-w-lg bg-bg-secondary border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
                        >
                            <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/5">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-black/20 rounded-lg">
                                        <selectedPlugin.icon className="w-5 h-5 text-primary" />
                                    </div>
                                    <h2 className="text-xl font-bold text-text-primary">Configure {selectedPlugin.name}</h2>
                                </div>
                                <button onClick={() => setSelectedPlugin(null)} className="text-text-muted hover:text-white transition-colors">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="p-6">
                                {selectedPlugin.renderSettings ? (() => {
                                    const SettingsComponent = selectedPlugin.renderSettings;
                                    return <SettingsComponent onClose={handleSettingsClose} />;
                                })() : (
                                    <div className="text-red-500">Error: No Settings Component Found</div>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
