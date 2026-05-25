use agent_tools::ToolDefinition;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use thiserror::Error;
use uuid::Uuid;

pub type SessionId = Uuid;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MessageRole {
    System,
    User,
    Assistant,
    Tool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Message {
    pub role: MessageRole,
    pub content: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Session {
    pub id: SessionId,
    pub product: String,
    pub tenant_id: String,
    pub user_id: Option<String>,
    pub context: Value,
    pub messages: Vec<Message>,
}

impl Session {
    #[must_use]
    pub fn new(
        product: impl Into<String>,
        tenant_id: impl Into<String>,
        user_id: Option<String>,
        context: Value,
    ) -> Self {
        Self {
            id: Uuid::new_v4(),
            product: product.into(),
            tenant_id: tenant_id.into(),
            user_id,
            context,
            messages: Vec::new(),
        }
    }

    pub fn push_user_message(&mut self, content: impl Into<String>) {
        self.messages.push(Message {
            role: MessageRole::User,
            content: content.into(),
        });
    }

    pub fn push_assistant_message(&mut self, content: impl Into<String>) {
        self.messages.push(Message {
            role: MessageRole::Assistant,
            content: content.into(),
        });
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum AgentEvent {
    SessionCreated {
        session_id: SessionId,
        product: String,
        tenant_id: String,
    },
    UserMessageAccepted {
        session_id: SessionId,
        message: String,
    },
    AssistantText {
        session_id: SessionId,
        delta: String,
    },
    ToolCall {
        session_id: SessionId,
        name: String,
        input: Value,
    },
    ToolResult {
        session_id: SessionId,
        name: String,
        output: Value,
        is_error: bool,
    },
    TurnCompleted {
        session_id: SessionId,
    },
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct RuntimeDescriptor {
    pub product: String,
    pub tools: Vec<ToolDefinition>,
}

#[derive(Debug, Error)]
pub enum RuntimeError {
    #[error("session not found")]
    SessionNotFound,
    #[error("runtime integration is not implemented yet")]
    NotImplemented,
}

#[derive(Debug, Clone)]
pub struct AgentRuntime {
    descriptor: RuntimeDescriptor,
}

impl AgentRuntime {
    #[must_use]
    pub fn new(product: impl Into<String>, tools: Vec<ToolDefinition>) -> Self {
        Self {
            descriptor: RuntimeDescriptor {
                product: product.into(),
                tools,
            },
        }
    }

    #[must_use]
    pub fn descriptor(&self) -> &RuntimeDescriptor {
        &self.descriptor
    }

    pub fn handle_message(
        &self,
        session: &mut Session,
        message: &str,
    ) -> Result<Vec<AgentEvent>, RuntimeError> {
        session.push_user_message(message.to_string());
        session.push_assistant_message("agent-platform scaffold placeholder");

        Ok(vec![
            AgentEvent::UserMessageAccepted {
                session_id: session.id,
                message: message.to_string(),
            },
            AgentEvent::AssistantText {
                session_id: session.id,
                delta: "agent-platform scaffold placeholder".to_string(),
            },
            AgentEvent::TurnCompleted {
                session_id: session.id,
            },
        ])
    }
}

#[cfg(test)]
mod tests {
    use super::{AgentEvent, AgentRuntime, MessageRole, Session};
    use serde_json::json;

    #[test]
    fn records_user_and_assistant_messages() {
        let runtime = AgentRuntime::new("pushci", Vec::new());
        let mut session = Session::new("pushci", "tenant-1", Some("user-1".to_string()), json!({}));

        let events = runtime
            .handle_message(&mut session, "why did my build fail?")
            .expect("runtime should accept scaffold message");

        assert_eq!(session.messages.len(), 2);
        assert_eq!(session.messages[0].role, MessageRole::User);
        assert_eq!(session.messages[1].role, MessageRole::Assistant);
        assert!(matches!(
            events.last(),
            Some(AgentEvent::TurnCompleted { .. })
        ));
    }
}
