/**
 * Main Dashboard Layout Component
 * Provides the primary layout structure with sidebar navigation and main content area
 */
import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { StatusBar } from './StatusBar';
export const DashboardLayout = ({ children, user, layout, onLayoutChange, className = '', }) => {
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [activeTheme, setActiveTheme] = useState(layout?.theme || 'auto');
    const handleSidebarToggle = () => {
        const newCollapsedState = !sidebarCollapsed;
        setSidebarCollapsed(newCollapsedState);
        onLayoutChange?.({
            sidebar: {
                ...layout?.sidebar,
                collapsed: newCollapsedState,
            },
        });
    };
    const handleThemeChange = (theme) => {
        setActiveTheme(theme);
        onLayoutChange?.({ theme });
    };
    return (<div className={`dashboard-layout min-h-screen flex flex-col ${className}`}>
      {/* Status Bar */}
      <StatusBar user={user} theme={activeTheme} onThemeChange={handleThemeChange}/>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <Sidebar collapsed={sidebarCollapsed} onToggle={handleSidebarToggle} layout={layout}/>

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <Header user={user} onSidebarToggle={handleSidebarToggle} sidebarCollapsed={sidebarCollapsed}/>

          {/* Page Content */}
          <main className="flex-1 overflow-auto p-6 bg-gray-50 dark:bg-gray-900">
            <div className="max-w-full mx-auto">
              {children}
            </div>
          </main>
        </div>
      </div>

      {/* Global Styles */}
      <style jsx global>{`
        .dashboard-layout {
          --sidebar-width: 280px;
          --sidebar-collapsed-width: 64px;
          --header-height: 64px;
          --status-bar-height: 32px;
        }

        /* Theme transitions */
        * {
          transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease;
        }

        /* Scrollbar styling */
        ::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }

        ::-webkit-scrollbar-track {
          background: transparent;
        }

        ::-webkit-scrollbar-thumb {
          background: rgba(156, 163, 175, 0.3);
          border-radius: 3px;
        }

        ::-webkit-scrollbar-thumb:hover {
          background: rgba(156, 163, 175, 0.5);
        }

        /* Dark theme scrollbar */
        .dark ::-webkit-scrollbar-thumb {
          background: rgba(75, 85, 99, 0.3);
        }

        .dark ::-webkit-scrollbar-thumb:hover {
          background: rgba(75, 85, 99, 0.5);
        }

        /* Focus styles */
        *:focus {
          outline: 2px solid rgba(59, 130, 246, 0.5);
          outline-offset: 2px;
        }

        /* Animation utilities */
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes scaleIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        .animate-slide-in {
          animation: slideIn 0.3s ease-out;
        }

        .animate-fade-in {
          animation: fadeIn 0.2s ease-out;
        }

        .animate-scale-in {
          animation: scaleIn 0.2s ease-out;
        }
      `}</style>
    </div>);
};
//# sourceMappingURL=DashboardLayout.js.map