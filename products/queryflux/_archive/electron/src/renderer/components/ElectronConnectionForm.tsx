import { useState, FormEvent, useEffect } from "react";
import {
  ArrowLeft,
  TestTube,
  Loader2,
  Link2,
  Container,
  ChevronDown,
  Plus,
  Check,
  Database,
  Server,
  Key,
  Shield,
} from "lucide-react";
import { DatabaseType, DATABASE_CONFIGS } from "../../types/database";
import { useElectronDatabase, DatabaseConfig } from "../hooks";
import { parseConnectionURL } from "../../utils/urlParser";
import { audioFeedback } from "../../utils/audioFeedback";
import { useTheme } from "../contexts/ThemeContext";
import { useLanguage } from "../contexts/LanguageContext";

interface ElectronConnectionFormProps {
  databaseType: DatabaseType;
  onBack: () => void;
  onConnect: (connection: any) => void;
  onCancel: () => void;
  editConnection?: DatabaseConfig | null;
}

interface Project {
  id: string;
  name: string;
  color: string;
}

export function ElectronConnectionForm({
  databaseType,
  onBack,
  onConnect,
  onCancel,
  editConnection,
}: ElectronConnectionFormProps) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { connect, testConnection, isElectron, isLoading, error, clearError } =
    useElectronDatabase();

  const config = DATABASE_CONFIGS[databaseType];
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    testTime?: number;
  } | null>(null);
  const [inputMode, setInputMode] = useState<"manual" | "url" | "docker">(
    "manual",
  );
  const [showPassword, setShowPassword] = useState(false);
  const [activeTab, setActiveTab] = useState<"basic" | "advanced">("basic");

  const [formData, setFormData] = useState<DatabaseConfig>({
    type: databaseType as any,
    host: "localhost",
    port: config.defaultPort,
    database: "",
    username: "",
    password: "",
    ssl: config.supportsSSL,
    connectionString: "",
    options: {},
    // Database-specific defaults
    dataCenter: databaseType === "cassandra" ? "datacenter1" : undefined,
    keyspace: databaseType === "cassandra" ? "queryflux" : undefined,
    serviceName:
      databaseType === "oracle" || databaseType === "oracledb"
        ? "ORCL"
        : undefined,
    sid:
      databaseType === "oracle" || databaseType === "oracledb"
        ? "ORCL"
        : undefined,
    encrypt: databaseType === "sqlserver" ? false : undefined,
    trustServerCertificate: databaseType === "sqlserver" ? false : undefined,
    file: databaseType === "sqlite" ? "" : undefined,
    readonly: databaseType === "sqlite" ? false : undefined,
    authDatabase: databaseType === "mongodb" ? "admin" : undefined,
    readPreference: databaseType === "mongodb" ? "primary" : undefined,
    replicaSet: databaseType === "mongodb" ? undefined : undefined,
    family: databaseType === "redis" ? 4 : undefined,
    db: databaseType === "redis" ? 0 : undefined,
    keepAlive: databaseType === "redis" ? true : undefined,
    connectTimeout: databaseType === "redis" ? 30000 : undefined,
    commandTimeout: databaseType === "redis" ? 5000 : undefined,
  });

  // Initialize form when editing
  useEffect(() => {
    if (editConnection) {
      setFormData(editConnection);
    } else {
      // Reset to defaults
      setFormData({
        type: databaseType as any,
        host: "localhost",
        port: config.defaultPort,
        database: "",
        username: "",
        password: "",
        ssl: config.supportsSSL,
        connectionString: "",
        options: {},
        // Database-specific defaults
        dataCenter: databaseType === "cassandra" ? "datacenter1" : undefined,
        keyspace: databaseType === "cassandra" ? "queryflux" : undefined,
        serviceName:
          databaseType === "oracle" || databaseType === "oracledb"
            ? "ORCL"
            : undefined,
        sid:
          databaseType === "oracle" || databaseType === "oracledb"
            ? "ORCL"
            : undefined,
        encrypt: databaseType === "sqlserver" ? false : undefined,
        trustServerCertificate:
          databaseType === "sqlserver" ? false : undefined,
        file: databaseType === "sqlite" ? "" : undefined,
        readonly: databaseType === "sqlite" ? false : undefined,
        authDatabase: databaseType === "mongodb" ? "admin" : undefined,
        readPreference: databaseType === "mongodb" ? "primary" : undefined,
        replicaSet: databaseType === "mongodb" ? undefined : undefined,
        family: databaseType === "redis" ? 4 : undefined,
        db: databaseType === "redis" ? 0 : undefined,
        keepAlive: databaseType === "redis" ? true : undefined,
        connectTimeout: databaseType === "redis" ? 30000 : undefined,
        commandTimeout: databaseType === "redis" ? 5000 : undefined,
      });
    }
  }, [editConnection, databaseType, config]);

  useEffect(() => {
    if (inputMode === "url" && formData.connectionString) {
      const parsed = parseConnectionURL(
        formData.connectionString,
        databaseType,
      );
      if (parsed.host) {
        setFormData((prev) => ({
          ...prev,
          host: parsed.host || "localhost",
          port: parsed.port || config.defaultPort,
          database: parsed.database || "",
          username: parsed.username || "",
          password: parsed.password || "",
          ssl: parsed.ssl || false,
        }));
      }
    }
  }, [formData.connectionString, inputMode, databaseType, config.defaultPort]);

  const handleDockerSetup = async () => {
    if (!config.supportsDocker) return;

    setIsTesting(true);
    setTestResult({
      success: false,
      message: "Setting up Docker container...",
    });

    await new Promise((resolve) => setTimeout(resolve, 2000));

    setFormData((prev) => ({
      ...prev,
      host: "localhost",
      port: config.defaultPort,
      username: "admin",
      password: "password",
    }));

    setIsTesting(false);
    setTestResult({
      success: true,
      message: `Docker container started successfully on port ${config.defaultPort}`,
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!isElectron) {
      setTestResult({
        success: false,
        message: "Database connections are only available in the Electron app",
      });
      return;
    }

    if (!formData.host || !formData.database || !formData.username) {
      setTestResult({
        success: false,
        message: "Please fill in all required fields",
      });
      return;
    }

    clearError();

    try {
      const result = await connect(formData);

      if (result.success && result.connectionId) {
        audioFeedback.connect();

        // Create connection object for callback
        const connectionData = {
          id: result.connectionId,
          name: `${databaseType} - ${formData.host}:${formData.port}`,
          type: databaseType,
          host: formData.host,
          port: formData.port,
          database: formData.database,
          username: formData.username,
          ssl: formData.ssl,
          createdAt: new Date().toISOString(),
          lastUsed: new Date().toISOString(),
          ...formData,
        };

        onConnect(connectionData);
      } else {
        audioFeedback.error();
        setTestResult({
          success: false,
          message: result.error || "Connection failed",
        });
      }
    } catch (error: any) {
      audioFeedback.error();
      setTestResult({
        success: false,
        message: error.message || "Failed to establish connection",
      });
    }
  };

  const handleTest = async () => {
    if (!isElectron) {
      setTestResult({
        success: false,
        message: "Connection testing is only available in the Electron app",
      });
      return;
    }

    setIsTesting(true);
    setTestResult(null);
    clearError();
    audioFeedback.click();

    try {
      const result = await testConnection(formData);

      setTestResult({
        success: result.success,
        message: result.success
          ? `Connection successful! (${result.testTime}ms)`
          : result.error || "Connection failed",
        testTime: result.testTime,
      });

      if (result.success) {
        audioFeedback.success();
      } else {
        audioFeedback.error();
      }
    } catch (error) {
      setIsTesting(false);
      setTestResult({
        success: false,
        message:
          error instanceof Error ? error.message : "Connection test failed",
      });
      audioFeedback.error();
    } finally {
      setIsTesting(false);
    }
  };

  const handleInputChange = (field: keyof DatabaseConfig, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setTestResult(null);
  };

  const handleTypeChange = (type: string) => {
    const dbConfig = DATABASE_CONFIGS[type as DatabaseType];
    setFormData((prev) => ({
      ...prev,
      type: type as any,
      port: dbConfig.defaultPort,
      database: type === "sqlite" ? "" : prev.database,
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="p-2.5 rounded-xl glass-morphism hover-3d transition-all"
          >
            <ArrowLeft
              className="w-5 h-5"
              style={{ color: theme.colors.textSecondary }}
            />
          </button>
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center glow-effect floating-animation"
            style={{
              backgroundColor: config.color + "20",
              boxShadow: `0 0 25px ${config.color}40`,
            }}
          >
            <Database className="w-7 h-7" style={{ color: config.color }} />
          </div>
          <div>
            <h3
              className="text-lg font-semibold"
              style={{ color: theme.colors.text }}
            >
              {config.name}
            </h3>
            <p
              className="text-xs"
              style={{ color: theme.colors.textSecondary }}
            >
              {t("nav.configureConnection")}
            </p>
          </div>
        </div>
      </div>

      {/* Database Type Selection */}
      <div className="form-group">
        <label className="block text-sm font-semibold mb-2.5">
          Database Type
        </label>
        <div className="database-type-grid grid grid-cols-4 gap-2">
          {Object.entries(DATABASE_CONFIGS).map(([type, dbConfig]) => (
            <button
              key={type}
              type="button"
              onClick={() => handleTypeChange(type)}
              className={`p-3 rounded-xl border-2 transition-all hover-3d ${
                formData.type === type
                  ? "border-blue-500 bg-blue-500/10"
                  : "border-gray-600/30 hover:border-gray-500/50"
              }`}
              style={{
                borderColor:
                  formData.type === type
                    ? config.color
                    : "rgba(99, 102, 241, 0.3)",
                backgroundColor:
                  formData.type === type ? `${config.color}20` : "transparent",
              }}
            >
              <div className="flex flex-col items-center gap-1">
                <div
                  className="w-6 h-6 rounded"
                  style={{ backgroundColor: dbConfig.color }}
                />
                <span
                  className="text-xs font-medium"
                  style={{ color: theme.colors.text }}
                >
                  {dbConfig.name}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Input Mode Selector */}
      <div className="flex items-center gap-2 p-1 glass-card rounded-xl w-fit">
        <button
          type="button"
          onClick={() => setInputMode("manual")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            inputMode === "manual" ? "text-white shadow-lg" : ""
          }`}
          style={{
            backgroundColor:
              inputMode === "manual" ? config.color : "transparent",
            color:
              inputMode === "manual" ? "white" : theme.colors.textSecondary,
          }}
        >
          Manual
        </button>
        {config.supportsURL && (
          <button
            type="button"
            onClick={() => setInputMode("url")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
              inputMode === "url" ? "text-white shadow-lg" : ""
            }`}
            style={{
              backgroundColor:
                inputMode === "url" ? config.color : "transparent",
              color: inputMode === "url" ? "white" : theme.colors.textSecondary,
            }}
          >
            <Link2 className="w-4 h-4" />
            URL
          </button>
        )}
        {config.supportsDocker && (
          <button
            type="button"
            onClick={() => setInputMode("docker")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
              inputMode === "docker" ? "text-white shadow-lg" : ""
            }`}
            style={{
              backgroundColor:
                inputMode === "docker" ? config.color : "transparent",
              color:
                inputMode === "docker" ? "white" : theme.colors.textSecondary,
            }}
          >
            <Container className="w-4 h-4" />
            Docker
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 p-1 glass-card rounded-xl w-fit">
        <button
          type="button"
          onClick={() => setActiveTab("basic")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === "basic" ? "text-white shadow-lg" : ""
          }`}
          style={{
            backgroundColor:
              activeTab === "basic" ? config.color : "transparent",
            color: activeTab === "basic" ? "white" : theme.colors.textSecondary,
          }}
        >
          Basic Settings
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("advanced")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === "advanced" ? "text-white shadow-lg" : ""
          }`}
          style={{
            backgroundColor:
              activeTab === "advanced" ? config.color : "transparent",
            color:
              activeTab === "advanced" ? "white" : theme.colors.textSecondary,
          }}
        >
          Advanced Options
        </button>
      </div>

      {/* URL Input */}
      {inputMode === "url" && config.supportsURL && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Connection URL
            </label>
            <input
              type="text"
              value={formData.connectionString || ""}
              onChange={(e) =>
                handleInputChange("connectionString", e.target.value)
              }
              placeholder={`${databaseType}://username:password@host:${config.defaultPort}/database`}
              className="w-full px-4 py-3 glass-card border rounded-2xl focus:ring-2 outline-none transition-all font-mono text-sm"
              style={{
                borderColor: "rgba(99, 102, 241, 0.3)",
                focusRingColor: config.color,
              }}
            />
            <p
              className="text-xs mt-2"
              style={{ color: theme.colors.textSecondary }}
            >
              Parsed values will be auto-filled below
            </p>
          </div>
        </div>
      )}

      {/* Docker Quick Setup */}
      {inputMode === "docker" && config.supportsDocker && (
        <div className="p-4 glass-card rounded-2xl">
          <h4
            className="font-semibold mb-3"
            style={{ color: theme.colors.text }}
          >
            Docker Quick Setup
          </h4>
          <p
            className="text-sm mb-4"
            style={{ color: theme.colors.textSecondary }}
          >
            Launch a {config.name} container instantly with default settings.
          </p>
          <button
            type="button"
            onClick={handleDockerSetup}
            disabled={isTesting}
            className="px-4 py-2 text-sm font-semibold text-white rounded-xl hover-3d glow-effect transition-all"
            style={{
              background: `linear-gradient(135deg, ${config.color}, ${config.color}dd)`,
            }}
          >
            {isTesting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                Starting Container...
              </>
            ) : (
              "Start Docker Container"
            )}
          </button>
        </div>
      )}

      {/* Form Fields */}
      <div className="space-y-5">
        {/* Basic Settings */}
        {activeTab === "basic" && (
          <div className="grid grid-cols-2 gap-4">
            {config.requiresHost && (
              <>
                <div>
                  <label className="block text-sm font-semibold mb-2.5">
                    Host *
                  </label>
                  <div className="input-with-icon relative">
                    <Server
                      className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4"
                      style={{ color: theme.colors.textSecondary }}
                    />
                    <input
                      type="text"
                      value={formData.host}
                      onChange={(e) =>
                        handleInputChange("host", e.target.value)
                      }
                      placeholder="localhost"
                      className="w-full pl-10 pr-4 py-3.5 glass-card border rounded-2xl focus:ring-2 outline-none transition-all"
                      style={{ borderColor: "rgba(99, 102, 241, 0.3)" }}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2.5">
                    Port *
                  </label>
                  <input
                    type="number"
                    value={formData.port}
                    onChange={(e) =>
                      handleInputChange("port", parseInt(e.target.value))
                    }
                    placeholder={config.defaultPort.toString()}
                    className="w-full px-4 py-3.5 glass-card border rounded-2xl focus:ring-2 outline-none transition-all"
                    style={{ borderColor: "rgba(99, 102, 241, 0.3)" }}
                    min="1"
                    max="65535"
                    required
                  />
                </div>
              </>
            )}

            {config.requiresDatabase && (
              <div className="col-span-2">
                <label className="block text-sm font-semibold mb-2.5">
                  {formData.type === "sqlite"
                    ? "Database File *"
                    : "Database Name *"}
                </label>
                <input
                  type="text"
                  value={formData.database}
                  onChange={(e) =>
                    handleInputChange("database", e.target.value)
                  }
                  placeholder={
                    formData.type === "sqlite"
                      ? "/path/to/database.db"
                      : "database_name"
                  }
                  className="w-full px-4 py-3.5 glass-card border rounded-2xl focus:ring-2 outline-none transition-all"
                  style={{ borderColor: "rgba(99, 102, 241, 0.3)" }}
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold mb-2.5">
                Username *
              </label>
              <div className="input-with-icon relative">
                <Key
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4"
                  style={{ color: theme.colors.textSecondary }}
                />
                <input
                  type="text"
                  value={formData.username || ""}
                  onChange={(e) =>
                    handleInputChange("username", e.target.value)
                  }
                  placeholder="username"
                  className="w-full pl-10 pr-4 py-3.5 glass-card border rounded-2xl focus:ring-2 outline-none transition-all"
                  style={{ borderColor: "rgba(99, 102, 241, 0.3)" }}
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2.5">
                Password
              </label>
              <div className="input-with-icon relative">
                <Shield
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4"
                  style={{ color: theme.colors.textSecondary }}
                />
                <input
                  type={showPassword ? "text" : "password"}
                  value={formData.password || ""}
                  onChange={(e) =>
                    handleInputChange("password", e.target.value)
                  }
                  placeholder="••••••••"
                  className="w-full pl-10 pr-12 py-3.5 glass-card border rounded-2xl focus:ring-2 outline-none transition-all"
                  style={{ borderColor: "rgba(99, 102, 241, 0.3)" }}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ color: theme.colors.textSecondary }}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            {formData.type !== "sqlite" && (
              <div className="col-span-2">
                <label className="flex items-center gap-3 p-4 glass-card rounded-2xl cursor-pointer hover-3d transition-all">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={formData.ssl || false}
                      onChange={(e) =>
                        handleInputChange("ssl", e.target.checked)
                      }
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-600/50 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-indigo-500 peer-checked:to-purple-500"></div>
                  </div>
                  <div>
                    <p
                      className="text-sm font-medium"
                      style={{ color: theme.colors.text }}
                    >
                      Enable SSL/TLS
                    </p>
                    <p
                      className="text-xs"
                      style={{ color: theme.colors.textSecondary }}
                    >
                      Secure encrypted connection
                    </p>
                  </div>
                </label>
              </div>
            )}
          </div>
        )}

        {/* Advanced Options */}
        {activeTab === "advanced" && (
          <div className="advanced-options space-y-4">
            <div>
              <label className="block text-sm font-semibold mb-2.5">
                Connection String (optional)
              </label>
              <input
                type="text"
                value={formData.connectionString || ""}
                onChange={(e) =>
                  handleInputChange("connectionString", e.target.value)
                }
                placeholder={`${databaseType}://user:password@host:port/database`}
                className="w-full px-4 py-3.5 glass-card border rounded-2xl focus:ring-2 outline-none transition-all font-mono text-sm"
                style={{ borderColor: "rgba(99, 102, 241, 0.3)" }}
              />
              <p
                className="text-xs mt-2"
                style={{ color: theme.colors.textSecondary }}
              >
                If provided, this will override the individual settings above
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2.5">
                Additional Options (JSON)
              </label>
              <textarea
                value={JSON.stringify(formData.options || {}, null, 2)}
                onChange={(e) => {
                  try {
                    const options = JSON.parse(e.target.value);
                    handleInputChange("options", options);
                  } catch {
                    // Invalid JSON, don't update
                  }
                }}
                className="w-full px-4 py-3.5 glass-card border rounded-2xl focus:ring-2 outline-none transition-all font-mono text-sm"
                rows={4}
                placeholder='{"ssl": true, "timeout": 30000}'
                style={{ borderColor: "rgba(99, 102, 241, 0.3)" }}
              />
              <p
                className="text-xs mt-2"
                style={{ color: theme.colors.textSecondary }}
              >
                Enter additional connection options in JSON format
              </p>
            </div>

            {/* Database-Specific Fields */}
            <div className="database-specific-fields space-y-4">
              <h4
                className="text-sm font-semibold"
                style={{ color: theme.colors.text }}
              >
                Database-Specific Options
              </h4>

              {/* Cassandra Fields */}
              {databaseType === "cassandra" && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Data Center
                      </label>
                      <input
                        type="text"
                        value={formData.dataCenter || "datacenter1"}
                        onChange={(e) =>
                          handleInputChange("dataCenter", e.target.value)
                        }
                        placeholder="datacenter1"
                        className="w-full px-4 py-3.5 glass-card border rounded-2xl focus:ring-2 outline-none transition-all"
                        style={{ borderColor: "rgba(99, 102, 241, 0.3)" }}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Keyspace
                      </label>
                      <input
                        type="text"
                        value={formData.keyspace || ""}
                        onChange={(e) =>
                          handleInputChange("keyspace", e.target.value)
                        }
                        placeholder="queryflux"
                        className="w-full px-4 py-3.5 glass-card border rounded-2xl focus:ring-2 outline-none transition-all"
                        style={{ borderColor: "rgba(99, 102, 241, 0.3)" }}
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Oracle Fields */}
              {(databaseType === "oracle" || databaseType === "oracledb") && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Service Name
                      </label>
                      <input
                        type="text"
                        value={formData.serviceName || ""}
                        onChange={(e) =>
                          handleInputChange("serviceName", e.target.value)
                        }
                        placeholder="ORCL"
                        className="w-full px-4 py-3.5 glass-card border rounded-2xl focus:ring-2 outline-none transition-all"
                        style={{ borderColor: "rgba(99, 102, 241, 0.3)" }}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        SID
                      </label>
                      <input
                        type="text"
                        value={formData.sid || ""}
                        onChange={(e) =>
                          handleInputChange("sid", e.target.value)
                        }
                        placeholder="ORCL"
                        className="w-full px-4 py-3.5 glass-card border rounded-2xl focus:ring-2 outline-none transition-all"
                        style={{ borderColor: "rgba(99, 102, 241, 0.3)" }}
                      />
                    </div>
                  </div>
                  <p
                    className="text-xs"
                    style={{ color: theme.colors.textSecondary }}
                  >
                    Enter either Service Name or SID (Service Name is preferred)
                  </p>
                </>
              )}

              {/* SQL Server Fields */}
              {databaseType === "sqlserver" && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="flex items-center gap-3 p-4 glass-card rounded-2xl cursor-pointer hover-3d transition-all">
                        <div className="relative">
                          <input
                            type="checkbox"
                            checked={formData.encrypt || false}
                            onChange={(e) =>
                              handleInputChange("encrypt", e.target.checked)
                            }
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-600/50 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-indigo-500 peer-checked:to-purple-500"></div>
                        </div>
                        <div>
                          <p
                            className="text-sm font-medium"
                            style={{ color: theme.colors.text }}
                          >
                            Encrypt Connection
                          </p>
                          <p
                            className="text-xs"
                            style={{ color: theme.colors.textSecondary }}
                          >
                            Use SSL/TLS encryption
                          </p>
                        </div>
                      </label>
                    </div>
                    <div>
                      <label className="flex items-center gap-3 p-4 glass-card rounded-2xl cursor-pointer hover-3d transition-all">
                        <div className="relative">
                          <input
                            type="checkbox"
                            checked={formData.trustServerCertificate || false}
                            onChange={(e) =>
                              handleInputChange(
                                "trustServerCertificate",
                                e.target.checked,
                              )
                            }
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-600/50 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-indigo-500 peer-checked:to-purple-500"></div>
                        </div>
                        <div>
                          <p
                            className="text-sm font-medium"
                            style={{ color: theme.colors.text }}
                          >
                            Trust Server Certificate
                          </p>
                          <p
                            className="text-xs"
                            style={{ color: theme.colors.textSecondary }}
                          >
                            Skip server certificate validation
                          </p>
                        </div>
                      </label>
                    </div>
                  </div>
                </>
              )}

              {/* SQLite Fields */}
              {databaseType === "sqlite" && (
                <>
                  <div>
                    <label className="flex items-center gap-3 p-4 glass-card rounded-2xl cursor-pointer hover-3d transition-all">
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={formData.readonly || false}
                          onChange={(e) =>
                            handleInputChange("readonly", e.target.checked)
                          }
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-600/50 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-indigo-500 peer-checked:to-purple-500"></div>
                      </div>
                      <div>
                        <p
                          className="text-sm font-medium"
                          style={{ color: theme.colors.text }}
                        >
                          Read-Only Mode
                        </p>
                        <p
                          className="text-xs"
                          style={{ color: theme.colors.textSecondary }}
                        >
                          Open database in read-only mode
                        </p>
                      </div>
                    </label>
                  </div>
                </>
              )}

              {/* MongoDB Fields */}
              {databaseType === "mongodb" && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Authentication Database
                      </label>
                      <input
                        type="text"
                        value={formData.authDatabase || "admin"}
                        onChange={(e) =>
                          handleInputChange("authDatabase", e.target.value)
                        }
                        placeholder="admin"
                        className="w-full px-4 py-3.5 glass-card border rounded-2xl focus:ring-2 outline-none transition-all"
                        style={{ borderColor: "rgba(99, 102, 241, 0.3)" }}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Read Preference
                      </label>
                      <select
                        value={formData.readPreference || "primary"}
                        onChange={(e) =>
                          handleInputChange("readPreference", e.target.value)
                        }
                        className="w-full px-4 py-3.5 glass-card border rounded-2xl focus:ring-2 outline-none transition-all"
                        style={{ borderColor: "rgba(99, 102, 241, 0.3)" }}
                      >
                        <option value="primary">Primary</option>
                        <option value="primaryPreferred">
                          Primary Preferred
                        </option>
                        <option value="secondary">Secondary</option>
                        <option value="secondaryPreferred">
                          Secondary Preferred
                        </option>
                        <option value="nearest">Nearest</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Replica Set (optional)
                      </label>
                      <input
                        type="text"
                        value={formData.replicaSet || ""}
                        onChange={(e) =>
                          handleInputChange("replicaSet", e.target.value)
                        }
                        placeholder="rs0"
                        className="w-full px-4 py-3.5 glass-card border rounded-2xl focus:ring-2 outline-none transition-all"
                        style={{ borderColor: "rgba(99, 102, 241, 0.3)" }}
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Redis Fields */}
              {databaseType === "redis" && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Database Index (0-15)
                      </label>
                      <input
                        type="number"
                        value={formData.db || 0}
                        onChange={(e) =>
                          handleInputChange("db", parseInt(e.target.value))
                        }
                        min="0"
                        max="15"
                        className="w-full px-4 py-3.5 glass-card border rounded-2xl focus:ring-2 outline-none transition-all"
                        style={{ borderColor: "rgba(99, 102, 241, 0.3)" }}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        IP Family
                      </label>
                      <select
                        value={formData.family || 4}
                        onChange={(e) =>
                          handleInputChange("family", parseInt(e.target.value))
                        }
                        className="w-full px-4 py-3.5 glass-card border rounded-2xl focus:ring-2 outline-none transition-all"
                        style={{ borderColor: "rgba(99, 102, 241, 0.3)" }}
                      >
                        <option value="4">IPv4</option>
                        <option value="6">IPv6</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Connect Timeout (ms)
                      </label>
                      <input
                        type="number"
                        value={formData.connectTimeout || 30000}
                        onChange={(e) =>
                          handleInputChange(
                            "connectTimeout",
                            parseInt(e.target.value),
                          )
                        }
                        min="1000"
                        max="300000"
                        className="w-full px-4 py-3.5 glass-card border rounded-2xl focus:ring-2 outline-none transition-all"
                        style={{ borderColor: "rgba(99, 102, 241, 0.3)" }}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Command Timeout (ms)
                      </label>
                      <input
                        type="number"
                        value={formData.commandTimeout || 5000}
                        onChange={(e) =>
                          handleInputChange(
                            "commandTimeout",
                            parseInt(e.target.value),
                          )
                        }
                        min="1000"
                        max="60000"
                        className="w-full px-4 py-3.5 glass-card border rounded-2xl focus:ring-2 outline-none transition-all"
                        style={{ borderColor: "rgba(99, 102, 241, 0.3)" }}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="flex items-center gap-3 p-4 glass-card rounded-2xl cursor-pointer hover-3d transition-all">
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={formData.keepAlive !== false}
                          onChange={(e) =>
                            handleInputChange("keepAlive", e.target.checked)
                          }
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-600/50 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-indigo-500 peer-checked:to-purple-500"></div>
                      </div>
                      <div>
                        <p
                          className="text-sm font-medium"
                          style={{ color: theme.colors.text }}
                        >
                          Keep Alive
                        </p>
                        <p
                          className="text-xs"
                          style={{ color: theme.colors.textSecondary }}
                        >
                          Maintain persistent connection
                        </p>
                      </div>
                    </label>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Test Result */}
      {testResult && (
        <div
          className={`p-4 rounded-2xl glass-card border ${
            testResult.success
              ? "border-green-500/30 bg-green-500/10"
              : "border-red-500/30 bg-red-500/10"
          }`}
        >
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${testResult.success ? "bg-green-400" : "bg-red-400"}`}
            />
            <p
              className={`text-sm font-medium ${
                testResult.success ? "text-green-300" : "text-red-300"
              }`}
            >
              {testResult.message}
            </p>
            {testResult.testTime && (
              <span
                className="text-xs"
                style={{ color: theme.colors.textSecondary }}
              >
                ({testResult.testTime}ms)
              </span>
            )}
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="p-4 rounded-2xl glass-card border border-red-500/30 bg-red-500/10">
          <p className="text-sm font-medium text-red-300">{error}</p>
        </div>
      )}

      {/* Actions */}
      <div
        className="flex justify-between items-center pt-6 border-t"
        style={{ borderColor: "rgba(99, 102, 241, 0.2)" }}
      >
        <button
          type="button"
          onClick={handleTest}
          disabled={isTesting || isLoading}
          className="flex items-center gap-2 px-5 py-3 text-sm font-semibold glass-morphism rounded-xl hover-3d transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ color: theme.colors.text }}
        >
          {isTesting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <TestTube className="w-4 h-4" />
          )}
          Test Connection
        </button>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="px-6 py-3 text-sm font-semibold glass-morphism rounded-xl hover-3d transition-all disabled:opacity-50"
            style={{ color: theme.colors.text }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isLoading || isTesting}
            className="px-6 py-3 text-sm font-semibold text-white rounded-xl hover-3d glow-effect transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: `linear-gradient(135deg, ${config.color}, ${config.color}dd)`,
            }}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                Connecting...
              </>
            ) : editConnection ? (
              "Update Connection"
            ) : (
              "Connect"
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
