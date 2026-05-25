import { useState, useEffect } from 'react';
import { useTheme } from '../hooks/useTheme';
import {
    SunIcon,
    MoonIcon,
    ComputerDesktopIcon,
    CodeBracketIcon,
    ClockIcon,
    ShieldCheckIcon
} from '@heroicons/react/24/outline';
import type { AppSettings } from '@shared/types';

export function Settings() {
    const { theme, setTheme } = useTheme();
    const [settings, setSettings] = useState<Partial<AppSettings>>({
        fontSize: 14,
        autoSave: true,
        queryLimit: 1000,
        showLineNumbers: true,
        wordWrap: false,
        executionTimeout: 30,
        confirmBeforeExecute: true,
        saveQueryHistory: true,
        maxHistoryItems: 100
    });
    const [backendUrl, setBackendUrl] = useState('http://localhost:8080');
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        async function loadSettings() {
            if (window.api?.settings) {
                const savedSettings = await window.api.settings.get<AppSettings>('settings');
                if (savedSettings) {
                    setSettings(savedSettings);
                }
                const url = await window.api.settings.get<string>('backendUrl');
                if (url) {
                    setBackendUrl(url);
                }
            }
        }
        loadSettings();
    }, []);

    async function handleSave() {
        if (window.api?.settings) {
            await window.api.settings.set('settings', settings);
            await window.api.settings.set('backendUrl', backendUrl);
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        }
    }

    function updateSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
        setSettings(prev => ({ ...prev, [key]: value }));
    }

    const themes = [
        { value: 'light' as const, label: 'Light', icon: SunIcon },
        { value: 'dark' as const, label: 'Dark', icon: MoonIcon },
        { value: 'system' as const, label: 'System', icon: ComputerDesktopIcon },
    ];

    return (
        <div className="animate-fade-in" style={{ maxWidth: 700 }}>
            <div style={{ marginBottom: 32 }}>
                <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Settings</h1>
                <p className="text-secondary">Customize your QueryFlux experience</p>
            </div>

            {/* Theme */}
            <section className="card" style={{ marginBottom: 24 }}>
                <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <SunIcon style={{ width: 20, height: 20 }} />
                    Appearance
                </h2>

                <div className="form-group">
                    <label className="form-label">Theme</label>
                    <div style={{ display: 'flex', gap: 12 }}>
                        {themes.map(t => (
                            <button
                                key={t.value}
                                className={`btn ${theme === t.value ? 'btn-primary' : 'btn-secondary'}`}
                                onClick={() => setTheme(t.value)}
                                style={{ flex: 1 }}
                            >
                                <t.icon style={{ width: 18, height: 18 }} />
                                {t.label}
                            </button>
                        ))}
                    </div>
                </div>
            </section>

            {/* Editor */}
            <section className="card" style={{ marginBottom: 24 }}>
                <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <CodeBracketIcon style={{ width: 20, height: 20 }} />
                    Editor
                </h2>

                <div className="form-group">
                    <label className="form-label">Font Size</label>
                    <input
                        type="range"
                        min={10}
                        max={24}
                        value={settings.fontSize}
                        onChange={e => updateSetting('fontSize', parseInt(e.target.value))}
                        style={{ width: '100%' }}
                    />
                    <span className="text-muted" style={{ fontSize: 13 }}>{settings.fontSize}px</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                        <input
                            type="checkbox"
                            checked={settings.showLineNumbers}
                            onChange={e => updateSetting('showLineNumbers', e.target.checked)}
                        />
                        <span>Show line numbers</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                        <input
                            type="checkbox"
                            checked={settings.wordWrap}
                            onChange={e => updateSetting('wordWrap', e.target.checked)}
                        />
                        <span>Word wrap</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                        <input
                            type="checkbox"
                            checked={settings.autoSave}
                            onChange={e => updateSetting('autoSave', e.target.checked)}
                        />
                        <span>Auto-save queries</span>
                    </label>
                </div>
            </section>

            {/* Query Execution */}
            <section className="card" style={{ marginBottom: 24 }}>
                <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <ClockIcon style={{ width: 20, height: 20 }} />
                    Query Execution
                </h2>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div className="form-group">
                        <label className="form-label">Default Row Limit</label>
                        <input
                            type="number"
                            className="form-input"
                            value={settings.queryLimit}
                            onChange={e => updateSetting('queryLimit', parseInt(e.target.value))}
                            min={100}
                            max={100000}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Execution Timeout (seconds)</label>
                        <input
                            type="number"
                            className="form-input"
                            value={settings.executionTimeout}
                            onChange={e => updateSetting('executionTimeout', parseInt(e.target.value))}
                            min={5}
                            max={300}
                        />
                    </div>
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginTop: 8 }}>
                    <input
                        type="checkbox"
                        checked={settings.confirmBeforeExecute}
                        onChange={e => updateSetting('confirmBeforeExecute', e.target.checked)}
                    />
                    <span>Confirm before executing destructive queries (DELETE, DROP, TRUNCATE)</span>
                </label>
            </section>

            {/* Backend */}
            <section className="card" style={{ marginBottom: 24 }}>
                <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <ShieldCheckIcon style={{ width: 20, height: 20 }} />
                    Backend Connection
                </h2>

                <div className="form-group">
                    <label className="form-label">Backend API URL</label>
                    <input
                        type="text"
                        className="form-input"
                        value={backendUrl}
                        onChange={e => setBackendUrl(e.target.value)}
                        placeholder="http://localhost:8080"
                    />
                    <p className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>
                        The URL of the QueryFlux backend API server
                    </p>
                </div>
            </section>

            {/* Save */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                {saved && (
                    <span className="text-success" style={{ alignSelf: 'center' }}>
                        ✓ Settings saved
                    </span>
                )}
                <button className="btn btn-primary" onClick={handleSave}>
                    Save Settings
                </button>
            </div>
        </div>
    );
}
