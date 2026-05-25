"""
Comprehensive tests for the Agent Collaboration Framework
"""

import pytest
import asyncio
import json
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4, UUID

from app.services.collaboration import (
    CollaborationService,
    AgentDiscoveryService,
    MessageRoutingService,
    TaskDelegationService,
    ConsensusService,
    AgentInfo,
    MessageEnvelope,
    TaskDelegationRequest,
    CollaborationError,
    AgentNotFoundError,
    CommunicationError,
    ConsensusError,
    DelegationError
)
from app.models.collaboration import (
    CollaborationSession,
    CollaborationMessage,
    CollaborationTask,
    ConsensusVote,
    CollaborationStatus,
    MessageType,
    MessagePriority
)


@pytest.fixture
async def collaboration_service():
    """Create collaboration service fixture"""
    service = CollaborationService()
    await service.start()
    yield service
    await service.stop()


@pytest.fixture
def mock_agent_registry():
    """Mock agent registry"""
    registry = MagicMock()
    registry._started = True
    registry.get_system_overview.return_value = {
        "registry": {
            "agents": [
                {
                    "id": str(uuid4()),
                    "name": "Test Agent 1",
                    "agent_type": "browser_automation",
                    "capabilities": ["web_navigation", "form_filling", "screenshot_capture"],
                    "status": "active",
                    "performance_metrics": {"performance_score": 0.8},
                    "current_load": 0.3
                },
                {
                    "id": str(uuid4()),
                    "name": "Test Agent 2",
                    "agent_type": "data_analysis",
                    "capabilities": ["data_processing", "statistical_analysis", "report_generation"],
                    "status": "active",
                    "performance_metrics": {"performance_score": 0.9},
                    "current_load": 0.1
                }
            ]
        }
    }
    return registry


@pytest.fixture
def sample_agents():
    """Create sample agent data"""
    agent1_id = uuid4()
    agent2_id = uuid4()
    agent3_id = uuid4()

    return {
        "agent1": AgentInfo(
            agent_id=agent1_id,
            name="Browser Agent",
            agent_type="browser_automation",
            capabilities=["web_navigation", "form_filling"],
            status="active",
            performance_score=0.8,
            current_load=0.2
        ),
        "agent2": AgentInfo(
            agent_id=agent2_id,
            name="Data Agent",
            agent_type="data_analysis",
            capabilities=["data_processing", "statistical_analysis"],
            status="active",
            performance_score=0.9,
            current_load=0.1
        ),
        "agent3": AgentInfo(
            agent_id=agent3_id,
            name="Infrastructure Agent",
            agent_type="infrastructure_management",
            capabilities=["server_management", "monitoring"],
            status="active",
            performance_score=0.7,
            current_load=0.4
        )
    }


class TestAgentDiscoveryService:
    """Test agent discovery service"""

    @pytest.fixture
    async def discovery_service(self, mock_agent_registry):
        """Create discovery service fixture"""
        return AgentDiscoveryService(mock_agent_registry)

    async def test_discover_agents_by_capability(self, discovery_service):
        """Test discovering agents by capability"""
        required_capabilities = ["web_navigation", "form_filling"]

        agents = await discovery_service.discover_agents_by_capability(
            required_capabilities=required_capabilities,
            max_agents=5
        )

        assert len(agents) > 0
        assert all(
            all(cap in agent.capabilities for cap in required_capabilities)
            for agent in agents
        )
        assert agents[0].performance_score >= agents[-1].performance_score  # Sorted by performance

    async def test_discover_agents_with_exclude_list(self, discovery_service, sample_agents):
        """Test discovering agents with exclusion list"""
        required_capabilities = ["data_processing"]
        exclude_agents = [sample_agents["agent2"].agent_id]

        with patch.object(discovery_service, 'discover_agents_by_capability') as mock_discover:
            mock_discover.return_value = [sample_agents["agent2"]]

            agents = await discovery_service.discover_agents_by_capability(
                required_capabilities=required_capabilities,
                exclude_agents=exclude_agents
            )

            mock_discover.assert_called_once()
            call_args = mock_discover.call_args
            assert exclude_agents in call_args[1].values()

    async def test_find_best_agent_for_task(self, discovery_service):
        """Test finding best agent for specific task"""
        task_type = "browser_automation"
        requirements = {
            "min_performance_score": 0.7,
            "required_capabilities": ["web_navigation"]
        }

        best_agent = await discovery_service.find_best_agent_for_task(
            task_type=task_type,
            requirements=requirements
        )

        assert best_agent is not None
        assert "web_navigation" in best_agent.capabilities
        assert best_agent.performance_score >= 0.7

    async def test_find_best_agent_no_match(self, discovery_service):
        """Test finding best agent when no match found"""
        task_type = "nonexistent_task_type"
        requirements = {"min_performance_score": 0.9}

        with patch.object(discovery_service, 'discover_agents_by_capability') as mock_discover:
            mock_discover.return_value = []

            best_agent = await discovery_service.find_best_agent_for_task(
                task_type=task_type,
                requirements=requirements
            )

            assert best_agent is None

    def test_get_capabilities_for_task_type(self, discovery_service):
        """Test mapping task types to capabilities"""
        browser_caps = discovery_service._get_capabilities_for_task_type(
            "browser_automation", {}
        )
        assert "web_navigation" in browser_caps
        assert "form_filling" in browser_caps

        # Test with additional capabilities from requirements
        custom_caps = discovery_service._get_capabilities_for_task_type(
            "data_analysis",
            {"required_capabilities": ["machine_learning"]}
        )
        assert "machine_learning" in custom_caps
        assert "data_processing" in custom_caps


class TestMessageRoutingService:
    """Test message routing service"""

    @pytest.fixture
    def routing_service(self):
        """Create routing service fixture"""
        return MessageRoutingService()

    async def test_send_direct_message(self, routing_service):
        """Test sending direct message"""
        sender_id = uuid4()
        recipient_id = uuid4()

        envelope = MessageEnvelope(
            message_id=uuid4(),
            sender_id=sender_id,
            recipient_id=recipient_id,
            message_type=MessageType.TASK_DELEGATION,
            priority=MessagePriority.NORMAL,
            subject="Test Message",
            content="Test content",
            payload={"test": "data"}
        )

        with patch('app.services.collaboration.redis_client') as mock_redis:
            mock_redis.publish = AsyncMock(return_value=True)

            success = await routing_service._send_direct_message(envelope)

            assert success
            mock_redis.publish.assert_called_once()

    async def test_send_broadcast_message(self, routing_service):
        """Test sending broadcast message"""
        session_id = uuid4()
        sender_id = uuid4()

        # Mock session participants
        participant1 = uuid4()
        participant2 = uuid4()

        envelope = MessageEnvelope(
            message_id=uuid4(),
            sender_id=sender_id,
            recipient_id=None,  # Broadcast
            message_type=MessageType.COORDINATION,
            priority=MessagePriority.NORMAL,
            subject="Broadcast Test",
            content="Broadcast content",
            thread_id=session_id
        )

        with patch('app.services.collaboration.get_db') as mock_get_db, \
             patch.object(routing_service, '_send_direct_message') as mock_send:

            # Mock database session and query
            mock_session = AsyncMock()
            mock_result = AsyncMock()
            mock_session.scalar_one_or_none.return_value = MagicMock(
                participating_agents=[str(participant1), str(participant2), str(sender_id)]
            )
            mock_result.scalar_one_or_none = mock_session.scalar_one_or_none
            mock_db = AsyncMock()
            mock_db.execute.return_value = mock_result
            mock_get_db.return_value.__aenter__.return_value = mock_db

            success = await routing_service._broadcast_message(envelope)

            assert success
            # Should send to 2 other participants (not sender)
            assert mock_send.call_count == 2

    async def test_receive_message(self, routing_service):
        """Test receiving a message"""
        message_id = uuid4()
        agent_id = uuid4()
        sender_id = uuid4()

        with patch('app.services.collaboration.get_db') as mock_get_db:
            # Mock database message
            mock_db_message = MagicMock()
            mock_db_message.id = message_id
            mock_db_message.sender_agent_id = sender_id
            mock_db_message.recipient_agent_id = agent_id
            mock_db_message.message_type = "task_delegation"
            mock_db_message.priority = "normal"
            mock_db_message.subject = "Test"
            mock_db_message.content = "Content"
            mock_db_message.payload = {"test": "data"}
            mock_db_message.thread_id = None
            mock_db_message.parent_message_id = None
            mock_db_message.requires_response = False
            mock_db_message.response_deadline = None
            mock_db_message.metadata = {}
            mock_db_message.sent_at = datetime.utcnow()

            mock_result = AsyncMock()
            mock_result.scalar_one_or_none.return_value = mock_db_message
            mock_db = AsyncMock()
            mock_db.execute.return_value = mock_result
            mock_db.commit = AsyncMock()
            mock_get_db.return_value.__aenter__.return_value = mock_db

            envelope = await routing_service.receive_message(message_id, agent_id)

            assert envelope is not None
            assert envelope.message_id == message_id
            assert envelope.sender_id == sender_id
            assert envelope.recipient_id == agent_id


class TestTaskDelegationService:
    """Test task delegation service"""

    @pytest.fixture
    def delegation_service(self):
        """Create delegation service fixture"""
        mock_discovery = AsyncMock()
        mock_routing = AsyncMock()
        return TaskDelegationService(mock_discovery, mock_routing)

    async def test_delegate_task_success(self, delegation_service, sample_agents):
        """Test successful task delegation"""
        session_id = uuid4()
        request = TaskDelegationRequest(
            task_id=uuid4(),
            delegating_agent_id=sample_agents["agent1"].agent_id,
            task_type="browser_automation",
            title="Test Task",
            description="Test task description",
            input_data={"url": "https://example.com"},
            priority=5
        )

        # Mock successful agent discovery and message routing
        delegation_service.discovery_service.find_best_agent_for_task = AsyncMock(
            return_value=sample_agents["agent2"]
        )
        delegation_service.routing_service.send_message = AsyncMock(return_value=True)

        with patch('app.services.collaboration.get_db') as mock_get_db:
            mock_db = AsyncMock()
            mock_db.add = MagicMock()
            mock_db.commit = AsyncMock()
            mock_db.scalar_one_or_none = AsyncMock(
                return_value=MagicMock(assigned_agent_id=sample_agents["agent2"].agent_id)
            )
            mock_get_db.return_value.__aenter__.return_value = mock_db

            assigned_agent_id = await delegation_service.delegate_task(request, session_id)

            assert assigned_agent_id == sample_agents["agent2"].agent_id
            delegation_service.discovery_service.find_best_agent_for_task.assert_called_once()
            delegation_service.routing_service.send_message.assert_called_once()

    async def test_delegate_task_no_agent_available(self, delegation_service):
        """Test task delegation when no agent is available"""
        session_id = uuid4()
        request = TaskDelegationRequest(
            task_id=uuid4(),
            delegating_agent_id=uuid4(),
            task_type="nonexistent_task",
            title="Test Task",
            description="Test task description",
            input_data={}
        )

        # Mock no agents found
        delegation_service.discovery_service.find_best_agent_for_task = AsyncMock(
            return_value=None
        )

        with patch('app.services.collaboration.get_db'):
            assigned_agent_id = await delegation_service.delegate_task(request, session_id)

            assert assigned_agent_id is None

    async def test_handle_task_response_accepted(self, delegation_service):
        """Test handling accepted task response"""
        task_id = uuid4()
        agent_id = uuid4()

        with patch('app.services.collaboration.get_db') as mock_get_db:
            mock_task = MagicMock()
            mock_task.status = "assigned"
            mock_task.started_at = datetime.utcnow()

            mock_result = AsyncMock()
            mock_result.scalar_one_or_none.return_value = mock_task
            mock_db = AsyncMock()
            mock_db.execute.return_value = mock_result
            mock_db.commit = AsyncMock()
            mock_get_db.return_value.__aenter__.return_value = mock_db

            await delegation_service.handle_task_response(
                task_id=task_id,
                agent_id=agent_id,
                accepted=True
            )

            assert mock_task.status == "in_progress"
            mock_task.started_at = datetime.utcnow()

    async def test_complete_task_success(self, delegation_service):
        """Test completing a delegated task successfully"""
        task_id = uuid4()
        agent_id = uuid4()
        result = {"output": "success", "data": [1, 2, 3]}

        with patch('app.services.collaboration.get_db') as mock_get_db:
            mock_task = MagicMock()
            mock_task.delegating_agent_id = uuid4()
            mock_task.title = "Test Task"

            mock_result = AsyncMock()
            mock_result.scalar_one_or_none.return_value = mock_task
            mock_db = AsyncMock()
            mock_db.execute.return_value = mock_result
            mock_db.commit = AsyncMock()
            mock_get_db.return_value.__aenter__.return_value = mock_db

            await delegation_service.complete_task(
                task_id=task_id,
                agent_id=agent_id,
                result=result,
                success=True,
                execution_time_ms=1500.0
            )

            assert mock_task.status == "completed"
            assert mock_task.result == result
            assert mock_task.success_score == 1.0


class TestConsensusService:
    """Test consensus service"""

    @pytest.fixture
    def consensus_service(self):
        """Create consensus service fixture"""
        mock_routing = AsyncMock()
        return ConsensusService(mock_routing)

    async def test_initiate_consensus(self, consensus_service, sample_agents):
        """Test initiating consensus"""
        session_id = uuid4()
        proposal_id = "test-proposal-1"
        participating_agents = [
            sample_agents["agent1"].agent_id,
            sample_agents["agent2"].agent_id,
            sample_agents["agent3"].agent_id
        ]
        proposal_data = {"action": "test_action", "parameters": {}}

        with patch.object(consensus_service, '_send_consensus_requests') as mock_send:
            mock_send.return_value = True

            success = await consensus_service.initiate_consensus(
                session_id=session_id,
                proposal_id=proposal_id,
                participating_agents=participating_agents,
                proposal_data=proposal_data,
                consensus_threshold=0.8
            )

            assert success
            assert proposal_id in consensus_service._active_consensus_sessions

            session_data = consensus_service._active_consensus_sessions[proposal_id]
            assert session_data["participating_agents"] == participating_agents
            assert session_data["consensus_threshold"] == 0.8

    async def test_submit_vote(self, consensus_service, sample_agents):
        """Test submitting a vote"""
        proposal_id = "test-proposal-2"
        agent_id = sample_agents["agent1"].agent_id

        # Pre-populate consensus session
        consensus_service._active_consensus_sessions[proposal_id] = {
            "session_id": str(uuid4()),
            "participating_agents": [agent_id],
            "consensus_threshold": 0.7,
            "voting_deadline": datetime.utcnow() + timedelta(hours=1),
            "votes": {}
        }

        with patch('app.services.collaboration.get_db') as mock_get_db:
            mock_db = AsyncMock()
            mock_db.add = MagicMock()
            mock_db.commit = AsyncMock()
            mock_get_db.return_value.__aenter__.return_value = mock_db

            success = await consensus_service.submit_vote(
                proposal_id=proposal_id,
                agent_id=agent_id,
                vote_value="approve",
                confidence_score=0.9,
                reasoning="I approve this proposal"
            )

            assert success
            assert str(agent_id) in consensus_service._active_consensus_sessions[proposal_id]["votes"]

            vote_data = consensus_service._active_consensus_sessions[proposal_id]["votes"][str(agent_id)]
            assert vote_data["vote_value"] == "approve"
            assert vote_data["confidence_score"] == 0.9

    async def test_check_consensus_approved(self, consensus_service):
        """Test consensus checking when approved"""
        proposal_id = "test-proposal-3"
        agent1_id = uuid4()
        agent2_id = uuid4()
        agent3_id = uuid4()

        # Pre-populate consensus session with votes
        consensus_service._active_consensus_sessions[proposal_id] = {
            "session_id": str(uuid4()),
            "participating_agents": [agent1_id, agent2_id, agent3_id],
            "consensus_threshold": 0.7,
            "voting_deadline": datetime.utcnow() + timedelta(hours=1),
            "votes": {
                str(agent1_id): {"vote_value": "approve"},
                str(agent2_id): {"vote_value": "approve"},
                str(agent3_id): {"vote_value": "approve"}
            }
        }

        with patch('app.services.collaboration.get_db') as mock_get_db, \
             patch.object(consensus_service, '_notify_consensus_result') as mock_notify:

            mock_session = MagicMock()
            mock_session.consensus_result = {}
            mock_result = AsyncMock()
            mock_result.scalar_one_or_none.return_value = mock_session
            mock_db = AsyncMock()
            mock_db.execute.return_value = mock_result
            mock_db.commit = AsyncMock()
            mock_get_db.return_value.__aenter__.return_value = mock_db

            await consensus_service._check_consensus(proposal_id)

            assert proposal_id not in consensus_service._active_consensus_sessions
            mock_session.consensus_result["result"] = "approved"

    async def test_check_consensus_no_consensus(self, consensus_service):
        """Test consensus checking when no consensus is reached"""
        proposal_id = "test-proposal-4"
        agent1_id = uuid4()
        agent2_id = uuid4()
        agent3_id = uuid4()

        # Pre-populate with mixed votes (no consensus)
        consensus_service._active_consensus_sessions[proposal_id] = {
            "session_id": str(uuid4()),
            "participating_agents": [agent1_id, agent2_id, agent3_id],
            "consensus_threshold": 0.8,
            "voting_deadline": datetime.utcnow() + timedelta(hours=1),
            "votes": {
                str(agent1_id): {"vote_value": "approve"},
                str(agent2_id): {"vote_value": "reject"},
                str(agent3_id): {"vote_value": "approve"}
            }
        }

        with patch('app.services.collaboration.get_db') as mock_get_db:
            mock_session = MagicMock()
            mock_session.consensus_result = {}
            mock_result = AsyncMock()
            mock_result.scalar_one_or_none.return_value = mock_session
            mock_db = AsyncMock()
            mock_db.execute.return_value = mock_result
            mock_db.commit = AsyncMock()
            mock_get_db.return_value.__aenter__.return_value = mock_db

            await consensus_service._check_consensus(proposal_id)

            assert proposal_id not in consensus_service._active_consensus_sessions
            mock_session.consensus_result["result"] == "no_consensus"


class TestCollaborationService:
    """Test main collaboration service"""

    async def test_create_collaboration_session(self, collaboration_service):
        """Test creating a collaboration session"""
        session_id = uuid4()
        initiator_id = uuid4()
        participant1_id = uuid4()
        participant2_id = uuid4()

        with patch('app.services.collaboration.uuid4', return_value=session_id), \
             patch('app.services.collaboration.get_db') as mock_get_db, \
             patch.object(collaboration_service._routing_service, 'send_message') as mock_send:

            mock_db = AsyncMock()
            mock_db.add = MagicMock()
            mock_db.commit = AsyncMock()
            mock_get_db.return_value.__aenter__.return_value = mock_db

            created_session_id = await collaboration_service.create_collaboration_session(
                name="Test Session",
                description="Test collaboration session",
                collaboration_type="task_delegation",
                initiator_agent_id=initiator_id,
                participating_agents=[participant1_id, participant2_id],
                workflow_definition={
                    "steps": [
                        {"type": "task_delegation", "data": {"title": "Step 1"}}
                    ]
                }
            )

            assert created_session_id == session_id
            assert session_id in collaboration_service._active_sessions

            session_data = collaboration_service._active_sessions[session_id]
            assert session_data["name"] == "Test Session"
            assert session_data["collaboration_type"] == "task_delegation"
            assert participant1_id in session_data["participating_agents"]
            assert participant2_id in session_data["participating_agents"]

            # Should send invitation to 2 participants
            assert mock_send.call_count == 2

    async def test_start_session(self, collaboration_service):
        """Test starting a collaboration session"""
        session_id = uuid4()
        participant_id = uuid4()

        # Pre-populate active session
        collaboration_service._active_sessions[session_id] = {
            "session_id": session_id,
            "name": "Test Session",
            "collaboration_type": "simple",
            "participating_agents": [participant_id],
            "workflow_definition": {},
            "current_step": 0
        }

        with patch('app.services.collaboration.get_db') as mock_get_db:
            mock_session = MagicMock()
            mock_session.status = CollaborationStatus.INITIALIZING
            mock_session.started_at = None

            mock_result = AsyncMock()
            mock_result.scalar_one_or_none.return_value = mock_session
            mock_db = AsyncMock()
            mock_db.execute.return_value = mock_result
            mock_db.commit = AsyncMock()
            mock_get_db.return_value.__aenter__.return_value = mock_db

            success = await collaboration_service.start_session(session_id)

            assert success
            assert mock_session.status == CollaborationStatus.ACTIVE
            assert mock_session.started_at is not None

    async def test_delegate_task_in_session(self, collaboration_service, sample_agents):
        """Test delegating a task within a session"""
        session_id = uuid4()
        delegating_agent_id = sample_agents["agent1"].agent_id

        # Pre-populate active session
        collaboration_service._active_sessions[session_id] = {
            "session_id": session_id,
            "name": "Test Session",
            "participating_agents": [delegating_agent_id]
        }

        with patch.object(collaboration_service._delegation_service, 'delegate_task') as mock_delegate:
            mock_delegate.return_value = sample_agents["agent2"].agent_id

            assigned_agent_id = await collaboration_service.delegate_task_in_session(
                session_id=session_id,
                delegating_agent_id=delegating_agent_id,
                task_type="browser_automation",
                title="Session Task",
                description="Task within session",
                input_data={"test": "data"},
                priority=5
            )

            assert assigned_agent_id == sample_agents["agent2"].agent_id
            mock_delegate.assert_called_once()

    async def test_initiate_consensus_in_session(self, collaboration_service, sample_agents):
        """Test initiating consensus within a session"""
        session_id = uuid4()
        participant1_id = sample_agents["agent1"].agent_id
        participant2_id = sample_agents["agent2"].agent_id

        # Pre-populate active session
        collaboration_service._active_sessions[session_id] = {
            "session_id": session_id,
            "participating_agents": [participant1_id, participant2_id],
            "consensus_threshold": 0.8
        }

        with patch.object(collaboration_service._consensus_service, 'initiate_consensus') as mock_consensus:
            mock_consensus.return_value = True

            success = await collaboration_service.initiate_consensus_in_session(
                session_id=session_id,
                proposal_id="session-proposal-1",
                proposal_data={"action": "test"},
                consensus_threshold=0.9
            )

            assert success
            mock_consensus.assert_called_once_with(
                session_id=session_id,
                proposal_id="session-proposal-1",
                participating_agents=[participant1_id, participant2_id],
                proposal_data={"action": "test"},
                consensus_threshold=0.9
            )

    async def test_get_session_status(self, collaboration_service):
        """Test getting collaboration session status"""
        session_id = uuid4()
        initiator_id = uuid4()

        with patch('app.services.collaboration.get_db') as mock_get_db:
            mock_session = MagicMock()
            mock_session.id = session_id
            mock_session.name = "Test Session"
            mock_session.description = "Test description"
            mock_session.collaboration_type = "task_delegation"
            mock_session.status = CollaborationStatus.ACTIVE
            mock_session.initiator_agent_id = initiator_id
            mock_session.participating_agents = [str(uuid4()), str(uuid4())]
            mock_session.current_step = 1
            mock_session.total_steps = 3
            mock_session.started_at = datetime.utcnow()
            mock_session.ended_at = None
            mock_session.final_result = None
            mock_session.consensus_result = None

            # Mock message and task counts
            mock_db = AsyncMock()

            def mock_execute(query):
                if "messages" in str(query):
                    result = AsyncMock()
                    result.scalar.return_value = 5  # 5 messages
                    return result
                elif "tasks" in str(query):
                    result = AsyncMock()
                    result.scalar.return_value = 3  # 3 tasks
                    return result
                else:
                    result = AsyncMock()
                    result.scalar_one_or_none.return_value = mock_session
                    return result

            mock_db.execute.side_effect = mock_execute
            mock_get_db.return_value.__aenter__.return_value = mock_db

            status = await collaboration_service.get_session_status(session_id)

            assert status is not None
            assert status["session_id"] == str(session_id)
            assert status["name"] == "Test Session"
            assert status["status"] == CollaborationStatus.ACTIVE
            assert status["message_count"] == 5
            assert status["task_count"] == 3
            assert status["current_step"] == 1
            assert status["total_steps"] == 3

    async def test_end_session(self, collaboration_service):
        """Test ending a collaboration session"""
        session_id = uuid4()
        participant1_id = uuid4()
        participant2_id = uuid4()
        final_result = {"output": "session completed successfully"}

        # Pre-populate active session
        collaboration_service._active_sessions[session_id] = {
            "session_id": session_id,
            "participating_agents": [participant1_id, participant2_id]
        }

        with patch('app.services.collaboration.get_db') as mock_get_db, \
             patch.object(collaboration_service._routing_service, 'send_message') as mock_send:

            mock_session = MagicMock()
            mock_session.status = CollaborationStatus.ACTIVE
            mock_session.ended_at = None
            mock_session.final_result = None

            mock_result = AsyncMock()
            mock_result.scalar_one_or_none.return_value = mock_session
            mock_db = AsyncMock()
            mock_db.execute.return_value = mock_result
            mock_db.commit = AsyncMock()
            mock_get_db.return_value.__aenter__.return_value = mock_db

            await collaboration_service.end_session(
                session_id=session_id,
                reason="Completed",
                final_result=final_result
            )

            assert session_id not in collaboration_service._active_sessions
            assert mock_session.status == CollaborationStatus.COMPLETED
            assert mock_session.ended_at is not None
            assert mock_session.final_result == final_result

            # Should notify 2 participants
            assert mock_send.call_count == 2

    async def test_execute_workflow_step_delegation(self, collaboration_service):
        """Test executing delegation workflow step"""
        session_id = uuid4()
        agent_id = uuid4()

        # Pre-populate active session with workflow
        collaboration_service._active_sessions[session_id] = {
            "session_id": session_id,
            "workflow_definition": {
                "steps": [
                    {
                        "type": "task_delegation",
                        "data": {
                            "delegating_agent_id": str(agent_id),
                            "task_type": "browser_automation",
                            "title": "Workflow Task",
                            "description": "Task from workflow",
                            "input_data": {"url": "https://example.com"}
                        }
                    }
                ]
            },
            "current_step": 0
        }

        with patch.object(collaboration_service, 'delegate_task_in_session') as mock_delegate:
            mock_delegate.return_value = uuid4()

            await collaboration_service._execute_workflow_step(session_id, 0)

            mock_delegate.assert_called_once()
            assert collaboration_service._active_sessions[session_id]["current_step"] == 1

    async def test_execute_workflow_step_consensus(self, collaboration_service):
        """Test executing consensus workflow step"""
        session_id = uuid4()

        # Pre-populate active session with consensus workflow
        collaboration_service._active_sessions[session_id] = {
            "session_id": session_id,
            "workflow_definition": {
                "steps": [
                    {
                        "type": "consensus",
                        "data": {
                            "proposal_id": "workflow-proposal-1",
                            "proposal_data": {"action": "test"},
                            "consensus_threshold": 0.8
                        }
                    }
                ]
            },
            "current_step": 0
        }

        with patch.object(collaboration_service, 'initiate_consensus_in_session') as mock_consensus:
            mock_consensus.return_value = True

            await collaboration_service._execute_workflow_step(session_id, 0)

            mock_consensus.assert_called_once_with(
                session_id=session_id,
                proposal_id="workflow-proposal-1",
                proposal_data={"action": "test"},
                consensus_threshold=0.8
            )


class TestCollaborationIntegration:
    """Integration tests for the collaboration framework"""

    async def test_full_collaboration_workflow(self, collaboration_service):
        """Test a complete collaboration workflow"""
        # Create session
        session_id = await collaboration_service.create_collaboration_session(
            name="Integration Test Session",
            description="Full workflow test",
            collaboration_type="workflow",
            initiator_agent_id=uuid4(),
            participating_agents=[uuid4(), uuid4()],
            workflow_definition={
                "steps": [
                    {
                        "type": "task_delegation",
                        "data": {
                            "delegating_agent_id": str(uuid4()),
                            "task_type": "browser_automation",
                            "title": "Integration Task",
                            "description": "Task from integration test",
                            "input_data": {"test": "integration"}
                        }
                    }
                ]
            }
        )

        # Start session
        success = await collaboration_service.start_session(session_id)
        assert success

        # Get session status
        status = await collaboration_service.get_session_status(session_id)
        assert status is not None
        assert status["status"] == CollaborationStatus.ACTIVE

        # End session
        await collaboration_service.end_session(
            session_id=session_id,
            reason="Integration test completed",
            final_result={"test": "passed"}
        )

        # Verify session ended
        final_status = await collaboration_service.get_session_status(session_id)
        assert final_status["status"] == CollaborationStatus.COMPLETED

    async def test_service_lifecycle(self, collaboration_service):
        """Test service start/stop lifecycle"""
        # Service should be started in fixture
        assert collaboration_service._started

        # Create a session
        session_id = await collaboration_service.create_collaboration_session(
            name="Lifecycle Test",
            description="Testing service lifecycle",
            collaboration_type="simple",
            initiator_agent_id=uuid4(),
            participating_agents=[uuid4()]
        )

        assert session_id in collaboration_service._active_sessions

        # Stop service
        await collaboration_service.stop()
        assert not collaboration_service._started

        # Sessions should be cleaned up
        assert session_id not in collaboration_service._active_sessions


# Performance tests
@pytest.mark.asyncio
class TestCollaborationPerformance:
    """Performance tests for collaboration framework"""

    async def test_concurrent_session_creation(self, collaboration_service):
        """Test creating multiple sessions concurrently"""
        session_count = 10

        with patch('app.services.collaboration.get_db') as mock_get_db, \
             patch.object(collaboration_service._routing_service, 'send_message') as mock_send:

            mock_db = AsyncMock()
            mock_db.add = MagicMock()
            mock_db.commit = AsyncMock()
            mock_get_db.return_value.__aenter__.return_value = mock_db

            # Create sessions concurrently
            tasks = []
            for i in range(session_count):
                task = collaboration_service.create_collaboration_session(
                    name=f"Concurrent Session {i}",
                    description=f"Concurrent test session {i}",
                    collaboration_type="test",
                    initiator_agent_id=uuid4(),
                    participating_agents=[uuid4(), uuid4()]
                )
                tasks.append(task)

            session_ids = await asyncio.gather(*tasks)

            assert len(session_ids) == session_count
            assert len(set(session_ids)) == session_count  # All unique
            assert len(collaboration_service._active_sessions) == session_count

    async def test_message_throughput(self, collaboration_service):
        """Test message routing throughput"""
        message_count = 100

        with patch('app.services.collaboration.redis_client') as mock_redis:
            mock_redis.publish = AsyncMock(return_value=True)

            # Create and send messages
            sender_id = uuid4()
            recipient_id = uuid4()

            start_time = time.time()

            tasks = []
            for i in range(message_count):
                envelope = MessageEnvelope(
                    message_id=uuid4(),
                    sender_id=sender_id,
                    recipient_id=recipient_id,
                    message_type=MessageType.TASK_DELEGATION,
                    priority=MessagePriority.NORMAL,
                    subject=f"Performance Test {i}",
                    content=f"Message {i} for performance testing"
                )
                task = collaboration_service._routing_service._send_direct_message(envelope)
                tasks.append(task)

            results = await asyncio.gather(*tasks)
            end_time = time.time()

            # All messages should be sent successfully
            assert all(results)

            # Performance check (should send at least 50 messages per second)
            duration = end_time - start_time
            throughput = message_count / duration
            assert throughput >= 50, f"Throughput too low: {throughput:.2f} messages/second"


if __name__ == "__main__":
    import time
    # Run tests
    pytest.main([__file__, "-v", "--tb=short"])