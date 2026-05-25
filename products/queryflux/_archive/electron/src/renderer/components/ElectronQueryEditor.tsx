import React, { useState, useEffect } from "react";
import {
  Play,
  Save,
  Download,
  Upload,
  Trash2,
  Bot,
  Shield,
  Zap,
  Network,
  Clock,
  Bookmark,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { useElectronDatabase, QueryResult } from "../hooks";
import { useTheme } from "../contexts/ThemeContext";
import { useLanguage } from "../contexts/LanguageContext";
import { audioFeedback } from "../../utils/audioFeedback";
import "./ElectronQueryEditor.css";

interface ElectronQueryEditorProps {
  connectionId: string;
  connectionName: string;
  databaseType: string;
  onBack?: () => void;
}

interface QueryTab {
  id: string;
  title: string;
  query: string;
  results?: QueryResult;
  isRunning: boolean;
  isDirty: boolean;
}

export const ElectronQueryEditor: React.FC<ElectronQueryEditorProps> = ({
  connectionId,
  connectionName,
  databaseType,
  onBack,
}) => {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { executeQuery, isElectron, isLoading } = useElectronDatabase();

  const [tabs, setTabs] = useState<QueryTab[]>([
    {
      id: "1",
      title: "Query 1",
      query: "",
      isRunning: false,
      isDirty: false,
    },
  ]);

  const [activeTabId, setActiveTabId] = useState("1");
  const [showAI, setShowAI] = useState(false);
  const [showSchema, setShowSchema] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeTab = tabs.find((tab) => tab.id === activeTabId);

  useEffect(() => {
    if (!isElectron) {
      setError("Query execution is only available in the Electron desktop app");
    }
  }, [isElectron]);

  const createNewTab = () => {
    const newTab: QueryTab = {
      id: Date.now().toString(),
      title: `Query ${tabs.length + 1}`,
      query: "",
      isRunning: false,
      isDirty: false,
    };
    setTabs([...tabs, newTab]);
    setActiveTabId(newTab.id);
  };

  const closeTab = (tabId: string) => {
    if (tabs.length <= 1) return;

    const newTabs = tabs.filter((tab) => tab.id !== tabId);
    setTabs(newTabs);

    if (activeTabId === tabId) {
      setActiveTabId(newTabs[0].id);
    }
  };

  const updateTabQuery = (query: string) => {
    if (!activeTab) return;

    setTabs(
      tabs.map((tab) =>
        tab.id === activeTabId ? { ...tab, query, isDirty: true } : tab,
      ),
    );
  };

  const runQuery = async () => {
    if (!activeTab || !activeTab.query.trim() || !isElectron) return;

    // Update tab to running state
    setTabs(
      tabs.map((tab) =>
        tab.id === activeTabId ? { ...tab, isRunning: true } : tab,
      ),
    );

    setError(null);
    audioFeedback.queryExecute();

    try {
      const result = await executeQuery(connectionId, activeTab.query);

      setTabs(
        tabs.map((tab) =>
          tab.id === activeTabId
            ? { ...tab, results: result, isRunning: false, isDirty: false }
            : tab,
        ),
      );

      if (result.success) {
        audioFeedback.success();
      } else {
        audioFeedback.error();
        setError(result.error || "Query execution failed");
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Unknown error occurred";
      setError(errorMessage);
      audioFeedback.error();

      setTabs(
        tabs.map((tab) =>
          tab.id === activeTabId ? { ...tab, isRunning: false } : tab,
        ),
      );
    }
  };

  const saveQuery = async () => {
    if (!activeTab || !activeTab.query.trim()) return;

    // TODO: Implement save query functionality
    audioFeedback.click();
    setTabs(
      tabs.map((tab) =>
        tab.id === activeTabId ? { ...tab, isDirty: false } : tab,
      ),
    );
  };

  const clearQuery = () => {
    if (!activeTab) return;
    updateTabQuery("");
    setTabs(
      tabs.map((tab) =>
        tab.id === activeTabId ? { ...tab, results: undefined } : tab,
      ),
    );
  };

  const getDatabaseColor = () => {
    const colors: Record<string, string> = {
      postgresql: "#4169E1",
      mysql: "#F29111",
      mongodb: "#47A248",
      redis: "#DC382D",
      sqlite: "#003B57",
      sqlserver: "#CC2927",
      oracle: "#F80000",
      cassandra: "#1287B2",
    };
    return colors[databaseType] || theme.colors.accent;
  };

  const dbColor = getDatabaseColor();

  if (!isElectron) {
    return (
      <div className="flex-1 flex items-center justify-center glass-card rounded-2xl m-4">
        <div className="text-center p-8">
          <AlertCircle
            className="w-16 h-16 mx-auto mb-4"
            style={{ color: theme.colors.textSecondary }}
          />
          <h3
            className="text-xl font-semibold mb-2"
            style={{ color: theme.colors.text }}
          >
            Electron Required
          </h3>
          <p style={{ color: theme.colors.textSecondary }}>
            Query execution is only available in the Electron desktop app.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="electron-query-editor flex flex-col h-full">
      {/* Header */}
      <div
        className="flex items-center justify-between px-6 py-4 border-b shimmer glass-morphism-strong"
        style={{ borderColor: theme.colors.border }}
      >
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 rounded-lg glass-morphism hover-3d transition-all"
            >
              <span style={{ color: theme.colors.textSecondary }}>←</span>
            </button>
          )}
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center glow-effect floating-animation"
            style={{
              backgroundColor: dbColor + "20",
              boxShadow: `0 0 20px ${dbColor}40`,
            }}
          >
            <div
              className="w-6 h-6 flex items-center justify-center"
              style={{ color: dbColor }}
            >
              ●
            </div>
          </div>
          <div>
            <h2
              className="text-lg font-semibold"
              style={{ color: theme.colors.text }}
            >
              {connectionName}
            </h2>
            <p
              className="text-sm"
              style={{ color: theme.colors.textSecondary }}
            >
              {databaseType.toUpperCase()} • Active
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSaved(!showSaved)}
            className={`p-2 rounded-lg transition-all hover-3d ${showSaved ? "glass-morphism-strong glow-effect" : "glass-morphism"}`}
            title="Saved Queries"
          >
            <Bookmark
              className="w-4 h-4"
              style={{
                color: showSaved ? theme.colors.accent : theme.colors.text,
              }}
            />
          </button>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className={`p-2 rounded-lg transition-all hover-3d ${showHistory ? "glass-morphism-strong glow-effect" : "glass-morphism"}`}
            title="Query History"
          >
            <Clock
              className="w-4 h-4"
              style={{
                color: showHistory ? theme.colors.accent : theme.colors.text,
              }}
            />
          </button>
          <button
            onClick={() => setShowSchema(!showSchema)}
            className={`p-2 rounded-lg transition-all hover-3d ${showSchema ? "glass-morphism-strong glow-effect" : "glass-morphism"}`}
            title="Schema Visualization"
          >
            <Network
              className="w-4 h-4"
              style={{
                color: showSchema ? theme.colors.accent : theme.colors.text,
              }}
            />
          </button>
          <button
            onClick={() => setShowAI(!showAI)}
            className={`p-2 rounded-lg transition-all hover-3d ${showAI ? "glass-morphism-strong glow-effect" : "glass-morphism"}`}
            title="AI Assistant"
          >
            <Bot
              className="w-4 h-4"
              style={{
                color: showAI ? theme.colors.accent : theme.colors.text,
              }}
            />
          </button>
          <div className="w-px h-6 bg-white/10" />
          <button
            onClick={saveQuery}
            className="p-2 rounded-lg transition-all hover:opacity-70 glass-morphism"
            style={{ color: theme.colors.text }}
            title="Save Query"
            disabled={!activeTab?.query.trim()}
          >
            <Save className="w-4 h-4" />
          </button>
          <button
            className="p-2 rounded-lg transition-all hover:opacity-70 glass-morphism"
            style={{ color: theme.colors.text }}
            title="Import"
          >
            <Upload className="w-4 h-4" />
          </button>
          <button
            className="p-2 rounded-lg transition-all hover:opacity-70 glass-morphism"
            style={{ color: theme.colors.text }}
            title="Export"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={clearQuery}
            className="p-2 rounded-lg transition-all hover:opacity-70 glass-morphism"
            style={{ color: theme.colors.text }}
            title="Clear"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div
        className="flex items-center border-b glass-morphism-strong"
        style={{ borderColor: theme.colors.border }}
      >
        <div className="flex items-center flex-1 overflow-x-auto">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={`flex items-center px-4 py-2 border-r cursor-pointer transition-all hover-3d ${
                activeTabId === tab.id
                  ? "glass-morphism-strong"
                  : "glass-morphism"
              }`}
              style={{
                borderColor: theme.colors.border,
                backgroundColor:
                  activeTabId === tab.id ? `${dbColor}20` : "transparent",
              }}
              onClick={() => setActiveTabId(tab.id)}
            >
              <span
                className="text-sm font-medium mr-2"
                style={{ color: theme.colors.text }}
              >
                {tab.title}
              </span>
              {tab.isDirty && (
                <div
                  className="w-2 h-2 rounded-full mr-2"
                  style={{ backgroundColor: dbColor }}
                />
              )}
              {tab.isRunning && (
                <Loader2
                  className="w-3 h-3 mr-2 animate-spin"
                  style={{ color: dbColor }}
                />
              )}
              {tabs.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.id);
                  }}
                  className="ml-1 p-1 rounded hover:bg-white/10 transition-all"
                >
                  <span style={{ color: theme.colors.textSecondary }}>×</span>
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          onClick={createNewTab}
          className="px-3 py-2 glass-morphism hover-3d transition-all"
          style={{ color: theme.colors.text }}
        >
          + New Tab
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mx-6 mt-4 p-3 rounded-xl glass-card border border-red-500/30 bg-red-500/10">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400" />
            <span className="text-sm text-red-300">{error}</span>
          </div>
        </div>
      )}

      {/* Main Content */}
      {activeTab && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 flex flex-col min-h-0">
            {/* Query Editor Header */}
            <div
              className="flex items-center justify-between px-6 py-3 border-b glass-morphism-strong shimmer"
              style={{ borderColor: theme.colors.border }}
            >
              <h3
                className="text-sm font-semibold"
                style={{ color: theme.colors.text }}
              >
                Query Editor
              </h3>
              <button
                onClick={runQuery}
                disabled={
                  isElectron
                    ? isLoading ||
                      !activeTab.query.trim() ||
                      activeTab.isRunning
                    : true
                }
                className="flex items-center gap-2 px-4 py-2 text-white rounded-xl text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover-3d glow-effect"
                style={{
                  background: `linear-gradient(135deg, ${dbColor}, ${dbColor}dd)`,
                }}
              >
                {activeTab.isRunning ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Running...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    Run Query
                  </>
                )}
              </button>
            </div>

            {/* Query Editor */}
            <div
              className="flex-1 p-4 overflow-auto"
              style={{ backgroundColor: "transparent" }}
            >
              <textarea
                value={activeTab.query}
                onChange={(e) => updateTabQuery(e.target.value)}
                placeholder={`Enter your ${databaseType.toUpperCase()} query here...\n\nExample:\n${getQueryExample(databaseType)}`}
                className="w-full h-full p-4 font-mono text-sm border rounded-2xl focus:ring-2 outline-none resize-none glass-card"
                style={{
                  color: theme.colors.editorText,
                  backgroundColor: theme.colors.editorBg,
                  borderColor: theme.colors.border,
                }}
                disabled={!isElectron}
              />
            </div>
          </div>

          {/* Results */}
          {activeTab.results && (
            <div
              className="flex-1 flex flex-col min-h-0 border-t"
              style={{ borderColor: theme.colors.border }}
            >
              <div
                className="px-6 py-3 border-b glass-morphism-strong shimmer"
                style={{ borderColor: theme.colors.border }}
              >
                <h3
                  className="text-sm font-semibold"
                  style={{ color: theme.colors.text }}
                >
                  Results{" "}
                  {activeTab.results.data?.rowCount
                    ? `(${activeTab.results.data.rowCount} rows)`
                    : ""}
                  <span
                    className="ml-2 text-xs"
                    style={{ color: theme.colors.textSecondary }}
                  >
                    ({activeTab.results.executionTime}ms)
                  </span>
                </h3>
              </div>

              <div
                className="flex-1 overflow-auto p-4"
                style={{ backgroundColor: "transparent" }}
              >
                {activeTab.results.success && activeTab.results.data ? (
                  <div className="overflow-x-auto glass-card rounded-2xl">
                    <table className="w-full text-sm">
                      <thead>
                        <tr
                          className="border-b glass-morphism"
                          style={{ borderColor: theme.colors.border }}
                        >
                          {activeTab.results.data.columns.map((column) => (
                            <th
                              key={column}
                              className="px-4 py-3 text-left font-semibold whitespace-nowrap"
                              style={{ color: theme.colors.text }}
                            >
                              {column}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {activeTab.results.data.rows.map((row, idx) => (
                          <tr
                            key={idx}
                            className="border-b transition-all hover:opacity-80 hover-3d"
                            style={{ borderColor: theme.colors.border }}
                          >
                            {row.map((value: any, cellIdx) => (
                              <td
                                key={cellIdx}
                                className="px-4 py-3 whitespace-nowrap"
                                style={{ color: theme.colors.text }}
                              >
                                {value?.toString() ?? "NULL"}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <p style={{ color: theme.colors.textSecondary }}>
                      {activeTab.results.error || "No results to display"}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

function getQueryExample(databaseType: string): string {
  const examples: Record<string, string> = {
    postgresql: "SELECT * FROM users WHERE id = 1;",
    mysql: "SELECT * FROM users WHERE id = 1;",
    mongodb: "db.users.find({ id: 1 });",
    redis: "GET user:1",
    sqlite: "SELECT * FROM users WHERE id = 1;",
    sqlserver: "SELECT * FROM users WHERE id = 1;",
    oracle: "SELECT * FROM users WHERE id = 1;",
    cassandra: "SELECT * FROM users WHERE id = 1;",
  };
  return examples[databaseType] || "SELECT * FROM table_name LIMIT 10;";
}
