//! Gateway -- HTTP client for the ClawPipe gateway API.
//!
//! Handles prompt dispatch to the remote gateway.

use crate::types::{ClawPipeError, GatewayResponse, PromptOptions, RouteDecision};
use reqwest::Client;
use serde_json::json;

/// Gateway client for the ClawPipe API.
pub struct Gateway {
    client: Client,
    gateway_url: String,
    api_key: String,
    project_id: String,
}

impl Gateway {
    pub fn new(gateway_url: &str, api_key: &str, project_id: &str) -> Self {
        Self {
            client: Client::new(),
            gateway_url: gateway_url.to_string(),
            api_key: api_key.to_string(),
            project_id: project_id.to_string(),
        }
    }

    /// Send a prompt to the gateway and return the response.
    pub async fn call(
        &self,
        prompt: &str,
        options: &PromptOptions,
        route: &RouteDecision,
    ) -> Result<GatewayResponse, ClawPipeError> {
        let url = format!("{}/prompt", self.gateway_url);
        let body = json!({
            "prompt": prompt,
            "system": options.system,
            "max_tokens": options.max_tokens,
            "temperature": options.temperature,
            "provider": route.provider,
            "model": route.model,
        });

        let res = self
            .client
            .post(&url)
            .header("Content-Type", "application/json")
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("X-Project-Id", &self.project_id)
            .json(&body)
            .send()
            .await?;

        if !res.status().is_success() {
            let status = res.status().as_u16();
            let body_text = res.text().await.unwrap_or_default();
            return Err(ClawPipeError::GatewayError {
                status,
                body: body_text,
            });
        }

        let gateway_resp: GatewayResponse = res.json().await?;
        Ok(gateway_resp)
    }
}
