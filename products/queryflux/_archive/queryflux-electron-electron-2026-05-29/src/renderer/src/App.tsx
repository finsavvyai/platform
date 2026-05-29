import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { Dashboard } from './pages/Dashboard';
import { QueryEditor } from './pages/QueryEditor';
import { Connections } from './pages/Connections';
import { Settings } from './pages/Settings';
import { useTheme } from './hooks/useTheme';
import { useMenuEvents } from './hooks/useMenuEvents';

function App() {
    const { theme } = useTheme();
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

    // Handle menu events from main process
    useMenuEvents();

    return (
        <Router>
            <div className={`app ${theme}`}>
                <div className="app-container">
                    <Sidebar
                        collapsed={sidebarCollapsed}
                        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
                    />
                    <div className="main-content">
                        <Header />
                        <main className="page-content">
                            <Routes>
                                <Route path="/" element={<Dashboard />} />
                                <Route path="/query" element={<QueryEditor />} />
                                <Route path="/query/:connectionId" element={<QueryEditor />} />
                                <Route path="/connections" element={<Connections />} />
                                <Route path="/settings" element={<Settings />} />
                            </Routes>
                        </main>
                    </div>
                </div>
            </div>
        </Router>
    );
}

export default App;
