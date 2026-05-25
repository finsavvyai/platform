import React, { useState } from 'react';

export interface NavItem {
  label: string;
  href: string;
  icon?: string;
}

interface User {
  name: string;
  email: string;
  avatar?: string;
}

interface DashboardLayoutProps {
  children: React.ReactNode;
  navigation: NavItem[];
  user: User;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  children,
  navigation,
  user,
}) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    minHeight: '100vh',
    backgroundColor: '#F2F2F7',
    fontFamily: 'SF Pro Display, -apple-system, sans-serif',
  };

  const sidebarStyle: React.CSSProperties = {
    width: sidebarOpen ? '250px' : '0',
    backgroundColor: '#FFFFFF',
    borderRight: '1px solid #E5E5EA',
    transition: 'width 0.3s ease',
    overflow: 'hidden',
    padding: sidebarOpen ? '20px' : '0',
  };

  const navListStyle: React.CSSProperties = {
    listStyle: 'none',
    padding: 0,
    margin: 0,
  };

  const navItemStyle: React.CSSProperties = {
    padding: '12px 16px',
    marginBottom: '8px',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  };

  const mainStyle: React.CSSProperties = {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  };

  const headerStyle: React.CSSProperties = {
    backgroundColor: '#FFFFFF',
    borderBottom: '1px solid #E5E5EA',
    padding: '16px 24px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  };

  const contentStyle: React.CSSProperties = {
    flex: 1,
    padding: '24px',
    overflow: 'auto',
  };

  return (
    <div style={containerStyle}>
      <aside style={sidebarStyle} data-testid="sidebar">
        <nav>
          <ul style={navListStyle}>
            {navigation.map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  style={navItemStyle}
                  data-testid={`nav-${item.label}`}
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      <div style={mainStyle}>
        <header style={headerStyle} data-testid="header">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            data-testid="sidebar-toggle"
          >
            Menu
          </button>
          <div data-testid="user-info">
            <span>{user.name}</span>
          </div>
        </header>

        <main style={contentStyle} data-testid="content">
          {children}
        </main>
      </div>
    </div>
  );
};

DashboardLayout.displayName = 'DashboardLayout';
