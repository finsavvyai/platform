-- Migration: Add Test Management Tables (Test Plans and Cycles)
-- Version: 0002
-- Date: 2025-12-04
-- Purpose: Add comprehensive test management with test plans and cycles

-- Enable foreign key support
PRAGMA foreign_keys = ON;

-- ==========================================
-- TEST MANAGEMENT TABLES
-- ==========================================

-- Test plans table - Test plan management
CREATE TABLE test_plans (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  objectives TEXT,
  scope TEXT,
  strategy TEXT,
  schedule TEXT,
  environments TEXT,
  resources TEXT,
  risks TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  progress INTEGER DEFAULT 0,
  start_date INTEGER,
  end_date INTEGER,
  is_active INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Test cycles table - Test cycle management
CREATE TABLE test_cycles (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  test_plan_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  environment TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'planned',
  assigned_to TEXT,
  start_date INTEGER NOT NULL,
  end_date INTEGER NOT NULL,
  progress TEXT,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (test_plan_id) REFERENCES test_plans(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

-- Cycle test cases table - Many-to-many relationship
CREATE TABLE cycle_test_cases (
  id TEXT PRIMARY KEY,
  cycle_id TEXT NOT NULL,
  test_case_id TEXT NOT NULL,
  status TEXT DEFAULT 'not_run',
  assigned_to TEXT,
  last_run_at INTEGER,
  notes TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (cycle_id) REFERENCES test_cycles(id) ON DELETE CASCADE,
  FOREIGN KEY (test_case_id) REFERENCES test_cases(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL
);

--  ==========================================
-- INDEXES FOR PERFORMANCE
-- ==========================================

CREATE INDEX idx_test_plans_project_id ON test_plans(project_id);
CREATE INDEX idx_test_plans_user_id ON test_plans(user_id);
CREATE INDEX idx_test_plans_status ON test_plans(status);
CREATE INDEX idx_test_plans_is_active ON test_plans(is_active);

CREATE INDEX idx_test_cycles_project_id ON test_cycles(project_id);
CREATE INDEX idx_test_cycles_test_plan_id ON test_cycles(test_plan_id);
CREATE INDEX idx_test_cycles_status ON test_cycles(status);
CREATE INDEX idx_test_cycles_assigned_to ON test_cycles(assigned_to);

CREATE INDEX idx_cycle_test_cases_cycle_id ON cycle_test_cases(cycle_id);
CREATE INDEX idx_cycle_test_cases_test_case_id ON cycle_test_cases(test_case_id);
CREATE INDEX idx_cycle_test_cases_status ON cycle_test_cases(status);

-- ==========================================
-- TRIGGERS FOR AUTOMATIC TIMESTAMPS
-- ==========================================

CREATE TRIGGER update_test_plans_timestamp
    AFTER UPDATE ON test_plans
BEGIN
    UPDATE test_plans SET updated_at = strftime('%s', 'now') WHERE id = NEW.id;
END;

CREATE TRIGGER update_test_cycles_timestamp
    AFTER UPDATE ON test_cycles
BEGIN
    UPDATE test_cycles SET updated_at = strftime('%s', 'now') WHERE id = NEW.id;
END;
