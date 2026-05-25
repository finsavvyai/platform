-- Jira Integration Migration
-- Creates tables for Jira OAuth, projects, epics, issues, and test linking

-- Jira connections per user/organization
CREATE TABLE jira_connections (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  jira_url TEXT NOT NULL,
  jira_cloud_id TEXT,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expires_at INTEGER,
  is_active INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_jira_connections_user ON jira_connections(user_id);
CREATE INDEX idx_jira_connections_active ON jira_connections(user_id, is_active);

-- Imported Jira projects
CREATE TABLE jira_projects (
  id TEXT PRIMARY KEY,
  connection_id TEXT NOT NULL REFERENCES jira_connections(id) ON DELETE CASCADE,
  jira_project_id TEXT NOT NULL,
  jira_project_key TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  project_type TEXT,
  lead TEXT,
  avatar_url TEXT,
  last_sync_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(connection_id, jira_project_key)
);

CREATE INDEX idx_jira_projects_connection ON jira_projects(connection_id);
CREATE INDEX idx_jira_projects_key ON jira_projects(jira_project_key);

-- Imported Jira epics
CREATE TABLE jira_epics (
  id TEXT PRIMARY KEY,
  jira_project_id TEXT NOT NULL REFERENCES jira_projects(id) ON DELETE CASCADE,
  jira_epic_id TEXT NOT NULL,
  jira_epic_key TEXT NOT NULL,
  summary TEXT NOT NULL,
  description TEXT,
  status TEXT,
  priority TEXT,
  assignee TEXT,
  reporter TEXT,
  labels TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(jira_project_id, jira_epic_key)
);

CREATE INDEX idx_jira_epics_project ON jira_epics(jira_project_id);
CREATE INDEX idx_jira_epics_key ON jira_epics(jira_epic_key);

-- Imported Jira issues (stories, tasks, bugs)
CREATE TABLE jira_issues (
  id TEXT PRIMARY KEY,
  jira_project_id TEXT NOT NULL REFERENCES jira_projects(id) ON DELETE CASCADE,
  jira_epic_id TEXT REFERENCES jira_epics(id) ON DELETE SET NULL,
  jira_issue_id TEXT NOT NULL,
  jira_issue_key TEXT NOT NULL,
  issue_type TEXT NOT NULL,
  summary TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL,
  priority TEXT,
  assignee TEXT,
  reporter TEXT,
  sprint_id TEXT,
  sprint_name TEXT,
  story_points INTEGER,
  labels TEXT,
  acceptance_criteria TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(jira_project_id, jira_issue_key)
);

CREATE INDEX idx_jira_issues_project ON jira_issues(jira_project_id);
CREATE INDEX idx_jira_issues_epic ON jira_issues(jira_epic_id);
CREATE INDEX idx_jira_issues_sprint ON jira_issues(sprint_id);
CREATE INDEX idx_jira_issues_key ON jira_issues(jira_issue_key);
CREATE INDEX idx_jira_issues_type ON jira_issues(issue_type);

-- Link test plans to Jira entities
CREATE TABLE test_plan_jira_links (
  id TEXT PRIMARY KEY,
  test_plan_id TEXT NOT NULL REFERENCES test_plans(id) ON DELETE CASCADE,
  jira_project_id TEXT REFERENCES jira_projects(id) ON DELETE SET NULL,
  jira_epic_id TEXT REFERENCES jira_epics(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_test_plan_links_plan ON test_plan_jira_links(test_plan_id);
CREATE INDEX idx_test_plan_links_project ON test_plan_jira_links(jira_project_id);
CREATE INDEX idx_test_plan_links_epic ON test_plan_jira_links(jira_epic_id);

-- Link test cases to Jira stories
CREATE TABLE test_case_jira_links (
  id TEXT PRIMARY KEY,
  test_case_id TEXT NOT NULL REFERENCES test_cases(id) ON DELETE CASCADE,
  jira_issue_id TEXT NOT NULL REFERENCES jira_issues(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  UNIQUE(test_case_id, jira_issue_id)
);

CREATE INDEX idx_test_case_links_case ON test_case_jira_links(test_case_id);
CREATE INDEX idx_test_case_links_issue ON test_case_jira_links(jira_issue_id);

-- Sprint test execution logs
CREATE TABLE sprint_test_logs (
  id TEXT PRIMARY KEY,
  jira_project_id TEXT NOT NULL REFERENCES jira_projects(id) ON DELETE CASCADE,
  sprint_id TEXT NOT NULL,
  sprint_name TEXT NOT NULL,
  test_cycle_id TEXT REFERENCES test_cycles(id) ON DELETE SET NULL,
  total_tests INTEGER DEFAULT 0,
  passed_tests INTEGER DEFAULT 0,
  failed_tests INTEGER DEFAULT 0,
  blocked_tests INTEGER DEFAULT 0,
  not_run_tests INTEGER DEFAULT 0,
  pass_rate REAL,
  executed_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_sprint_logs_project ON sprint_test_logs(jira_project_id);
CREATE INDEX idx_sprint_logs_sprint ON sprint_test_logs(sprint_id);
CREATE INDEX idx_sprint_logs_cycle ON sprint_test_logs(test_cycle_id);

-- Triggers for updated_at
CREATE TRIGGER update_jira_connections_timestamp
AFTER UPDATE ON jira_connections
FOR EACH ROW
BEGIN
  UPDATE jira_connections SET updated_at = strftime('%s', 'now') * 1000 WHERE id = NEW.id;
END;

CREATE TRIGGER update_jira_projects_timestamp
AFTER UPDATE ON jira_projects
FOR EACH ROW
BEGIN
  UPDATE jira_projects SET updated_at = strftime('%s', 'now') * 1000 WHERE id = NEW.id;
END;

CREATE TRIGGER update_jira_epics_timestamp
AFTER UPDATE ON jira_epics
FOR EACH ROW
BEGIN
  UPDATE jira_epics SET updated_at = strftime('%s', 'now') * 1000 WHERE id = NEW.id;
END;

CREATE TRIGGER update_jira_issues_timestamp
AFTER UPDATE ON jira_issues
FOR EACH ROW
BEGIN
  UPDATE jira_issues SET updated_at = strftime('%s', 'now') * 1000 WHERE id = NEW.id;
END;
