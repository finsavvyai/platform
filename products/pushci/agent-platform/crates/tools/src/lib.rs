use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::{BTreeMap, BTreeSet};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ToolPermission {
    ReadOnly,
    WorkspaceWrite,
    DangerFullAccess,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ToolDefinition {
    pub name: String,
    pub description: String,
    pub input_schema: Value,
    pub required_permission: ToolPermission,
}

#[derive(Debug, Clone, Default)]
pub struct ToolRegistry {
    tools: BTreeMap<String, ToolDefinition>,
}

impl ToolRegistry {
    #[must_use]
    pub fn new() -> Self {
        Self::default()
    }

    pub fn register(&mut self, definition: ToolDefinition) -> Result<(), String> {
        if self.tools.contains_key(&definition.name) {
            return Err(format!("duplicate tool `{}`", definition.name));
        }
        self.tools.insert(definition.name.clone(), definition);
        Ok(())
    }

    #[must_use]
    pub fn definitions(&self) -> Vec<ToolDefinition> {
        self.tools.values().cloned().collect()
    }

    #[must_use]
    pub fn names(&self) -> BTreeSet<String> {
        self.tools.keys().cloned().collect()
    }

    #[must_use]
    pub fn get(&self, name: &str) -> Option<&ToolDefinition> {
        self.tools.get(name)
    }
}

#[cfg(test)]
mod tests {
    use super::{ToolDefinition, ToolPermission, ToolRegistry};
    use serde_json::json;

    #[test]
    fn rejects_duplicate_tool_names() {
        let mut registry = ToolRegistry::new();
        let tool = ToolDefinition {
            name: "pushci.list_runs".to_string(),
            description: "List runs".to_string(),
            input_schema: json!({ "type": "object" }),
            required_permission: ToolPermission::ReadOnly,
        };

        registry
            .register(tool.clone())
            .expect("first register should succeed");
        let error = registry
            .register(tool)
            .expect_err("duplicate tool should fail");
        assert!(error.contains("duplicate tool"));
    }
}
