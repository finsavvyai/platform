"""
User Journey State Machine for UPM Enterprise Onboarding

Tracks user behavior through onboarding and provides
MCP-interventions when users show signs of friction.
"""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Optional

from udp.core.config import settings


class JourneyStage(str, Enum):
    """All possible stages in the user journey."""

    LANDING = "landing"
    SIGNUP = "signup"
    VERIFY_EMAIL = "verify_email"
    CREATE_PROFILE = "create_profile"
    SELECT_PLAN = "select_plan"
    CONNECT_VCS = "connect_vcs"
    FIRST_SCAN = "first_scan"
    VIEW_RESULTS = "view_results"
    CONFIGURE_POLICIES = "configure_policies"
    INVITE_TEAM = "invite_team"
    SETUP_CI = "setup_ci"
    INSTALL_IDE = "install_ide"
    ACTIVATE = "activate"
    FIRST_VALUE = "first_value"  # Converted to paying customer


class JourneyEvent(str, Enum):
    """Events that can trigger state transitions."""

    VISIT_PAGE = "visit_page"
    CLICK_CTA = "click_cta"
    START_SIGNUP = "start_signup"
    SUBMIT_EMAIL = "submit_email"
    VERIFY_EMAIL = "verify_email"
    COMPLETE_PROFILE = "complete_profile"
    SELECT_PLAN = "select_plan"
    ADD_PAYMENT = "add_payment"
    CONNECT_REPO = "connect_repo"
    START_SCAN = "start_scan"
    SCAN_COMPLETE = "scan_complete"
    VIEW_DASHBOARD = "view_dashboard"
    CONFIGURE_POLICY = "configure_policy"
    INVITE_MEMBER = "invite_member"
    SETUP_CI = "setup_ci"
    DOWNLOAD_PLUGIN = "download_plugin"
    FIRST_REVENUE = "first_revenue"


class FrictionSignal(str, Enum):
    """Signals that indicate user friction."""

    HIGH_ERROR_RATE = "high_error_rate"
    LONG_PAUSE = "long_pause"
    PAGE_ABANDON = "page_abandon"
    REPEATED_ACTION = "repeated_action"
    CONFUSION_EVENT = "confusion_event"
    RAGE_CLICK = "rage_click"
    HELP_REQUEST = "help_request"


class InterventionType(str, Enum):
    """Types of MCP interventions."""

    GUIDANCE = "guidance"  # Helpful tip
    ASSISTANCE = "assistance"  # Active help
    MOTIVATION = "motivation"  # Encouragement
    SIMPLIFICATION = "simplification"  # Suggest easier path
    ESCALATION = "escalation"  # Connect to human


@dataclass
class JourneyState:
    """State of a user through the onboarding journey."""

    user_id: str
    current_stage: JourneyStage
    entered_stage_at: datetime
    last_activity_at: datetime

    # Tracking metrics
    sessions_count: int = 0
    page_views: int = 0
    errors_encountered: int = 0
    time_in_stage: float = 0.0

    # Friction indicators
    friction_signals: list[FrictionSignal] = field(default_factory=list)
    interventions_shown: list[InterventionType] = field(default_factory=list)

    # Context for personalization
    organization_size: Optional[str] = None
    primary_ecosystem: Optional[str] = None
    technical_sophistication: str = "medium"  # low, medium, high
    previous_experience: str = "none"  # none, some, expert


class JourneyStateMachine:
    """
    Manages user journeys through onboarding with MCP-powered
    interventions for users showing signs of friction.
    """

    def __init__(self):
        self.states: dict[str, JourneyState] = {}
        self.transitions = self._build_transitions()
        self.interventions = self._build_interventions()

    def _build_transitions(self) -> dict[JourneyStage, list[JourneyEvent]]:
        """Define valid state transitions."""
        return {
            JourneyStage.LANDING: [JourneyEvent.START_SIGNUP],
            JourneyStage.SIGNUP: [JourneyEvent.SUBMIT_EMAIL, JourneyEvent.VISIT_PAGE],
            JourneyStage.VERIFY_EMAIL: [
                JourneyEvent.VERIFY_EMAIL,
                JourneyEvent.VISIT_PAGE,
            ],
            JourneyStage.CREATE_PROFILE: [JourneyEvent.COMPLETE_PROFILE],
            JourneyStage.SELECT_PLAN: [
                JourneyEvent.SELECT_PLAN,
                JourneyEvent.ADD_PAYMENT,
            ],
            JourneyStage.CONNECT_VCS: [JourneyEvent.CONNECT_REPO],
            JourneyStage.FIRST_SCAN: [
                JourneyEvent.START_SCAN,
                JourneyEvent.SCAN_COMPLETE,
            ],
            JourneyStage.VIEW_RESULTS: [
                JourneyEvent.VIEW_DASHBOARD,
                JourneyEvent.CONFIGURE_POLICY,
            ],
            JourneyStage.CONFIGURE_POLICIES: [
                JourneyEvent.CONFIGURE_POLICY,
                JourneyEvent.INVITE_MEMBER,
            ],
            JourneyStage.INVITE_TEAM: [
                JourneyEvent.INVITE_MEMBER,
                JourneyEvent.SETUP_CI,
            ],
            JourneyStage.SETUP_CI: [
                JourneyEvent.SETUP_CI,
                JourneyEvent.DOWNLOAD_PLUGIN,
            ],
            JourneyStage.INSTALL_IDE: [
                JourneyEvent.DOWNLOAD_PLUGIN,
                JourneyEvent.ACTIVATE,
            ],
            JourneyStage.ACTIVATE: [JourneyEvent.FIRST_REVENUE],
            JourneyStage.FIRST_VALUE: [JourneyEvent.VISIT_PAGE],
        }

    def _build_interventions(
        self,
    ) -> dict[JourneyStage, dict[FrictionSignal, InterventionType]]:
        """Define when to trigger interventions based on friction signals."""
        return {
            JourneyStage.SIGNUP: {
                FrictionSignal.PAGE_ABANDON: InterventionType.MOTIVATION,
                FrictionSignal.HIGH_ERROR_RATE: InterventionType.ASSISTANCE,
                FrictionSignal.HELP_REQUEST: InterventionType.ASSISTANCE,
            },
            JourneyStage.VERIFY_EMAIL: {
                FrictionSignal.LONG_PAUSE: InterventionType.MOTIVATION,
                FrictionSignal.PAGE_ABANDON: InterventionType.ESCALATION,
            },
            JourneyStage.CONNECT_VCS: {
                FrictionSignal.HIGH_ERROR_RATE: InterventionType.ASSISTANCE,
                FrictionSignal.REPEATED_ACTION: InterventionType.GUIDANCE,
                FrictionSignal.HELP_REQUEST: InterventionType.ASSISTANCE,
            },
            JourneyStage.FIRST_SCAN: {
                FrictionSignal.LONG_PAUSE: InterventionType.GUIDANCE,
                FrictionSignal.PAGE_ABANDON: InterventionType.MOTIVATION,
            },
            JourneyStage.CONFIGURE_POLICIES: {
                FrictionSignal.RAGE_CLICK: InterventionType.SIMPLIFICATION,
                FrictionSignal.HELP_REQUEST: InterventionType.ASSISTANCE,
            },
            JourneyStage.SETUP_CI: {
                FrictionSignal.PAGE_ABANDON: InterventionType.MOTIVATION,
                FrictionSignal.HIGH_ERROR_RATE: InterventionType.ASSISTANCE,
            },
            JourneyStage.INSTALL_IDE: {
                FrictionSignal.PAGE_ABANDON: InterventionType.GUIDANCE,
                FrictionSignal.HELP_REQUEST: InterventionType.ASSISTANCE,
            },
        }

    async def process_event(
        self, user_id: str, event: JourneyEvent, properties: dict[str, Any]
    ) -> dict[str, Any]:
        """
        Process a journey event and determine if intervention is needed.

        Returns action recommendations including MCP calls if needed.
        """
        # Get or create user state
        state = self.states.get(user_id)
        if not state:
            state = JourneyState(
                user_id=user_id,
                current_stage=JourneyStage.LANDING,
                entered_stage_at=datetime.utcnow(),
                last_activity_at=datetime.utcnow(),
            )
            self.states[user_id] = state

        # Update state
        state.last_activity_at = datetime.utcnow()

        # Check for friction signals
        detected_friction = self._detect_friction(state, event, properties)

        # Determine if intervention is needed
        intervention = None
        if detected_friction:
            stage_interventions = self.interventions.get(state.current_stage, {})
            intervention = stage_interventions.get(detected_friction)

            if intervention:
                # Generate MCP-assisted intervention
                mcp_response = await self._generate_intervention(
                    state, detected_friction, intervention, properties
                )
                state.interventions_shown.append(intervention)

                return {
                    "transition": None,
                    "intervention": {
                        "type": intervention,
                        "signal": detected_friction,
                        "mcp_response": mcp_response,
                    },
                }

        # Process state transition
        new_stage = None
        valid_events = self.transitions.get(state.current_stage, [])

        if event in valid_events:
            new_stage = self._get_next_stage(state.current_stage, event)

        if new_stage and new_stage != state.current_stage:
            # Calculate time in previous stage
            time_in_stage = (datetime.utcnow() - state.entered_stage_at).total_seconds()

            # Transition to new stage
            old_stage = state.current_stage
            state.current_stage = new_stage
            state.entered_stage_at = datetime.utcnow()
            state.time_in_stage = 0.0

            # Record milestone
            await self._record_milestone(user_id, old_stage, new_stage, time_in_stage)

            return {
                "transition": {
                    "from": old_stage,
                    "to": new_stage,
                    "time_spent": time_in_stage,
                },
                "next_step": self._get_stage_instructions(new_stage),
            }

        return {"transition": None}

    def _detect_friction(
        self, state: JourneyState, event: JourneyEvent, properties: dict[str, Any]
    ) -> Optional[FrictionSignal]:
        """Detect friction signals from user behavior."""
        # High error rate (more than 3 errors in 5 minutes)
        if event == JourneyEvent.VISIT_PAGE:
            page_errors = properties.get("errors", 0)
            if page_errors > 3:
                return FrictionSignal.HIGH_ERROR_RATE

        # Long pause (no activity for 30 minutes during active stage)
        time_since_activity = (
            datetime.utcnow() - state.last_activity_at
        ).total_seconds()
        if time_since_activity > 1800 and state.current_stage not in [
            JourneyStage.LANDING,
            JourneyStage.ACTIVATE,
            JourneyStage.FIRST_VALUE,
        ]:
            return FrictionSignal.LONG_PAUSE

        # Page abandon (viewing page for < 5 seconds)
        if event == JourneyEvent.VISIT_PAGE:
            page_duration = properties.get("duration", 0)
            if page_duration < 5:
                return FrictionSignal.PAGE_ABANDON

        # Repeated action (same action 5+ times in 1 minute)
        action_count = properties.get("action_count", 0)
        if action_count > 5:
            return FrictionSignal.REPEATED_ACTION

        # Rage click (rapid clicking on same element)
        click_rate = properties.get("click_rate", 0)
        if click_rate > 10:
            return FrictionSignal.RAGE_CLICK

        # Help request (user clicks help or support)
        if properties.get("clicked_help", False):
            return FrictionSignal.HELP_REQUEST

        # Confusion event (user visits FAQ or docs mid-task)
        if properties.get("visited_docs", False) and state.current_stage in [
            JourneyStage.CONNECT_VCS,
            JourneyStage.CONFIGURE_POLICIES,
            JourneyStage.SETUP_CI,
        ]:
            return FrictionSignal.CONFUSION_EVENT

        return None

    async def _generate_intervention(
        self,
        state: JourneyState,
        signal: FrictionSignal,
        intervention: InterventionType,
        context: dict[str, Any],
    ) -> dict[str, Any]:
        """Generate AI-powered intervention using MCP."""
        from udp.mcp.client import UPMMCPClient

        mcp_client = UPMMCPClient(api_key=settings.MCP_API_KEY)

        # Build prompt for AI assistant
        prompt = self._build_intervention_prompt(state, signal, intervention, context)

        # Call MCP for AI-generated response
        response = await mcp_client.get_assistive_guidance(
            user_id=state.user_id,
            stage=state.current_stage.value,
            signal=signal.value,
            intervention=intervention.value,
            context=context,
        )

        return response

    def _build_intervention_prompt(
        self,
        state: JourneyState,
        signal: FrictionSignal,
        intervention: InterventionType,
        context: dict[str, Any],
    ) -> str:
        """Build prompt for AI assistant to generate intervention."""
        return f"""
The user is experiencing friction during onboarding.

User Context:
- Stage: {state.current_stage.value}
- Technical sophistication: {state.technical_sophistication}
- Previous experience: {state.previous_experience}
- Time in current stage: {state.time_in_stage} seconds

Friction Signal:
- Signal: {signal.value}
- Context: {context}

Intervention Type: {intervention.value}

Please provide helpful, empathetic guidance to help the user proceed.
The response should be:
1. Acknowledge the difficulty
2. Provide clear next steps
3. Offer alternative approaches if applicable
4. Maintain an encouraging tone
5. Be concise (under 200 words)
"""

    def _get_next_stage(
        self, current_stage: JourneyStage, event: JourneyEvent
    ) -> Optional[JourneyStage]:
        """Determine the next stage based on current stage and event."""
        stage_map = {
            JourneyStage.LANDING: JourneyStage.SIGNUP,
            JourneyStage.SIGNUP: JourneyStage.VERIFY_EMAIL,
            JourneyStage.VERIFY_EMAIL: JourneyStage.CREATE_PROFILE,
            JourneyStage.CREATE_PROFILE: JourneyStage.SELECT_PLAN,
            JourneyStage.SELECT_PLAN: JourneyStage.CONNECT_VCS,
            JourneyStage.CONNECT_VCS: JourneyStage.FIRST_SCAN,
            JourneyStage.FIRST_SCAN: JourneyStage.VIEW_RESULTS,
            JourneyStage.VIEW_RESULTS: JourneyStage.CONFIGURE_POLICIES,
            JourneyStage.CONFIGURE_POLICIES: JourneyStage.INVITE_TEAM,
            JourneyStage.INVITE_TEAM: JourneyStage.SETUP_CI,
            JourneyStage.SETUP_CI: JourneyStage.INSTALL_IDE,
            JourneyStage.INSTALL_IDE: JourneyStage.ACTIVATE,
            JourneyStage.ACTIVATE: JourneyStage.FIRST_VALUE,
        }

        return stage_map.get(current_stage)

    def _get_stage_instructions(self, stage: JourneyStage) -> dict[str, Any]:
        """Get instructions for a given stage."""
        # This would integrate with OnboardingOrchestrator
        return {
            "stage": stage.value,
            "title": stage.value.replace("_", " ").title(),
            "instructions": f"Complete the {stage.value} step",
        }

    async def _record_milestone(
        self,
        user_id: str,
        from_stage: JourneyStage,
        to_stage: JourneyStage,
        time_spent: float,
    ):
        """Record journey milestone for analytics."""
        # Implementation would save to analytics database
        pass


class JourneyAnalytics:
    """
    Analytics engine for journey optimization.
    Provides insights into onboarding performance.
    """

    async def get_funnel_metrics(
        self, stage: JourneyStage, period: str = "30d"
    ) -> dict[str, Any]:
        """Get conversion metrics for a specific stage."""
        # Implementation would query analytics database
        # Return metrics like conversion rate, drop-off points, etc.
        pass

    async def identify_bottlenecks(
        self, organization_size: Optional[str] = None
    ) -> list[dict[str, Any]]:
        """Identify bottlenecks in the onboarding flow."""
        bottlenecks = []

        # Stage with highest drop-off
        # Stage with longest completion time
        # Stage with most friction signals

        return bottlenecks

    async def get_user_cohort_analysis(
        self,
        cohort: str,  # e.g., "enterprise-2024-02", "startup-100-500"
    ) -> dict[str, Any]:
        """Analyze a cohort of users through their journey."""
        # Implementation would analyze users who started in same time period
        pass

    async def calculate_ltv(self, user_id: str) -> float:
        """Calculate lifetime value for a user based on journey data."""
        # LTV calculation based on user's journey patterns and engagement
        pass


class JourneyOptimizer:
    """
    Continuously optimizes the onboarding flow based on
    journey analytics and user feedback.
    """

    async def suggest_optimizations(self, stage: JourneyStage) -> list[dict[str, Any]]:
        """Suggest optimizations for a specific stage."""
        # Analyze stage performance
        # Suggest A/B tests
        # Recommend content changes
        pass

    async def get_personalized_onboarding_path(
        self, user_id: str, user_profile: dict[str, Any]
    ) -> list[dict[str, Any]]:
        """Generate personalized onboarding path for a user."""
        # Based on user's experience, tech stack, team size, etc.
        # Recommend optimal journey through onboarding
        pass
