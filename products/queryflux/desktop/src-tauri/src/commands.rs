use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Manager, State};

// ============================================================================
// Types for IPC Communication
// ============================================================================

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ConnectionConfig {
    pub id: String,
    pub name: String,
    pub db_type: String,
    pub host: String,
    pub port: u16,
    pub database: String,
    pub username: String,
    #[serde(skip_serializing)]
    pub password: Option<String>,
    pub ssl: bool,
    pub options: HashMap<String, String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct QueryRequest {
    pub connection_id: String,
    pub query: String,
    pub params: Option<Vec<serde_json::Value>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct QueryResult {
    pub columns: Vec<ColumnInfo>,
    pub rows: Vec<HashMap<String, serde_json::Value>>,
    pub row_count: i64,
    pub execution_time_ms: i64,
    pub success: bool,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ColumnInfo {
    pub name: String,
    pub data_type: String,
    pub nullable: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SchemaInfo {
    pub database: String,
    pub tables: Vec<TableInfo>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TableInfo {
    pub name: String,
    pub schema: String,
    pub columns: Vec<ColumnInfo>,
    pub indexes: Vec<IndexInfo>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct IndexInfo {
    pub name: String,
    pub columns: Vec<String>,
    pub unique: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct NLToSQLRequest {
    pub natural_language: String,
    pub connection_id: String,
    pub database_type: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct NLToSQLResult {
    pub sql: String,
    pub confidence: f64,
    pub confidence_level: String,
    pub explanation: String,
    pub warnings: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ConnectionStatus {
    pub id: String,
    pub name: String,
    pub connected: bool,
    pub last_error: Option<String>,
}

struct JsonHttpResponse {
    status: reqwest::StatusCode,
    body: serde_json::Value,
    raw: String,
}

// ============================================================================
// Application State
// ============================================================================

pub struct AppState {
    pub connections: Mutex<HashMap<String, ConnectionConfig>>,
    pub backend_url: String,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            connections: Mutex::new(HashMap::new()),
            backend_url: backend_url_from_env(),
        }
    }
}

fn backend_url_from_env() -> String {
    std::env::var("QUERYFLUX_BACKEND_URL")
        .unwrap_or_else(|_| "http://127.0.0.1:8080".to_string())
        .trim_end_matches('/')
        .to_string()
}

const BACKEND_CONNECTION_ID_KEY: &str = "backend_connection_id";

fn backend_sync_type(db_type: &str) -> Option<&'static str> {
    match db_type {
        "postgresql" | "redshift" | "cockroachdb" | "timescaledb" => Some("postgresql"),
        "mysql" | "mariadb" => Some("mysql"),
        _ => None,
    }
}

fn backend_connection_id(config: &ConnectionConfig) -> Option<String> {
    config.options.get(BACKEND_CONNECTION_ID_KEY).cloned()
}

fn looks_like_uuid(value: &str) -> bool {
    if value.len() != 36 {
        return false;
    }

    for (index, ch) in value.chars().enumerate() {
        let is_hyphen = matches!(index, 8 | 13 | 18 | 23);
        if is_hyphen {
            if ch != '-' {
                return false;
            }
        } else if !ch.is_ascii_hexdigit() {
            return false;
        }
    }

    true
}

fn build_backend_connection_payload(
    config: &ConnectionConfig,
    password: Option<&str>,
) -> Result<serde_json::Value, String> {
    let backend_type = backend_sync_type(&config.db_type).ok_or_else(|| {
        format!(
            "{} connections are not yet wired for the native backend. QueryFlux Desktop currently supports live execution for PostgreSQL-compatible and MySQL-compatible engines.",
            config.db_type
        )
    })?;

    let mut payload = serde_json::Map::new();
    payload.insert("name".to_string(), serde_json::Value::String(config.name.clone()));
    payload.insert(
        "type".to_string(),
        serde_json::Value::String(backend_type.to_string()),
    );
    payload.insert("host".to_string(), serde_json::Value::String(config.host.clone()));
    payload.insert(
        "port".to_string(),
        serde_json::Value::Number(serde_json::Number::from(config.port)),
    );
    payload.insert(
        "database".to_string(),
        serde_json::Value::String(config.database.clone()),
    );
    payload.insert(
        "username".to_string(),
        serde_json::Value::String(config.username.clone()),
    );
    payload.insert("ssl".to_string(), serde_json::Value::Bool(config.ssl));

    if let Some(password) = password.filter(|password| !password.trim().is_empty()) {
        payload.insert(
            "password".to_string(),
            serde_json::Value::String(password.to_string()),
        );
    }

    Ok(serde_json::Value::Object(payload))
}

fn infer_data_type(value: &serde_json::Value) -> String {
    match value {
        serde_json::Value::Null => "text".to_string(),
        serde_json::Value::Bool(_) => "boolean".to_string(),
        serde_json::Value::Number(number) => {
            if number.is_i64() || number.is_u64() {
                "integer".to_string()
            } else {
                "numeric".to_string()
            }
        }
        serde_json::Value::Array(_) | serde_json::Value::Object(_) => "json".to_string(),
        serde_json::Value::String(text) => {
            if text.contains('T') && text.contains('-') && text.contains(':') {
                "timestamp".to_string()
            } else {
                "text".to_string()
            }
        }
    }
}

fn extract_error_message(value: &serde_json::Value, raw: &str) -> String {
    let candidate = value
        .get("error")
        .and_then(serde_json::Value::as_str)
        .or_else(|| value.get("message").and_then(serde_json::Value::as_str))
        .or_else(|| {
            value
                .get("data")
                .and_then(|data| data.get("error"))
                .and_then(serde_json::Value::as_str)
        })
        .or_else(|| {
            value
                .get("data")
                .and_then(|data| data.get("message"))
                .and_then(serde_json::Value::as_str)
        })
        .or_else(|| {
            value
                .get("details")
                .and_then(serde_json::Value::as_array)
                .and_then(|details| details.first())
                .and_then(|detail| detail.get("message"))
                .and_then(serde_json::Value::as_str)
        })
        .or_else(|| {
            value
                .get("data")
                .and_then(|data| data.get("details"))
                .and_then(serde_json::Value::as_array)
                .and_then(|details| details.first())
                .and_then(|detail| detail.get("message"))
                .and_then(serde_json::Value::as_str)
        });

    if let Some(message) = candidate {
        if !message.trim().is_empty() {
            return message.trim().to_string();
        }
    }

    if !raw.trim().is_empty() {
        return raw.trim().to_string();
    }

    "Unknown backend error".to_string()
}

fn format_backend_unavailable(backend_url: &str, error: &str) -> String {
    format!(
        "Unable to reach QueryFlux backend at {}. Start the backend on that URL or set QUERYFLUX_BACKEND_URL. Last error: {}",
        backend_url, error
    )
}

async fn send_json_request(request: reqwest::RequestBuilder) -> Result<JsonHttpResponse, String> {
    let response = request.send().await.map_err(|e| e.to_string())?;
    let status = response.status();
    let raw = response.text().await.map_err(|e| e.to_string())?;
    let body = serde_json::from_str(&raw).unwrap_or_else(|_| {
        serde_json::json!({
            "raw": raw,
        })
    });

    Ok(JsonHttpResponse { status, body, raw })
}

fn extract_backend_connection_id(response: &JsonHttpResponse) -> Option<String> {
    response
        .body
        .get("data")
        .and_then(|data| data.get("id"))
        .or_else(|| response.body.get("id"))
        .and_then(serde_json::Value::as_str)
        .map(ToString::to_string)
}

fn parse_connection_status(
    local_id: &str,
    name: &str,
    response: &JsonHttpResponse,
) -> ConnectionStatus {
    let data = response.body.get("data").unwrap_or(&response.body);
    let connected = data
        .get("status")
        .and_then(serde_json::Value::as_str)
        .map(|status| status.eq_ignore_ascii_case("connected"))
        .or_else(|| data.get("success").and_then(serde_json::Value::as_bool))
        .unwrap_or(response.status.is_success());

    ConnectionStatus {
        id: local_id.to_string(),
        name: name.to_string(),
        connected,
        last_error: if connected {
            None
        } else {
            Some(extract_error_message(data, &response.raw))
        },
    }
}

fn build_query_columns(
    names: &[String],
    rows: &[HashMap<String, serde_json::Value>],
) -> Vec<ColumnInfo> {
    names.iter()
        .map(|name| {
            let first_value = rows.iter().find_map(|row| row.get(name));
            let nullable = rows
                .iter()
                .any(|row| row.get(name).is_none() || row.get(name) == Some(&serde_json::Value::Null));

            ColumnInfo {
                name: name.clone(),
                data_type: first_value
                    .map(infer_data_type)
                    .unwrap_or_else(|| "text".to_string()),
                nullable,
            }
        })
        .collect()
}

fn parse_query_result(response: &JsonHttpResponse) -> Result<QueryResult, String> {
    let data = response.body.get("data").unwrap_or(&response.body);
    let rows = data
        .get("rows")
        .cloned()
        .map(serde_json::from_value::<Vec<HashMap<String, serde_json::Value>>>)
        .transpose()
        .map_err(|e| e.to_string())?
        .unwrap_or_default();

    let columns = if let Some(value) = data.get("columns") {
        if let Ok(columns) = serde_json::from_value::<Vec<ColumnInfo>>(value.clone()) {
            columns
        } else if let Some(names) = value.as_array().map(|items| {
            items
                .iter()
                .filter_map(|item| item.as_str().map(ToString::to_string))
                .collect::<Vec<_>>()
        }) {
            build_query_columns(&names, &rows)
        } else {
            let mut names = rows
                .first()
                .map(|row| row.keys().cloned().collect::<Vec<_>>())
                .unwrap_or_default();
            names.sort();
            build_query_columns(&names, &rows)
        }
    } else {
        let mut names = rows
            .first()
            .map(|row| row.keys().cloned().collect::<Vec<_>>())
            .unwrap_or_default();
        names.sort();
        build_query_columns(&names, &rows)
    };

    let row_count = data
        .get("row_count")
        .or_else(|| data.get("rowCount"))
        .and_then(serde_json::Value::as_i64)
        .unwrap_or(rows.len() as i64);
    let execution_time_ms = data
        .get("execution_time_ms")
        .or_else(|| data.get("executionTime"))
        .or_else(|| data.get("executionTimeMs"))
        .and_then(serde_json::Value::as_i64)
        .unwrap_or(0);
    let success = data
        .get("success")
        .and_then(serde_json::Value::as_bool)
        .unwrap_or(response.status.is_success());

    Ok(QueryResult {
        columns,
        rows,
        row_count,
        execution_time_ms,
        success,
        error: if success {
            None
        } else {
            Some(extract_error_message(data, &response.raw))
        },
    })
}

fn parse_schema_column(value: &serde_json::Value) -> ColumnInfo {
    ColumnInfo {
        name: value
            .get("name")
            .and_then(serde_json::Value::as_str)
            .unwrap_or("column")
            .to_string(),
        data_type: value
            .get("data_type")
            .or_else(|| value.get("type"))
            .and_then(serde_json::Value::as_str)
            .unwrap_or("text")
            .to_string(),
        nullable: value
            .get("nullable")
            .and_then(serde_json::Value::as_bool)
            .unwrap_or(true),
    }
}

fn parse_schema_index(value: &serde_json::Value) -> IndexInfo {
    IndexInfo {
        name: value
            .get("name")
            .and_then(serde_json::Value::as_str)
            .unwrap_or("index")
            .to_string(),
        columns: value
            .get("columns")
            .and_then(serde_json::Value::as_array)
            .map(|items| {
                items
                    .iter()
                    .filter_map(|item| item.as_str().map(ToString::to_string))
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default(),
        unique: value
            .get("unique")
            .and_then(serde_json::Value::as_bool)
            .unwrap_or(false),
    }
}

fn parse_schema_table(value: &serde_json::Value, default_schema: &str) -> TableInfo {
    TableInfo {
        name: value
            .get("name")
            .and_then(serde_json::Value::as_str)
            .unwrap_or("table")
            .to_string(),
        schema: value
            .get("schema")
            .and_then(serde_json::Value::as_str)
            .unwrap_or(default_schema)
            .to_string(),
        columns: value
            .get("columns")
            .and_then(serde_json::Value::as_array)
            .map(|columns| columns.iter().map(parse_schema_column).collect())
            .unwrap_or_default(),
        indexes: value
            .get("indexes")
            .and_then(serde_json::Value::as_array)
            .map(|indexes| indexes.iter().map(parse_schema_index).collect())
            .unwrap_or_default(),
    }
}

fn parse_schema_info(response: &JsonHttpResponse) -> Result<SchemaInfo, String> {
    let data = response.body.get("data").unwrap_or(&response.body);

    if data.get("database").is_some() && data.get("tables").is_some() {
        return serde_json::from_value::<SchemaInfo>(data.clone()).map_err(|e| e.to_string());
    }

    if let Some(databases) = data.get("databases").and_then(serde_json::Value::as_array) {
        let database = databases
            .first()
            .and_then(|entry| entry.get("name"))
            .and_then(serde_json::Value::as_str)
            .unwrap_or("default")
            .to_string();
        let mut tables = Vec::new();

        for database_value in databases {
            let schemas = database_value
                .get("schemas")
                .and_then(serde_json::Value::as_array)
                .cloned()
                .unwrap_or_default();

            for schema in schemas {
                let schema_name = schema
                    .get("name")
                    .and_then(serde_json::Value::as_str)
                    .unwrap_or("public");
                if let Some(schema_tables) =
                    schema.get("tables").and_then(serde_json::Value::as_array)
                {
                    for table in schema_tables {
                        tables.push(parse_schema_table(table, schema_name));
                    }
                }
            }
        }

        return Ok(SchemaInfo { database, tables });
    }

    Err(format!(
        "Unexpected schema response from backend: {}",
        extract_error_message(&response.body, &response.raw)
    ))
}

fn confidence_level(confidence: f64) -> String {
    if confidence >= 0.9 {
        "high".to_string()
    } else if confidence >= 0.75 {
        "medium".to_string()
    } else {
        "low".to_string()
    }
}

fn parse_nl_to_sql_result(response: &JsonHttpResponse) -> Result<NLToSQLResult, String> {
    let data = response.body.get("data").unwrap_or(&response.body);
    let sql = data
        .get("sql")
        .and_then(serde_json::Value::as_str)
        .ok_or_else(|| "Backend did not return generated SQL".to_string())?
        .to_string();
    let confidence = data
        .get("confidence")
        .and_then(serde_json::Value::as_f64)
        .unwrap_or(0.82);
    let explanation = data
        .get("explanation")
        .and_then(serde_json::Value::as_str)
        .unwrap_or("Generated SQL from the current natural-language request.")
        .to_string();
    let warnings = data
        .get("warnings")
        .and_then(serde_json::Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(|item| item.as_str().map(ToString::to_string))
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    Ok(NLToSQLResult {
        sql,
        confidence,
        confidence_level: confidence_level(confidence),
        explanation,
        warnings,
    })
}

fn persist_connection_locally(
    app: &AppHandle,
    state: &AppState,
    config: &ConnectionConfig,
) -> Result<(), String> {
    let mut connections = state.connections.lock().map_err(|e| e.to_string())?;
    let mut config_to_store = config.clone();
    config_to_store.password = None;
    connections.insert(config.id.clone(), config_to_store);
    save_connections_to_disk(app, &connections)
}

async fn upsert_backend_connection_id(
    client: &reqwest::Client,
    backend_url: &str,
    config: &ConnectionConfig,
    password: Option<&str>,
) -> Result<String, String> {
    let payload = build_backend_connection_payload(config, password)?;
    let existing_backend_id = backend_connection_id(config).or_else(|| {
        if looks_like_uuid(&config.id) {
            Some(config.id.clone())
        } else {
            None
        }
    });

    if let Some(existing_backend_id) = existing_backend_id {
        let update_url = format!("{}/api/v1/connections/{}", backend_url, existing_backend_id);
        let response = send_json_request(client.put(update_url).json(&payload))
            .await
            .map_err(|error| format_backend_unavailable(backend_url, &error))?;

        if response.status.is_success() {
            return Ok(extract_backend_connection_id(&response).unwrap_or(existing_backend_id));
        }

        if response.status != reqwest::StatusCode::NOT_FOUND {
            return Err(format!(
                "Failed to sync connection with backend: {}",
                extract_error_message(&response.body, &response.raw)
            ));
        }
    }

    if payload.get("password").is_none() {
        return Err(
            "This connection needs a password before QueryFlux can register it with the backend. Re-save the connection with credentials."
                .to_string(),
        );
    }

    let create_url = format!("{}/api/v1/connections", backend_url);
    let response = send_json_request(client.post(create_url).json(&payload))
        .await
        .map_err(|error| format_backend_unavailable(backend_url, &error))?;

    if response.status.is_success() {
        return extract_backend_connection_id(&response).ok_or_else(|| {
            "Backend created the connection but did not return an id".to_string()
        });
    }

    Err(format!(
        "Failed to register connection with backend: {}",
        extract_error_message(&response.body, &response.raw)
    ))
}

async fn ensure_backend_connection(
    app: &AppHandle,
    state: &AppState,
    client: &reqwest::Client,
    config: &ConnectionConfig,
    password: Option<&str>,
) -> Result<String, String> {
    let backend_id = upsert_backend_connection_id(client, &state.backend_url, config, password).await?;

    if backend_connection_id(config).as_deref() != Some(backend_id.as_str()) {
        let mut updated = config.clone();
        updated
            .options
            .insert(BACKEND_CONNECTION_ID_KEY.to_string(), backend_id.clone());
        persist_connection_locally(app, state, &updated)?;
    }

    Ok(backend_id)
}

fn connection_store_path(app: &AppHandle) -> Result<PathBuf, String> {
    let config_dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&config_dir).map_err(|e| e.to_string())?;
    Ok(config_dir.join("connections.json"))
}

fn load_connections_from_disk(app: &AppHandle) -> Result<HashMap<String, ConnectionConfig>, String> {
    let path = connection_store_path(app)?;

    if !path.exists() {
        return Ok(HashMap::new());
    }

    let contents = fs::read_to_string(path).map_err(|e| e.to_string())?;
    let connections: Vec<ConnectionConfig> =
        serde_json::from_str(&contents).map_err(|e| e.to_string())?;

    Ok(connections
        .into_iter()
        .map(|connection| (connection.id.clone(), connection))
        .collect())
}

fn save_connections_to_disk(
    app: &AppHandle,
    connections: &HashMap<String, ConnectionConfig>,
) -> Result<(), String> {
    let path = connection_store_path(app)?;
    let mut persisted: Vec<ConnectionConfig> = connections.values().cloned().collect();

    persisted.sort_by(|a, b| a.name.cmp(&b.name));
    let contents = serde_json::to_string_pretty(&persisted).map_err(|e| e.to_string())?;
    fs::write(path, contents).map_err(|e| e.to_string())
}

pub fn hydrate_connections(app: &AppHandle, state: &AppState) -> Result<(), String> {
    let persisted = load_connections_from_disk(app)?;
    let mut connections = state.connections.lock().map_err(|e| e.to_string())?;
    *connections = persisted;
    Ok(())
}

#[tauri::command]
pub async fn get_backend_url(state: State<'_, AppState>) -> Result<String, String> {
    Ok(state.backend_url.clone())
}

// ============================================================================
// IPC Commands - Connection Management
// ============================================================================

/// Save a database connection configuration
#[tauri::command]
pub async fn save_connection(
    app: AppHandle,
    state: State<'_, AppState>,
    config: ConnectionConfig,
) -> Result<String, String> {
    let client = reqwest::Client::new();
    let password = config.password.clone();
    let backend_connection_id =
        upsert_backend_connection_id(&client, &state.backend_url, &config, password.as_deref())
            .await
            .ok();

    // Store password securely in keychain
    if let Some(ref password) = config.password {
        store_credential(&config.id, password)?;
    }

    let mut config_to_store = config.clone();
    if let Some(backend_connection_id) = backend_connection_id {
        config_to_store.options.insert(
            BACKEND_CONNECTION_ID_KEY.to_string(),
            backend_connection_id,
        );
    }
    persist_connection_locally(&app, state.inner(), &config_to_store)?;

    Ok(config.id)
}

/// Get all saved connections
#[tauri::command]
pub async fn get_connections(
    state: State<'_, AppState>,
) -> Result<Vec<ConnectionConfig>, String> {
    let connections = state.connections.lock().map_err(|e| e.to_string())?;
    Ok(connections.values().cloned().collect())
}

/// Delete a connection
#[tauri::command]
pub async fn delete_connection(
    app: AppHandle,
    state: State<'_, AppState>,
    connection_id: String,
) -> Result<bool, String> {
    let backend_connection_id = {
        let connections = state.connections.lock().map_err(|e| e.to_string())?;
        connections
            .get(&connection_id)
            .and_then(backend_connection_id)
            .or_else(|| {
                if looks_like_uuid(&connection_id) {
                    Some(connection_id.clone())
                } else {
                    None
                }
            })
    };

    let removed = {
        let mut connections = state.connections.lock().map_err(|e| e.to_string())?;

        // Remove from keychain
        let _ = delete_credential(&connection_id);

        let removed = connections.remove(&connection_id).is_some();
        save_connections_to_disk(&app, &connections)?;
        removed
    };

    if removed {
        if let Some(backend_connection_id) = backend_connection_id {
            let backend_url = state.backend_url.clone();
            let client = reqwest::Client::new();
            let _ = client
                .delete(format!(
                    "{}/api/v1/connections/{}",
                    backend_url, backend_connection_id
                ))
                .send()
                .await;
        }
    }

    Ok(removed)
}

/// Test a database connection
#[tauri::command]
pub async fn test_connection(
    state: State<'_, AppState>,
    connection_id: String,
) -> Result<ConnectionStatus, String> {
    let config = {
        let connections = state.connections.lock().map_err(|e| e.to_string())?;

        connections
            .get(&connection_id)
            .cloned()
            .ok_or_else(|| "Connection not found".to_string())?
    };
    let client = reqwest::Client::new();
    let password = get_credential(&connection_id).ok();
    let backend_url = state.backend_url.clone();

    if let Ok(payload) = build_backend_connection_payload(&config, password.as_deref()) {
        match send_json_request(
            client
                .post(format!("{}/api/v1/database/connect", backend_url))
                .json(&payload),
        )
        .await
        {
            Ok(response) => return Ok(parse_connection_status(&connection_id, &config.name, &response)),
            Err(error) => {
                let saved_backend_id =
                    backend_connection_id(&config).or_else(|| if looks_like_uuid(&config.id) {
                        Some(config.id.clone())
                    } else {
                        None
                    });

                if let Some(saved_backend_id) = saved_backend_id {
                    let response = send_json_request(
                        client.post(format!(
                            "{}/api/v1/connections/{}/test",
                            backend_url, saved_backend_id
                        )),
                    )
                    .await
                    .map_err(|saved_error| format_backend_unavailable(&backend_url, &saved_error))?;

                    return Ok(parse_connection_status(&connection_id, &config.name, &response));
                }

                return Err(format_backend_unavailable(&backend_url, &error));
            }
        }
    }

    Ok(ConnectionStatus {
        id: connection_id,
        name: config.name,
        connected: false,
        last_error: Some(
            "This connection type is not yet supported by the native backend. Live native mode currently supports PostgreSQL-compatible and MySQL-compatible engines."
                .to_string(),
        ),
    })
}

// ============================================================================
// IPC Commands - Query Execution
// ============================================================================

/// Execute a SQL query
#[tauri::command]
pub async fn execute_query(
    app: AppHandle,
    state: State<'_, AppState>,
    request: QueryRequest,
) -> Result<QueryResult, String> {
    let config = {
        let connections = state.connections.lock().map_err(|e| e.to_string())?;

        connections
            .get(&request.connection_id)
            .cloned()
            .ok_or_else(|| "Connection not found".to_string())?
    };

    let password = get_credential(&request.connection_id).ok();
    let client = reqwest::Client::new();
    let backend_connection_id =
        ensure_backend_connection(&app, state.inner(), &client, &config, password.as_deref())
            .await?;
    let backend_url = state.backend_url.clone();
    let response = send_json_request(
        client
            .post(format!("{}/api/v1/database/query", backend_url))
            .json(&serde_json::json!({
                "connectionId": backend_connection_id,
                "sql": request.query,
            })),
    )
    .await
    .map_err(|error| format_backend_unavailable(&state.backend_url, &error))?;

    if response.status.is_success() {
        parse_query_result(&response)
    } else {
        Ok(QueryResult {
            columns: vec![],
            rows: vec![],
            row_count: 0,
            execution_time_ms: 0,
            success: false,
            error: Some(extract_error_message(&response.body, &response.raw)),
        })
    }
}

/// Get database schema
#[tauri::command]
pub async fn get_schema(
    app: AppHandle,
    state: State<'_, AppState>,
    connection_id: String,
) -> Result<SchemaInfo, String> {
    let config = {
        let connections = state.connections.lock().map_err(|e| e.to_string())?;

        connections
            .get(&connection_id)
            .cloned()
            .ok_or_else(|| "Connection not found".to_string())?
    };

    let password = get_credential(&connection_id).ok();
    let client = reqwest::Client::new();
    let backend_connection_id =
        ensure_backend_connection(&app, state.inner(), &client, &config, password.as_deref())
            .await?;
    let response = send_json_request(
        client
            .post(format!("{}/api/v1/database/schema", state.backend_url))
            .json(&serde_json::json!({
                "connectionId": backend_connection_id,
            })),
    )
    .await
    .map_err(|error| format_backend_unavailable(&state.backend_url, &error))?;

    if response.status.is_success() {
        parse_schema_info(&response)
    } else {
        Err(format!(
            "Schema load failed: {}",
            extract_error_message(&response.body, &response.raw)
        ))
    }
}

// ============================================================================
// IPC Commands - AI Features
// ============================================================================

/// Convert natural language to SQL
#[tauri::command]
pub async fn convert_nl_to_sql(
    app: AppHandle,
    state: State<'_, AppState>,
    request: NLToSQLRequest,
) -> Result<NLToSQLResult, String> {
    let client = reqwest::Client::new();
    let config = {
        let connections = state.connections.lock().map_err(|e| e.to_string())?;

        connections
            .get(&request.connection_id)
            .cloned()
            .ok_or_else(|| "Connection not found".to_string())?
    };
    let password = get_credential(&request.connection_id).ok();
    let backend_connection_id =
        ensure_backend_connection(&app, state.inner(), &client, &config, password.as_deref())
            .await?;

    let primary = send_json_request(
        client
            .post(format!("{}/api/v1/nlp/query", state.backend_url))
            .json(&serde_json::json!({
                "question": request.natural_language,
                "databaseId": backend_connection_id,
            })),
    )
    .await
    .map_err(|error| format_backend_unavailable(&state.backend_url, &error))?;

    if primary.status.is_success() {
        return parse_nl_to_sql_result(&primary);
    }

    if primary.status == reqwest::StatusCode::NOT_FOUND {
        let fallback = send_json_request(
            client
                .post(format!("{}/api/v1/ai/generate-sql", state.backend_url))
                .json(&serde_json::json!({
                    "connectionId": request.connection_id,
                    "prompt": request.natural_language,
                    "execute": false,
                })),
        )
        .await
        .map_err(|error| format_backend_unavailable(&state.backend_url, &error))?;

        if fallback.status.is_success() {
            return parse_nl_to_sql_result(&fallback);
        }

        return Err(format!(
            "AI service error: {}",
            extract_error_message(&fallback.body, &fallback.raw)
        ));
    }

    Err(format!(
        "AI service error: {}",
        extract_error_message(&primary.body, &primary.raw)
    ))
}

// ============================================================================
// Secure Credential Storage (OS Keychain)
// ============================================================================

#[cfg(target_os = "macos")]
fn store_credential(service: &str, password: &str) -> Result<(), String> {
    use std::process::Command;
    
    let output = Command::new("security")
        .args([
            "add-generic-password",
            "-a", "queryflux",
            "-s", &format!("queryflux-{}", service),
            "-w", password,
            "-U", // Update if exists
        ])
        .output()
        .map_err(|e| e.to_string())?;
    
    if output.status.success() {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

#[cfg(target_os = "macos")]
fn get_credential(service: &str) -> Result<String, String> {
    use std::process::Command;
    
    let output = Command::new("security")
        .args([
            "find-generic-password",
            "-a", "queryflux",
            "-s", &format!("queryflux-{}", service),
            "-w",
        ])
        .output()
        .map_err(|e| e.to_string())?;
    
    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    } else {
        Err("Credential not found".to_string())
    }
}

#[cfg(target_os = "macos")]
fn delete_credential(service: &str) -> Result<(), String> {
    use std::process::Command;
    
    let output = Command::new("security")
        .args([
            "delete-generic-password",
            "-a", "queryflux",
            "-s", &format!("queryflux-{}", service),
        ])
        .output()
        .map_err(|e| e.to_string())?;
    
    if output.status.success() {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

// Windows credential storage
#[cfg(target_os = "windows")]
fn store_credential(service: &str, password: &str) -> Result<(), String> {
    // Windows Credential Manager via powershell
    use std::process::Command;
    
    let script = format!(
        r#"
        $cred = New-Object -TypeName PSCredential -ArgumentList 'queryflux', (ConvertTo-SecureString -String '{}' -AsPlainText -Force)
        cmdkey /generic:queryflux-{} /user:queryflux /pass:{}
        "#,
        password, service, password
    );
    
    Command::new("powershell")
        .args(["-Command", &script])
        .output()
        .map_err(|e| e.to_string())?;
    
    Ok(())
}

#[cfg(target_os = "windows")]
fn get_credential(service: &str) -> Result<String, String> {
    // For Windows, we'd use Windows Credential Manager
    // This is a simplified implementation
    Err("Windows credential retrieval not yet implemented".to_string())
}

#[cfg(target_os = "windows")]
fn delete_credential(service: &str) -> Result<(), String> {
    use std::process::Command;
    
    Command::new("cmdkey")
        .args(["/delete", &format!("queryflux-{}", service)])
        .output()
        .map_err(|e| e.to_string())?;
    
    Ok(())
}

// Linux credential storage (using libsecret/GNOME Keyring)
#[cfg(target_os = "linux")]
fn store_credential(service: &str, password: &str) -> Result<(), String> {
    use std::process::Command;
    
    let output = Command::new("secret-tool")
        .args([
            "store",
            "--label", &format!("QueryFlux - {}", service),
            "application", "queryflux",
            "service", service,
        ])
        .stdin(std::process::Stdio::piped())
        .spawn()
        .and_then(|mut child| {
            use std::io::Write;
            if let Some(ref mut stdin) = child.stdin {
                stdin.write_all(password.as_bytes())?;
            }
            child.wait_with_output()
        })
        .map_err(|e| e.to_string())?;
    
    if output.status.success() {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

#[cfg(target_os = "linux")]
fn get_credential(service: &str) -> Result<String, String> {
    use std::process::Command;
    
    let output = Command::new("secret-tool")
        .args([
            "lookup",
            "application", "queryflux",
            "service", service,
        ])
        .output()
        .map_err(|e| e.to_string())?;
    
    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    } else {
        Err("Credential not found".to_string())
    }
}

#[cfg(target_os = "linux")]
fn delete_credential(service: &str) -> Result<(), String> {
    use std::process::Command;
    
    Command::new("secret-tool")
        .args([
            "clear",
            "application", "queryflux",
            "service", service,
        ])
        .output()
        .map_err(|e| e.to_string())?;
    
    Ok(())
}
