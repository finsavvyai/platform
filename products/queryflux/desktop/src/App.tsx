import { listen } from '@tauri-apps/api/event';
import { useEffect, useMemo, useState, type Dispatch, type FormEvent, type SetStateAction } from 'react';
import './App-modern.css';
import {
  DATABASE_TYPES,
  TABS,
  getDatabaseLabel,
  getDatabaseMeta,
  getHostLabel,
  initialConnectionForm,
  isDesktopTab,
  type ConnectionFormState,
  type DatabaseType,
  type DesktopTab,
} from './appTypes';
import { formatCellValue, getErrorMessage, sleep } from './appUtils';
import { Icon } from './components/Icon';
import {
  buildChartSpec,
  buildDashboardTiles,
  buildExplorationBrief,
  buildPinnedChartArtifact,
  buildPinnedResultArtifact,
  serializeQueryResultToCsv,
  summarizeQueryResult,
  type ChartType,
  type ExplorationBrief,
  type PinnedArtifact,
  type SemanticMetric,
} from './lib/analytics-engine';
import {
  buildPreviewConnectionStatus,
  buildPreviewConnections,
  buildPreviewQueryResult,
  buildPreviewSchema,
  buildPreviewSql,
  buildPreviewStatuses,
  PREVIEW_LINKS,
  type PreviewSchemaTable,
} from './previewData';
import {
  convertNLToSQL,
  deleteConnection,
  executeQuery,
  generateConnectionId,
  getBackendUrl,
  getConnections,
  getDefaultPort,
  isTauriContext,
  saveConnection,
  testConnection,
  type ConnectionConfig,
  type ConnectionStatus,
  type QueryResult,
} from './lib/tauri-ipc';

function App() {
  const nativeMode = isTauriContext();
  const [activeTab, setActiveTab] = useState<DesktopTab>('connections');
  const [connections, setConnections] = useState<ConnectionConfig[]>([]);
  const [connectionStatuses, setConnectionStatuses] = useState<Record<string, ConnectionStatus>>({});
  const [selectedConnectionId, setSelectedConnectionId] = useState('');
  const [connectionForm, setConnectionForm] = useState<ConnectionFormState>(initialConnectionForm);
  const [query, setQuery] = useState('SELECT * FROM users LIMIT 25;');
  const [naturalLanguageQuery, setNaturalLanguageQuery] = useState('');
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [backendUrl, setBackendUrl] = useState('native bridge not available');
  const [isBusy, setIsBusy] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [connectionSearch, setConnectionSearch] = useState('');
  const [notice, setNotice] = useState(
    nativeMode
      ? 'Flux bridge ready. Create or select a data link.'
      : 'Preview mode. Launch the Tauri app to activate native storage and database IPC.',
  );

  const selectedConnection = connections.find((connection) => connection.id === selectedConnectionId);
  const filteredConnections = useMemo(() => {
    const queryText = connectionSearch.trim().toLowerCase();

    if (!queryText) {
      return connections;
    }

    return connections.filter((connection) =>
      [
        connection.name,
        connection.db_type,
        connection.host,
        connection.database,
        connection.username,
      ]
        .join(' ')
        .toLowerCase()
        .includes(queryText),
    );
  }, [connections, connectionSearch]);

  useEffect(() => {
    let cancelled = false;

    if (!nativeMode) {
      const previewConnections = buildPreviewConnections();
      setConnections(previewConnections);
      setConnectionStatuses(buildPreviewStatuses(previewConnections));
      setBackendUrl('preview://flux-bridge');
      setNotice(`Preview fabric loaded with ${previewConnections.length} demo data links.`);
      return;
    }

    async function loadInitialDesktopState() {
      setIsBusy(true);

      try {
        const [savedConnections, configuredBackendUrl] = await Promise.all([
          getConnections(),
          getBackendUrl(),
        ]);

        if (cancelled) {
          return;
        }

        setConnections(savedConnections);
        setBackendUrl(configuredBackendUrl);
        setNotice(
          savedConnections.length > 0
            ? `Loaded ${savedConnections.length} data link${savedConnections.length === 1 ? '' : 's'}.`
            : 'No saved data links yet. Create one to connect QueryFlux to live data.',
        );
      } catch (error) {
        if (!cancelled) {
          setNotice(`Failed to load desktop state: ${getErrorMessage(error)}`);
        }
      } finally {
        if (!cancelled) {
          setIsBusy(false);
        }
      }
    }

    void loadInitialDesktopState();

    return () => {
      cancelled = true;
    };
  }, [nativeMode]);

  useEffect(() => {
    if (connections.length === 0) {
      setSelectedConnectionId('');
      return;
    }

    if (!connections.some((connection) => connection.id === selectedConnectionId)) {
      setSelectedConnectionId(connections[0].id);
    }
  }, [connections, selectedConnectionId]);

  useEffect(() => {
    if (!isTauriContext()) {
      return;
    }

    let unlisten: (() => void) | undefined;
    let disposed = false;

    void listen<string>('navigate', (event) => {
      if (isDesktopTab(event.payload)) {
        setActiveTab(event.payload);
      }
    }).then((cleanup) => {
      if (disposed) {
        cleanup();
        return;
      }

      unlisten = cleanup;
    });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  async function reloadConnections() {
    if (!nativeMode) {
      const previewConnections = buildPreviewConnections();
      setConnections(previewConnections);
      setConnectionStatuses(buildPreviewStatuses(previewConnections));
      setQueryResult(null);
      setNotice(`Preview fabric restored with ${previewConnections.length} demo data links.`);
      return;
    }

    setIsBusy(true);

    try {
      const savedConnections = await getConnections();
      setConnections(savedConnections);
      setNotice(`Loaded ${savedConnections.length} data link${savedConnections.length === 1 ? '' : 's'}.`);
    } catch (error) {
      setNotice(`Failed to reload connections: ${getErrorMessage(error)}`);
    } finally {
      setIsBusy(false);
    }
  }

  async function handleSaveConnection(event: FormEvent<HTMLFormElement>): Promise<boolean> {
    event.preventDefault();

    const databaseMeta = getDatabaseMeta(connectionForm.dbType);
    const config: ConnectionConfig = {
      id: generateConnectionId(),
      name: connectionForm.name.trim() || `${databaseMeta.label} connection`,
      db_type: connectionForm.dbType,
      host: connectionForm.host.trim() || '127.0.0.1',
      port: connectionForm.port || databaseMeta.defaultPort || getDefaultPort(connectionForm.dbType),
      database: connectionForm.database.trim(),
      username: connectionForm.username.trim(),
      password: connectionForm.password || undefined,
      ssl: connectionForm.ssl,
      options: {},
    };

    if (!nativeMode) {
      setIsBusy(true);

      try {
        await sleep(220);
        setConnections((current) => [...current, config]);
        setConnectionStatuses((current) => ({
          ...current,
          [config.id]: buildPreviewConnectionStatus(config),
        }));
        setConnectionForm({
          ...initialConnectionForm,
          dbType: connectionForm.dbType,
          port: databaseMeta.defaultPort,
        });
        setSelectedConnectionId(config.id);
        setActiveTab('connections');
        setNotice(`${config.name} added to the preview fabric for this session. Launch Tauri to persist it locally.`);
        return true;
      } finally {
        setIsBusy(false);
      }
    }

    setIsBusy(true);

    try {
      await saveConnection(config);
      setConnectionForm({
        ...initialConnectionForm,
        dbType: connectionForm.dbType,
        port: databaseMeta.defaultPort,
      });
      await reloadConnections();
      setSelectedConnectionId(config.id);
      setActiveTab('connections');
      setNotice(`${config.name} saved. Password is stored in the OS credential store.`);
      return true;
    } catch (error) {
      setNotice(`Failed to save connection: ${getErrorMessage(error)}`);
      return false;
    } finally {
      setIsBusy(false);
    }
  }

  async function handleTestConnection(connectionId: string) {
    const connection = connections.find((item) => item.id === connectionId);

    if (!connection) {
      setNotice('Selected data link is no longer available.');
      return;
    }

    if (!nativeMode) {
      setIsBusy(true);

      try {
        await sleep(160);
        const status = buildPreviewConnectionStatus(connection);
        setConnectionStatuses((current) => ({ ...current, [connectionId]: status }));
        setNotice(
          status.connected
            ? `${status.name} validated in preview mode.`
            : `${status.name} failed: ${status.last_error ?? 'Unknown preview error'}`,
        );
      } finally {
        setIsBusy(false);
      }
    }

    setIsBusy(true);

    try {
      const status = await testConnection(connectionId);
      setConnectionStatuses((current) => ({ ...current, [connectionId]: status }));
      setNotice(
        status.connected
          ? `${status.name} connected successfully.`
          : `${status.name} failed: ${status.last_error ?? 'Unknown backend error'}`,
      );
    } catch (error) {
      setNotice(`Connection test failed: ${getErrorMessage(error)}`);
    } finally {
      setIsBusy(false);
    }
  }

  async function handleDeleteConnection(connectionId: string) {
    if (!window.confirm('Delete this data link?')) {
      return;
    }

    if (!nativeMode) {
      setConnections((current) => current.filter((connection) => connection.id !== connectionId));
      setConnectionStatuses((current) => {
        const next = { ...current };
        delete next[connectionId];
        return next;
      });
      setNotice('Preview data link removed. Use Reload to restore the demo fabric.');
      return;
    }

    setIsBusy(true);

    try {
      await deleteConnection(connectionId);
      setConnectionStatuses((current) => {
        const next = { ...current };
        delete next[connectionId];
        return next;
      });
      await reloadConnections();
      setNotice('Connection deleted.');
    } catch (error) {
      setNotice(`Failed to delete connection: ${getErrorMessage(error)}`);
    } finally {
      setIsBusy(false);
    }
  }

  async function handleRunQuery(): Promise<QueryResult | null> {
    if (!selectedConnection) {
      setNotice('Select a data link before running a query.');
      return null;
    }

    if (!query.trim()) {
      setNotice('Enter SQL before running the workbench.');
      return null;
    }

    if (!nativeMode) {
      setIsBusy(true);
      setQueryResult(null);

      try {
        await sleep(240);
        const result = buildPreviewQueryResult(query, selectedConnection);
        setQueryResult(result);
        setNotice(
          result.success
            ? `Preview query completed in ${result.execution_time_ms}ms with ${result.row_count} row${result.row_count === 1 ? '' : 's'}.`
            : `Query failed: ${result.error ?? 'Unknown preview error'}`,
        );
        return result;
      } finally {
        setIsBusy(false);
      }
    }

    setIsBusy(true);
    setQueryResult(null);

    try {
      const result = await executeQuery({
        connection_id: selectedConnection.id,
        query,
      });

      setQueryResult(result);
      setNotice(
        result.success
          ? `Query completed in ${result.execution_time_ms}ms with ${result.row_count} row${result.row_count === 1 ? '' : 's'}.`
          : `Query failed: ${result.error ?? 'Unknown backend error'}`,
      );
      return result;
    } catch (error) {
      setNotice(`Query execution failed: ${getErrorMessage(error)}`);
      return null;
    } finally {
      setIsBusy(false);
    }
  }

  async function handleGenerateSql() {
    if (!selectedConnection) {
      setNotice('Select a data link before using natural language to SQL.');
      return;
    }

    if (!naturalLanguageQuery.trim()) {
      setNotice('Enter a natural-language request first.');
      return;
    }

    setIsBusy(true);

    try {
      if (!nativeMode) {
        await sleep(180);
        const result = buildPreviewSql(naturalLanguageQuery, selectedConnection);
        setQuery(result.sql);
        setActiveTab('query');
        setNotice(`Preview SQL generated with ${Math.round(result.confidence * 100)}% confidence: ${result.explanation}`);
        return;
      }

      const result = await convertNLToSQL({
        natural_language: naturalLanguageQuery,
        connection_id: selectedConnection.id,
        database_type: selectedConnection.db_type,
      });

      setQuery(result.sql);
      setActiveTab('query');
      setNotice(`Generated SQL with ${Math.round(result.confidence * 100)}% confidence: ${result.explanation}`);
    } catch (error) {
      setNotice(`AI SQL generation failed: ${getErrorMessage(error)}`);
    } finally {
      setIsBusy(false);
    }
  }

  function handleDatabaseTypeChange(dbType: DatabaseType) {
    const databaseMeta = getDatabaseMeta(dbType);
    setConnectionForm((current) => ({
      ...current,
      dbType,
      port: databaseMeta.defaultPort || getDefaultPort(dbType),
    }));
  }

  function openQueryWorkbench(connectionId: string) {
    setSelectedConnectionId(connectionId);
    setActiveTab('query');
  }

  return (
    <div className="desktop-stage">
      <div className="desktop-window">
        <aside className="native-sidebar">
          <div className="traffic-lights" aria-hidden="true">
            <span className="traffic-red" />
            <span className="traffic-yellow" />
            <span className="traffic-green" />
          </div>

          <div className="brand-panel">
            <div className="brand-origami" aria-hidden="true">
              <span>Q</span>
            </div>
            <h1>QueryFlux</h1>
            <p>AI Data Console</p>
          </div>

          <div className={`native-state ${nativeMode ? 'ready' : 'preview'}`}>
            {nativeMode ? 'Flux bridge online' : 'Preview cockpit'}
          </div>

          <div className="sidebar-actions">
            <button className="sidebar-action disabled" disabled type="button">
              <Icon name="backup" />
              Snapshot vault
            </button>
            <button className="sidebar-action disabled" disabled type="button">
              <Icon name="backup" />
              Restore timeline
            </button>
            <button className="sidebar-action primary" onClick={() => setShowCreateDialog(true)} type="button">
              <Icon name="plug" />
              Create data link
            </button>
          </div>

          <nav className="side-tabs" aria-label="Desktop modules">
            {TABS.map((item) => (
              <button
                className={`side-tab ${activeTab === item.id ? 'active' : ''}`}
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                type="button"
              >
                <Icon name={item.icon} />
                {item.label}
              </button>
            ))}
          </nav>
        </aside>

        <main className="desktop-main">
          <header className="desktop-toolbar">
            <button className="toolbar-plus" onClick={() => setShowCreateDialog(true)} type="button" aria-label="New connection">
              <Icon name="plus" />
            </button>
            <label className="toolbar-search">
              <Icon name="search" />
              <input
                onChange={(event) => setConnectionSearch(event.target.value)}
                placeholder="Command search connections, hosts, schemas..."
                value={connectionSearch}
              />
            </label>
            <div className={`toolbar-status ${nativeMode ? 'ready' : 'preview'}`}>
              {isBusy ? 'Working' : nativeMode ? 'Native' : 'Preview'}
            </div>
          </header>

          <div className="notice-strip">
            <span>{notice}</span>
            <button className="notice-link" onClick={() => void reloadConnections()} type="button">
              Reload
            </button>
          </div>

          <section className="desktop-content">
            {activeTab === 'connections' && (
              <ConnectionLibrary
                connectionStatuses={connectionStatuses}
                connections={filteredConnections}
                isFiltered={connectionSearch.trim().length > 0}
                onCreate={() => setShowCreateDialog(true)}
                onDeleteConnection={handleDeleteConnection}
                onOpenWorkbench={openQueryWorkbench}
                onSelectConnection={setSelectedConnectionId}
                onTestConnection={handleTestConnection}
                selectedConnectionId={selectedConnectionId}
                totalConnections={connections.length}
              />
            )}
            {activeTab === 'query' && (
              <QueryEditorView
                connections={connections}
                isBusy={isBusy}
                naturalLanguageQuery={naturalLanguageQuery}
                onGenerateSql={handleGenerateSql}
                onRunQuery={handleRunQuery}
                onSelectConnection={setSelectedConnectionId}
                onSetNaturalLanguageQuery={setNaturalLanguageQuery}
                onSetQuery={setQuery}
                query={query}
                queryResult={queryResult}
                selectedConnectionId={selectedConnectionId}
              />
            )}
            {activeTab === 'monitor' && (
              <MonitorView
                backendUrl={backendUrl}
                connectionStatuses={connectionStatuses}
                connections={connections}
                lastQueryResult={queryResult}
                nativeMode={nativeMode}
              />
            )}
            {activeTab === 'insights' && (
              <VisualCanvasView
                connections={connections}
                lastQueryResult={queryResult}
                selectedConnection={selectedConnection}
              />
            )}
            {activeTab === 'backup' && <BackupView />}
            {activeTab === 'settings' && <SettingsView backendUrl={backendUrl} nativeMode={nativeMode} />}
          </section>

          <footer className="desktop-statusbar" aria-label="Desktop status">
            <span>{nativeMode ? 'Tauri shell' : 'Browser preview'} · {backendUrl}</span>
            <span>{connections.length} links · {selectedConnection?.name ?? 'No active connection'}</span>
            <span>⌘ Enter Run · ⌘ K Search · Read/write guardrails</span>
          </footer>
        </main>
      </div>

      {showCreateDialog && (
        <CreateConnectionDialog
          connectionForm={connectionForm}
          isBusy={isBusy}
          nativeMode={nativeMode}
          onClose={() => setShowCreateDialog(false)}
          onDatabaseTypeChange={handleDatabaseTypeChange}
          onSaveConnection={handleSaveConnection}
          onSetConnectionForm={setConnectionForm}
        />
      )}
    </div>
  );
}

interface ConnectionLibraryProps {
  connectionStatuses: Record<string, ConnectionStatus>;
  connections: ConnectionConfig[];
  isFiltered: boolean;
  onCreate: () => void;
  onDeleteConnection: (connectionId: string) => Promise<void>;
  onOpenWorkbench: (connectionId: string) => void;
  onSelectConnection: (connectionId: string) => void;
  onTestConnection: (connectionId: string) => Promise<void>;
  selectedConnectionId: string;
  totalConnections: number;
}

function ConnectionLibrary({
  connectionStatuses,
  connections,
  isFiltered,
  onCreate,
  onDeleteConnection,
  onOpenWorkbench,
  onSelectConnection,
  onTestConnection,
  selectedConnectionId,
  totalConnections,
}: ConnectionLibraryProps) {
  if (totalConnections === 0) {
    return (
      <div className="library-empty">
        <div className="empty-orb">
          <Icon name="database" />
        </div>
        <h2>No data links yet</h2>
        <p>Create a secure connection fabric to browse data, run SQL, and route AI-assisted workflows locally.</p>
        <div className="empty-hints" aria-label="QueryFlux desktop capabilities">
          <span>Encrypted vault</span>
          <span>AI SQL routing</span>
          <span>Native IPC</span>
        </div>
        <div className="preview-fabric-grid" aria-label="Preview data-link fabric">
          {PREVIEW_LINKS.map((link) => {
            const databaseMeta = getDatabaseMeta(link.dbType);

            return (
              <article className="preview-fabric-card" key={link.name}>
                <div className="preview-fabric-topline">
                  <span className="database-pick-icon" style={{ backgroundColor: databaseMeta.color }}>
                    {databaseMeta.initials}
                  </span>
                  <span>{link.signal}</span>
                </div>
                <strong>{link.name}</strong>
                <p>{link.region}</p>
                <div className="preview-fabric-footer">
                  <span>{databaseMeta.label}</span>
                  <span>{link.latency}</span>
                </div>
              </article>
            );
          })}
        </div>
        <button className="btn btn-primary" onClick={onCreate} type="button">
          <Icon name="plus" />
          Create Data Link
        </button>
      </div>
    );
  }

  return (
    <div className="connection-library">
      <div className="library-group-header">
        <div>
          <button className="disclosure-button" type="button" aria-label="Saved connections expanded">
            <Icon name="chevron" />
          </button>
          <strong>{isFiltered ? 'Search Results' : 'Connection Fabric'}</strong>
        </div>
        <span>{connections.length}</span>
      </div>

      {connections.length === 0 && (
        <div className="library-no-results">
          <strong>No matching connections</strong>
          <span>Try another host, database, or connection name.</span>
        </div>
      )}

      <div className="connection-rows">
        {connections.map((connection) => {
          const status = connectionStatuses[connection.id];

          return (
            <ConnectionRow
              connection={connection}
              key={connection.id}
              onDeleteConnection={onDeleteConnection}
              onOpenWorkbench={onOpenWorkbench}
              onSelectConnection={onSelectConnection}
              onTestConnection={onTestConnection}
              selected={selectedConnectionId === connection.id}
              status={status}
            />
          );
        })}
      </div>
    </div>
  );
}

function ConnectionRow({
  connection,
  onDeleteConnection,
  onOpenWorkbench,
  onSelectConnection,
  onTestConnection,
  selected,
  status,
}: {
  connection: ConnectionConfig;
  onDeleteConnection: (connectionId: string) => Promise<void>;
  onOpenWorkbench: (connectionId: string) => void;
  onSelectConnection: (connectionId: string) => void;
  onTestConnection: (connectionId: string) => Promise<void>;
  selected: boolean;
  status?: ConnectionStatus;
}) {
  const databaseMeta = getDatabaseMeta(connection.db_type);
  const hostLabel = getHostLabel(connection);

  return (
    <div
      className={`connection-row ${selected ? 'selected' : ''}`}
      onDoubleClick={() => onOpenWorkbench(connection.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          onOpenWorkbench(connection.id);
        }
      }}
    >
      <button className="row-select" onClick={() => onSelectConnection(connection.id)} type="button" aria-label={`Select ${connection.name}`}>
        <Icon name="chevron" />
      </button>
      <div className="plug-badge" aria-hidden="true">
        <Icon name="plug" />
      </div>
      <div className="db-initial" style={{ backgroundColor: databaseMeta.color }}>
        {databaseMeta.initials}
      </div>
      <div className="connection-copy">
        <div className="connection-title">
          {connection.name}
          <span className={hostLabel === 'local' ? 'local-label' : ''}>({hostLabel})</span>
        </div>
        <div className="connection-subtitle">
          {connection.database || 'default'} · {connection.host}:{connection.port}
        </div>
      </div>
      <div className="connection-row-actions">
        <span className={`row-status ${status?.connected ? 'online' : status?.connected === false ? 'error' : ''}`}>
          {status?.connected ? 'online' : status?.connected === false ? 'failed' : getDatabaseLabel(connection.db_type)}
        </span>
        <button className="mini-button" onClick={() => void onTestConnection(connection.id)} type="button">
          Test
        </button>
        <button className="mini-button danger" onClick={() => void onDeleteConnection(connection.id)} type="button">
          Delete
        </button>
      </div>
    </div>
  );
}

interface CreateConnectionDialogProps {
  connectionForm: ConnectionFormState;
  isBusy: boolean;
  nativeMode: boolean;
  onClose: () => void;
  onDatabaseTypeChange: (dbType: DatabaseType) => void;
  onSaveConnection: (event: FormEvent<HTMLFormElement>) => Promise<boolean>;
  onSetConnectionForm: Dispatch<SetStateAction<ConnectionFormState>>;
}

function CreateConnectionDialog({
  connectionForm,
  isBusy,
  nativeMode,
  onClose,
  onDatabaseTypeChange,
  onSaveConnection,
  onSetConnectionForm,
}: CreateConnectionDialogProps) {
  const [databaseSearch, setDatabaseSearch] = useState('');
  const selectedDatabase = getDatabaseMeta(connectionForm.dbType);
  const filteredDatabases = DATABASE_TYPES.filter((database) =>
    `${database.label} ${database.id}`.toLowerCase().includes(databaseSearch.trim().toLowerCase()),
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const saved = await onSaveConnection(event);

    if (saved) {
      onClose();
    }
  }

  return (
    <div className="create-overlay" role="presentation">
      <form className="create-dialog" onSubmit={(event) => void handleSubmit(event)}>
        <div className="create-dialog-header">
          <label className="create-search">
            <Icon name="search" />
            <input
              autoFocus
              onChange={(event) => setDatabaseSearch(event.target.value)}
              placeholder="Search engines, warehouses, edge stores..."
              value={databaseSearch}
            />
          </label>
          <button className="dialog-close" onClick={onClose} type="button" aria-label="Close dialog">
            <Icon name="close" />
          </button>
        </div>

        <div className="create-dialog-body">
          <div className="database-picker-grid">
            {filteredDatabases.map((database) => (
              <button
                className={`database-pick ${connectionForm.dbType === database.id ? 'selected' : ''}`}
                key={database.id}
                onClick={() => onDatabaseTypeChange(database.id)}
                type="button"
              >
                <span className="database-pick-icon" style={{ backgroundColor: database.color }}>
                  {database.initials}
                </span>
                <span>{database.label}</span>
              </button>
            ))}
          </div>

          <div className="create-fields">
            <div className="selected-db-summary">
              <span className="database-pick-icon" style={{ backgroundColor: selectedDatabase.color }}>
                {selectedDatabase.initials}
              </span>
              <div>
                <strong>{selectedDatabase.label}</strong>
                <p>{selectedDatabase.description}</p>
              </div>
            </div>

            <label className="form-group">
              <span className="form-label">Name</span>
              <input
                className="form-input"
                onChange={(event) =>
                  onSetConnectionForm((current) => ({ ...current, name: event.target.value }))
                }
                placeholder={`${selectedDatabase.label} connection`}
                value={connectionForm.name}
              />
            </label>
            <div className="form-grid compact">
              <label className="form-group">
                <span className="form-label">Host</span>
                <input
                  className="form-input"
                  onChange={(event) =>
                    onSetConnectionForm((current) => ({ ...current, host: event.target.value }))
                  }
                  placeholder="127.0.0.1"
                  value={connectionForm.host}
                />
              </label>
              <label className="form-group">
                <span className="form-label">Port</span>
                <input
                  className="form-input"
                  min="0"
                  onChange={(event) =>
                    onSetConnectionForm((current) => ({ ...current, port: Number(event.target.value) }))
                  }
                  type="number"
                  value={connectionForm.port}
                />
              </label>
            </div>
            <label className="form-group">
              <span className="form-label">Database</span>
              <input
                className="form-input"
                onChange={(event) =>
                  onSetConnectionForm((current) => ({ ...current, database: event.target.value }))
                }
                placeholder="app_db"
                value={connectionForm.database}
              />
            </label>
            <div className="form-grid compact">
              <label className="form-group">
                <span className="form-label">Username</span>
                <input
                  className="form-input"
                  onChange={(event) =>
                    onSetConnectionForm((current) => ({ ...current, username: event.target.value }))
                  }
                  placeholder="queryflux"
                  value={connectionForm.username}
                />
              </label>
              <label className="form-group">
                <span className="form-label">Password</span>
                <input
                  className="form-input"
                  onChange={(event) =>
                    onSetConnectionForm((current) => ({ ...current, password: event.target.value }))
                  }
                  placeholder="Stored securely"
                  type="password"
                  value={connectionForm.password}
                />
              </label>
            </div>
            <label className="checkbox-row">
              <input
                checked={connectionForm.ssl}
                onChange={(event) =>
                  onSetConnectionForm((current) => ({ ...current, ssl: event.target.checked }))
                }
                type="checkbox"
              />
              <span>Use SSL when supported</span>
            </label>
          </div>
        </div>

        <div className="create-dialog-footer">
          <button className="dialog-button" onClick={onClose} type="button">
            Cancel
          </button>
          <button className="dialog-button secondary" disabled type="button">
            Import from URL
          </button>
          <button className="dialog-button secondary" disabled type="button">
            New Group
          </button>
          <button
            className={`dialog-button primary ${nativeMode ? '' : 'preview-action'}`}
            disabled={isBusy}
            title={nativeMode ? undefined : 'Creates a session-only preview link. Launch Tauri to persist it locally.'}
            type="submit"
          >
            Create Link
          </button>
        </div>
      </form>
    </div>
  );
}

interface QueryEditorViewProps {
  connections: ConnectionConfig[];
  isBusy: boolean;
  naturalLanguageQuery: string;
  onGenerateSql: () => Promise<void>;
  onRunQuery: () => Promise<QueryResult | null>;
  onSelectConnection: (connectionId: string) => void;
  onSetNaturalLanguageQuery: (value: string) => void;
  onSetQuery: (value: string) => void;
  query: string;
  queryResult: QueryResult | null;
  selectedConnectionId: string;
}

async function writeClipboardText(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall back to the legacy selection path below.
    }
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  const copied = document.execCommand('copy');
  document.body.removeChild(textarea);
  return copied;
}

function downloadTextFile(filename: string, content: string, type: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

type AudienceMode = 'developer' | 'product' | 'analyst';

const AI_PERSONAS: Array<{
  id: AudienceMode;
  label: string;
  summary: string;
}> = [
  {
    id: 'developer',
    label: 'Developer',
    summary: 'SQL, schema, explain plans, guardrails.',
  },
  {
    id: 'product',
    label: 'Product Manager',
    summary: 'Funnels, adoption, cohorts, launch signals.',
  },
  {
    id: 'analyst',
    label: 'Business Analyst',
    summary: 'Metrics, variance, segments, executive readouts.',
  },
];

const AI_PROMPTS: Record<AudienceMode, string[]> = {
  developer: [
    'Find slow queries and suggest the safest index',
    'Explain this table relationship before I query it',
    'Generate a read-only query with a 100 row limit',
  ],
  product: [
    'Show activation drop-off by account tier this week',
    'Which product signals changed after the last release?',
    'Summarize user adoption risks for the roadmap review',
  ],
  analyst: [
    'Compare revenue by customer segment and explain variance',
    'Build an executive summary for ARR movement',
    'Find anomalies in usage, retention, and spend',
  ],
};

function buildAiBrief(
  mode: AudienceMode,
  prompt: string,
  connection: ConnectionConfig | undefined,
  table: PreviewSchemaTable | undefined,
  result: QueryResult | null,
) {
  const subject = table ? `${table.schema}.${table.name}` : connection?.database || 'the selected data source';
  const rowSignal = result?.success ? `${result.row_count} rows in ${result.execution_time_ms}ms` : 'no executed result yet';

  if (mode === 'product') {
    return {
      title: 'Product Readout',
      bullets: [
        `Question framed around ${subject} so PMs can discuss behavior without writing SQL.`,
        `Recommended output: activation slice, cohort movement, owner-impact notes, and launch risk tags.`,
        `Current evidence: ${rowSignal}. Run the generated query to move from draft to decision support.`,
      ],
      next: 'Ask AI to turn the result into a roadmap note, success metric, or experiment hypothesis.',
    };
  }

  if (mode === 'analyst') {
    return {
      title: 'Business Analysis Brief',
      bullets: [
        `Metric context uses ${subject} with segment, variance, and confidence language.`,
        `Recommended output: top movers, baseline comparison, anomaly callouts, and CSV-ready rows.`,
        `Current evidence: ${rowSignal}. Validate against finance definitions before sharing externally.`,
      ],
      next: 'Ask AI for an executive summary, chart recommendation, or metric definition.',
    };
  }

  return {
    title: 'Developer Plan',
    bullets: [
      `Dialect and schema context are scoped to ${connection?.db_type ?? 'the selected engine'}.`,
      `Recommended output: read-only SQL, explain-plan notes, null/type assumptions, and failure modes.`,
      `Current evidence: ${rowSignal}. Keep destructive statements behind native guardrails.`,
    ],
    next: prompt.trim()
      ? 'Run, inspect the result grid, then ask for optimization or schema changes.'
      : 'Describe the query intent or choose a prompt starter.',
  };
}

function QueryEditorView({
  connections,
  isBusy,
  naturalLanguageQuery,
  onGenerateSql,
  onRunQuery,
  onSelectConnection,
  onSetNaturalLanguageQuery,
  onSetQuery,
  query,
  queryResult,
  selectedConnectionId,
}: QueryEditorViewProps) {
  const selectedConnection = connections.find((connection) => connection.id === selectedConnectionId);
  const selectedDatabaseLabel = selectedConnection ? getDatabaseLabel(selectedConnection.db_type) : 'No connection';
  const schemaTables = useMemo(
    () => (selectedConnection ? buildPreviewSchema(selectedConnection) : []),
    [selectedConnection],
  );
  const [activeQueryTab, setActiveQueryTab] = useState('scratch');
  const [audienceMode, setAudienceMode] = useState<AudienceMode>('developer');
  const [schemaFilter, setSchemaFilter] = useState('');
  const [selectedTableName, setSelectedTableName] = useState('');
  const [queryHistory, setQueryHistory] = useState<Array<{ id: string; label: string; time: string; rows: string }>>([]);
  const [resultActionMessage, setResultActionMessage] = useState<{ key: string; message: string } | null>(null);
  const [resultCopyBuffer, setResultCopyBuffer] = useState<{ csv: string; key: string } | null>(null);
  const [pinnedResults, setPinnedResults] = useState<PinnedArtifact[]>([]);
  const queryTabs = [
    { id: 'scratch', label: 'Scratch.sql' },
    { id: 'inspect', label: 'Inspect table' },
    { id: 'explain', label: 'Explain plan' },
  ];
  const filteredSchemaTables = schemaTables.filter((table) =>
    `${table.schema}.${table.name}`.toLowerCase().includes(schemaFilter.trim().toLowerCase()),
  );
  const selectedSchemaTable = schemaTables.find((table) => table.name === selectedTableName) ?? schemaTables[0];
  const aiBrief = buildAiBrief(audienceMode, naturalLanguageQuery, selectedConnection, selectedSchemaTable, queryResult);
  const activePersona = AI_PERSONAS.find((persona) => persona.id === audienceMode) ?? AI_PERSONAS[0];
  const resultEvidenceKey = queryResult?.success
    ? `${queryResult.row_count}:${queryResult.execution_time_ms}:${queryResult.columns.map((column) => column.name).join('|')}`
    : 'no-result';
  const visibleResultActionMessage = resultActionMessage?.key === resultEvidenceKey ? resultActionMessage.message : '';
  const visibleCopyBuffer = resultCopyBuffer?.key === resultEvidenceKey ? resultCopyBuffer.csv : '';

  function openTable(table: PreviewSchemaTable) {
    setSelectedTableName(table.name);
    setActiveQueryTab('inspect');
    onSetQuery(`SELECT *\nFROM ${table.schema}.${table.name}\nLIMIT 100;`);
  }

  function loadQueryTab(tabId: string) {
    setActiveQueryTab(tabId);

    if (tabId === 'explain') {
      onSetQuery(`EXPLAIN ANALYZE\n${query.trim() || 'SELECT * FROM public.users LIMIT 100;'}`);
    }
  }

  async function runAndTrack() {
    const result = await onRunQuery();
    setQueryHistory((current) => [
      {
        id: `${Date.now()}`,
        label: query.trim().split('\n')[0]?.slice(0, 48) || 'Untitled query',
        rows: result?.success ? `${result.row_count} rows` : result?.error ? 'failed' : 'pending',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
      ...current,
    ].slice(0, 6));
  }

  async function askAi() {
    if (!naturalLanguageQuery.trim()) {
      onSetNaturalLanguageQuery(AI_PROMPTS[audienceMode][0]);
      return;
    }

    await onGenerateSql();
  }

  async function copyResults() {
    if (!queryResult?.success) {
      return;
    }

    const csv = serializeQueryResultToCsv(queryResult);

    try {
      const copied = await writeClipboardText(csv);

      if (copied) {
        setResultCopyBuffer(null);
        setResultActionMessage({ key: resultEvidenceKey, message: `Copied ${summarizeQueryResult(queryResult)} as CSV.` });
        return;
      }

      setResultCopyBuffer({ csv, key: resultEvidenceKey });
      setResultActionMessage({
        key: resultEvidenceKey,
        message: `Clipboard blocked; CSV buffer is ready below for ${summarizeQueryResult(queryResult)}.`,
      });
    } catch (error) {
      setResultCopyBuffer({ csv, key: resultEvidenceKey });
      setResultActionMessage({ key: resultEvidenceKey, message: `Copy failed: ${getErrorMessage(error)}` });
    }
  }

  function exportResults() {
    if (!queryResult?.success) {
      return;
    }

    const csv = serializeQueryResultToCsv(queryResult);
    downloadTextFile(`queryflux-results-${Date.now()}.csv`, csv, 'text/csv;charset=utf-8');
    setResultCopyBuffer(null);
    setResultActionMessage({ key: resultEvidenceKey, message: `Exported ${summarizeQueryResult(queryResult)} to CSV.` });
  }

  function pinResults() {
    if (!queryResult?.success) {
      return;
    }

    const artifact = buildPinnedResultArtifact({
      connectionName: selectedConnection?.name,
      query,
      result: queryResult,
    });

    setPinnedResults((current) => [artifact, ...current].slice(0, 3));
    setResultCopyBuffer(null);
    setResultActionMessage({ key: resultEvidenceKey, message: `Pinned ${summarizeQueryResult(queryResult)} to this workbench.` });
  }

  return (
    <div className="query-editor">
      <div className="query-header">
        <div className="query-left">
          <div className="query-heading">
            <span>Workbench</span>
            <strong>{selectedConnection?.name ?? 'SQL Draft'}</strong>
          </div>
          <div className="query-controls">
            <button className="btn btn-primary" disabled={isBusy || connections.length === 0} onClick={() => void runAndTrack()} type="button">
              <Icon name="run" />
              Run
            </button>
            <button className="btn btn-secondary" disabled={isBusy || connections.length === 0} onClick={() => void askAi()} type="button">
              <Icon name="spark" />
              Ask AI
            </button>
          </div>
        </div>
        <div className="query-status">
          <select
            className="query-select"
            disabled={connections.length === 0}
            onChange={(event) => onSelectConnection(event.target.value)}
            value={selectedConnectionId}
          >
            {connections.length === 0 && <option value="">No data links available</option>}
            {connections.map((connection) => (
              <option key={connection.id} value={connection.id}>
                {connection.name}
              </option>
            ))}
          </select>
          <div className="ai-status">AI SQL Copilot</div>
        </div>
      </div>

      <div className="ai-command-center">
        <div className="persona-switcher" aria-label="AI audience mode">
          {AI_PERSONAS.map((persona) => (
            <button
              className={`persona-chip ${audienceMode === persona.id ? 'active' : ''}`}
              key={persona.id}
              onClick={() => setAudienceMode(persona.id)}
              type="button"
            >
              <span>{persona.label}</span>
              <small>{persona.summary}</small>
            </button>
          ))}
        </div>
        <div className="ai-prompt-row">
          <label className="ai-prompt-box">
            <span className="nl-label">Speak to AI</span>
            <input
              onChange={(event) => onSetNaturalLanguageQuery(event.target.value)}
              placeholder={`Ask as a ${activePersona.label.toLowerCase()}, for example: ${AI_PROMPTS[audienceMode][0]}`}
              value={naturalLanguageQuery}
            />
          </label>
          <button className="ai-ask-button" disabled={isBusy || connections.length === 0} onClick={() => void askAi()} type="button">
            <Icon name="spark" />
            Ask
          </button>
        </div>
        <div className="prompt-starters" aria-label="AI prompt starters">
          {AI_PROMPTS[audienceMode].map((prompt) => (
            <button key={prompt} onClick={() => onSetNaturalLanguageQuery(prompt)} type="button">
              {prompt}
            </button>
          ))}
        </div>
      </div>

      <div className="query-content">
        <aside className="workbench-context" aria-label="Database browser">
          <section className="context-block context-primary">
            <div className="context-eyebrow">Active session</div>
            <div className="context-title">{selectedConnection?.name ?? 'No database selected'}</div>
            <div className="context-meta">
              {selectedConnection
                ? `${selectedDatabaseLabel} / ${selectedConnection.host}:${selectedConnection.port}`
                : 'Create or select a connection to execute SQL.'}
            </div>
          </section>

          <section className="context-block">
            <div className="context-row">
              <span>Dialect</span>
              <strong>{selectedConnection?.db_type ?? 'none'}</strong>
            </div>
            <div className="context-row">
              <span>Database</span>
              <strong>{selectedConnection?.database || 'not set'}</strong>
            </div>
            <div className="context-row">
              <span>Transport</span>
              <strong>{selectedConnection?.ssl ? 'SSL' : 'plain'}</strong>
            </div>
          </section>

          <section className="schema-browser">
            <div className="schema-browser-header">
              <span>Schema</span>
              <strong>{schemaTables.length}</strong>
            </div>
            <label className="schema-search">
              <Icon name="search" />
              <input
                onChange={(event) => setSchemaFilter(event.target.value)}
                placeholder="Filter tables"
                value={schemaFilter}
              />
            </label>
            <div className="schema-table-list">
              {filteredSchemaTables.map((table) => (
                <button
                  className={`schema-table-item ${selectedSchemaTable?.name === table.name ? 'active' : ''}`}
                  key={`${table.schema}.${table.name}`}
                  onClick={() => openTable(table)}
                  type="button"
                >
                  <Icon name="table" />
                  <span>
                    <strong>{table.name}</strong>
                    <small>{table.schema} · {table.rowCount}</small>
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section className="schema-columns">
            <div className="context-eyebrow">Columns</div>
            {(selectedSchemaTable?.columns ?? []).map((column) => (
              <div className="schema-column" key={column.name}>
                <span>{column.key ? 'PK' : '  '}</span>
                <strong>{column.name}</strong>
                <small>{column.type}</small>
              </div>
            ))}
          </section>

          <section className="context-block">
            <div className="context-eyebrow">History</div>
            <div className="query-history">
              {queryHistory.length === 0 && <span className="history-empty">No runs yet</span>}
              {queryHistory.map((item) => (
                <button className="history-item" key={item.id} type="button">
                  <Icon name="history" />
                  <span>
                    <strong>{item.label}</strong>
                    <small>{item.time} · {item.rows}</small>
                  </span>
                </button>
              ))}
            </div>
          </section>
        </aside>

        <div className="query-workspace">
          <div className="query-tabbar">
            {queryTabs.map((tab) => (
              <button
                className={`query-tab ${activeQueryTab === tab.id ? 'active' : ''}`}
                key={tab.id}
                onClick={() => loadQueryTab(tab.id)}
                type="button"
              >
                {tab.label}
              </button>
            ))}
            <button className="query-tab add-tab" type="button">+</button>
            <button
              className="query-tab execute-tab"
              disabled={isBusy || connections.length === 0}
              onClick={() => void runAndTrack()}
              type="button"
            >
              Execute
            </button>
          </div>
          <div className="query-input-area">
            <div className="editor-rail" aria-hidden="true">
              {Array.from({ length: 18 }, (_, index) => (
                <span key={index}>{index + 1}</span>
              ))}
            </div>
            <textarea
              className="query-textarea"
              onChange={(event) => onSetQuery(event.target.value)}
              spellCheck={false}
              value={query}
            />
          </div>
        </div>

        <div className="query-results-area">
          <section className="ai-brief-panel" aria-label="AI brief">
            <div className="ai-brief-header">
              <span>{aiBrief.title}</span>
              <strong>{activePersona.label}</strong>
            </div>
            <div className="ai-brief-body">
              {aiBrief.bullets.map((item) => (
                <p key={item}>{item}</p>
              ))}
            </div>
            <div className="ai-next-step">{aiBrief.next}</div>
          </section>
          <div className="query-results-header">
            <div className="query-results-title">
              <span>Data Grid {queryResult?.success ? `- ${queryResult.row_count} rows in ${queryResult.execution_time_ms}ms` : ''}</span>
              {visibleResultActionMessage && <small aria-live="polite">{visibleResultActionMessage}</small>}
            </div>
            <div className="result-actions">
              <button disabled={!queryResult?.success} onClick={() => void copyResults()} type="button">Copy</button>
              <button disabled={!queryResult?.success} onClick={exportResults} type="button">CSV</button>
              <button disabled={!queryResult?.success} onClick={pinResults} type="button">Pin</button>
            </div>
          </div>
          <div className="query-results-content results-scroll">
            {pinnedResults.length > 0 && (
              <div className="pinned-results-strip" aria-label="Pinned query artifacts">
                {pinnedResults.map((artifact) => (
                  <article key={artifact.id}>
                    <span>{artifact.createdAt}</span>
                    <strong>{artifact.title}</strong>
                    <p>{artifact.summary}</p>
                  </article>
                ))}
              </div>
            )}
            {visibleCopyBuffer && (
              <label className="result-copy-buffer">
                <span>CSV copy buffer</span>
                <textarea
                  aria-label="CSV copy buffer"
                  onFocus={(event) => event.currentTarget.select()}
                  readOnly
                  value={visibleCopyBuffer}
                />
              </label>
            )}
            {!queryResult && (
              <div className="results-placeholder">
                <div className="results-icon">
                  <Icon name="query" />
                </div>
                <div className="results-text">Run a query to see results here</div>
                <div className="results-hint">Results are executed by the native bridge against the configured backend.</div>
              </div>
            )}
            {queryResult && !queryResult.success && (
              <div className="error-panel">{queryResult.error ?? 'Query failed with no error message.'}</div>
            )}
            {queryResult?.success && queryResult.rows.length === 0 && (
              <div className="results-placeholder">
                <div className="results-icon">
                  <Icon name="run" />
                </div>
                <div className="results-text">Query completed with no rows</div>
              </div>
            )}
            {queryResult?.success && queryResult.rows.length > 0 && (
              <table className="results-table">
                <thead>
                  <tr>
                    {queryResult.columns.map((column) => (
                      <th key={column.name}>{column.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {queryResult.rows.slice(0, 50).map((row, rowIndex) => (
                    <tr key={`${rowIndex}-${queryResult.columns.length}`}>
                      {queryResult.columns.map((column) => (
                        <td key={column.name}>{formatCellValue(row[column.name])}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface MonitorViewProps {
  backendUrl: string;
  connectionStatuses: Record<string, ConnectionStatus>;
  connections: ConnectionConfig[];
  lastQueryResult: QueryResult | null;
  nativeMode: boolean;
}

function MonitorView({ backendUrl, connectionStatuses, connections, lastQueryResult, nativeMode }: MonitorViewProps) {
  const connectedCount = Object.values(connectionStatuses).filter((status) => status.connected).length;

  return (
    <div className="utility-view">
      <div className="section-header">
        <h2 className="section-title">Desktop Activity</h2>
        <p className="section-description">Runtime state for the Flux bridge, connection fabric, and query activity.</p>
      </div>

      <div className="metrics-grid">
        <MetricCard label="Runtime" value={nativeMode ? 'Native' : 'Preview'} subtitle="Tauri bridge" />
        <MetricCard label="Backend" value={backendUrl.replace(/^https?:\/\//, '')} subtitle="QUERYFLUX_BACKEND_URL" />
        <MetricCard label="Connections" value={`${connectedCount}/${connections.length}`} subtitle="Tested online" />
        <MetricCard
          label="Last Query"
          value={lastQueryResult ? `${lastQueryResult.execution_time_ms}ms` : 'None'}
          subtitle={lastQueryResult ? `${lastQueryResult.row_count} rows` : 'No execution yet'}
        />
      </div>

      <div className="card">
        <h3 className="card-title">Launch Gate</h3>
        <div className="launch-list">
          <LaunchGate done={nativeMode} label="Run inside Tauri native shell" />
          <LaunchGate done={connections.length > 0} label="At least one saved database connection" />
          <LaunchGate done={connectedCount > 0} label="At least one backend-verified connection" />
          <LaunchGate done={Boolean(lastQueryResult?.success)} label="Successful query execution from desktop" />
        </div>
      </div>
    </div>
  );
}

interface VisualCanvasViewProps {
  connections: ConnectionConfig[];
  lastQueryResult: QueryResult | null;
  selectedConnection: ConnectionConfig | undefined;
}

const SEMANTIC_METRICS: SemanticMetric[] = [
  { id: 'active_users', name: 'Active users', owner: 'Product', grain: 'daily user', certified: true },
  { id: 'arr_movement', name: 'ARR movement', owner: 'Revenue', grain: 'account month', certified: true },
  { id: 'query_success', name: 'Query success rate', owner: 'Platform', grain: 'query run', certified: true },
  { id: 'warehouse_cost', name: 'Warehouse cost', owner: 'Finance', grain: 'warehouse day', certified: false },
];

function VisualCanvasView({ connections, lastQueryResult, selectedConnection }: VisualCanvasViewProps) {
  const [canvasMode, setCanvasMode] = useState<'explore' | 'dashboard' | 'story'>('dashboard');
  const [activeMetricId, setActiveMetricId] = useState(SEMANTIC_METRICS[0].id);
  const [chartType, setChartType] = useState<ChartType>('bar');
  const [visualQuestion, setVisualQuestion] = useState('Why did activation move this week, and what should product do next?');
  const [generatedExploration, setGeneratedExploration] = useState<{ brief: ExplorationBrief; key: string } | null>(null);
  const [artifactMessage, setArtifactMessage] = useState<{ key: string; message: string } | null>(null);
  const [pinnedArtifacts, setPinnedArtifacts] = useState<PinnedArtifact[]>([]);
  const activeMetric = SEMANTIC_METRICS.find((metric) => metric.id === activeMetricId) ?? SEMANTIC_METRICS[0];
  const chartSpec = useMemo(
    () =>
      buildChartSpec({
        canvasMode,
        chartType,
        metric: activeMetric,
        question: visualQuestion,
        result: lastQueryResult,
      }),
    [activeMetric, canvasMode, chartType, lastQueryResult, visualQuestion],
  );
  const dashboardTiles = useMemo(
    () => buildDashboardTiles(lastQueryResult, activeMetric),
    [activeMetric, lastQueryResult],
  );
  const liveExploration = useMemo(
    () => buildExplorationBrief({ chartSpec, metric: activeMetric, question: visualQuestion }),
    [activeMetric, chartSpec, visualQuestion],
  );
  const canvasEvidenceKey = `${activeMetricId}:${chartType}:${lastQueryResult?.success ? `${lastQueryResult.row_count}:${lastQueryResult.execution_time_ms}` : 'sample'}`;
  const displayedExploration = generatedExploration?.key === canvasEvidenceKey
    ? generatedExploration.brief
    : liveExploration;
  const visibleArtifactMessage = artifactMessage?.key === canvasEvidenceKey ? artifactMessage.message : '';

  function selectMetric(metricId: string) {
    setActiveMetricId(metricId);
    setGeneratedExploration(null);
    setArtifactMessage(null);
  }

  function selectChartType(nextChartType: ChartType) {
    setChartType(nextChartType);
    setGeneratedExploration(null);
    setArtifactMessage(null);
  }

  function generateExploration() {
    const brief = buildExplorationBrief({ chartSpec, metric: activeMetric, question: visualQuestion });
    setGeneratedExploration({ brief, key: canvasEvidenceKey });
    setArtifactMessage({
      key: canvasEvidenceKey,
      message: `${brief.title} generated from ${chartSpec.source === 'query-result' ? 'the last executed result' : 'the sample semantic model'}.`,
    });
    setCanvasMode('story');
  }

  function addChartArtifact() {
    const artifact = buildPinnedChartArtifact(chartSpec, displayedExploration);
    setPinnedArtifacts((current) => [artifact, ...current].slice(0, 4));
    setArtifactMessage({ key: canvasEvidenceKey, message: `Pinned ${artifact.title} to the canvas.` });
  }

  function forecastMetric() {
    selectChartType('forecast');
    setCanvasMode('dashboard');
    setArtifactMessage({
      key: `${activeMetricId}:forecast:${lastQueryResult?.success ? `${lastQueryResult.row_count}:${lastQueryResult.execution_time_ms}` : 'sample'}`,
      message: `Forecast rebuilt for ${activeMetric.name} using ${chartSpec.source === 'query-result' ? 'query-result evidence' : 'sample evidence'}.`,
    });
  }

  function presentStory() {
    setCanvasMode('story');
    setArtifactMessage({ key: canvasEvidenceKey, message: `Story mode prepared for ${activeMetric.name}.` });
  }

  return (
    <div className="visual-canvas">
      <header className="visual-canvas-header">
        <div>
          <span className="visual-eyebrow">Future analytics layer</span>
          <h2>Visual Canvas</h2>
          <p>Ask questions, assemble governed metrics, and turn live data into product and business decisions.</p>
        </div>
        <div className="canvas-mode-switcher" aria-label="Canvas mode">
          {[
            ['explore', 'Explore'],
            ['dashboard', 'Dashboard'],
            ['story', 'Story'],
          ].map(([id, label]) => (
            <button
              className={canvasMode === id ? 'active' : ''}
              key={id}
              onClick={() => setCanvasMode(id as 'explore' | 'dashboard' | 'story')}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      <div className="visual-layout">
        <aside className="semantic-layer-panel">
          <div className="panel-heading">
            <span>Semantic Layer</span>
            <strong>{SEMANTIC_METRICS.filter((metric) => metric.certified).length}/{SEMANTIC_METRICS.length}</strong>
          </div>
          <div className="metric-catalog">
            {SEMANTIC_METRICS.map((metric) => (
              <button
                className={`metric-catalog-item ${activeMetric.id === metric.id ? 'active' : ''}`}
                key={metric.name}
                onClick={() => selectMetric(metric.id)}
                type="button"
              >
                <span>
                  <strong>{metric.name}</strong>
                  <small>{metric.owner} · {metric.grain}</small>
                </span>
                <em>{metric.certified ? 'certified' : 'draft'}</em>
              </button>
            ))}
          </div>
          <div className="ai-data-guide">
            <div className="panel-heading">
              <span>AI Data Guide</span>
            </div>
            <label className="visual-question">
              <span>Ask a business question</span>
              <textarea
                onChange={(event) => setVisualQuestion(event.target.value)}
                value={visualQuestion}
              />
            </label>
            <button onClick={generateExploration} type="button">Generate exploration</button>
          </div>
        </aside>

        <section className="dashboard-canvas">
          <div className="canvas-toolbar">
            <span>{selectedConnection?.name ?? connections[0]?.name ?? 'No data source'}</span>
            <div>
              <button onClick={addChartArtifact} type="button">Add chart</button>
              <button onClick={forecastMetric} type="button">Forecast</button>
              <button onClick={presentStory} type="button">Present</button>
            </div>
          </div>

          <div className="chart-type-switcher" aria-label="Chart type">
            {[
              ['bar', 'Bar'],
              ['line', 'Trend'],
              ['scatter', 'Outliers'],
              ['forecast', 'Forecast'],
            ].map(([id, label]) => (
              <button
                className={chartType === id ? 'active' : ''}
                key={id}
                onClick={() => selectChartType(id as ChartType)}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>

          <div className="canvas-evidence-strip" aria-live="polite">
            <span>{chartSpec.source === 'query-result' ? 'Result-backed' : 'Sample model'}</span>
            <strong>{Math.round(chartSpec.confidence * 100)}% confidence</strong>
            <em>{visibleArtifactMessage || chartSpec.recommendation}</em>
          </div>

          <div className="dashboard-kpis">
            {dashboardTiles.map((tile) => (
              <article className={`dashboard-kpi ${tile.tone}`} key={tile.label}>
                <span>{tile.label}</span>
                <strong>{tile.value}</strong>
                <small>{tile.delta}</small>
              </article>
            ))}
          </div>

          <div className="visual-board">
            <article className="chart-card main-chart">
              <div className="chart-card-header">
                <div>
                  <span>Recommended visualization</span>
                  <strong>{chartSpec.title}</strong>
                </div>
                <em>{chartSpec.recommendation}</em>
              </div>
              <div className={`bar-chart ${chartType}`} aria-label="Segment performance chart">
                {chartSpec.rows.map((row) => (
                  <div className="bar-row" key={row.label}>
                    <span>{row.label}</span>
                    <div>
                      <i style={{ width: `${row.value}%` }} />
                    </div>
                    <strong>{row.displayValue}</strong>
                  </div>
                ))}
              </div>
            </article>

            <article className="chart-card">
              <div className="chart-card-header">
                <div>
                  <span>AI explanation</span>
                  <strong>{canvasMode === 'story' ? 'Decision narrative' : 'What changed'}</strong>
                </div>
              </div>
              <ul className="insight-list">
                {displayedExploration.bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
                {displayedExploration.warning && <li>{displayedExploration.warning}</li>}
              </ul>
            </article>
          </div>

          {pinnedArtifacts.length > 0 && (
            <div className="artifact-strip" aria-label="Pinned canvas artifacts">
              {pinnedArtifacts.map((artifact) => (
                <article key={artifact.id}>
                  <span>{artifact.createdAt} · {artifact.source === 'query-result' ? 'result' : 'sample'}</span>
                  <strong>{artifact.title}</strong>
                  <p>{artifact.summary}</p>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function MetricCard({ label, subtitle, value }: { label: string; subtitle: string; value: string }) {
  return (
    <div className="metric-card">
      <span className="metric-icon">●</span>
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      <div className="metric-subtitle">{subtitle}</div>
    </div>
  );
}

function LaunchGate({ done, label }: { done: boolean; label: string }) {
  return (
    <div className="launch-gate">
      <span className={`launch-gate-status ${done ? 'done' : ''}`}>{done ? 'done' : 'todo'}</span>
      <span>{label}</span>
    </div>
  );
}

function BackupView() {
  return (
    <div className="utility-view">
      <div className="section-header">
        <h2 className="section-title">Backup & Restore</h2>
        <p className="section-description">Planned production module. Unavailable data operations are separated from live flows.</p>
      </div>
      <div className="card roadmap-card">
        <h3 className="card-title">Production Scope</h3>
        <p>
          Backup orchestration should be implemented after restore testing, retention policy, and audit logging are in place.
        </p>
      </div>
    </div>
  );
}

function SettingsView({ backendUrl, nativeMode }: { backendUrl: string; nativeMode: boolean }) {
  return (
    <div className="utility-view">
      <div className="section-header">
        <h2 className="section-title">Settings</h2>
        <p className="section-description">Desktop runtime configuration needed before distributing QueryFlux.</p>
      </div>

      <div className="settings-stack">
        <section className="card">
          <h3 className="card-title">Backend Bridge</h3>
          <div className="settings-item">
            <div className="settings-info">
              <h3>Backend URL</h3>
              <p>{backendUrl}</p>
            </div>
            <span className="settings-chip">QUERYFLUX_BACKEND_URL</span>
          </div>
          <div className="settings-item">
            <div className="settings-info">
              <h3>Native mode</h3>
              <p>{nativeMode ? 'Tauri IPC is available.' : 'Running as a browser-only preview.'}</p>
            </div>
            <span className={`settings-chip ${nativeMode ? 'success-chip' : 'warning-chip'}`}>
              {nativeMode ? 'Ready' : 'Preview'}
            </span>
          </div>
        </section>

        <section className="card">
          <h3 className="card-title">Release Blockers</h3>
          <div className="launch-list">
            <LaunchGate done={false} label="Configure updater signing public key" />
            <LaunchGate done={false} label="Add macOS hardened runtime, signing identity, and notarization" />
            <LaunchGate done={false} label="Add Windows signing and installer smoke tests" />
            <LaunchGate done={false} label="Publish production backend URL and health checks" />
          </div>
        </section>
      </div>
    </div>
  );
}

export default App;
