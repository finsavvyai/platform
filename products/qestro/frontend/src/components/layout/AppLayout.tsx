import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

const AppLayout: React.FC = () => {
  return (
    <div
      className="min-h-screen flex transition-colors duration-300"
      style={{ backgroundColor: 'var(--bg-primary)' }}
    >
      {/* Sidebar - Fixed position */}
      <Sidebar />

      {/* Main Content Area - Offset for sidebar */}
      <div className="flex-1 flex flex-col min-h-screen md:ml-64">
        {/* Header */}
        <Header title="Qestro" />

        {/* Page Content */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto">
          <div className="px-6 lg:px-8 py-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
