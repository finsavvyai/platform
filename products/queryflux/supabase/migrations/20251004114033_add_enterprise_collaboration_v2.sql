/*
  # Enterprise Collaboration and Team Management

  1. New Tables
    - `teams` - Organization/team management
    - `team_members` - Team membership and roles
    - `project_collaborators` - Project-level access control
    - `connection_permissions` - Granular connection access
    - `team_invitations` - Pending team invites
    - `audit_logs` - Enterprise audit trail

  2. Security
    - Enable RLS on all new tables
    - Add comprehensive policies for team-based access
*/

-- Teams Table
CREATE TABLE IF NOT EXISTS teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  subscription_tier text NOT NULL DEFAULT 'free',
  license_key text UNIQUE,
  license_expires_at timestamptz,
  sso_enabled boolean DEFAULT false,
  sso_provider text,
  sso_domain text,
  max_members integer DEFAULT 5,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Team Members Table
CREATE TABLE IF NOT EXISTS team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role text NOT NULL DEFAULT 'member',
  invited_by uuid REFERENCES auth.users(id),
  invited_at timestamptz DEFAULT now(),
  joined_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(team_id, user_id)
);

-- Project Collaborators Table
CREATE TABLE IF NOT EXISTS project_collaborators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  team_id uuid REFERENCES teams(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  access_level text NOT NULL DEFAULT 'viewer',
  granted_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE(project_id, user_id)
);

-- Connection Permissions Table
CREATE TABLE IF NOT EXISTS connection_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid REFERENCES connections(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  team_id uuid REFERENCES teams(id) ON DELETE CASCADE,
  environment_access jsonb DEFAULT '{}'::jsonb,
  can_execute_queries boolean DEFAULT true,
  can_modify_schema boolean DEFAULT false,
  can_delete_data boolean DEFAULT false,
  granted_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(connection_id, user_id)
);

-- Team Invitations Table
CREATE TABLE IF NOT EXISTS team_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'member',
  invited_by uuid REFERENCES auth.users(id) NOT NULL,
  token text UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  expires_at timestamptz DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid REFERENCES teams(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  resource_type text,
  resource_id uuid,
  details jsonb DEFAULT '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE connection_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Teams Policies
CREATE POLICY "Users can view teams they belong to"
  ON teams FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = teams.id
      AND team_members.user_id = auth.uid()
    ) OR owner_id = auth.uid()
  );

CREATE POLICY "Team owners can update their teams"
  ON teams FOR UPDATE TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can create teams"
  ON teams FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id);

-- Team Members Policies
CREATE POLICY "Users can view team members of their teams"
  ON team_members FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.team_id = team_members.team_id
      AND tm.user_id = auth.uid()
    )
  );

CREATE POLICY "Team owners and admins can manage members"
  ON team_members FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.team_id = team_members.team_id
      AND tm.user_id = auth.uid()
      AND tm.role IN ('owner', 'admin')
    )
  );

-- Project Collaborators Policies
CREATE POLICY "Users can view collaborators on their projects"
  ON project_collaborators FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_collaborators.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Project owners can manage collaborators"
  ON project_collaborators FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_collaborators.project_id
      AND projects.user_id = auth.uid()
    )
  );

-- Connection Permissions Policies
CREATE POLICY "Users can view their own permissions"
  ON connection_permissions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Connection owners can manage permissions"
  ON connection_permissions FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM connections
      WHERE connections.id = connection_permissions.connection_id
      AND connections.user_id = auth.uid()
    )
  );

-- Team Invitations Policies
CREATE POLICY "Team members can view invitations"
  ON team_invitations FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = team_invitations.team_id
      AND team_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Team admins can manage invitations"
  ON team_invitations FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = team_invitations.team_id
      AND team_members.user_id = auth.uid()
      AND team_members.role IN ('owner', 'admin')
    )
  );

-- Audit Logs Policies
CREATE POLICY "Team admins can view audit logs"
  ON audit_logs FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = audit_logs.team_id
      AND team_members.user_id = auth.uid()
      AND team_members.role IN ('owner', 'admin')
    )
  );

-- Add team_id columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'team_id'
  ) THEN
    ALTER TABLE projects ADD COLUMN team_id uuid REFERENCES teams(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'connections' AND column_name = 'team_id'
  ) THEN
    ALTER TABLE connections ADD COLUMN team_id uuid REFERENCES teams(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_teams_owner_id ON teams(owner_id);
CREATE INDEX IF NOT EXISTS idx_teams_slug ON teams(slug);
CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_project_collaborators_project_id ON project_collaborators(project_id);
CREATE INDEX IF NOT EXISTS idx_connection_permissions_connection_id ON connection_permissions(connection_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_team_id ON audit_logs(team_id);

-- Function to add owner as team member
CREATE OR REPLACE FUNCTION add_team_owner_as_member()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO team_members (team_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS create_team_owner_member ON teams;
CREATE TRIGGER create_team_owner_member
  AFTER INSERT ON teams
  FOR EACH ROW
  EXECUTE FUNCTION add_team_owner_as_member();
