import React, { useState, useEffect } from "react";
import {
  Database,
  Sparkles,
  Settings,
  X,
  Maximize2,
  Minus,
  Monitor,
  Cpu,
  Shield,
  Zap,
} from "lucide-react";
import { ThemeProvider, useTheme } from "./contexts/ThemeContext";
import { LanguageProvider, useLanguage } from "./contexts/LanguageContext";
import { ElectronSidebar } from "./components/ElectronSidebar";
import { ElectronConnectionDialog } from "./components/ElectronConnectionDialog";
import { ElectronQueryEditor } from "./components/ElectronQueryEditor";
import ElectronMonitoringDashboard from "./components/ElectronMonitoringDashboard";
import {
  useElectronDatabase,
  useElectronStorage,
  useElectronUpdater,
} from "./hooks";
import "./App-Electron.css";

declare global {
  interface Window {
    electronAPI?: any;
  }
}

// Main app component with providers
export const AppElectron: React.FC = () => {
  return (
    <LanguageProvider>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </LanguageProvider>
  );
};

// Internal app content component
const AppContent: React.FC = () => {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { isElectron, connections, activeConnections, isLoading } =
    useElectronDatabase();
  const { getPreferences, setPreferences } = useElectronStorage();
  const { checkForUpdates, updateInfo } = useElectronUpdater();

  const [selectedConnectionId, setSelectedConnectionId] = useState<
    string | null
  >(null);
  const [isConnectionDialogOpen, setIsConnectionDialogOpen] = useState(false);
  const [activeView, setActiveView] = useState<"query" | "monitoring">("query");
  const [isMaximized, setIsMaximized] = useState(false);

  // Initialize app state
  useEffect(() => {
    if (isElectron) {
      // Load saved preferences
      loadSavedPreferences();

      // Check for updates
      checkForUpdates();

      // Listen for window state changes
      if (window.electronAPI?.app) {
        window.electronAPI.app.onMaximized(() => setIsMaximized(true));
        window.electronAPI.app.onUnmaximized(() => setIsMaximized(false));
      }
    }
  }, [isElectron]);

  const loadSavedPreferences = async () => {
    try {
      const prefs = await getPreferences();
      if (prefs?.lastConnectionId) {
        setSelectedConnectionId(prefs.lastConnectionId);
      }
      if (prefs?.defaultView) {
        setActiveView(prefs.defaultView);
      }
    } catch (error) {
      console.error("Failed to load preferences:", error);
    }
  };

  const savePreferences = async (prefs: any) => {
    try {
      await setPreferences(prefs);
    } catch (error) {
      console.error("Failed to save preferences:", error);
    }
  };

  // Handle window controls
  const handleMinimize = () => {
    window.electronAPI?.app?.minimize();
  };

  const handleMaximize = () => {
    window.electronAPI?.app?.maximize();
  };

  const handleClose = () => {
    window.electronAPI?.app?.quit();
  };

  // Handle connection selection
  const handleConnectionSelect = (connectionId: string) => {
    setSelectedConnectionId(connectionId);
    savePreferences({ lastConnectionId: connectionId });
  };

  // Handle connection creation
  const handleConnectionCreated = (connection: any) => {
    setIsConnectionDialogOpen(false);
    setSelectedConnectionId(connection.id);
    savePreferences({ lastConnectionId: connection.id });
  };

  // Handle view change
  const handleViewChange = (view: "query" | "monitoring") => {
    setActiveView(view);
    savePreferences({ defaultView: view });
  };

  if (!isElectron) {
    return <ElectronRequiredView />;
  }

  const selectedConnection = connections.find(
    (c) => c.id === selectedConnectionId,
  );
  const isActiveConnection = activeConnections.some(
    (ac) => ac.id === selectedConnectionId,
  );

  return (
    <div className="app-electron" data-theme={theme.name}>
      {/* Custom Title Bar */}
      <div
        className="title-bar electron-drag-region"
        style={{
          backgroundColor: theme.colors.foreground,
          borderColor: theme.colors.border,
        }}
      >
        <div className="title-bar-left">
          <Database
            className="title-bar-icon"
            style={{ color: theme.colors.accent }}
          />
          <span
            className="title-bar-title"
            style={{ color: theme.colors.text }}
          >
            QueryFlux
          </span>
          {selectedConnectionId && isActiveConnection && (
            <span
              className="title-bar-status"
              style={{ color: theme.colors.accent }}
            >
              • Connected to {selectedConnection?.name}
            </span>
          )}
          {updateInfo?.available && (
            <span
              className="title-bar-update"
              style={{ color: theme.colors.accent }}
            >
              Update Available
            </span>
          )}
        </div>
        <div className="title-bar-right electron-no-drag">
          <button
            className="title-bar-button"
            onClick={handleMinimize}
            style={{ color: theme.colors.textSecondary }}
          >
            <Minus size={14} />
          </button>
          <button
            className="title-bar-button"
            onClick={handleMaximize}
            style={{ color: theme.colors.textSecondary }}
          >
            <Maximize2 size={14} />
          </button>
          <button
            className="title-bar-button close"
            onClick={handleClose}
            style={{ color: theme.colors.textSecondary }}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Main Layout */}
      <div
        className="app-layout"
        style={{ backgroundColor: theme.colors.background }}
      >
        {/* Sidebar */}
        <ElectronSidebar
          selectedConnectionId={selectedConnectionId}
          activeView={activeView}
          onConnectionSelect={handleConnectionSelect}
          onViewChange={handleViewChange}
          onNewConnection={() => setIsConnectionDialogOpen(true)}
          onOpenSettings={() => window.electronAPI?.app?.openSettings?.()}
        />

        {/* Main Content */}
        <div
          className="main-content"
          style={{ backgroundColor: theme.colors.background }}
        >
          {selectedConnectionId ? (
            <>
              {activeView === "query" ? (
                <ElectronQueryEditor
                  connectionId={selectedConnectionId}
                  connectionName={selectedConnection?.name || "Unknown"}
                  databaseType={selectedConnection?.type || "postgresql"}
                  onBack={() => setSelectedConnectionId(null)}
                />
              ) : (
                <ElectronMonitoringDashboard
                  connectionId={selectedConnectionId}
                  connectionName={selectedConnection?.name || "Unknown"}
                  databaseType={selectedConnection?.type || "postgresql"}
                />
              )}
            </>
          ) : (
            <WelcomeScreen
              onNewConnection={() => setIsConnectionDialogOpen(true)}
              theme={theme}
              t={t}
            />
          )}
        </div>
      </div>

      {/* Connection Dialog */}
      <ElectronConnectionDialog
        isOpen={isConnectionDialogOpen}
        onClose={() => setIsConnectionDialogOpen(false)}
        onConnect={handleConnectionCreated}
      />

      {/* Loading Overlay */}
      {isLoading && (
        <div className="loading-overlay">
          <div className="loading-spinner" />
          <p style={{ color: theme.colors.text }}>Loading...</p>
        </div>
      )}
    </div>
  );
};

// Welcome screen component
const WelcomeScreen: React.FC<{
  onNewConnection: () => void;
  theme: any;
  t: (key: string) => string;
}> = ({ onNewConnection, theme, t }) => {
  return (
    <div
      className="welcome-screen"
      style={{ backgroundColor: theme.colors.background }}
    >
      <div className="welcome-content">
        <div className="welcome-header">
          <div
            className="welcome-icon"
            style={{
              backgroundColor: theme.colors.accent + "20",
              boxShadow: `0 0 30px ${theme.colors.accent}40`,
            }}
          >
            <Database size={64} style={{ color: theme.colors.accent }} />
          </div>
          <h1 style={{ color: theme.colors.text }}>
            Welcome to QueryFlux Desktop
          </h1>
          <p style={{ color: theme.colors.textSecondary }}>
            Connect to your databases and start querying with AI-powered
            assistance
          </p>
        </div>

        <div className="welcome-actions">
          <button
            className="btn btn-primary btn-lg glass-morphism hover-3d glow-effect"
            onClick={onNewConnection}
            style={{
              background: `linear-gradient(135deg, ${theme.colors.accent}, ${theme.colors.accentHover})`,
              color: "white",
            }}
          >
            <Database size={20} className="mr-2" />
            Create Your First Connection
          </button>
          <button
            className="btn btn-outline btn-lg glass-morphism hover-3d"
            style={{
              color: theme.colors.text,
              borderColor: theme.colors.border,
            }}
          >
            <Sparkles size={16} className="mr-2" />
            Try AI Assistant
          </button>
        </div>

        <div className="welcome-features">
          <div className="feature-card glass-card hover-3d">
            <div className="feature-icon">
              <Cpu style={{ color: theme.colors.accent }} />
            </div>
            <h3 style={{ color: theme.colors.text }}>Multi-Database Support</h3>
            <p style={{ color: theme.colors.textSecondary }}>
              Connect to PostgreSQL, MySQL, MongoDB, Redis, SQLite, and more
            </p>
          </div>

          <div className="feature-card glass-card hover-3d">
            <div className="feature-icon">
              <Sparkles style={{ color: theme.colors.accent }} />
            </div>
            <h3 style={{ color: theme.colors.text }}>AI-Powered Queries</h3>
            <p style={{ color: theme.colors.textSecondary }}>
              Convert natural language to SQL and optimize your queries
            </p>
          </div>

          <div className="feature-card glass-card hover-3d">
            <div className="feature-icon">
              <Shield style={{ color: theme.colors.accent }} />
            </div>
            <h3 style={{ color: theme.colors.text }}>Local & Secure</h3>
            <p style={{ color: theme.colors.textSecondary }}>
              Your data stays on your device with enterprise-grade encryption
            </p>
          </div>

          <div className="feature-card glass-card hover-3d">
            <div className="feature-icon">
              <Monitor style={{ color: theme.colors.accent }} />
            </div>
            <h3 style={{ color: theme.colors.text }}>Real-time Monitoring</h3>
            <p style={{ color: theme.colors.textSecondary }}>
              Monitor query performance and database health in real-time
            </p>
          </div>

          <div className="feature-card glass-card hover-3d">
            <div className="feature-icon">
              <Zap style={{ color: theme.colors.accent }} />
            </div>
            <h3 style={{ color: theme.colors.text }}>Lightning Fast</h3>
            <p style={{ color: theme.colors.textSecondary }}>
              Native performance with direct database connections
            </p>
          </div>

          <div className="feature-card glass-card hover-3d">
            <div className="feature-icon">
              <Settings style={{ color: theme.colors.accent }} />
            </div>
            <h3 style={{ color: theme.colors.text }}>Highly Customizable</h3>
            <p style={{ color: theme.colors.textSecondary }}>
              Themes, shortcuts, and workflows tailored to your needs
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Component shown when not running in Electron
const ElectronRequiredView: React.FC = () => {
  return (
    <div className="electron-required-view">
      <div className="electron-required-content">
        <Database size={64} />
        <h1>Desktop Application Required</h1>
        <p>
          This version of QueryFlux requires the desktop application for full
          functionality.
        </p>

        <div className="electron-only-features">
          <h3>Desktop Features:</h3>
          <ul>
            <li>Direct database connections</li>
            <li>Local data storage</li>
            <li>AI-powered query assistance</li>
            <li>Real-time monitoring</li>
            <li>System integration</li>
            <li>Custom themes and shortcuts</li>
            <li>Advanced security features</li>
          </ul>
        </div>

        <button className="btn btn-primary">Download QueryFlux Desktop</button>
      </div>
    </div>
  );
};
