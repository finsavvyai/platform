# src/udp/services/onboarding_orchestrator.py
"""
Enterprise Onboarding Orchestrator
Handles the complete onboarding flow for new enterprise customers
"""

from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from udp.core.config import settings
from udp.core.models import (
    OnboardingMilestone,
    OnboardingState,
    Organization,
    Project,
    User,
)
from udp.security.ldap import LDAPAuthProvider
from udp.security.sso import SSOManager


class OnboardingStage(str, Enum):
    """Stages of enterprise onboarding."""

    ACCOUNT_CREATION = "account_creation"
    ORGANIZATION_SETUP = "organization_setup"
    TEAM_INVITATION = "team_invitation"
    REPOSITORY_CONNECTION = "repository_connection"
    INITIAL_SCAN = "initial_scan"
    POLICY_CONFIG = "policy_config"
    CI_INTEGRATION = "ci_integration"
    IDE_PLUGINS = "ide_plugins"
    TRAINING_COMPLETION = "training_completion"
    ACTIVATION = "activation"


class OnboardingOrchestrator:
    """
    Orchestrates the complete enterprise onboarding journey.

    Each enterprise customer goes through a guided onboarding
    process with personalized assistance, automated setup, and
    milestone tracking.
    """

    def __init__(self, db_session: AsyncSession):
        self.db = db_session
        self.mcp_client = None  # Initialized when needed

    async def start_onboarding(
        self,
        organization_name: str,
        admin_email: str,
        admin_name: str,
        plan: str = "enterprise",
    ) -> dict[str, Any]:
        """
        Start the onboarding process for a new enterprise customer.

        Returns:
            Onboarding session with first step instructions
        """
        # Create organization
        org = Organization(
            name=organization_name,
            slug=organization_name.lower().replace(" ", "-"),
            plan=plan,
            settings={
                "auto_scan": True,
                "notify_on_vuln": True,
                "require_approval": True,
            },
            onboarding_stage=OnboardingStage.ACCOUNT_CREATION.value,
            onboarding_started_at=datetime.utcnow(),
        )
        self.db.add(org)
        await self.db.flush()

        # Create admin user
        admin = User(
            username=admin_email.split("@")[0],
            email=admin_email,
            full_name=admin_name,
            organization_id=org.id,
            is_org_admin=True,
            is_active=True,
        )
        admin.set_password("TempPassword123!")  # Will be reset
        self.db.add(admin)
        await self.db.flush()

        # Create onboarding state
        state = OnboardingState(
            organization_id=org.id,
            current_stage=OnboardingStage.ACCOUNT_CREATION.value,
            completed_steps=[],
            started_at=datetime.utcnow(),
        )
        self.db.add(state)
        await self.db.commit()

        return {
            "organization_id": str(org.id),
            "admin_id": str(admin.id),
            "onboarding_token": self._generate_onboarding_token(org.id),
            "first_step": self._get_step_instructions(OnboardingStage.ACCOUNT_CREATION),
            "progress": 0,
        }

    async def advance_onboarding(
        self,
        organization_id: str,
        stage: OnboardingStage,
        data: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        """
        Advance the onboarding process to the next stage.

        Handles validation, setup, and milestone tracking.
        """
        org = await self._get_organization(organization_id)
        state = await self._get_onboarding_state(organization_id)

        # Validate current stage
        current_stage = OnboardingStage(state.current_stage)
        stage_order = [
            OnboardingStage.ACCOUNT_CREATION,
            OnboardingStage.ORGANIZATION_SETUP,
            OnboardingStage.TEAM_INVITATION,
            OnboardingStage.REPOSITORY_CONNECTION,
            OnboardingStage.INITIAL_SCAN,
            OnboardingStage.POLICY_CONFIG,
            OnboardingStage.CI_INTEGRATION,
            OnboardingStage.IDE_PLUGINS,
            OnboardingStage.TRAINING_COMPLETION,
            OnboardingStage.ACTIVATION,
        ]

        current_index = stage_order.index(current_stage)
        next_index = current_index + 1

        if stage != current_stage and stage != stage_order[next_index]:
            raise ValueError(
                f"Invalid stage progression from {current_stage} to {stage}"
            )

        # Execute stage-specific logic
        result = await self._execute_stage(org, stage, data or {})

        # Update state
        state.completed_steps.append(stage.value)
        state.current_stage = (
            stage_order[next_index].value
            if next_index < len(stage_order)
            else OnboardingStage.ACTIVATION.value
        )
        state.updated_at = datetime.utcnow()

        # Record milestone
        milestone = OnboardingMilestone(
            organization_id=org.id,
            stage=stage.value,
            completed_at=datetime.utcnow(),
            metadata=result,
        )
        self.db.add(milestone)
        await self.db.commit()

        # Get next step
        next_step = (
            self._get_step_instructions(stage_order[next_index])
            if next_index < len(stage_order)
            else None
        )

        return {
            "current_stage": state.current_stage,
            "completed_stage": stage.value,
            "result": result,
            "next_step": next_step,
            "progress": int((current_index + 1) / len(stage_order) * 100),
        }

    async def _execute_stage(
        self, org: Organization, stage: OnboardingStage, data: dict[str, Any]
    ) -> dict[str, Any]:
        """Execute the logic for a specific onboarding stage."""

        if stage == OnboardingStage.ACCOUNT_CREATION:
            return await self._setup_account(org, data)

        elif stage == OnboardingStage.ORGANIZATION_SETUP:
            return await self._setup_organization(org, data)

        elif stage == OnboardingStage.TEAM_INVITATION:
            return await self._invite_team(org, data)

        elif stage == OnboardingStage.REPOSITORY_CONNECTION:
            return await self._connect_repositories(org, data)

        elif stage == OnboardingStage.INITIAL_SCAN:
            return await self._run_initial_scan(org, data)

        elif stage == OnboardingStage.POLICY_CONFIG:
            return await self._configure_policies(org, data)

        elif stage == OnboardingStage.CI_INTEGRATION:
            return await self._setup_ci_integration(org, data)

        elif stage == OnboardingStage.IDE_PLUGINS:
            return await self._setup_ide_plugins(org, data)

        elif stage == OnboardingStage.TRAINING_COMPLETION:
            return await self._complete_training(org, data)

        elif stage == OnboardingStage.ACTIVATION:
            return await self._activate_organization(org, data)

        else:
            raise ValueError(f"Unknown stage: {stage}")

    async def _setup_account(self, org: Organization, data: dict) -> dict:
        """Setup initial account and send welcome email."""
        # Send welcome email with onboarding link
        await self._send_welcome_email(org)

        # Create customer success record
        success_manager = data.get("success_manager")
        if success_manager:
            org.settings["success_manager"] = success_manager
            org.settings["success_manager_email"] = (
                f"{success_manager.lower().replace(' ', '.')}@upm.io"
            )

        await self.db.commit()

        return {
            "welcome_email_sent": True,
            "customer_success_assigned": bool(success_manager),
        }

    async def _setup_organization(self, org: Organization, data: dict) -> dict:
        """Configure organization settings and integrations."""
        settings = data.get("settings", {})

        # SSO Configuration
        if "sso_config" in data:
            sso_manager = SSOManager()
            sso_result = await sso_manager.configure_sso(
                org.id, data["sso_config"]["provider"], data["sso_config"]["config"]
            )
            settings["sso_enabled"] = True
            settings["sso_provider"] = data["sso_config"]["provider"]

        # LDAP Configuration
        if "ldap_config" in data:
            ldap_auth = LDAPAuthProvider(
                server=data["ldap_config"]["server"],
                base_dn=data["ldap_config"]["base_dn"],
                bind_dn=data["ldap_config"].get("bind_dn"),
                bind_password=data["ldap_config"].get("bind_password"),
            )
            await ldap_auth.test_connection()
            settings["ldap_enabled"] = True

        org.settings.update(settings)
        await self.db.commit()

        return {
            "sso_configured": "sso_config" in data,
            "ldap_configured": "ldap_config" in data,
        }

    async def _invite_team(self, org: Organization, data: dict) -> dict:
        """Invite team members to the organization."""
        emails = data.get("emails", [])
        invited_count = 0

        for email in emails:
            # Check if user already exists
            result = await self.db.execute(select(User).where(User.email == email))
            existing_user = result.scalar_one_or_none()

            if existing_user:
                # Add to organization
                existing_user.organization_id = org.id
                invited_count += 1
            else:
                # Create invitation
                # Send invite email
                await self._send_invite_email(org, email)
                invited_count += 1

        await self.db.commit()

        return {"invited_count": invited_count, "team_size": len(emails)}

    async def _connect_repositories(self, org: Organization, data: dict) -> dict:
        """Connect to version control repositories."""
        repos = data.get("repositories", [])
        connected_count = 0

        for repo_config in repos:
            # Create project for each repository
            project = Project(
                name=repo_config["name"],
                description=f"Imported from {repo_config['url']}",
                ecosystem=repo_config.get("ecosystem", "auto-detect"),
                repository_url=repo_config["url"],
                repository_type=repo_config.get("type", "github"),
                organization_id=org.id,
                settings={
                    "auto_scan": True,
                    "branch": repo_config.get("branch", "main"),
                    "scan_schedule": repo_config.get("scan_schedule", "daily"),
                },
            )
            self.db.add(project)
            connected_count += 1

        await self.db.commit()

        return {
            "connected_repositories": connected_count,
            "projects_created": connected_count,
        }

    async def _run_initial_scan(self, org: Organization, data: dict) -> dict:
        """Run initial vulnerability scan on all projects."""
        projects = await self.db.execute(
            select(Project).where(Project.organization_id == org.id)
        )
        projects = projects.scalars().all()

        scan_results = []
        for project in projects:
            # Trigger scan
            scan_id = await self._trigger_scan(project.id)
            scan_results.append(
                {
                    "project_id": str(project.id),
                    "project_name": project.name,
                    "scan_id": scan_id,
                }
            )

        return {"projects_scanned": len(projects), "scan_results": scan_results}

    async def _configure_policies(self, org: Organization, data: dict) -> dict:
        """Configure security policies for the organization."""
        policies = data.get("policies", [])

        configured_policies = []
        for policy_config in policies:
            # Create policy
            policy = {
                "name": policy_config["name"],
                "description": policy_config.get("description", ""),
                "rules": policy_config.get("rules", []),
                "severity_threshold": policy_config.get("severity_threshold", "medium"),
                "enabled": True,
                "organization_id": str(org.id),
            }
            configured_policies.append(policy)

        # Save to organization settings
        org.settings["policies"] = configured_policies
        await self.db.commit()

        return {"policies_configured": len(configured_policies)}

    async def _setup_ci_integration(self, org: Organization, data: dict) -> dict:
        """Setup CI/CD integration."""
        platforms = data.get("platforms", [])
        integrations = []

        for platform in platforms:
            if platform == "github":
                integrations.append(
                    {
                        "platform": "github",
                        "webhook_url": f"{settings.API_BASE_URL}/webhooks/github",
                        "setup_instructions": self._get_github_setup_instructions(
                            org.id
                        ),
                    }
                )
            elif platform == "gitlab":
                integrations.append(
                    {
                        "platform": "gitlab",
                        "webhook_url": f"{settings.API_BASE_URL}/webhooks/gitlab",
                        "setup_instructions": self._get_gitlab_setup_instructions(
                            org.id
                        ),
                    }
                )
            elif platform == "jenkins":
                integrations.append(
                    {
                        "platform": "jenkins",
                        "plugin_url": f"{settings.API_BASE_URL}/plugins/jenkins",
                        "setup_instructions": self._get_jenkins_setup_instructions(
                            org.id
                        ),
                    }
                )

        org.settings["ci_integrations"] = integrations
        await self.db.commit()

        return {
            "integrations_configured": len(integrations),
            "platforms": [i["platform"] for i in integrations],
        }

    async def _setup_ide_plugins(self, org: Organization, data: dict) -> dict:
        """Setup IDE plugins for the organization."""
        plugin_urls = {
            "intellij": f"{settings.API_BASE_URL}/plugins/intellij?org={org.slug}",
            "vscode": f"{settings.API_BASE_URL}/plugins/vscode?org={org.slug}",
            "jetbrains": f"{settings.API_BASE_URL}/plugins/jetbrains?org={org.slug}",
        }

        instructions = {
            "intellij": {
                "download_url": plugin_urls["intellij"],
                "install_steps": [
                    "1. Open IntelliJ IDEA",
                    "2. Go to Settings → Plugins",
                    "3. Search for 'UPM'",
                    "4. Install and restart",
                    "5. Enter your organization slug: " + org.slug,
                ],
            },
            "vscode": {
                "download_url": plugin_urls["vscode"],
                "install_steps": [
                    "1. Open VS Code",
                    "2. Press Ctrl+P",
                    "3. Search 'upm-vscode'",
                    "4. Click Install",
                    "5. Configure with your organization slug: " + org.slug,
                ],
            },
        }

        return {
            "plugins_available": list(instructions.keys()),
            "instructions": instructions,
        }

    async def _complete_training(self, org: Organization, data: dict) -> dict:
        """Mark training as completed."""
        training_modules = [
            "upm_basics",
            "vulnerability_management",
            "policy_enforcement",
            "remediation_workflows",
        ]

        completed_modules = data.get("completed_modules", training_modules)

        org.settings["training_completed"] = True
        org.settings["training_modules"] = completed_modules
        org.settings["training_completed_at"] = datetime.utcnow().isoformat()

        await self.db.commit()

        return {"training_complete": True, "modules_completed": completed_modules}

    async def _activate_organization(self, org: Organization, data: dict) -> dict:
        """Activate the organization for production use."""
        org.onboarding_stage = OnboardingStage.ACTIVATION.value
        org.onboarding_completed_at = datetime.utcnow()
        org.is_active = True

        # Send activation email
        await self._send_activation_email(org)

        # Schedule check-in call
        check_in_date = datetime.utcnow() + timedelta(days=30)
        org.settings["next_check_in"] = check_in_date.isoformat()

        await self.db.commit()

        return {
            "organization_active": True,
            "check_in_scheduled": check_in_date.isoformat(),
        }

    # Public API methods for MCP integration

    async def scan_project(
        self,
        project_id: str,
        ecosystem: Optional[str] = None,
        manifest_url: Optional[str] = None,
    ) -> dict[str, Any]:
        """
        Scan a project for vulnerabilities.
        Main entry point for MCP AI assistant interaction.
        """
        from udp.services.scanner_service import ScannerService

        scanner = ScannerService(self.db)

        result = await scanner.scan_project(
            project_id=project_id, ecosystem=ecosystem, manifest_url=manifest_url
        )

        return {
            "scan_id": result.get("scan_id"),
            "status": result.get("status"),
            "dependencies_found": result.get("dependencies_count", 0),
            "vulnerabilities_found": result.get("vulnerabilities_count", 0),
            "risk_score": result.get("risk_score", 0),
        }

    async def analyze_dependency(
        self, ecosystem: str, package_name: str, version: str
    ) -> dict[str, Any]:
        """Analyze a specific dependency with full context."""
        from udp.services.dependency_service import DependencyService

        dep_service = DependencyService(self.db)

        # Get package info
        package_info = await dep_service.get_package_info(
            ecosystem, package_name, version
        )

        # Check for vulnerabilities
        vulnerabilities = await dep_service.get_vulnerabilities(
            ecosystem, package_name, version
        )

        # Get license info
        license_info = await dep_service.get_license_info(ecosystem, package_name)

        # Calculate risk score
        risk_score = await dep_service.calculate_risk_score(
            ecosystem, package_name, version, vulnerabilities
        )

        return {
            "package": {
                "ecosystem": ecosystem,
                "name": package_name,
                "version": version,
                "license": license_info.get("license", "Unknown"),
                "homepage": package_info.get("homepage", ""),
                "repository": package_info.get("repository", ""),
                "description": package_info.get("description", ""),
                "downloads": package_info.get("downloads", 0),
                "last_updated": package_info.get("last_updated", ""),
            },
            "vulnerabilities": vulnerabilities,
            "risk_score": risk_score,
            "recommendation": self._get_recommendation(risk_score, vulnerabilities),
        }

    async def get_remediation(
        self, project_id: str, vulnerability_ids: Optional[list[str]] = None
    ) -> dict[str, Any]:
        """Get remediation suggestions for vulnerabilities."""
        from udp.services.remediation_service import RemediationService

        remediation = RemediationService(self.db)

        suggestions = await remediation.get_suggestions(
            project_id=project_id, vulnerability_ids=vulnerability_ids
        )

        return {
            "suggestions": suggestions,
            "total_suggestions": len(suggestions),
            "auto_fixable": sum(1 for s in suggestions if s.get("auto_fixable", False)),
            "breaking_changes": sum(
                1 for s in suggestions if s.get("has_breaking_changes", False)
            ),
        }

    async def generate_sbom(
        self, project_id: str, format: str = "cyclonedx"
    ) -> dict[str, Any]:
        """Generate SBOM for compliance."""
        from udp.services.sbom_service import SBOMService

        sbom_service = SBOMService(self.db)

        sbom = await sbom_service.generate(project_id=project_id, format=format)

        return {
            "format": format,
            "bom": sbom,
            "components_count": len(sbom.get("components", [])),
            "dependencies_count": sbom.get("metadata", {}).get("componentCount", 0),
            "download_url": sbom.get("download_url", ""),
        }

    async def check_compliance(
        self, project_id: str, policy_ids: Optional[list[str]] = None
    ) -> dict[str, Any]:
        """Check project compliance against policies."""
        from udp.services.policy_service import PolicyService

        policy_service = PolicyService(self.db)

        result = await policy_service.validate_project(
            project_id=project_id, policy_ids=policy_ids
        )

        return {
            "compliant": result.get("compliant", False),
            "score": result.get("score", 0),
            "violations": result.get("violations", []),
            "policies_checked": result.get("policies_checked", 0),
        }

    async def create_fix_pr(
        self, project_id: str, vulnerability_id: str, branch: Optional[str] = None
    ) -> dict[str, Any]:
        """Create an automated fix pull request."""
        from udp.services.remediation_service import RemediationService

        remediation = RemediationService(self.db)

        pr = await remediation.create_fix_pr(
            project_id=project_id, vulnerability_id=vulnerability_id, branch=branch
        )

        return {
            "pr_number": pr.get("number"),
            "pr_url": pr.get("url"),
            "status": pr.get("status"),
            "head_branch": pr.get("head_branch"),
            "base_branch": pr.get("base_branch"),
        }

    # Helper methods

    def _generate_onboarding_token(self, organization_id: str) -> str:
        """Generate a secure onboarding token."""
        import base64
        import secrets

        raw = f"{organization_id}:{secrets.token_urlsafe(16)}"
        return base64.b64encode(raw.encode()).decode()

    def _get_step_instructions(self, stage: OnboardingStage) -> dict[str, Any]:
        """Get instructions for the current onboarding step."""
        instructions = {
            OnboardingStage.ACCOUNT_CREATION: {
                "title": "Create Your Account",
                "description": "Let's get your account set up",
                "estimated_time": "2 minutes",
                "actions": [
                    {
                        "action": "Check your email",
                        "description": "We've sent a verification link to your email",
                    },
                    {
                        "action": "Set your password",
                        "description": "Create a secure password for your account",
                    },
                    {
                        "action": "Complete your profile",
                        "description": "Add your name and timezone",
                    },
                ],
                "mctp_call": {
                    "prompt": "The user has started account creation. Guide them through verification.",
                    "next_action": "verify_email",
                },
            },
            OnboardingStage.ORGANIZATION_SETUP: {
                "title": "Configure Your Organization",
                "description": "Set up SSO, LDAP, and organization settings",
                "estimated_time": "15 minutes",
                "actions": [
                    {
                        "action": "Configure SSO",
                        "description": "Connect your identity provider (Okta, Azure AD, Google)",
                    },
                    {
                        "action": "Configure LDAP (optional)",
                        "description": "Connect your LDAP directory for user sync",
                    },
                    {
                        "action": "Set team preferences",
                        "description": "Configure notification preferences and policies",
                    },
                ],
                "mctp_call": {
                    "prompt": "The user is configuring organization settings. Help them with SSO/LDAP setup.",
                    "next_action": "configure_sso",
                },
            },
            OnboardingStage.TEAM_INVITATION: {
                "title": "Invite Your Team",
                "description": "Add your developers and security team",
                "estimated_time": "5 minutes",
                "actions": [
                    {
                        "action": "Upload CSV or enter emails",
                        "description": "Add team members by email",
                    },
                    {
                        "action": "Set roles and permissions",
                        "description": "Assign admin, developer, viewer, or auditor roles",
                    },
                    {
                        "action": "Send invitations",
                        "description": "Team members will receive onboarding links",
                    },
                ],
                "mctp_call": {
                    "prompt": "The user is inviting their team. Help them structure the team.",
                    "next_action": "invite_team",
                },
            },
            OnboardingStage.REPOSITORY_CONNECTION: {
                "title": "Connect Your Repositories",
                "description": "Link your GitHub, GitLab, or Bitbucket repositories",
                "estimated_time": "10 minutes",
                "actions": [
                    {
                        "action": "Connect VCS provider",
                        "description": "Authorize UPM to access your repositories",
                    },
                    {
                        "action": "Select repositories to scan",
                        "description": "Choose which repositories to monitor",
                    },
                    {
                        "action": "Configure scan settings",
                        "description": "Set scan schedules and notification preferences",
                    },
                ],
                "mctp_call": {
                    "prompt": "The user is connecting repositories. Guide them through VCS setup.",
                    "next_action": "connect_repos",
                },
            },
            OnboardingStage.INITIAL_SCAN: {
                "title": "Run Your First Scan",
                "description": "We'll scan your dependencies and create your security baseline",
                "estimated_time": "Variable (based on project size)",
                "actions": [
                    {
                        "action": "Review scan progress",
                        "description": "Watch as we discover your complete dependency tree",
                    },
                    {
                        "action": "Review initial findings",
                        "description": "See your vulnerabilities and risk score",
                    },
                ],
                "mctp_call": {
                    "prompt": "The first scan is running. Explain the results when complete.",
                    "next_action": "review_scan",
                },
            },
            OnboardingStage.POLICY_CONFIG: {
                "title": "Configure Security Policies",
                "description": "Set up policies that match your requirements",
                "estimated_time": "10 minutes",
                "actions": [
                    {
                        "action": "Choose policy templates",
                        "description": "Select from pre-built policies or create custom ones",
                    },
                    {
                        "action": "Set severity thresholds",
                        "description": "Define which vulnerability levels require action",
                    },
                    {
                        "action": "Configure approval workflows",
                        "description": "Set up when security team approval is needed",
                    },
                ],
                "mctp_call": {
                    "prompt": "The user is configuring policies. Help them set appropriate rules.",
                    "next_action": "configure_policies",
                },
            },
            OnboardingStage.CI_INTEGRATION: {
                "title": "Integrate with CI/CD",
                "description": "Add UPM scans to your pipeline",
                "estimated_time": "15 minutes",
                "actions": [
                    {
                        "action": "Select your CI platform",
                        "description": "GitHub Actions, GitLab CI, Jenkins, CircleCI, etc.",
                    },
                    {
                        "action": "Add scan step",
                        "description": "Add UPM scan step to your workflow",
                    },
                    {
                        "action": "Configure policy gates",
                        "description": "Block PRs with policy violations",
                    },
                ],
                "mctp_call": {
                    "prompt": "The user is setting up CI/CD. Guide them through pipeline integration.",
                    "next_action": "setup_ci",
                },
            },
            OnboardingStage.IDE_PLUGINS: {
                "title": "Install IDE Plugins",
                "description": "Get real-time vulnerability alerts in your IDE",
                "estimated_time": "5 minutes",
                "actions": [
                    {
                        "action": "Install IntelliJ plugin",
                        "description": "Download from JetBrains Marketplace",
                    },
                    {
                        "action": "Install VS Code extension",
                        "description": "Install from VS Code Marketplace",
                    },
                    {
                        "action": "Configure with your organization",
                        "description": "Enter your organization slug to connect",
                    },
                ],
                "mctp_call": {
                    "prompt": "The user is installing IDE plugins. Help them get started.",
                    "next_action": "install_plugins",
                },
            },
            OnboardingStage.TRAINING_COMPLETION: {
                "title": "Complete Training",
                "description": "Watch quick training videos to get the most out of UPM",
                "estimated_time": "30 minutes",
                "actions": [
                    {
                        "action": "Watch UPM Basics",
                        "description": "5-minute overview video",
                    },
                    {
                        "action": "Learn vulnerability management",
                        "description": "How to review and remediate findings",
                    },
                    {
                        "action": "Explore advanced features",
                        "description": "Policies, CI/CD integration, and more",
                    },
                ],
                "mctp_call": {
                    "prompt": "The user is completing training. Answer any questions they have.",
                    "next_action": "complete_training",
                },
            },
            OnboardingStage.ACTIVATION: {
                "title": "You're Ready!",
                "description": "Your organization is now fully set up and active",
                "estimated_time": "0 minutes",
                "actions": [
                    {
                        "action": "Review your dashboard",
                        "description": "See your complete security posture",
                    },
                    {
                        "action": "Explore the platform",
                        "description": "All features are now available",
                    },
                ],
                "mctp_call": {
                    "prompt": "Onboarding complete! Celebrate with the user and offer next steps.",
                    "next_action": "start_using_upm",
                },
            },
        }

        return instructions.get(stage, {})

    async def _get_organization(self, organization_id: str) -> Organization:
        """Get organization by ID."""
        result = await self.db.execute(
            select(Organization).where(Organization.id == organization_id)
        )
        return result.scalar_one()

    async def _get_onboarding_state(self, organization_id: str) -> OnboardingState:
        """Get onboarding state for organization."""
        result = await self.db.execute(
            select(OnboardingState).where(
                OnboardingState.organization_id == organization_id
            )
        )
        return result.scalar_one()

    async def _send_welcome_email(self, org: Organization):
        """Send welcome email with onboarding link."""
        # Implementation would use email service
        pass

    async def _send_invite_email(self, org: Organization, email: str):
        """Send team invitation email."""
        pass

    async def _send_activation_email(self, org: Organization):
        """Send activation celebration email."""
        pass

    async def _trigger_scan(self, project_id: str) -> str:
        """Trigger a vulnerability scan."""
        from udp.services.scanner_service import ScannerService

        scanner = ScannerService(self.db)
        result = await scanner.scan_project(project_id)
        return result.get("scan_id")

    def _get_recommendation(self, risk_score: int, vulnerabilities: list[dict]) -> str:
        """Get recommendation based on risk score."""
        if risk_score >= 80:
            return "CRITICAL: Upgrade immediately. This package has known exploitable vulnerabilities."
        elif risk_score >= 50:
            return "HIGH: Upgrade soon. This package has vulnerabilities that could be exploited."
        elif risk_score >= 20:
            return "MEDIUM: Consider upgrading. This package has known vulnerabilities."
        else:
            return "LOW: Monitor for updates. No critical issues currently known."

    def _get_github_setup_instructions(self, org_id: str) -> str:
        """Get GitHub webhook setup instructions."""
        return f"""
1. Go to your repository Settings → Webhooks
2. Add webhook: {settings.API_BASE_URL}/webhooks/github
3. Select events: Push, Pull Request, Create
4. Add secret: {self._generate_webhook_secret(org_id)}
        """

    def _get_gitlab_setup_instructions(self, org_id: str) -> str:
        """Get GitLab webhook setup instructions."""
        return f"""
1. Go to your project Settings → Webhooks
2. Add webhook: {settings.API_BASE_URL}/webhooks/gitlab
3. Select triggers: Push events, Merge request events
4. Add secret token: {self._generate_webhook_secret(org_id)}
        """

    def _get_jenkins_setup_instructions(self, org_id: str) -> str:
        """Get Jenkins plugin setup instructions."""
        return f"""
1. Install UPM Jenkins plugin from {settings.API_BASE_URL}/plugins/jenkins
2. Configure plugin with:
   - API Key: your_api_key
   - Organization: {org_id}
3. Add build step to your Jenkinsfile
        """

    def _generate_webhook_secret(self, org_id: str) -> str:
        """Generate webhook secret for organization."""
        import secrets

        return secrets.token_hex(32)
