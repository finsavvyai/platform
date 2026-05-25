use agent_runtime::{AgentEvent, AgentRuntime, Session, SessionId};
use axum::extract::{Path, State};
use axum::http::{header, HeaderMap, StatusCode};
use axum::response::sse::{Event, Sse};
use axum::response::IntoResponse;
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::convert::Infallible;
use std::sync::Arc;
use tokio::sync::RwLock;
use toolpack_pushci::{answer_message, pushci_registry, PushciClient};
use uuid::Uuid;

#[derive(Clone)]
pub struct AppState {
    runtime: Arc<AgentRuntime>,
    sessions: Arc<RwLock<HashMap<SessionId, Session>>>,
    agent_core_token: Option<String>,
    pushci_client: Option<PushciClient>,
}

impl AppState {
    pub fn new_pushci(
        pushci_api_base_url: Option<String>,
        pushci_service_token: Option<String>,
        agent_core_token: Option<String>,
    ) -> Result<Self, String> {
        let registry = pushci_registry()?;
        let runtime = AgentRuntime::new("pushci", registry.definitions());
        let pushci_client = build_pushci_client(pushci_api_base_url, pushci_service_token)?;
        Ok(Self {
            runtime: Arc::new(runtime),
            sessions: Arc::new(RwLock::new(HashMap::new())),
            agent_core_token: normalize_optional(agent_core_token),
            pushci_client,
        })
    }
}

#[derive(Debug, Deserialize)]
pub struct CreateSessionRequest {
    pub product: String,
    pub tenant_id: String,
    pub user_id: Option<String>,
    #[serde(default = "default_context")]
    pub context: Value,
}

#[derive(Debug, Serialize)]
pub struct CreateSessionResponse {
    pub session_id: Uuid,
    pub product: String,
    pub tenant_id: String,
}

#[derive(Debug, Deserialize)]
pub struct PostMessageRequest {
    pub message: String,
}

#[derive(Debug, Serialize)]
pub struct SessionResponse {
    pub session: Session,
}

#[must_use]
pub fn app(state: AppState) -> Router {
    Router::new()
        .route("/health", get(health))
        .route("/sessions", post(create_session))
        .route("/sessions/{id}", get(get_session))
        .route("/sessions/{id}/messages", post(post_message))
        .route("/sessions/{id}/events", get(stream_events))
        .with_state(state)
}

async fn health(State(state): State<AppState>) -> Json<Value> {
    Json(json!({
        "status": "ok",
        "auth_configured": state.agent_core_token.is_some(),
        "pushci_configured": state.pushci_client.is_some(),
    }))
}

async fn create_session(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<CreateSessionRequest>,
) -> Result<(StatusCode, Json<CreateSessionResponse>), (StatusCode, Json<Value>)> {
    authorize_request(&headers, &state)?;

    if body.product != "pushci" {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "unsupported product" })),
        ));
    }

    let session = Session::new(
        body.product.clone(),
        body.tenant_id.clone(),
        body.user_id,
        body.context,
    );
    let response = CreateSessionResponse {
        session_id: session.id,
        product: session.product.clone(),
        tenant_id: session.tenant_id.clone(),
    };

    state.sessions.write().await.insert(session.id, session);
    Ok((StatusCode::CREATED, Json(response)))
}

async fn get_session(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
) -> Result<Json<SessionResponse>, (StatusCode, Json<Value>)> {
    authorize_request(&headers, &state)?;

    let sessions = state.sessions.read().await;
    let Some(session) = sessions.get(&id) else {
        return Err((
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "session not found" })),
        ));
    };

    Ok(Json(SessionResponse {
        session: session.clone(),
    }))
}

async fn post_message(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
    Json(body): Json<PostMessageRequest>,
) -> Result<(StatusCode, Json<Value>), (StatusCode, Json<Value>)> {
    authorize_request(&headers, &state)?;

    let mut sessions = state.sessions.write().await;
    let Some(session) = sessions.get_mut(&id) else {
        return Err((
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "session not found" })),
        ));
    };

    let events = if let Some(client) = &state.pushci_client {
        session.push_user_message(body.message.clone());
        let assistant = answer_message(client, &body.message, &session.context)
            .await
            .map_err(|error| {
                (
                    StatusCode::BAD_GATEWAY,
                    Json(json!({ "error": error.to_string() })),
                )
            })?;
        session.push_assistant_message(assistant.clone());
        vec![
            AgentEvent::UserMessageAccepted {
                session_id: session.id,
                message: body.message.clone(),
            },
            AgentEvent::AssistantText {
                session_id: session.id,
                delta: assistant,
            },
            AgentEvent::TurnCompleted {
                session_id: session.id,
            },
        ]
    } else {
        state
            .runtime
            .handle_message(session, &body.message)
            .map_err(|error| {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({ "error": error.to_string() })),
                )
            })?
    };

    Ok((StatusCode::ACCEPTED, Json(json!({ "events": events }))))
}

async fn stream_events(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, (StatusCode, Json<Value>)> {
    authorize_request(&headers, &state)?;

    let sessions = state.sessions.read().await;
    let Some(session) = sessions.get(&id) else {
        return Err((
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "session not found" })),
        ));
    };

    let snapshot = Event::default()
        .event("snapshot")
        .data(serde_json::to_string(session).unwrap_or_else(|_| "{}".to_string()));

    let stream = async_stream::stream! {
        yield Ok::<Event, Infallible>(snapshot);
        yield Ok::<Event, Infallible>(Event::default().event("done").data("{}"));
    };

    Ok(Sse::new(stream))
}

fn default_context() -> Value {
    json!({})
}

fn normalize_optional(value: Option<String>) -> Option<String> {
    value.and_then(|value| {
        let trimmed = value.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed.to_string())
        }
    })
}

fn build_pushci_client(
    base_url: Option<String>,
    service_token: Option<String>,
) -> Result<Option<PushciClient>, String> {
    match (
        normalize_optional(base_url),
        normalize_optional(service_token),
    ) {
        (Some(base_url), Some(service_token)) => PushciClient::new(base_url, service_token)
            .map(Some)
            .map_err(|error| error.to_string()),
        (None, None) => Ok(None),
        _ => Err("PUSHCI_API_BASE_URL and PUSHCI_SERVICE_TOKEN must both be set".to_string()),
    }
}

fn authorize_request(
    headers: &HeaderMap,
    state: &AppState,
) -> Result<(), (StatusCode, Json<Value>)> {
    let Some(expected) = state.agent_core_token.as_deref() else {
        return Err((
            StatusCode::SERVICE_UNAVAILABLE,
            Json(json!({ "error": "agent-core auth is not configured" })),
        ));
    };

    let provided = headers
        .get("x-agent-core-token")
        .and_then(|value| value.to_str().ok())
        .or_else(|| extract_bearer_token(headers));

    match provided {
        Some(token) if token == expected => Ok(()),
        _ => Err((
            StatusCode::UNAUTHORIZED,
            Json(json!({ "error": "unauthorized" })),
        )),
    }
}

fn extract_bearer_token(headers: &HeaderMap) -> Option<&str> {
    headers
        .get(header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.strip_prefix("Bearer "))
}

#[cfg(test)]
mod tests {
    use super::{build_pushci_client, extract_bearer_token};
    use axum::http::{header, HeaderMap, HeaderValue};

    #[test]
    fn build_pushci_client_requires_both_values() {
        let err = build_pushci_client(Some("http://127.0.0.1:8787".to_string()), None)
            .expect_err("partial config should fail");
        assert!(err.contains("must both be set"));
    }

    #[test]
    fn extracts_bearer_token_from_headers() {
        let mut headers = HeaderMap::new();
        headers.insert(
            header::AUTHORIZATION,
            HeaderValue::from_static("Bearer secret-token"),
        );

        assert_eq!(extract_bearer_token(&headers), Some("secret-token"));
    }
}
