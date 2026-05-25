import { useState, useEffect } from 'react';
import {
    Cloud, Monitor, Smartphone, Tablet, RefreshCw, Play,
    Settings, Wifi, WifiOff, Laptop, Globe, X, ExternalLink
} from 'lucide-react';
import { Card, Button, Badge } from '../components/atoms';
import { motion, AnimatePresence } from 'framer-motion';
import { cloudDeviceService } from '../services/cloudDeviceService';
import type { CloudDevice, CloudProvider } from '../services/cloudDeviceService';

const CloudDeviceHub = () => {
    const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [devices, setDevices] = useState<CloudDevice[]>([]);
    const [providers, setProviders] = useState<CloudProvider[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [launchedDevice, setLaunchedDevice] = useState<CloudDevice | null>(null);
    const [isLaunching, setIsLaunching] = useState<string | null>(null);
    const [activeReservationId, setActiveReservationId] = useState<string | null>(null);

    const fetchData = async () => {
        setIsRefreshing(true);
        setError(null);
        try {
            const [fetchedDevices, fetchedProviders] = await Promise.all([
                cloudDeviceService.getDevices(),
                cloudDeviceService.getProviders()
            ]);
            setDevices(fetchedDevices);
            setProviders(fetchedProviders);
        } catch (err) {
            console.error('Failed to fetch cloud device data:', err);
            setError('Failed to load device data. Please ensure the backend is running.');
        } finally {
            setIsRefreshing(false);
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const filteredDevices = selectedProvider
        ? devices.filter(d => d.provider === selectedProvider)
        : devices;

    const getDeviceIcon = (platform: string) => {
        const p = platform.toLowerCase();
        if (p.includes('ios') || p.includes('android')) return <Smartphone size={20} />;
        if (p.includes('ipad') || p.includes('tablet')) return <Tablet size={20} />;
        if (p.includes('chrome') || p.includes('firefox') || p.includes('safari') || p.includes('edge')) return <Monitor size={20} />;
        return <Laptop size={20} />;
    };

    const getStatusColor = (status: string): 'success' | 'warning' | 'outline' => {
        switch (status) {
            case 'available': return 'success';
            case 'busy': return 'warning';
            case 'offline': return 'outline';
            default: return 'outline';
        }
    };

    const handleRefresh = () => {
        fetchData();
    };

    const handleLaunch = async (device: CloudDevice) => {
        if (device.status !== 'available') return;

        setIsLaunching(device.id);
        setError(null);

        try {
            const reservation = await cloudDeviceService.reserveDevice(device.id, 60);
            setActiveReservationId(reservation.id);

            setDevices(prev => prev.map(d =>
                d.id === device.id ? { ...d, status: 'busy' as const } : d
            ));

            setLaunchedDevice(device);
        } catch (err) {
            console.error('Failed to reserve cloud device:', err);
            setError('Failed to reserve device. Please try another available device.');
        } finally {
            setIsLaunching(null);
        }
    };

    const handleCloseSession = async () => {
        const reservationId = activeReservationId;
        setActiveReservationId(null);

        if (reservationId) {
            try {
                await cloudDeviceService.releaseDevice(reservationId);
            } catch (err) {
                console.error('Failed to release cloud device:', err);
            }
        }

        if (launchedDevice) {
            setDevices(prev => prev.map(d =>
                d.id === launchedDevice.id ? { ...d, status: 'available' as const } : d
            ));
        }
        setLaunchedDevice(null);
    };

    if (isLoading && !isRefreshing && devices.length === 0) {
        return (
            <div className="p-6 max-w-[1600px] mx-auto flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                    <RefreshCw size={32} className="animate-spin text-primary mx-auto mb-4" />
                    <p className="text-gray-400">Loading cloud devices...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-[1600px] mx-auto space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold font-mono text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">
                        CLOUD DEVICE HUB
                    </h2>
                    <p className="text-gray-400 mt-1">
                        Access real devices and browsers across multiple cloud providers
                    </p>
                </div>
                <div className="flex gap-3">
                    <Button
                        variant="glass"
                        size="sm"
                        leftIcon={<RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />}
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                    >
                        {isRefreshing ? 'Refreshing...' : 'Refresh Devices'}
                    </Button>
                    <Button variant="neon" size="sm" leftIcon={<Settings size={16} />}>
                        Configure Providers
                    </Button>
                </div>
            </div>

            {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-lg flex items-center gap-2">
                    <WifiOff size={20} />
                    <span>{error}</span>
                </div>
            )}

            {/* Provider Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {providers.map((provider) => (
                    <motion.div
                        key={provider.id}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                    >
                        <Card
                            variant="glass"
                            className={`cursor-pointer transition-all ${selectedProvider === provider.id
                                ? 'ring-2 ring-primary border-primary/50'
                                : 'hover:border-white/20'
                                }`}
                            onClick={() => setSelectedProvider(
                                selectedProvider === provider.id ? null : provider.id
                            )}
                        >
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-3">
                                    <div
                                        className="w-10 h-10 rounded-lg flex items-center justify-center bg-white/5"
                                    >
                                        <Cloud size={20} className="text-blue-400" />
                                    </div>
                                    <div>
                                        <h4 className="font-semibold text-white">{provider.name}</h4>
                                        <p className="text-xs text-gray-500">{provider.deviceCount} devices</p>
                                    </div>
                                </div>
                                {provider.connected ? (
                                    <Wifi size={18} className="text-green-400" />
                                ) : (
                                    <WifiOff size={18} className="text-gray-500" />
                                )}
                            </div>
                            <Badge variant={provider.connected ? 'success' : 'outline'}>
                                {provider.connected ? 'Connected' : 'Not Connected'}
                            </Badge>
                        </Card>
                    </motion.div>
                ))}
            </div>

            {/* Device Grid */}
            <Card variant="glass" padding="lg">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-white font-mono flex items-center gap-2">
                        <Globe size={20} className="text-primary" />
                        AVAILABLE DEVICES
                        <Badge variant="outline" className="ml-2">{filteredDevices.length}</Badge>
                    </h3>
                    <div className="flex gap-2">
                        <Badge variant="success" className="cursor-pointer">Available</Badge>
                        <Badge variant="warning" className="cursor-pointer">Busy</Badge>
                        <Badge variant="outline" className="cursor-pointer">Offline</Badge>
                    </div>
                </div>

                {filteredDevices.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                        <Smartphone size={48} className="mx-auto mb-4 opacity-20" />
                        <p>No devices found. Try configuring a provider or check your filters.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {filteredDevices.map((device, index) => (
                            <motion.div
                                key={device.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.05 }}
                            >
                                <Card
                                    variant="glass"
                                    className="group hover:border-primary/50 transition-all cursor-pointer h-full"
                                >
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center text-primary group-hover:bg-primary/20 transition-colors">
                                                {getDeviceIcon(device.platform)}
                                            </div>
                                            <div>
                                                <h4 className="font-semibold text-white text-sm">{device.name}</h4>
                                                <p className="text-xs text-gray-500">{device.model} • {device.osVersion}</p>
                                            </div>
                                        </div>
                                        <Badge variant={getStatusColor(device.status)} className="text-xs">
                                            {device.status}
                                        </Badge>
                                    </div>
                                    <div className="flex gap-2 mt-3">
                                        <Button
                                            variant="neon"
                                            size="sm"
                                            className="flex-1"
                                            leftIcon={isLaunching === device.id ? <RefreshCw size={14} className="animate-spin" /> : <Play size={14} />}
                                            disabled={device.status !== 'available' || isLaunching !== null}
                                            onClick={() => handleLaunch(device)}
                                        >
                                            {isLaunching === device.id ? 'Launching...' : 'Launch'}
                                        </Button>
                                    </div>
                                    <div className="mt-2 flex flex-wrap gap-1">
                                        {device.tags?.map(tag => (
                                            <span key={tag} className="text-[10px] text-gray-500 bg-white/5 px-2 py-0.5 rounded">
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                </Card>
                            </motion.div>
                        ))}
                    </div>
                )}
            </Card>

            {/* Device Session Modal */}
            <AnimatePresence>
                {launchedDevice && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                            onClick={handleCloseSession}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="relative w-full max-w-4xl bg-[#0a0b12] border border-white/10 rounded-xl shadow-2xl overflow-hidden"
                        >
                            <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center text-primary">
                                        {getDeviceIcon(launchedDevice.platform)}
                                    </div>
                                    <div>
                                        <h2 className="font-bold text-white">{launchedDevice.name}</h2>
                                        <p className="text-xs text-gray-500">{launchedDevice.model} • {launchedDevice.osVersion}</p>
                                    </div>
                                    <Badge variant="success" className="ml-2">Live Session</Badge>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button variant="outline" size="sm" leftIcon={<ExternalLink size={14} />}>
                                        Open in New Tab
                                    </Button>
                                    <button
                                        onClick={handleCloseSession}
                                        className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                                    >
                                        <X size={20} />
                                    </button>
                                </div>
                            </div>

                            {/* Device Preview */}
                            <div className="p-8 flex items-center justify-center bg-gradient-to-br from-gray-900 to-black min-h-[500px]">
                                <div className="relative">
                                    {/* Device Frame */}
                                    <div className="w-[280px] h-[560px] bg-black rounded-[40px] border-4 border-gray-800 p-3 shadow-2xl">
                                        {/* Screen */}
                                        <div className="w-full h-full bg-gradient-to-br from-blue-900 to-purple-900 rounded-[32px] flex flex-col items-center justify-center overflow-hidden">
                                            {/* Status Bar */}
                                            <div className="w-full px-6 py-2 flex justify-between text-white text-xs">
                                                <span>9:41</span>
                                                <div className="flex gap-1">
                                                    <Wifi size={12} />
                                                    <span>100%</span>
                                                </div>
                                            </div>

                                            {/* Content */}
                                            <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
                                                <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mb-4">
                                                    <Play size={32} className="text-white" />
                                                </div>
                                                <h3 className="text-white font-semibold mb-2">Device Ready</h3>
                                                <p className="text-white/60 text-sm mb-4">
                                                    {launchedDevice.name} is connected and ready for testing
                                                </p>
                                                <div className="flex items-center gap-2 text-green-400 text-xs">
                                                    <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                                                    Recording Active
                                                </div>
                                            </div>

                                            {/* Home Indicator */}
                                            <div className="w-32 h-1 bg-white/30 rounded-full mb-2" />
                                        </div>
                                    </div>

                                    {/* Glow Effect */}
                                    <div className="absolute inset-0 bg-primary/20 rounded-[40px] blur-3xl -z-10" />
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="p-4 border-t border-white/10 flex justify-between items-center bg-white/5">
                                <div className="flex items-center gap-4 text-sm text-gray-400">
                                    <span>Session Duration: <span className="text-white">00:00:12</span></span>
                                    <span>Actions Recorded: <span className="text-white">0</span></span>
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="outline" size="sm">Take Screenshot</Button>
                                    <Button variant="danger" size="sm" onClick={handleCloseSession}>End Session</Button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default CloudDeviceHub;
