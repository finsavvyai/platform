import { useState } from 'react';
import { Moon, Sun, Monitor, ShieldCheck, SlidersHorizontal } from 'lucide-react';

export function SettingsPage() {
    const [theme, setTheme] = useState('dark');

    const themes = [
        { value: 'light' as const, label: 'Light', icon: Sun },
        { value: 'dark' as const, label: 'Dark', icon: Moon },
        { value: 'system' as const, label: 'System', icon: Monitor },
    ];

    return (
        <div className="h-full overflow-auto p-4 md:p-6">
            <div className="mx-auto max-w-6xl space-y-6">
                <section className="premium-card rounded-[2rem] p-6 md:p-8">
                    <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.24em] text-primary">
                        <SlidersHorizontal className="h-3.5 w-3.5" />
                        Workspace controls
                    </div>
                    <h1 className="text-4xl font-black tracking-tight text-gradient-data md:text-5xl">Settings</h1>
                    <p className="mt-3 max-w-2xl text-muted-foreground">
                        Manage your application preferences
                    </p>
                </section>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_0.85fr]">
                    <section className="premium-card rounded-[1.75rem] p-6">
                        <div className="mb-6 flex items-center justify-between">
                            <div>
                                <h2 className="text-2xl font-black tracking-tight">Appearance</h2>
                                <p className="mt-1 text-sm text-muted-foreground">Tune the command center theme.</p>
                            </div>
                            <ShieldCheck className="h-5 w-5 text-success" />
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="mb-3 block text-sm font-bold">Theme</label>
                                <div className="grid grid-cols-3 gap-3">
                                    {themes.map((t) => {
                                        const Icon = t.icon;
                                        return (
                                            <button
                                                key={t.value}
                                                aria-label={t.label}
                                                onClick={() => setTheme(t.value)}
                                                style={theme === t.value ? { borderColor: 'hsl(var(--primary) / 0.5)' } : undefined}
                                                className={`
                                                    cursor-pointer rounded-2xl border p-4 transition-all
                                                    ${theme === t.value
                                                        ? 'border-purple-600 bg-primary/15 text-foreground shadow-[0_18px_40px_hsl(var(--primary)/0.12)]'
                                                        : 'border-border/70 bg-background/35 text-muted-foreground hover:border-primary/40 hover:bg-primary/10 hover:text-foreground'
                                                    }
                                                `}
                                            >
                                                <Icon className="mx-auto mb-2" size={24} />
                                                <div className="text-sm font-black">{t.label}</div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </section>

                    <section className="premium-card rounded-[1.75rem] p-6">
                        <h2 className="mb-6 text-2xl font-black tracking-tight">About</h2>
                        <div className="space-y-3 text-sm">
                            <div className="flex justify-between gap-4 rounded-2xl border border-border/70 bg-background/35 px-4 py-3">
                                <span className="text-muted-foreground">Version:</span>
                                <span className="font-mono font-bold">1.0.0</span>
                            </div>
                            <div className="flex justify-between gap-4 rounded-2xl border border-border/70 bg-background/35 px-4 py-3">
                                <span className="text-muted-foreground">Backend:</span>
                                <span className="font-bold text-success">Connected</span>
                            </div>
                            <div className="flex justify-between gap-4 rounded-2xl border border-border/70 bg-background/35 px-4 py-3">
                                <span className="text-muted-foreground">API URL:</span>
                                <span className="truncate font-mono font-bold">http://localhost:8080</span>
                            </div>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}
