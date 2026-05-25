use agent_tools::{ToolDefinition, ToolPermission, ToolRegistry};
use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION, CONTENT_TYPE};
use serde::{Deserialize, Serialize};
use serde_json::json;
use serde_json::Value;
use thiserror::Error;

pub fn pushci_registry() -> Result<ToolRegistry, String> {
    let mut registry = ToolRegistry::new();

    for tool in [
        ToolDefinition {
            name: "pushci.get_project".to_string(),
            description: "Fetch PushCI project metadata and pipeline context.".to_string(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "project_id": { "type": "string" }
                },
                "required": ["project_id"],
                "additionalProperties": false
            }),
            required_permission: ToolPermission::ReadOnly,
        },
        ToolDefinition {
            name: "pushci.list_runs".to_string(),
            description: "List recent runs for a project.".to_string(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "project_id": { "type": "string" },
                    "status": { "type": "string" }
                },
                "required": ["project_id"],
                "additionalProperties": false
            }),
            required_permission: ToolPermission::ReadOnly,
        },
        ToolDefinition {
            name: "pushci.get_run_logs".to_string(),
            description: "Fetch logs for a specific PushCI run.".to_string(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "run_id": { "type": "string" }
                },
                "required": ["run_id"],
                "additionalProperties": false
            }),
            required_permission: ToolPermission::ReadOnly,
        },
        ToolDefinition {
            name: "pushci.save_pipeline".to_string(),
            description: "Persist a generated or edited pipeline for a project.".to_string(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "project_id": { "type": "string" },
                    "yaml": { "type": "string" }
                },
                "required": ["project_id", "yaml"],
                "additionalProperties": false
            }),
            required_permission: ToolPermission::WorkspaceWrite,
        },
        ToolDefinition {
            name: "pushci.retry_run".to_string(),
            description: "Trigger a retry for a failed or cancelled run.".to_string(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "run_id": { "type": "string" }
                },
                "required": ["run_id"],
                "additionalProperties": false
            }),
            required_permission: ToolPermission::WorkspaceWrite,
        },
        ToolDefinition {
            name: "pushci.create_fix_pr".to_string(),
            description: "Create a fix PR proposal for a failed run.".to_string(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "run_id": { "type": "string" },
                    "summary": { "type": "string" }
                },
                "required": ["run_id"],
                "additionalProperties": false
            }),
            required_permission: ToolPermission::WorkspaceWrite,
        },
    ] {
        registry.register(tool)?;
    }

    Ok(registry)
}

#[derive(Debug, Clone)]
pub struct PushciClient {
    http: reqwest::Client,
    base_url: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct PushciProject {
    pub id: String,
    pub repo: String,
    pub platform: String,
    pub created_at: String,
    pub webhook_secret: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct PushciRun {
    pub id: String,
    pub repo: String,
    pub branch: String,
    pub sha: String,
    pub status: String,
    pub created_at: String,
    pub started_at: Option<String>,
    pub finished_at: Option<String>,
    pub duration_ms: Option<i64>,
    pub checks_json: Option<String>,
}

#[derive(Debug, Error)]
pub enum PushciClientError {
    #[error("missing pushci runtime configuration")]
    MissingConfiguration,
    #[error("request failed: {0}")]
    Request(#[from] reqwest::Error),
    #[error("pushci api returned {status}: {body}")]
    Api { status: u16, body: String },
}

impl PushciClient {
    pub fn new(
        base_url: impl Into<String>,
        service_token: impl Into<String>,
    ) -> Result<Self, PushciClientError> {
        let base_url = base_url.into();
        let service_token = service_token.into();
        if base_url.trim().is_empty() || service_token.trim().is_empty() {
            return Err(PushciClientError::MissingConfiguration);
        }

        let mut headers = HeaderMap::new();
        headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
        headers.insert(
            AUTHORIZATION,
            HeaderValue::from_str(&format!("Bearer {service_token}"))
                .map_err(|_| PushciClientError::MissingConfiguration)?,
        );
        headers.insert(
            "x-service-token",
            HeaderValue::from_str(&service_token)
                .map_err(|_| PushciClientError::MissingConfiguration)?,
        );

        Ok(Self {
            http: reqwest::Client::builder()
                .default_headers(headers)
                .build()?,
            base_url: base_url.trim_end_matches('/').to_string(),
        })
    }

    pub async fn get_project_by_repo(
        &self,
        repo: &str,
    ) -> Result<Option<PushciProject>, PushciClientError> {
        let response = self
            .http
            .get(format!("{}/internal/projects/by-repo", self.base_url))
            .query(&[("repo", repo)])
            .send()
            .await?;

        if response.status() == reqwest::StatusCode::NOT_FOUND {
            return Ok(None);
        }
        if !response.status().is_success() {
            return Err(error_from_response(response).await);
        }
        let payload = response.json::<ProjectResponse>().await?;
        Ok(payload.project)
    }

    pub async fn get_run(&self, run_id: &str) -> Result<Option<PushciRun>, PushciClientError> {
        let response = self
            .http
            .get(format!("{}/internal/runs/{}", self.base_url, run_id))
            .send()
            .await?;

        if response.status() == reqwest::StatusCode::NOT_FOUND {
            return Ok(None);
        }
        if !response.status().is_success() {
            return Err(error_from_response(response).await);
        }
        let payload = response.json::<RunResponse>().await?;
        Ok(payload.run)
    }

    pub async fn list_runs(
        &self,
        repo: &str,
        limit: usize,
    ) -> Result<Vec<PushciRun>, PushciClientError> {
        let response = self
            .http
            .get(format!("{}/internal/runs", self.base_url))
            .query(&[("repo", repo), ("limit", &limit.to_string())])
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(error_from_response(response).await);
        }
        let payload = response.json::<RunsResponse>().await?;
        Ok(payload.runs)
    }
}

#[derive(Debug, Deserialize)]
struct ProjectResponse {
    project: Option<PushciProject>,
}

#[derive(Debug, Deserialize)]
struct RunResponse {
    run: Option<PushciRun>,
}

#[derive(Debug, Deserialize)]
struct RunsResponse {
    runs: Vec<PushciRun>,
}

async fn error_from_response(response: reqwest::Response) -> PushciClientError {
    let status = response.status().as_u16();
    let body = response
        .text()
        .await
        .unwrap_or_else(|_| "unreadable error response".to_string());
    PushciClientError::Api { status, body }
}

pub async fn answer_message(
    client: &PushciClient,
    message: &str,
    context: &Value,
) -> Result<String, PushciClientError> {
    let message_lower = message.to_ascii_lowercase();
    let repo = context.get("root").and_then(Value::as_str);
    let last_run = context.get("lastRun").and_then(Value::as_str);

    if message_lower.contains("fail")
        || message_lower.contains("build")
        || message_lower.contains("why")
    {
        if let Some(run_id) = last_run {
            if let Some(run) = client.get_run(run_id).await? {
                return Ok(describe_run_failure(&run));
            }
        }
    }

    if message_lower.contains("project") {
        if let Some(repo) = repo {
            return Ok(match client.get_project_by_repo(repo).await? {
                Some(project) => format!(
                    "Project `{}` is connected on {} via {}.",
                    project.repo, project.created_at, project.platform
                ),
                None => format!("No PushCI project is connected for `{repo}`."),
            });
        }
    }

    if let Some(repo) = repo {
        let runs = client.list_runs(repo, 5).await?;
        if runs.is_empty() {
            return Ok(format!("No recorded PushCI runs found for `{repo}`."));
        }
        let latest = &runs[0];
        return Ok(format!(
            "Latest run for `{}` is `{}` on branch `{}` at `{}`.",
            latest.repo,
            latest.status,
            latest.branch,
            short_sha(&latest.sha),
        ));
    }

    Ok("The shared agent runtime is wired, but the current request did not include enough PushCI context yet.".to_string())
}

fn describe_run_failure(run: &PushciRun) -> String {
    let duration = run
        .duration_ms
        .map(|ms| format!(" in {}s", ms / 1000))
        .unwrap_or_default();
    let checks = summarize_checks(run.checks_json.as_deref());

    match run.status.as_str() {
        "failed" => format!(
            "Run `{}` for `{}` failed on branch `{}` at `{}`{}{}. {}",
            run.id,
            run.repo,
            run.branch,
            short_sha(&run.sha),
            duration,
            checks.prefix,
            checks.detail,
        ),
        other => format!(
            "Run `{}` for `{}` is currently `{}` on branch `{}` at `{}`. {}",
            run.id,
            run.repo,
            other,
            run.branch,
            short_sha(&run.sha),
            checks.detail,
        ),
    }
}

struct CheckSummary {
    prefix: String,
    detail: String,
}

fn summarize_checks(raw: Option<&str>) -> CheckSummary {
    let Some(raw) = raw else {
        return CheckSummary {
            prefix: String::new(),
            detail: "No check breakdown is stored yet.".to_string(),
        };
    };

    let Ok(value) = serde_json::from_str::<Value>(raw) else {
        return CheckSummary {
            prefix: String::new(),
            detail: "Stored check metadata is not parseable.".to_string(),
        };
    };

    if let Some(items) = value.as_array() {
        return CheckSummary {
            prefix: format!(" with {} checks recorded", items.len()),
            detail: "Detailed step logs are not persisted in the current API yet.".to_string(),
        };
    }

    CheckSummary {
        prefix: String::new(),
        detail: "Check metadata exists but is not in the expected array shape.".to_string(),
    }
}

fn short_sha(sha: &str) -> String {
    sha.chars().take(7).collect()
}

#[cfg(test)]
mod tests {
    use super::pushci_registry;

    #[test]
    fn registers_expected_pushci_tools() {
        let registry = pushci_registry().expect("pushci registry should build");
        let names = registry.names();

        assert!(names.contains("pushci.get_project"));
        assert!(names.contains("pushci.list_runs"));
        assert!(names.contains("pushci.get_run_logs"));
        assert!(names.contains("pushci.save_pipeline"));
        assert!(names.contains("pushci.retry_run"));
        assert!(names.contains("pushci.create_fix_pr"));
    }
}
