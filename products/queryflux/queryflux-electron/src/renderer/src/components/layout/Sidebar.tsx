import { NavLink } from 'react-router-dom';
import {
    HomeIcon,
    CommandLineIcon,
    ServerStackIcon,
    Cog6ToothIcon,
    ChevronLeftIcon,
    ChevronRightIcon
} from '@heroicons/react/24/outline';

interface SidebarProps {
    collapsed: boolean;
    onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
    const navItems = [
        { path: '/', label: 'Dashboard', icon: HomeIcon },
        { path: '/query', label: 'Query Editor', icon: CommandLineIcon },
        { path: '/connections', label: 'Connections', icon: ServerStackIcon },
        { path: '/settings', label: 'Settings', icon: Cog6ToothIcon },
    ];

    return (
        <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
            <div className="sidebar-header">
                <svg className="sidebar-logo" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="50" cy="50" r="45" stroke="#6366f1" strokeWidth="3" fill="none" />
                    <circle cx="50" cy="30" r="8" fill="#6366f1" />
                    <circle cx="30" cy="60" r="8" fill="#818cf8" />
                    <circle cx="70" cy="60" r="8" fill="#818cf8" />
                    <path d="M50 38 L30 52" stroke="#6366f1" strokeWidth="2" />
                    <path d="M50 38 L70 52" stroke="#6366f1" strokeWidth="2" />
                    <path d="M30 60 L70 60" stroke="#818cf8" strokeWidth="2" />
                </svg>
                {!collapsed && <span className="sidebar-title">QueryFlux</span>}
            </div>

            <nav className="sidebar-nav">
                {navItems.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                    >
                        <item.icon className="nav-item-icon" />
                        {!collapsed && <span>{item.label}</span>}
                    </NavLink>
                ))}
            </nav>

            <div style={{ padding: '16px 12px', borderTop: '1px solid var(--color-border)' }}>
                <button
                    onClick={onToggle}
                    className="nav-item"
                    style={{ width: '100%', justifyContent: collapsed ? 'center' : 'flex-start' }}
                >
                    {collapsed ? (
                        <ChevronRightIcon className="nav-item-icon" />
                    ) : (
                        <>
                            <ChevronLeftIcon className="nav-item-icon" />
                            <span>Collapse</span>
                        </>
                    )}
                </button>
            </div>
        </aside>
    );
}
