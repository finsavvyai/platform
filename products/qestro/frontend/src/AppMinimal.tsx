/**
 * Enhanced TestQuality App Component
 * Interactive features and professional UI like TestQuality.com
 */

import React, { useState, useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";

// Navigation component
interface NavigationProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const Navigation: React.FC<NavigationProps> = ({ activeTab, setActiveTab }) => (
  <nav style={{
    backgroundColor: '#1e293b',
    color: 'white',
    padding: '0 24px',
    height: '64px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{
          width: '36px',
          height: '36px',
          background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontWeight: 'bold',
          fontSize: '18px'
        }}>
          Q
        </div>
        <div>
          <div style={{ fontWeight: 'bold', fontSize: '18px' }}>Qestro TestQuality</div>
          <div style={{ fontSize: '12px', color: '#94a3b8' }}>Enterprise Testing Platform</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '4px' }}>
        {['dashboard', 'projects', 'test-cases', 'test-runs', 'reports'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '8px 16px',
              backgroundColor: activeTab === tab ? '#3b82f6' : 'transparent',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: activeTab === tab ? '600' : '400',
              transition: 'all 0.2s'
            }}
          >
            {tab.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
          </button>
        ))}
      </div>
    </div>

    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
      <button style={{
        padding: '6px 12px',
        backgroundColor: '#22c55e',
        color: 'white',
        border: 'none',
        borderRadius: '6px',
        fontSize: '12px',
        cursor: 'pointer',
        fontWeight: '500'
      }}>
        ▶ Run Tests
      </button>
      <div style={{
        width: '8px',
        height: '8px',
        backgroundColor: '#22c55e',
        borderRadius: '50%',
        animation: 'pulse 2s infinite'
      }}></div>
    </div>
  </nav>
);

// Enhanced Dashboard with real-time features
const TestQualityDashboard: React.FC = () => {
  // State management for interactive features
  const [activeTab, setActiveTab] = useState('dashboard');
  const [projects, setProjects] = useState([
    { id: 1, name: 'E-commerce Platform', status: 'active', tests: 234, lastRun: '2 hours ago', health: 95 },
    { id: 2, name: 'Mobile Banking App', status: 'running', tests: 189, lastRun: '5 mins ago', health: 88 },
    { id: 3, name: 'API Gateway', status: 'failed', tests: 156, lastRun: '1 hour ago', health: 42 },
    { id: 4, name: 'Admin Dashboard', status: 'active', tests: 298, lastRun: '30 mins ago', health: 97 }
  ]);
  // const [selectedProject, setSelectedProject] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);
  const [testResults, setTestResults] = useState({
    total: 2341,
    passed: 2294,
    failed: 47,
    running: 8,
    skipped: 12
  });

  // Simulate real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      setTestResults(prev => ({
        ...prev,
        running: Math.max(0, prev.running + (Math.random() > 0.5 ? 1 : -1))
      }));
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />

      <div style={{ padding: '24px', backgroundColor: '#f8fafc', minHeight: 'calc(100vh - 64px)' }}>
        {/* Real-time Stats */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '20px',
          marginBottom: '32px'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '24px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            transition: 'transform 0.2s, box-shadow 0.2s'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <div style={{ color: '#22c55e', fontSize: '14px', fontWeight: '600', marginBottom: '4px' }}>
                  Total Tests
                </div>
                <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#1e293b' }}>
                  {testResults.total.toLocaleString()}
                </div>
              </div>
              <div style={{
                width: '48px',
                height: '48px',
                backgroundColor: '#22c55e',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '20px'
              }}>
                ✓
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
              <span style={{ color: '#22c55e' }}>{testResults.passed} Passed</span>
              <span style={{ color: '#ef4444' }}>{testResults.failed} Failed</span>
              <span style={{ color: '#f59e0b' }}>{testResults.running} Running</span>
            </div>
          </div>

          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '24px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <div style={{ color: '#3b82f6', fontSize: '14px', fontWeight: '600', marginBottom: '4px' }}>
                  Test Coverage
                </div>
                <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#1e293b' }}>94.2%</div>
              </div>
              <div style={{
                width: '48px',
                height: '48px',
                backgroundColor: '#3b82f6',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '20px'
              }}>
                📊
              </div>
            </div>
            <div style={{ backgroundColor: '#e2e8f0', borderRadius: '4px', height: '8px', overflow: 'hidden' }}>
              <div style={{
                width: '94.2%',
                height: '100%',
                backgroundColor: '#3b82f6',
                transition: 'width 1s ease'
              }}></div>
            </div>
          </div>

          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '24px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <div style={{ color: '#8b5cf6', fontSize: '14px', fontWeight: '600', marginBottom: '4px' }}>
                  Active Projects
                </div>
                <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#1e293b' }}>{projects.length}</div>
              </div>
              <div style={{
                width: '48px',
                height: '48px',
                backgroundColor: '#8b5cf6',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '20px'
              }}>
                📁
              </div>
            </div>
            <div style={{ fontSize: '14px', color: '#64748b' }}>
              {projects.filter(p => p.status === 'running').length} running tests
            </div>
          </div>

          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '24px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <div style={{ color: '#f59e0b', fontSize: '14px', fontWeight: '600', marginBottom: '4px' }}>
                  Avg Duration
                </div>
                <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#1e293b' }}>2.4s</div>
              </div>
              <div style={{
                width: '48px',
                height: '48px',
                backgroundColor: '#f59e0b',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '20px'
              }}>
                ⏱️
              </div>
            </div>
            <div style={{ fontSize: '14px', color: '#64748b' }}>
              15% faster than last week
            </div>
          </div>
        </div>

        {/* Interactive Projects Table */}
        <div style={{
          background: 'white',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          overflow: 'hidden'
        }}>
          <div style={{
            padding: '20px 24px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: '#1e293b' }}>
              Active Projects
            </h2>
            <button
              onClick={() => setShowModal(true)}
              style={{
                padding: '8px 16px',
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                cursor: 'pointer',
                fontWeight: '500'
              }}
            >
              + New Project
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '12px 24px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748b' }}>PROJECT</th>
                  <th style={{ padding: '12px 24px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748b' }}>STATUS</th>
                  <th style={{ padding: '12px 24px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748b' }}>TESTS</th>
                  <th style={{ padding: '12px 24px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748b' }}>HEALTH</th>
                  <th style={{ padding: '12px 24px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748b' }}>LAST RUN</th>
                  <th style={{ padding: '12px 24px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748b' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {projects.map(project => (
                  <tr
                    key={project.id}
                    style={{
                      borderBottom: '1px solid #e2e8f0',
                      cursor: 'pointer',
                      transition: 'backgroundColor 0.2s'
                    }}
                    // onClick={() => setSelectedProject(project)}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <td style={{ padding: '16px 24px' }}>
                      <div>
                        <div style={{ fontWeight: '600', color: '#1e293b', marginBottom: '4px' }}>{project.name}</div>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>ID: PRJ-{project.id.toString().padStart(4, '0')}</div>
                      </div>
                    </td>
                    <td style={{ padding: '16px 24px' }}>
                      <span style={{
                        padding: '4px 8px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: '500',
                        backgroundColor:
                          project.status === 'active' ? '#dcfce7' :
                            project.status === 'running' ? '#fef3c7' :
                              '#fee2e2',
                        color:
                          project.status === 'active' ? '#166534' :
                            project.status === 'running' ? '#92400e' :
                              '#991b1b'
                      }}>
                        {project.status.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '16px 24px', color: '#1e293b', fontWeight: '500' }}>
                      {project.tests}
                    </td>
                    <td style={{ padding: '16px 24px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          background: `conic-gradient(#3b82f6 ${project.health * 3.6}deg, #e2e8f0 0deg)`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '12px',
                          fontWeight: '600'
                        }}>
                          <div style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            backgroundColor: 'white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            {project.health}%
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '16px 24px', color: '#64748b', fontSize: '14px' }}>
                      {project.lastRun}
                    </td>
                    <td style={{ padding: '16px 24px' }}>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            // Run tests for this project
                            const updatedProjects = projects.map(p =>
                              p.id === project.id ? { ...p, status: 'running' } : p
                            );
                            setProjects(updatedProjects);
                          }}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: '#3b82f6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            fontSize: '12px',
                            cursor: 'pointer'
                          }}
                        >
                          Run
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            // View project details
                          }}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: '#f1f5f9',
                            color: '#475569',
                            border: '1px solid #e2e8f0',
                            borderRadius: '4px',
                            fontSize: '12px',
                            cursor: 'pointer'
                          }}
                        >
                          View
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal for new project */}
      {showModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '24px',
            width: '90%',
            maxWidth: '500px',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '20px', fontWeight: '600', color: '#1e293b' }}>
              Create New Project
            </h3>
            <input
              type="text"
              placeholder="Project Name"
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                fontSize: '14px',
                marginBottom: '16px'
              }}
            />
            <textarea
              placeholder="Description (optional)"
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                fontSize: '14px',
                marginBottom: '16px',
                minHeight: '80px',
                resize: 'vertical'
              }}
            />
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#f1f5f9',
                  color: '#475569',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  // Add new project logic here
                  setShowModal(false);
                }}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                Create Project
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const AppMinimal: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/test-quality/dashboard" replace />} />
      <Route path="/test-quality/dashboard" element={<TestQualityDashboard />} />
      <Route path="/test-quality/projects" element={<TestQualityDashboard />} />
      <Route path="/test-quality/test-cases" element={<TestQualityDashboard />} />
      <Route path="/test-quality/test-scenarios" element={<TestQualityDashboard />} />
      <Route path="/test-quality/requirements" element={<TestQualityDashboard />} />
      <Route path="/test-quality/team" element={<TestQualityDashboard />} />
      <Route path="/test-quality/*" element={<TestQualityDashboard />} />
    </Routes>
  );
};

export default AppMinimal;