/**
 * Header Component
 * Provides the main header with breadcrumbs, search, and user actions
 */
import React, { useState } from 'react';
import { SearchBox } from './SearchBox';
import { NotificationCenter } from './NotificationCenter';
import { UserMenu } from './UserMenu';
export const Header = ({ user, onSidebarToggle, sidebarCollapsed, className = '', }) => {
    const [searchOpen, setSearchOpen] = useState(false);
    const [notificationsOpen, setNotificationsOpen] = useState(false);
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    // Mock breadcrumbs - this would be dynamic based on current route
    const breadcrumbs = [
        { label: 'Dashboard', href: '/', icon: '🏠' },
        { label: 'Products', href: '/products' },
        { label: 'SDLC Pipeline', href: '/products/sdlc' },
    ];
    const handleSearchToggle = () => {
        setSearchOpen(!searchOpen);
    };
    const handleNotificationsToggle = () => {
        setNotificationsOpen(!notificationsOpen);
        setUserMenuOpen(false);
    };
    const handleUserMenuToggle = () => {
        setUserMenuOpen(!userMenuOpen);
        setNotificationsOpen(false);
    };
    const handleKeyDown = (e) => {
        // Global keyboard shortcuts
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
            e.preventDefault();
            handleSearchToggle();
        }
    };
    React.useEffect(() => {
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [searchOpen]);
    return (<>
      <header className={`
        h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700
        flex items-center justify-between px-6 z-10
        ${className}
      `}>
        {/* Left Section */}
        <div className="flex items-center space-x-4">
          {/* Mobile Sidebar Toggle */}
          <button onClick={onSidebarToggle} className="lg:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors" aria-label="Toggle sidebar">
            <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/>
            </svg>
          </button>

          {/* Breadcrumbs */}
          <nav className="hidden md:flex items-center space-x-2">
            {breadcrumbs.map((breadcrumb, index) => (<React.Fragment key={index}>
                {index > 0 && (<svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd"/>
                  </svg>)}
                {breadcrumb.href ? (<a href={breadcrumb.href} className="flex items-center space-x-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors">
                    {breadcrumb.icon && <span>{breadcrumb.icon}</span>}
                    <span>{breadcrumb.label}</span>
                  </a>) : (<div className="flex items-center space-x-1 text-sm font-medium text-gray-900 dark:text-white">
                    {breadcrumb.icon && <span>{breadcrumb.icon}</span>}
                    <span>{breadcrumb.label}</span>
                  </div>)}
              </React.Fragment>))}
          </nav>
        </div>

        {/* Center Section - Search */}
        <div className="flex-1 max-w-2xl mx-8">
          <SearchBox expanded={searchOpen} onToggle={handleSearchToggle} placeholder="Search products, pipelines, documentation..." className="w-full"/>
        </div>

        {/* Right Section */}
        <div className="flex items-center space-x-3">
          {/* Quick Actions */}
          <div className="hidden sm:flex items-center space-x-1">
            <button className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group relative" title="New Pipeline">
              <svg className="w-5 h-5 text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
              </svg>
              <span className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 px-2 py-1 text-xs bg-gray-900 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                New Pipeline
              </span>
            </button>

            <button className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group relative" title="AI Assistant">
              <span className="text-lg">🤖</span>
              <span className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 px-2 py-1 text-xs bg-gray-900 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                AI Assistant
              </span>
            </button>
          </div>

          {/* Notifications */}
          <NotificationCenter open={notificationsOpen} onToggle={handleNotificationsToggle} user={user}/>

          {/* User Menu */}
          <UserMenu open={userMenuOpen} onToggle={handleUserMenuToggle} user={user}/>
        </div>
      </header>

      {/* Global Search Overlay */}
      {searchOpen && (<div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-start justify-center pt-20">
          <div className="w-full max-w-4xl mx-4">
            <SearchBox expanded autoFocus onToggle={handleSearchToggle} placeholder="Search products, pipelines, documentation, and more..." className="w-full shadow-2xl"/>
          </div>
          <div className="absolute inset-0" onClick={handleSearchToggle}/>
        </div>)}
    </>);
};
//# sourceMappingURL=Header.js.map