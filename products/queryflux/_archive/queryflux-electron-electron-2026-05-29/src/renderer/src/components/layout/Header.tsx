import { useState, useEffect } from 'react';
import { MagnifyingGlassIcon, BellIcon, UserCircleIcon } from '@heroicons/react/24/outline';

export function Header() {
    const [version, setVersion] = useState('');

    useEffect(() => {
        async function getVersion() {
            if (window.api?.app) {
                const v = await window.api.app.getVersion();
                setVersion(v);
            }
        }
        getVersion();
    }, []);

    return (
        <header className="header">
            <div className="header-search" style={{ position: 'relative' }}>
                <MagnifyingGlassIcon
                    style={{
                        width: 18,
                        height: 18,
                        position: 'absolute',
                        left: 12,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: 'var(--color-text-muted)'
                    }}
                />
                <input
                    type="text"
                    className="search-input"
                    placeholder="Search tables, queries..."
                />
            </div>

            <div style={{ flex: 1 }} />

            <button className="btn btn-ghost" style={{ padding: 8 }}>
                <BellIcon style={{ width: 20, height: 20 }} />
            </button>

            <button className="btn btn-ghost" style={{ padding: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                <UserCircleIcon style={{ width: 24, height: 24 }} />
                {version && (
                    <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                        v{version}
                    </span>
                )}
            </button>
        </header>
    );
}
