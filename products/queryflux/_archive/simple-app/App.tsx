import React, { useState, useEffect } from 'react';
import { Database, Plus, Play, Settings, BarChart3, Menu, X } from 'lucide-react';
import ConnectionForm from './src/components/ConnectionForm';
import DatabaseExplorer from './src/components/DatabaseExplorer';
import DataGrid from './src/components/DataGrid';

function App() {
  const [activeView, setActiveView] = useState<'connections' | 'explorer' | 'query' | 'dashboard'>('connections');
  const [selectedConnection, setSelectedConnection] = useState<any>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth < 768) {
        setIsSidebarOpen(false);
      } else {
        setIsSidebarOpen(true);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const renderSidebar = () => {
    if (isMobile && !isSidebarOpen) {
      return null;
    }

    return (
      <nav
        role="navigation"
        aria-label="Main navigation"
        style={{
          position: isMobile ? 'fixed' : 'relative',
          top: 0,
          left: 0,
          width: isMobile ? '100%' : '250px',
          height: isMobile ? '100vh' : '100vh',
          backgroundColor: '#1e293b',
          color: 'white',
          padding: isMobile ? '20px' : '20px',
          zIndex: isMobile ? 1000 : 1,
          display: 'flex',
          flexDirection: 'column',
          transform: isMobile && !isSidebarOpen ? 'translateX(-100%)' : 'translateX(0)',
          transition: 'transform 0.3s ease-in-out'
        }}
      >
        {isMobile && (
          <button
            aria-label="Close sidebar navigation"
            onClick={() => setIsSidebarOpen(false)}
            style={{
              position: 'absolute',
              top: '10px',
              right: '10px',
              backgroundColor: 'transparent',
              border: 'none',
              color: 'white',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '4px'
            }}
          >
            <X size={24} />
          </button>
        )}

        <header style={{
          display: 'flex',
          alignItems: 'center',
          marginBottom: '30px',
          justifyContent: isMobile ? 'center' : 'flex-start'
        }}>
          <Database size={isMobile ? 28 : 32} style={{ marginRight: '10px', color: '#8B5CF6' }} aria-hidden="true" />
          <h1 style={{
            margin: 0,
            fontSize: isMobile ? '1.3em' : '1.5em',
            textAlign: 'center'
          }}>QueryFlux</h1>
        </header>

      <ul style={{
        listStyle: 'none',
        margin: 0,
        padding: 0,
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      }}>
        <li>
          <button
            onClick={() => {
              setActiveView('connections');
              if (isMobile) setIsSidebarOpen(false);
            }}
            aria-current={activeView === 'connections' ? 'page' : undefined}
            aria-label="Navigate to database connections"
            style={{
              width: '100%',
              padding: isMobile ? '16px' : '12px',
              backgroundColor: activeView === 'connections' ? '#8B5CF6' : 'transparent',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              fontSize: isMobile ? '16px' : '14px',
              minHeight: isMobile ? '50px' : 'auto',
              textAlign: 'left'
            }}
          >
            <Plus size={isMobile ? 20 : 16} style={{ marginRight: '8px' }} aria-hidden="true" />
            <span>Connections</span>
          </button>
        </li>

        <li>
          <button
            onClick={() => {
              setActiveView('explorer');
              if (isMobile) setIsSidebarOpen(false);
            }}
            aria-current={activeView === 'explorer' ? 'page' : undefined}
            aria-label="Navigate to database explorer"
            style={{
              width: '100%',
              padding: isMobile ? '16px' : '12px',
              backgroundColor: activeView === 'explorer' ? '#8B5CF6' : 'transparent',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              fontSize: isMobile ? '16px' : '14px',
              minHeight: isMobile ? '50px' : 'auto',
              textAlign: 'left'
            }}
          >
            <Database size={isMobile ? 20 : 16} style={{ marginRight: '8px' }} aria-hidden="true" />
            <span>Database Explorer</span>
          </button>
        </li>

        <li>
          <button
            onClick={() => {
              setActiveView('query');
              if (isMobile) setIsSidebarOpen(false);
            }}
            aria-current={activeView === 'query' ? 'page' : undefined}
            aria-label="Navigate to query editor"
            style={{
              width: '100%',
              padding: isMobile ? '16px' : '12px',
              backgroundColor: activeView === 'query' ? '#8B5CF6' : 'transparent',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              fontSize: isMobile ? '16px' : '14px',
              minHeight: isMobile ? '50px' : 'auto',
              textAlign: 'left'
            }}
          >
            <Play size={isMobile ? 20 : 16} style={{ marginRight: '8px' }} aria-hidden="true" />
            <span>Query Editor</span>
          </button>
        </li>

        <li>
          <button
            onClick={() => {
              setActiveView('dashboard');
              if (isMobile) setIsSidebarOpen(false);
            }}
            aria-current={activeView === 'dashboard' ? 'page' : undefined}
            aria-label="Navigate to monitoring dashboard"
            style={{
              width: '100%',
              padding: isMobile ? '16px' : '12px',
              backgroundColor: activeView === 'dashboard' ? '#8B5CF6' : 'transparent',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              fontSize: isMobile ? '16px' : '14px',
              minHeight: isMobile ? '50px' : 'auto',
              textAlign: 'left'
            }}
          >
            <BarChart3 size={isMobile ? 20 : 16} style={{ marginRight: '8px' }} aria-hidden="true" />
            <span>Dashboard</span>
          </button>
        </li>
      </ul>

      <footer>
        <button
          aria-label="Open application settings"
          style={{
            width: '100%',
            padding: isMobile ? '16px' : '12px',
            backgroundColor: 'transparent',
            color: '#94a3b8',
            border: '1px solid #334155',
            borderRadius: '6px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            fontSize: isMobile ? '16px' : '14px',
            minHeight: isMobile ? '50px' : 'auto',
            textAlign: 'left'
          }}
        >
          <Settings size={isMobile ? 20 : 16} style={{ marginRight: '8px' }} aria-hidden="true" />
          <span>Settings</span>
        </button>
      </footer>
    </nav>
  );

  const renderMainContent = () => (
    <div style={{
      flex: 1,
      padding: isMobile ? '15px' : '20px',
      backgroundColor: '#f8fafc',
      height: '100vh',
      overflow: 'auto',
      marginLeft: isMobile ? 0 : (isSidebarOpen ? '0' : '0')
    }}>
      {isMobile && (
        <header style={{
          display: 'flex',
          alignItems: 'center',
          marginBottom: '20px',
          padding: '10px 0'
        }}>
          <button
            onClick={() => setIsSidebarOpen(true)}
            aria-label="Open navigation menu"
            aria-expanded={isSidebarOpen}
            style={{
              padding: '8px',
              backgroundColor: '#8B5CF6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              marginRight: '15px',
              display: 'flex',
              alignItems: 'center',
              minHeight: '44px',
              minWidth: '44px'
            }}
          >
            <Menu size={20} />
          </button>
          <h2 style={{ margin: 0, color: '#1e293b', fontSize: '1.2em' }}>QueryFlux</h2>
        </header>
      )}

      {activeView === 'connections' && (
        <div>
          <h2 style={{ color: '#1e293b', marginBottom: '20px', fontSize: isMobile ? '1.3em' : '1.5em' }}>
            {isMobile ? '' : 'Database '}Connections
          </h2>
          <div style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}>
            <ConnectionForm />
          </div>
        </div>
      )}

      {activeView === 'explorer' && (
        <div>
          <h2 style={{ color: '#1e293b', marginBottom: '20px' }}>Database Explorer</h2>
          <div style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}>
            <DatabaseExplorer />
          </div>
        </div>
      )}

      {activeView === 'query' && (
        <div>
          <h2 style={{ color: '#1e293b', marginBottom: '20px' }}>Query Editor</h2>
          <div style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}>
            <p style={{ color: '#64748b', marginBottom: '20px' }}>
              Connect to a database first to start writing queries.
            </p>
            <div style={{
              border: '2px dashed #e2e8f0',
              borderRadius: '8px',
              padding: '40px',
              textAlign: 'center'
            }}>
              <Database size={48} style={{ color: '#cbd5e1', marginBottom: '10px' }} />
              <p style={{ color: '#94a3b8', margin: 0 }}>No active database connection</p>
              <button
                onClick={() => setActiveView('connections')}
                style={{
                  marginTop: '15px',
                  padding: '10px 20px',
                  backgroundColor: '#8B5CF6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                Create Connection
              </button>
            </div>
          </div>
        </div>
      )}

      {activeView === 'dashboard' && (
        <section aria-labelledby="dashboard-title">
          <h2 id="dashboard-title" style={{ color: '#1e293b', marginBottom: '20px' }}>Monitoring Dashboard</h2>
          <div style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}>
            <p style={{ color: '#64748b', marginBottom: '20px' }}>
              Real-time database monitoring and performance metrics.
            </p>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: '20px'
            }}>
              <article style={{
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '20px',
                textAlign: 'center',
                backgroundColor: '#f8fafc'
              }}>
                <h3 style={{ color: '#1e293b', marginBottom: '10px', fontSize: '1.1em' }}>Active Connections</h3>
                <div data-testid="active-connections" style={{ fontSize: '2em', fontWeight: 'bold', color: '#8B5CF6' }}>3</div>
                <p style={{ color: '#64748b', fontSize: '0.9em', marginTop: '5px' }}>PostgreSQL, MySQL, Redis</p>
              </article>
              <article style={{
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '20px',
                textAlign: 'center',
                backgroundColor: '#f8fafc'
              }}>
                <h3 style={{ color: '#1e293b', marginBottom: '10px', fontSize: '1.1em' }}>Queries Executed</h3>
                <div data-testid="queries-executed" style={{ fontSize: '2em', fontWeight: 'bold', color: '#10B981' }}>147</div>
                <p style={{ color: '#64748b', fontSize: '0.9em', marginTop: '5px' }}>Last 24 hours</p>
              </article>
              <article style={{
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '20px',
                textAlign: 'center',
                backgroundColor: '#f8fafc'
              }}>
                <h3 style={{ color: '#1e293b', marginBottom: '10px', fontSize: '1.1em' }}>Response Time</h3>
                <div data-testid="response-time" style={{ fontSize: '2em', fontWeight: 'bold', color: '#F59E0B' }}>23ms</div>
                <p style={{ color: '#64748b', fontSize: '0.9em', marginTop: '5px' }}>Average</p>
              </article>
            </div>

            <div style={{
              marginTop: '30px',
              padding: '20px',
              backgroundColor: '#f1f5f9',
              borderRadius: '8px',
              border: '1px solid #e2e8f0'
            }}>
              <h3 style={{ color: '#1e293b', marginBottom: '15px', fontSize: '1.1em' }}>System Status</h3>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '15px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    backgroundColor: '#10B981'
                  }}></div>
                  <span style={{ color: '#374151', fontSize: '0.9em' }}>PostgreSQL: Connected</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    backgroundColor: '#10B981'
                  }}></div>
                  <span style={{ color: '#374151', fontSize: '0.9em' }}>MySQL: Connected</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    backgroundColor: '#10B981'
                  }}></div>
                  <span style={{ color: '#374151', fontSize: '0.9em' }}>Redis: Connected</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    backgroundColor: '#F59E0B'
                  }}></div>
                  <span style={{ color: '#374151', fontSize: '0.9em' }}>MongoDB: Standby</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif', position: 'relative' }}>
      {renderSidebar()}

      <main
        role="main"
        aria-label="QueryFlux application main content"
        style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
      >
        {renderMainContent()}
      </main>

      {/* Mobile overlay */}
      {isMobile && isSidebarOpen && (
        <div
          role="button"
          tabIndex={0}
          aria-label="Close sidebar"
          onClick={() => setIsSidebarOpen(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setIsSidebarOpen(false);
            }
          }}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 999,
            cursor: 'pointer'
          }}
        />
      )}
    </div>
  );
}

export default App;