use agent_server::{app, AppState};
use std::env;
use std::net::SocketAddr;

#[tokio::main]
async fn main() {
    let state = AppState::new_pushci(
        env_optional("PUSHCI_API_BASE_URL"),
        env_optional("PUSHCI_SERVICE_TOKEN"),
        Some(env_required("AGENT_CORE_TOKEN")),
    )
    .expect("pushci app state should initialize");
    let app = app(state);
    let addr = env_optional("BIND_ADDR")
        .unwrap_or_else(|| "127.0.0.1:8088".to_string())
        .parse::<SocketAddr>()
        .expect("BIND_ADDR must be a valid socket address");
    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .expect("bind agent-platform listener");

    axum::serve(listener, app)
        .await
        .expect("serve agent-platform");
}

fn env_optional(name: &str) -> Option<String> {
    env::var(name).ok().filter(|value| !value.trim().is_empty())
}

fn env_required(name: &str) -> String {
    env_optional(name).unwrap_or_else(|| panic!("{name} must be set"))
}
