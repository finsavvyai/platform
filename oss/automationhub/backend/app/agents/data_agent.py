"""
Data processing agent implementation with analysis, transformation, and multi-format document processing capabilities.

This agent specializes in data extraction, transformation, analysis, knowledge management,
and comprehensive document processing with OCR, security validation, and intelligent parsing.
"""

import asyncio
import json
import logging
import os
import time
import pandas as pd
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Union, BinaryIO
from uuid import UUID, uuid4

from pydantic import BaseModel

from app.agents.base import (
    UPMAgent, Task, TaskResult, TaskStatus, TaskType, ExecutionContext,
    ExecutionStep, Capability, AgentStatus
)
from app.models.workflow import ExecutionStatus
from app.services.llm import llm_service
from app.services.browser_automation import browser_automation_service
from app.services.browser_manager import browser_manager, BrowserConfig, BrowserType, ExecutionMode
from app.core.vector_db import knowledge_manager

# Import advanced capabilities services
try:
    from app.services.visual_testing import VisualTestingService, VisualTestConfig, VisualTestType
    from app.services.captcha_solver import CaptchaSolverService, CaptchaConfig, CaptchaType, SolverType
    from app.services.network_simulation import NetworkSimulationService, NetworkCondition, NetworkProfile
    from app.services.advanced_browser_automation import (
        AdvancedBrowserAutomationService, AdvancedInteractionConfig, AutomationMode,
        GeolocationConfig, UserAgentConfig, FileOperationConfig, HumanBehaviorConfig
    )
    HAS_ADVANCED_CAPABILITIES = True
except ImportError:
    HAS_ADVANCED_CAPABILITIES = False

# Import document processing service
try:
    from app.services.document_processor import (
        DocumentProcessor, DocumentProcessingRequest, DocumentType,
        SecurityLevel, ProcessingStatus, get_document_processor
    )
    HAS_DOCUMENT_PROCESSOR = True
except ImportError:
    HAS_DOCUMENT_PROCESSOR = False
    DocumentProcessor = None
    DocumentProcessingRequest = None
    DocumentType = None
    SecurityLevel = None
    ProcessingStatus = None
    get_document_processor = None

logger = logging.getLogger(__name__)


class DataSource(BaseModel):
    """Data source configuration."""
    source_id: UUID
    name: str
    type: str  # file, database, api, web
    connection_info: Dict[str, Any]
    schema: Optional[Dict[str, Any]] = None
    last_updated: Optional[datetime] = None


class DataTransformation(BaseModel):
    """Data transformation definition."""
    transformation_id: UUID
    name: str
    input_schema: Dict[str, Any]
    output_schema: Dict[str, Any]
    transformation_rules: List[Dict[str, Any]]
    created_at: datetime


class DataAnalysisResult(BaseModel):
    """Data analysis result."""
    analysis_id: UUID
    data_source: str
    analysis_type: str
    results: Dict[str, Any]
    insights: List[str]
    visualizations: List[Dict[str, Any]] = []
    created_at: datetime


class DocumentProcessingTask(BaseModel):
    """Document processing task configuration."""
    task_id: UUID
    file_path: Optional[str] = None
    source_url: Optional[str] = None
    document_type: Optional[str] = None
    security_level: str = SecurityLevel.BASIC if SecurityLevel else "basic"
    extraction_options: Dict[str, Any] = {}
    auto_index: bool = True
    generate_embeddings: bool = True
    extract_entities: bool = True
    summarize_content: bool = True
    created_at: datetime


class KnowledgeGraphNode(BaseModel):
    """Knowledge graph node."""
    node_id: UUID
    entity_type: str  # person, organization, concept, document, etc.
    entity_name: str
    properties: Dict[str, Any]
    confidence_score: float
    source_document: Optional[str] = None
    created_at: datetime


class KnowledgeGraphEdge(BaseModel):
    """Knowledge graph edge."""
    edge_id: UUID
    source_node: UUID
    target_node: UUID
    relationship_type: str  # works_for, mentions, related_to, etc.
    properties: Dict[str, Any]
    confidence_score: float
    source_document: Optional[str] = None
    created_at: datetime


class DocumentSummary(BaseModel):
    """Document summary with key insights."""
    document_id: UUID
    title: str
    summary: str
    key_points: List[str]
    entities: List[str]
    topics: List[str]
    sentiment: Optional[str] = None
    language: Optional[str] = None
    reading_time_minutes: int
    created_at: datetime


class DataAgent(UPMAgent):
    """
    Advanced data processing agent with multi-format document processing, analysis, and knowledge management capabilities.

    Capabilities:
    - Data extraction from various sources
    - Data transformation and cleaning
    - Statistical analysis and insights
    - Data visualization generation
    - Knowledge base management
    - Pattern recognition and anomaly detection
    - Multi-format document processing (PDF, Office, images, web)
    - OCR and text extraction from scanned documents
    - Document security validation and threat detection
    - Entity extraction and relationship mapping
    - Knowledge graph construction
    - Document summarization and content analysis
    """

    def __init__(self, **kwargs):
        # Define enhanced data processing capabilities
        capabilities = [
            Capability(
                name="data_extraction",
                description="Extract data from files, databases, APIs, and web sources",
                supported_task_types=[TaskType.DATA_PROCESSING]
            ),
            Capability(
                name="data_transformation",
                description="Clean, transform, and normalize data",
                supported_task_types=[TaskType.DATA_PROCESSING]
            ),
            Capability(
                name="statistical_analysis",
                description="Perform statistical analysis and generate insights",
                supported_task_types=[TaskType.DATA_PROCESSING]
            ),
            Capability(
                name="data_visualization",
                description="Create charts and visualizations",
                supported_task_types=[TaskType.DATA_PROCESSING]
            ),
            Capability(
                name="pattern_recognition",
                description="Identify patterns and anomalies in data",
                supported_task_types=[TaskType.DATA_PROCESSING]
            ),
            Capability(
                name="knowledge_management",
                description="Manage and organize knowledge bases",
                supported_task_types=[TaskType.DATA_PROCESSING, TaskType.CONVERSATION]
            ),
            Capability(
                name="data_quality_assessment",
                description="Assess and improve data quality",
                supported_task_types=[TaskType.DATA_PROCESSING]
            ),
            Capability(
                name="document_processing",
                description="Process multi-format documents with OCR and security validation",
                supported_task_types=[TaskType.DATA_PROCESSING]
            ),
            Capability(
                name="entity_extraction",
                description="Extract entities and relationships from documents",
                supported_task_types=[TaskType.DATA_PROCESSING, TaskType.CONVERSATION]
            ),
            Capability(
                name="knowledge_graph_construction",
                description="Build knowledge graphs from processed documents",
                supported_task_types=[TaskType.DATA_PROCESSING]
            ),
            Capability(
                name="document_summarization",
                description="Generate intelligent summaries and insights from documents",
                supported_task_types=[TaskType.DATA_PROCESSING, TaskType.CONVERSATION]
            ),
            Capability(
                name="content_analysis",
                description="Analyze content for sentiment, topics, and key insights",
                supported_task_types=[TaskType.DATA_PROCESSING]
            ),
            Capability(
                name="vector_database_integration",
                description="Index documents with embeddings and perform semantic search",
                supported_task_types=[TaskType.DATA_PROCESSING, TaskType.CONVERSATION]
            ),
            Capability(
                name="semantic_search",
                description="Perform semantic search with similarity scoring",
                supported_task_types=[TaskType.DATA_PROCESSING, TaskType.CONVERSATION]
            ),
            Capability(
                name="hybrid_search",
                description="Perform hybrid search combining text and vector similarity",
                supported_task_types=[TaskType.DATA_PROCESSING, TaskType.CONVERSATION]
            ),
            Capability(
                name="document_similarity_analysis",
                description="Find and analyze similar documents",
                supported_task_types=[TaskType.DATA_PROCESSING]
            ),
            Capability(
                name="real_time_indexing",
                description="Update document embeddings and indexes in real-time",
                supported_task_types=[TaskType.DATA_PROCESSING]
            ),
            Capability(
                name="rag_question_answering",
                description="Context-aware question answering with RAG system",
                supported_task_types=[TaskType.DATA_PROCESSING, TaskType.CONVERSATION]
            ),
            Capability(
                name="source_citation",
                description="Generate responses with source citations and references",
                supported_task_types=[TaskType.DATA_PROCESSING, TaskType.CONVERSATION]
            ),
            Capability(
                name="conversation_memory",
                description="Manage conversation memory and context retention",
                supported_task_types=[TaskType.CONVERSATION]
            ),
            Capability(
                name="multilingual_rag",
                description="Multi-language RAG support for international users",
                supported_task_types=[TaskType.DATA_PROCESSING, TaskType.CONVERSATION]
            ),
            Capability(
                name="multi_browser_support",
                description="Multi-browser automation support (Chrome, Firefox, Safari, Edge)",
                supported_task_types=[TaskType.BROWSER_AUTOMATION, TaskType.DATA_PROCESSING]
            ),
            Capability(
                name="browser_compatibility_checking",
                description="Browser version compatibility checks and validation",
                supported_task_types=[TaskType.BROWSER_AUTOMATION]
            ),
            Capability(
                name="mobile_device_emulation",
                description="Mobile device emulation and responsive testing",
                supported_task_types=[TaskType.BROWSER_AUTOMATION, TaskType.DATA_PROCESSING]
            ),
            Capability(
                name="headless_headed_execution",
                description="Headless and headed browser execution modes",
                supported_task_types=[TaskType.BROWSER_AUTOMATION]
            ),
            Capability(
                name="cross_browser_testing",
                description="Cross-browser compatibility testing and validation",
                supported_task_types=[TaskType.BROWSER_AUTOMATION, TaskType.DATA_PROCESSING]
            ),
            Capability(
                name="visual_testing",
                description="Visual regression testing and screenshot comparison",
                supported_task_types=[TaskType.BROWSER_AUTOMATION, TaskType.DATA_PROCESSING]
            ),
            Capability(
                name="captcha_solving",
                description="Automated CAPTCHA detection and solving",
                supported_task_types=[TaskType.BROWSER_AUTOMATION]
            ),
            Capability(
                name="network_simulation",
                description="Network condition simulation and performance testing",
                supported_task_types=[TaskType.BROWSER_AUTOMATION, TaskType.DATA_PROCESSING]
            ),
            Capability(
                name="human_behavior_simulation",
                description="Human-like behavior simulation for automation",
                supported_task_types=[TaskType.BROWSER_AUTOMATION]
            ),
            Capability(
                name="advanced_file_handling",
                description="Advanced file upload/download handling",
                supported_task_types=[TaskType.BROWSER_AUTOMATION, TaskType.DATA_PROCESSING]
            ),
            Capability(
                name="geolocation_spoofing",
                description="Geolocation spoofing and location-based testing",
                supported_task_types=[TaskType.BROWSER_AUTOMATION]
            ),
            Capability(
                name="user_agent_management",
                description="User agent management and browser fingerprinting avoidance",
                supported_task_types=[TaskType.BROWSER_AUTOMATION]
            ),
            Capability(
                name="stealth_mode",
                description="Stealth mode for avoiding detection",
                supported_task_types=[TaskType.BROWSER_AUTOMATION]
            ),
            Capability(
                name="advanced_workflows",
                description="Complex workflow execution with multiple steps",
                supported_task_types=[TaskType.BROWSER_AUTOMATION, TaskType.DATA_PROCESSING]
            )
        ]

        super().__init__(
            name=kwargs.get("name", "DataAgent"),
            capabilities=capabilities,
            **kwargs
        )

        # Data-specific attributes
        self.data_sources: Dict[UUID, DataSource] = {}
        self.transformations: Dict[UUID, DataTransformation] = {}
        self.analysis_results: Dict[UUID, DataAnalysisResult] = {}
        self.temp_data_cache: Dict[str, Any] = {}

        # Document processing attributes
        self.document_processor: Optional[DocumentProcessor] = None
        self.processing_tasks: Dict[UUID, DocumentProcessingTask] = {}
        self.document_summaries: Dict[UUID, DocumentSummary] = {}
        self.knowledge_graph_nodes: Dict[UUID, KnowledgeGraphNode] = {}
        self.knowledge_graph_edges: Dict[UUID, KnowledgeGraphEdge] = {}

        # Initialize document processor
        self._initialize_document_processor()

        # Initialize advanced capabilities services
        self._initialize_advanced_capabilities()

    def _initialize_document_processor(self):
        """Initialize the document processor service."""
        try:
            if HAS_DOCUMENT_PROCESSOR and get_document_processor:
                loop = asyncio.get_event_loop()
                self.document_processor = loop.run_until_complete(get_document_processor())
                self.logger.info("Document processor initialized successfully")
            else:
                self.logger.warning("Document processor not available - missing dependencies")
        except Exception as e:
            self.logger.error(f"Failed to initialize document processor: {e}")
            self.document_processor = None

    def _initialize_advanced_capabilities(self):
        """Initialize advanced capabilities services."""
        try:
            if HAS_ADVANCED_CAPABILITIES:
                # Initialize advanced services
                self.visual_testing_service = VisualTestingService(browser_manager)
                self.captcha_solver_service = CaptchaSolverService()
                self.network_simulation_service = NetworkSimulationService()
                self.advanced_browser_service = AdvancedBrowserAutomationService(
                    browser_manager,
                    self.visual_testing_service,
                    self.captcha_solver_service,
                    self.network_simulation_service
                )
                self.logger.info("Advanced capabilities services initialized successfully")
            else:
                self.logger.warning("Advanced capabilities not available - missing dependencies")
                self.visual_testing_service = None
                self.captcha_solver_service = None
                self.network_simulation_service = None
                self.advanced_browser_service = None
        except Exception as e:
            self.logger.error(f"Failed to initialize advanced capabilities: {e}")
            self.visual_testing_service = None
            self.captcha_solver_service = None
            self.network_simulation_service = None
            self.advanced_browser_service = None

    def _register_default_tools(self):
        """Register enhanced data processing tools."""
        self.tools.register_tool("pandas_processor", self._process_with_pandas)
        self.tools.register_tool("statistical_analyzer", self._perform_statistical_analysis)
        self.tools.register_tool("pattern_detector", self._detect_patterns)
        self.tools.register_tool("data_quality_checker", self._check_data_quality)
        self.tools.register_tool("knowledge_indexer", self._index_knowledge)

        # Register document processing tools
        self.tools.register_tool("document_processor", self._process_document)
        self.tools.register_tool("entity_extractor", self._extract_entities)
        self.tools.register_tool("knowledge_graph_builder", self._build_knowledge_graph)
        self.tools.register_tool("document_summarizer", self._summarize_document)
        self.tools.register_tool("content_analyzer", self._analyze_content)
    
    async def execute_task(self, task: Task, context: ExecutionContext) -> TaskResult:
        """Execute an enhanced data processing task with document processing capabilities."""
        self.status = AgentStatus.BUSY
        started_at = datetime.utcnow()
        execution_steps = []

        try:
            self.logger.info(f"Executing data task: {task.name}")

            # Parse task parameters
            task_type = task.parameters.get("task_type", "analyze")
            data_source = task.parameters.get("data_source")

            result = None

            if task_type == "extract":
                result = await self._handle_data_extraction(task.parameters, context, execution_steps)
            elif task_type == "transform":
                result = await self._handle_data_transformation(task.parameters, context, execution_steps)
            elif task_type == "analyze":
                result = await self._handle_data_analysis(task.parameters, context, execution_steps)
            elif task_type == "visualize":
                result = await self._handle_data_visualization(task.parameters, context, execution_steps)
            elif task_type == "quality_check":
                result = await self._handle_quality_assessment(task.parameters, context, execution_steps)
            elif task_type == "knowledge_index":
                result = await self._handle_knowledge_indexing(task.parameters, context, execution_steps)
            elif task_type == "process_document":
                result = await self._handle_document_processing(task.parameters, context, execution_steps)
            elif task_type == "extract_entities":
                result = await self._handle_entity_extraction(task.parameters, context, execution_steps)
            elif task_type == "build_knowledge_graph":
                result = await self._handle_knowledge_graph_construction(task.parameters, context, execution_steps)
            elif task_type == "summarize_document":
                result = await self._handle_document_summarization(task.parameters, context, execution_steps)
            elif task_type == "analyze_content":
                result = await self._handle_content_analysis(task.parameters, context, execution_steps)
            elif task_type == "batch_process_documents":
                result = await self._handle_batch_document_processing(task.parameters, context, execution_steps)
            # Task 1.4.2 - Vector Database Integration task types
            elif task_type == "index_document":
                result = await self._handle_document_indexing(task.parameters, context, execution_steps)
            elif task_type == "semantic_search":
                result = await self._handle_semantic_search(task.parameters, context, execution_steps)
            elif task_type == "hybrid_search":
                result = await self._handle_hybrid_search(task.parameters, context, execution_steps)
            elif task_type == "find_similar_documents":
                result = await self._handle_document_similarity_search(task.parameters, context, execution_steps)
            elif task_type == "update_document_index":
                result = await self._handle_document_index_update(task.parameters, context, execution_steps)
            elif task_type == "batch_update_indexes":
                result = await self._handle_batch_index_updates(task.parameters, context, execution_steps)
            # Task 1.4.3 - RAG System Implementation task types
            elif task_type == "rag_question_answer":
                result = await self._handle_rag_question_answering(task.parameters, context, execution_steps)
            elif task_type == "rag_with_citations":
                result = await self._handle_rag_with_citations(task.parameters, context, execution_steps)
            elif task_type == "multilingual_rag":
                result = await self._handle_multilingual_rag(task.parameters, context, execution_steps)
            elif task_type == "conversation_query":
                result = await self._handle_conversation_query(task.parameters, context, execution_steps)
            elif task_type == "clear_conversation":
                result = await self._handle_clear_conversation(task.parameters, context, execution_steps)
            # Task 1.5.1 - Multi-Browser Support task types
            elif task_type == "check_browser_compatibility":
                result = await self._handle_browser_compatibility_check(task.parameters, context, execution_steps)
            elif task_type == "get_available_browsers":
                result = await self._handle_get_available_browsers(task.parameters, context, execution_steps)
            elif task_type == "get_device_profiles":
                result = await self._handle_get_device_profiles(task.parameters, context, execution_steps)
            elif task_type == "create_browser_config":
                result = await self._handle_create_browser_config(task.parameters, context, execution_steps)
            elif task_type == "create_browser_instance":
                result = await self._handle_create_browser_instance(task.parameters, context, execution_steps)
            elif task_type == "cross_browser_test":
                result = await self._handle_cross_browser_test(task.parameters, context, execution_steps)
            elif task_type == "mobile_emulation_test":
                result = await self._handle_mobile_emulation_test(task.parameters, context, execution_steps)
            elif task_type == "browser_performance_test":
                result = await self._handle_browser_performance_test(task.parameters, context, execution_steps)
            # Task 1.5.3 - Advanced Capabilities task types
            elif task_type == "visual_regression_test":
                result = await self._handle_visual_regression_test(task.parameters, context, execution_steps)
            elif task_type == "captcha_detection_solving":
                result = await self._handle_captcha_detection_solving(task.parameters, context, execution_steps)
            elif task_type == "network_simulation_test":
                result = await self._handle_network_simulation_test(task.parameters, context, execution_steps)
            elif task_type == "human_behavior_workflow":
                result = await self._handle_human_behavior_workflow(task.parameters, context, execution_steps)
            elif task_type == "advanced_file_operations":
                result = await self._handle_advanced_file_operations(task.parameters, context, execution_steps)
            elif task_type == "geolocation_test":
                result = await self._handle_geolocation_test(task.parameters, context, execution_steps)
            elif task_type == "user_agent_test":
                result = await self._handle_user_agent_test(task.parameters, context, execution_steps)
            elif task_type == "stealth_mode_test":
                result = await self._handle_stealth_mode_test(task.parameters, context, execution_steps)
            elif task_type == "advanced_workflow_execution":
                result = await self._handle_advanced_workflow_execution(task.parameters, context, execution_steps)
            else:
                raise ValueError(f"Unsupported data task type: {task_type}")
            
            completed_at = datetime.utcnow()
            duration_ms = int((completed_at - started_at).total_seconds() * 1000)
            
            task_result = TaskResult(
                task_id=task.id,
                status=TaskStatus.COMPLETED,
                result=result,
                execution_steps=execution_steps,
                started_at=started_at,
                completed_at=completed_at,
                duration_ms=duration_ms,
                metadata={
                    "task_type": task_type,
                    "data_source": data_source
                }
            )
            
            self.update_performance_metrics(task_result)
            self.status = AgentStatus.IDLE
            return task_result
            
        except Exception as e:
            self.logger.error(f"Data task execution failed: {e}")
            self.status = AgentStatus.ERROR
            
            completed_at = datetime.utcnow()
            duration_ms = int((completed_at - started_at).total_seconds() * 1000)
            
            task_result = TaskResult(
                task_id=task.id,
                status=TaskStatus.FAILED,
                error=str(e),
                execution_steps=execution_steps,
                started_at=started_at,
                completed_at=completed_at,
                duration_ms=duration_ms
            )
            
            self.update_performance_metrics(task_result)
            return task_result
    
    async def _handle_data_extraction(
        self, parameters: Dict[str, Any], context: ExecutionContext, execution_steps: List[ExecutionStep]
    ) -> Dict[str, Any]:
        """Handle data extraction from various sources."""
        
        source_type = parameters.get("source_type", "file")
        source_path = parameters.get("source_path", "")
        extraction_config = parameters.get("config", {})
        
        step_started = datetime.utcnow()
        try:
            extracted_data = None
            
            if source_type == "file":
                # Handle file extraction
                if source_path.endswith('.csv'):
                    extracted_data = pd.read_csv(source_path, **extraction_config)
                elif source_path.endswith('.json'):
                    with open(source_path, 'r') as f:
                        extracted_data = json.load(f)
                elif source_path.endswith(('.xlsx', '.xls')):
                    extracted_data = pd.read_excel(source_path, **extraction_config)
                else:
                    raise ValueError(f"Unsupported file type: {source_path}")
            
            elif source_type == "api":
                # Handle API extraction (placeholder)
                api_url = parameters.get("api_url", "")
                headers = parameters.get("headers", {})
                
                import aiohttp
                async with aiohttp.ClientSession() as session:
                    async with session.get(api_url, headers=headers) as response:
                        if response.content_type == 'application/json':
                            extracted_data = await response.json()
                        else:
                            extracted_data = await response.text()
            
            else:
                raise ValueError(f"Unsupported source type: {source_type}")
            
            # Cache extracted data
            cache_key = f"extracted_{uuid4().hex[:8]}"
            self.temp_data_cache[cache_key] = extracted_data
            
            # Analyze data structure
            data_info = self._analyze_data_structure(extracted_data)
            
            step = ExecutionStep(
                step_id=uuid4(),
                action="extract_data",
                parameters={"source_type": source_type, "source_path": source_path},
                result={
                    "cache_key": cache_key,
                    "data_info": data_info,
                    "extraction_success": True
                },
                started_at=step_started,
                completed_at=datetime.utcnow(),
                duration_ms=int((datetime.utcnow() - step_started).total_seconds() * 1000)
            )
            execution_steps.append(step)
            
            return {
                "extraction_id": cache_key,
                "source_type": source_type,
                "data_info": data_info,
                "status": "extracted"
            }
            
        except Exception as e:
            self.logger.error(f"Data extraction failed: {e}")
            raise
    
    async def _handle_data_transformation(
        self, parameters: Dict[str, Any], context: ExecutionContext, execution_steps: List[ExecutionStep]
    ) -> Dict[str, Any]:
        """Handle data transformation and cleaning."""
        
        data_key = parameters.get("data_key", "")
        transformations = parameters.get("transformations", [])
        
        step_started = datetime.utcnow()
        try:
            # Get data from cache
            if data_key not in self.temp_data_cache:
                raise ValueError(f"Data not found in cache: {data_key}")
            
            data = self.temp_data_cache[data_key]
            
            # Convert to DataFrame if not already
            if not isinstance(data, pd.DataFrame):
                if isinstance(data, list):
                    data = pd.DataFrame(data)
                elif isinstance(data, dict):
                    data = pd.DataFrame([data])
                else:
                    raise ValueError("Data format not supported for transformation")
            
            # Apply transformations
            for transform in transformations:
                transform_type = transform.get("type", "")
                
                if transform_type == "clean_nulls":
                    data = data.dropna()
                elif transform_type == "remove_duplicates":
                    data = data.drop_duplicates()
                elif transform_type == "filter":
                    condition = transform.get("condition", "")
                    data = data.query(condition)
                elif transform_type == "aggregate":
                    group_by = transform.get("group_by", [])
                    agg_func = transform.get("function", "mean")
                    data = data.groupby(group_by).agg(agg_func).reset_index()
                elif transform_type == "normalize":
                    columns = transform.get("columns", [])
                    for col in columns:
                        if col in data.columns:
                            data[col] = (data[col] - data[col].mean()) / data[col].std()
            
            # Cache transformed data
            transformed_key = f"transformed_{uuid4().hex[:8]}"
            self.temp_data_cache[transformed_key] = data
            
            # Analyze transformed data
            transformed_info = self._analyze_data_structure(data)
            
            step = ExecutionStep(
                step_id=uuid4(),
                action="transform_data",
                parameters={"transformations": transformations},
                result={
                    "transformed_key": transformed_key,
                    "transformed_info": transformed_info,
                    "transformation_success": True
                },
                started_at=step_started,
                completed_at=datetime.utcnow(),
                duration_ms=int((datetime.utcnow() - step_started).total_seconds() * 1000)
            )
            execution_steps.append(step)
            
            return {
                "transformation_id": transformed_key,
                "original_data_key": data_key,
                "transformed_info": transformed_info,
                "transformations_applied": len(transformations),
                "status": "transformed"
            }
            
        except Exception as e:
            self.logger.error(f"Data transformation failed: {e}")
            raise
    
    async def _handle_data_analysis(
        self, parameters: Dict[str, Any], context: ExecutionContext, execution_steps: List[ExecutionStep]
    ) -> Dict[str, Any]:
        """Handle data analysis and insights generation."""
        
        data_key = parameters.get("data_key", "")
        analysis_type = parameters.get("analysis_type", "descriptive")
        
        step_started = datetime.utcnow()
        try:
            # Get data from cache
            if data_key not in self.temp_data_cache:
                raise ValueError(f"Data not found in cache: {data_key}")
            
            data = self.temp_data_cache[data_key]
            
            # Convert to DataFrame if needed
            if not isinstance(data, pd.DataFrame):
                data = pd.DataFrame(data)
            
            analysis_results = {}
            
            if analysis_type == "descriptive":
                analysis_results = {
                    "summary_statistics": data.describe().to_dict(),
                    "data_types": data.dtypes.to_dict(),
                    "missing_values": data.isnull().sum().to_dict(),
                    "unique_values": {col: data[col].nunique() for col in data.columns}
                }
            
            elif analysis_type == "correlation":
                numeric_data = data.select_dtypes(include=['number'])
                if not numeric_data.empty:
                    analysis_results = {
                        "correlation_matrix": numeric_data.corr().to_dict(),
                        "strong_correlations": self._find_strong_correlations(numeric_data.corr())
                    }
            
            elif analysis_type == "distribution":
                numeric_data = data.select_dtypes(include=['number'])
                analysis_results = {}
                for col in numeric_data.columns:
                    analysis_results[col] = {
                        "mean": float(numeric_data[col].mean()),
                        "median": float(numeric_data[col].median()),
                        "std": float(numeric_data[col].std()),
                        "skewness": float(numeric_data[col].skew()),
                        "kurtosis": float(numeric_data[col].kurtosis())
                    }
            
            # Generate AI insights
            insights_prompt = f"""
            Analyze this data analysis result and provide key insights:
            
            Analysis Type: {analysis_type}
            Data Shape: {data.shape}
            Results: {json.dumps(analysis_results, default=str)[:1000]}
            
            Provide 3-5 key insights about the data patterns, trends, and recommendations.
            """
            
            insights_result = await llm_service.generate_completion(
                prompt=insights_prompt,
                temperature=0.3,
                max_tokens=500
            )
            
            insights = insights_result["content"].split('\n')
            insights = [insight.strip() for insight in insights if insight.strip()]
            
            analysis_id = uuid4()
            analysis_record = DataAnalysisResult(
                analysis_id=analysis_id,
                data_source=data_key,
                analysis_type=analysis_type,
                results=analysis_results,
                insights=insights,
                created_at=datetime.utcnow()
            )
            
            self.analysis_results[analysis_id] = analysis_record
            
            step = ExecutionStep(
                step_id=uuid4(),
                action="analyze_data",
                parameters={"analysis_type": analysis_type},
                result={
                    "analysis_id": str(analysis_id),
                    "results": analysis_results,
                    "insights": insights
                },
                started_at=step_started,
                completed_at=datetime.utcnow(),
                duration_ms=int((datetime.utcnow() - step_started).total_seconds() * 1000)
            )
            execution_steps.append(step)
            
            return {
                "analysis_id": str(analysis_id),
                "analysis_type": analysis_type,
                "results": analysis_results,
                "insights": insights,
                "data_shape": data.shape,
                "status": "analyzed"
            }
            
        except Exception as e:
            self.logger.error(f"Data analysis failed: {e}")
            raise
    
    async def _handle_data_visualization(
        self, parameters: Dict[str, Any], context: ExecutionContext, execution_steps: List[ExecutionStep]
    ) -> Dict[str, Any]:
        """Handle data visualization generation."""
        
        data_key = parameters.get("data_key", "")
        chart_type = parameters.get("chart_type", "auto")
        
        step_started = datetime.utcnow()
        try:
            # Get data from cache
            if data_key not in self.temp_data_cache:
                raise ValueError(f"Data not found in cache: {data_key}")
            
            data = self.temp_data_cache[data_key]
            
            # Generate visualization recommendations using AI
            viz_prompt = f"""
            Recommend appropriate visualizations for this data:
            
            Data Shape: {data.shape if hasattr(data, 'shape') else 'Unknown'}
            Data Types: {data.dtypes.to_dict() if hasattr(data, 'dtypes') else 'Unknown'}
            Chart Type Requested: {chart_type}
            
            Suggest the best visualization types and configurations.
            Return as JSON with visualization specifications.
            """
            
            viz_result = await llm_service.generate_completion(
                prompt=viz_prompt,
                temperature=0.3,
                max_tokens=500
            )
            
            # Parse visualization recommendations
            try:
                viz_recommendations = json.loads(viz_result["content"])
            except json.JSONDecodeError:
                viz_recommendations = {
                    "recommended_charts": ["histogram", "scatter", "bar"],
                    "note": "Default recommendations due to parsing error"
                }
            
            step = ExecutionStep(
                step_id=uuid4(),
                action="generate_visualizations",
                parameters={"chart_type": chart_type},
                result={
                    "recommendations": viz_recommendations,
                    "data_shape": data.shape if hasattr(data, 'shape') else None
                },
                started_at=step_started,
                completed_at=datetime.utcnow(),
                duration_ms=int((datetime.utcnow() - step_started).total_seconds() * 1000)
            )
            execution_steps.append(step)
            
            return {
                "visualization_id": f"viz_{uuid4().hex[:8]}",
                "chart_type": chart_type,
                "recommendations": viz_recommendations,
                "status": "visualization_planned"
            }
            
        except Exception as e:
            self.logger.error(f"Data visualization failed: {e}")
            raise
    
    async def _handle_quality_assessment(
        self, parameters: Dict[str, Any], context: ExecutionContext, execution_steps: List[ExecutionStep]
    ) -> Dict[str, Any]:
        """Handle data quality assessment."""
        
        data_key = parameters.get("data_key", "")
        
        step_started = datetime.utcnow()
        try:
            # Get data from cache
            if data_key not in self.temp_data_cache:
                raise ValueError(f"Data not found in cache: {data_key}")
            
            data = self.temp_data_cache[data_key]
            
            if not isinstance(data, pd.DataFrame):
                data = pd.DataFrame(data)
            
            # Perform quality checks
            quality_report = {
                "completeness": {
                    "total_records": len(data),
                    "missing_values": data.isnull().sum().to_dict(),
                    "completeness_percentage": ((len(data) - data.isnull().sum()) / len(data) * 100).to_dict()
                },
                "consistency": {
                    "duplicate_rows": data.duplicated().sum(),
                    "data_types": data.dtypes.to_dict()
                },
                "validity": {
                    "numeric_ranges": {},
                    "categorical_values": {}
                }
            }
            
            # Check numeric ranges
            numeric_cols = data.select_dtypes(include=['number']).columns
            for col in numeric_cols:
                quality_report["validity"]["numeric_ranges"][col] = {
                    "min": float(data[col].min()),
                    "max": float(data[col].max()),
                    "outliers_count": len(data[data[col] > (data[col].quantile(0.75) + 1.5 * (data[col].quantile(0.75) - data[col].quantile(0.25)))])
                }
            
            # Check categorical values
            categorical_cols = data.select_dtypes(include=['object']).columns
            for col in categorical_cols:
                quality_report["validity"]["categorical_values"][col] = {
                    "unique_count": data[col].nunique(),
                    "most_frequent": data[col].mode().iloc[0] if not data[col].mode().empty else None
                }
            
            step = ExecutionStep(
                step_id=uuid4(),
                action="assess_data_quality",
                parameters={"data_key": data_key},
                result=quality_report,
                started_at=step_started,
                completed_at=datetime.utcnow(),
                duration_ms=int((datetime.utcnow() - step_started).total_seconds() * 1000)
            )
            execution_steps.append(step)
            
            return {
                "quality_assessment_id": f"qa_{uuid4().hex[:8]}",
                "data_key": data_key,
                "quality_report": quality_report,
                "status": "quality_assessed"
            }
            
        except Exception as e:
            self.logger.error(f"Data quality assessment failed: {e}")
            raise
    
    async def _handle_knowledge_indexing(
        self, parameters: Dict[str, Any], context: ExecutionContext, execution_steps: List[ExecutionStep]
    ) -> Dict[str, Any]:
        """Handle knowledge base indexing."""

        documents = parameters.get("documents", [])
        index_name = parameters.get("index_name", "default")

        step_started = datetime.utcnow()
        try:
            indexed_count = 0

            for doc in documents:
                # Index document in knowledge manager
                await knowledge_manager.add_document(
                    content=doc.get("content", ""),
                    metadata=doc.get("metadata", {}),
                    document_id=doc.get("id")
                )
                indexed_count += 1

            step = ExecutionStep(
                step_id=uuid4(),
                action="index_knowledge",
                parameters={"index_name": index_name, "document_count": len(documents)},
                result={"indexed_count": indexed_count},
                started_at=step_started,
                completed_at=datetime.utcnow(),
                duration_ms=int((datetime.utcnow() - step_started).total_seconds() * 1000)
            )
            execution_steps.append(step)

            return {
                "indexing_id": f"idx_{uuid4().hex[:8]}",
                "index_name": index_name,
                "documents_indexed": indexed_count,
                "status": "indexed"
            }

        except Exception as e:
            self.logger.error(f"Knowledge indexing failed: {e}")
            raise

    async def _handle_document_processing(
        self, parameters: Dict[str, Any], context: ExecutionContext, execution_steps: List[ExecutionStep]
    ) -> Dict[str, Any]:
        """Handle advanced document processing with security validation."""

        file_path = parameters.get("file_path")
        source_url = parameters.get("source_url")
        security_level = parameters.get("security_level", "basic")
        extraction_options = parameters.get("extraction_options", {})
        auto_index = parameters.get("auto_index", True)

        step_started = datetime.utcnow()
        try:
            if not self.document_processor:
                raise ProcessingError("Document processor not available")

            # Create processing task
            processing_task = DocumentProcessingTask(
                task_id=uuid4(),
                file_path=file_path,
                source_url=source_url,
                security_level=security_level,
                extraction_options=extraction_options,
                auto_index=auto_index,
                created_at=datetime.utcnow()
            )

            # Create processing request
            processing_request = DocumentProcessingRequest(
                file_path=file_path,
                source_url=source_url,
                security_level=SecurityLevel(security_level) if SecurityLevel else "basic",
                extraction_options=extraction_options
            )

            # Process document
            processing_result = await self.document_processor.process_document(
                processing_request,
                user_id=context.user_id if context else uuid4()
            )

            if not processing_result.success:
                raise ProcessingError(f"Document processing failed: {processing_result.error}")

            # Cache processed content
            cache_key = f"doc_{processing_task.task_id.hex[:8]}"
            self.temp_data_cache[cache_key] = {
                "content": processing_result.content,
                "metadata": processing_result.metadata,
                "processing_id": processing_result.processing_id
            }

            # Auto-index if requested
            indexed_id = None
            if auto_index and processing_result.content:
                try:
                    await knowledge_manager.add_document(
                        content=processing_result.content,
                        metadata={
                            "title": getattr(processing_result.metadata, 'title', ''),
                            "source": file_path or source_url,
                            "processed_at": datetime.utcnow().isoformat(),
                            "processing_id": processing_result.processing_id
                        },
                        document_id=str(processing_task.task_id)
                    )
                    indexed_id = str(processing_task.task_id)
                except Exception as index_error:
                    self.logger.warning(f"Auto-indexing failed: {index_error}")

            # Store processing task
            self.processing_tasks[processing_task.task_id] = processing_task

            step = ExecutionStep(
                step_id=uuid4(),
                action="process_document",
                parameters={
                    "file_path": file_path,
                    "source_url": source_url,
                    "security_level": security_level,
                    "auto_index": auto_index
                },
                result={
                    "processing_id": processing_result.processing_id,
                    "cache_key": cache_key,
                    "indexed_id": indexed_id,
                    "content_length": len(processing_result.content),
                    "pages_processed": getattr(processing_result, 'extraction_stats', {}).get('pages_processed', 0)
                },
                started_at=step_started,
                completed_at=datetime.utcnow(),
                duration_ms=int((datetime.utcnow() - step_started).total_seconds() * 1000)
            )
            execution_steps.append(step)

            return {
                "processing_id": processing_result.processing_id,
                "task_id": str(processing_task.task_id),
                "cache_key": cache_key,
                "indexed_id": indexed_id,
                "content_length": len(processing_result.content),
                "metadata": processing_result.metadata.__dict__ if hasattr(processing_result.metadata, '__dict__') else {},
                "processing_time": processing_result.processing_time,
                "security_validation": processing_result.security_validation,
                "status": "processed"
            }

        except Exception as e:
            self.logger.error(f"Document processing failed: {e}")
            raise

    async def _handle_entity_extraction(
        self, parameters: Dict[str, Any], context: ExecutionContext, execution_steps: List[ExecutionStep]
    ) -> Dict[str, Any]:
        """Handle entity extraction from processed documents."""

        cache_key = parameters.get("cache_key")
        extraction_types = parameters.get("extraction_types", ["PERSON", "ORG", "GPE", "EVENT"])

        step_started = datetime.utcnow()
        try:
            # Get document content from cache
            if cache_key not in self.temp_data_cache:
                raise ValueError(f"Document not found in cache: {cache_key}")

            document_data = self.temp_data_cache[cache_key]
            content = document_data.get("content", "")

            if not content:
                raise ValueError("No content available for entity extraction")

            # Use LLM for entity extraction
            entity_prompt = f"""
            Extract entities from the following text. Focus on: {', '.join(extraction_types)}

            Text: {content[:3000]}

            Return entities in JSON format with entity type, text, and confidence score.
            """

            entity_result = await llm_service.generate_completion(
                prompt=entity_prompt,
                temperature=0.1,
                max_tokens=1000
            )

            # Parse entity results
            try:
                entities = json.loads(entity_result["content"])
                if not isinstance(entities, list):
                    entities = []
            except json.JSONDecodeError:
                entities = []

            # Create knowledge graph nodes
            nodes_created = []
            for entity in entities:
                if isinstance(entity, dict) and "text" in entity and "type" in entity:
                    node = KnowledgeGraphNode(
                        node_id=uuid4(),
                        entity_type=entity.get("type", "UNKNOWN"),
                        entity_name=entity.get("text", ""),
                        properties={
                            "confidence": entity.get("confidence", 0.5),
                            "source": cache_key
                        },
                        confidence_score=entity.get("confidence", 0.5),
                        source_document=cache_key,
                        created_at=datetime.utcnow()
                    )
                    self.knowledge_graph_nodes[node.node_id] = node
                    nodes_created.append(str(node.node_id))

            step = ExecutionStep(
                step_id=uuid4(),
                action="extract_entities",
                parameters={
                    "cache_key": cache_key,
                    "extraction_types": extraction_types
                },
                result={
                    "entities_found": len(entities),
                    "nodes_created": len(nodes_created),
                    "entity_types": list(set(e.get("type", "UNKNOWN") for e in entities))
                },
                started_at=step_started,
                completed_at=datetime.utcnow(),
                duration_ms=int((datetime.utcnow() - step_started).total_seconds() * 1000)
            )
            execution_steps.append(step)

            return {
                "extraction_id": f"ext_{uuid4().hex[:8]}",
                "cache_key": cache_key,
                "entities_found": len(entities),
                "nodes_created": len(nodes_created),
                "entities": entities[:20],  # Return first 20 entities
                "status": "extracted"
            }

        except Exception as e:
            self.logger.error(f"Entity extraction failed: {e}")
            raise

    async def _handle_knowledge_graph_construction(
        self, parameters: Dict[str, Any], context: ExecutionContext, execution_steps: List[ExecutionStep]
    ) -> Dict[str, Any]:
        """Handle knowledge graph construction from extracted entities."""

        source_nodes = parameters.get("source_nodes", [])
        build_relationships = parameters.get("build_relationships", True)

        step_started = datetime.utcnow()
        try:
            edges_created = []

            if build_relationships and source_nodes:
                # Use LLM to identify relationships between entities
                for i, node_id1 in enumerate(source_nodes):
                    for node_id2 in source_nodes[i+1:]:
                        node1 = self.knowledge_graph_nodes.get(UUID(node_id1))
                        node2 = self.knowledge_graph_nodes.get(UUID(node_id2))

                        if node1 and node2:
                            # Get content for context
                            cache_key = node1.source_document
                            if cache_key in self.temp_data_cache:
                                content = self.temp_data_cache[cache_key].get("content", "")

                                # Use LLM to identify relationships
                                relationship_prompt = f"""
                                Analyze the relationship between these entities in the text:

                                Entity 1: {node1.entity_name} ({node1.entity_type})
                                Entity 2: {node2.entity_name} ({node2.entity_type})

                                Text context: {content[:1000]}

                                Determine if there's a relationship and what type. Return JSON with:
                                - has_relationship (boolean)
                                - relationship_type (string)
                                - confidence (float)
                                """

                                rel_result = await llm_service.generate_completion(
                                    prompt=relationship_prompt,
                                    temperature=0.1,
                                    max_tokens=200
                                )

                                try:
                                    rel_data = json.loads(rel_result["content"])
                                    if rel_data.get("has_relationship", False):
                                        edge = KnowledgeGraphEdge(
                                            edge_id=uuid4(),
                                            source_node=UUID(node_id1),
                                            target_node=UUID(node_id2),
                                            relationship_type=rel_data.get("relationship_type", "RELATED_TO"),
                                            properties={
                                                "confidence": rel_data.get("confidence", 0.5),
                                                "method": "llm_inferred"
                                            },
                                            confidence_score=rel_data.get("confidence", 0.5),
                                            source_document=cache_key,
                                            created_at=datetime.utcnow()
                                        )
                                        self.knowledge_graph_edges[edge.edge_id] = edge
                                        edges_created.append(str(edge.edge_id))
                                except json.JSONDecodeError:
                                    continue

            step = ExecutionStep(
                step_id=uuid4(),
                action="build_knowledge_graph",
                parameters={
                    "source_nodes": source_nodes,
                    "build_relationships": build_relationships
                },
                result={
                    "edges_created": len(edges_created),
                    "total_nodes": len(self.knowledge_graph_nodes),
                    "total_edges": len(self.knowledge_graph_edges)
                },
                started_at=step_started,
                completed_at=datetime.utcnow(),
                duration_ms=int((datetime.utcnow() - step_started).total_seconds() * 1000)
            )
            execution_steps.append(step)

            return {
                "graph_id": f"graph_{uuid4().hex[:8]}",
                "edges_created": len(edges_created),
                "total_nodes": len(self.knowledge_graph_nodes),
                "total_edges": len(self.knowledge_graph_edges),
                "status": "constructed"
            }

        except Exception as e:
            self.logger.error(f"Knowledge graph construction failed: {e}")
            raise

    async def _handle_document_summarization(
        self, parameters: Dict[str, Any], context: ExecutionContext, execution_steps: List[ExecutionStep]
    ) -> Dict[str, Any]:
        """Handle intelligent document summarization."""

        cache_key = parameters.get("cache_key")
        summary_length = parameters.get("summary_length", "medium")  # short, medium, long
        extract_key_points = parameters.get("extract_key_points", True)
        analyze_sentiment = parameters.get("analyze_sentiment", True)

        step_started = datetime.utcnow()
        try:
            # Get document content from cache
            if cache_key not in self.temp_data_cache:
                raise ValueError(f"Document not found in cache: {cache_key}")

            document_data = self.temp_data_cache[cache_key]
            content = document_data.get("content", "")
            metadata = document_data.get("metadata", {})

            if not content:
                raise ValueError("No content available for summarization")

            # Determine summary length
            length_guidelines = {
                "short": "100-150 words",
                "medium": "200-300 words",
                "long": "400-500 words"
            }
            target_length = length_guidelines.get(summary_length, "200-300 words")

            # Generate summary using LLM
            summary_prompt = f"""
            Summarize the following document in {target_length}.

            Title: {metadata.get('title', 'Unknown')}
            Content: {content[:4000]}

            Provide:
            1. A comprehensive summary
            2. Key points (bulleted list)
            3. Main topics
            4. Sentiment analysis (if requested)

            Return as JSON with keys: summary, key_points, topics, sentiment (optional)
            """

            if analyze_sentiment:
                summary_prompt += "\n5. Overall sentiment (positive, negative, neutral)"

            summary_result = await llm_service.generate_completion(
                prompt=summary_prompt,
                temperature=0.3,
                max_tokens=800
            )

            # Parse summary results
            try:
                summary_data = json.loads(summary_result["content"])
            except json.JSONDecodeError:
                # Fallback parsing
                summary_data = {
                    "summary": summary_result["content"][:500],
                    "key_points": [],
                    "topics": [],
                    "sentiment": "neutral" if analyze_sentiment else None
                }

            # Create document summary
            document_summary = DocumentSummary(
                document_id=uuid4(),
                title=metadata.get('title', 'Unknown Document'),
                summary=summary_data.get("summary", ""),
                key_points=summary_data.get("key_points", []),
                topics=summary_data.get("topics", []),
                sentiment=summary_data.get("sentiment"),
                language="en",  # Could be detected with language detection
                reading_time_minutes=max(1, len(content.split()) // 200),  # ~200 words per minute
                created_at=datetime.utcnow()
            )

            # Store summary
            self.document_summaries[document_summary.document_id] = document_summary

            step = ExecutionStep(
                step_id=uuid4(),
                action="summarize_document",
                parameters={
                    "cache_key": cache_key,
                    "summary_length": summary_length,
                    "extract_key_points": extract_key_points,
                    "analyze_sentiment": analyze_sentiment
                },
                result={
                    "summary_id": str(document_summary.document_id),
                    "summary_length": len(document_summary.summary),
                    "key_points_count": len(document_summary.key_points),
                    "topics_count": len(document_summary.topics),
                    "reading_time": document_summary.reading_time_minutes
                },
                started_at=step_started,
                completed_at=datetime.utcnow(),
                duration_ms=int((datetime.utcnow() - step_started).total_seconds() * 1000)
            )
            execution_steps.append(step)

            return {
                "summary_id": str(document_summary.document_id),
                "cache_key": cache_key,
                "summary": document_summary.summary,
                "key_points": document_summary.key_points,
                "topics": document_summary.topics,
                "sentiment": document_summary.sentiment,
                "reading_time_minutes": document_summary.reading_time_minutes,
                "status": "summarized"
            }

        except Exception as e:
            self.logger.error(f"Document summarization failed: {e}")
            raise

    async def _handle_content_analysis(
        self, parameters: Dict[str, Any], context: ExecutionContext, execution_steps: List[ExecutionStep]
    ) -> Dict[str, Any]:
        """Handle comprehensive content analysis."""

        cache_key = parameters.get("cache_key")
        analysis_types = parameters.get("analysis_types", ["sentiment", "topics", "readability"])

        step_started = datetime.utcnow()
        try:
            # Get document content from cache
            if cache_key not in self.temp_data_cache:
                raise ValueError(f"Document not found in cache: {cache_key}")

            document_data = self.temp_data_cache[cache_key]
            content = document_data.get("content", "")

            if not content:
                raise ValueError("No content available for analysis")

            analysis_results = {}

            # Sentiment analysis
            if "sentiment" in analysis_types:
                sentiment_prompt = f"""
                Analyze the sentiment of this text. Return JSON with:
                - overall_sentiment (positive, negative, neutral)
                - confidence (0-1)
                - emotions (list of detected emotions with scores)

                Text: {content[:2000]}
                """

                sentiment_result = await llm_service.generate_completion(
                    prompt=sentiment_prompt,
                    temperature=0.1,
                    max_tokens=300
                )

                try:
                    sentiment_data = json.loads(sentiment_result["content"])
                    analysis_results["sentiment"] = sentiment_data
                except json.JSONDecodeError:
                    analysis_results["sentiment"] = {"overall_sentiment": "neutral", "confidence": 0.5}

            # Topic analysis
            if "topics" in analysis_types:
                topics_prompt = f"""
                Extract main topics and themes from this text. Return JSON with:
                - main_topics (list of top 5 topics)
                - sub_topics (list of secondary topics)
                - topic_relevance (dictionary with confidence scores)

                Text: {content[:2000]}
                """

                topics_result = await llm_service.generate_completion(
                    prompt=topics_prompt,
                    temperature=0.2,
                    max_tokens=400
                )

                try:
                    topics_data = json.loads(topics_result["content"])
                    analysis_results["topics"] = topics_data
                except json.JSONDecodeError:
                    analysis_results["topics"] = {"main_topics": [], "sub_topics": []}

            # Readability analysis
            if "readability" in analysis_types:
                words = content.split()
                sentences = content.split('.')

                avg_sentence_length = sum(len(sentence.split()) for sentence in sentences if sentence.strip()) / len(sentences) if sentences else 0

                analysis_results["readability"] = {
                    "word_count": len(words),
                    "sentence_count": len(sentences),
                    "avg_sentence_length": round(avg_sentence_length, 1),
                    "estimated_reading_time": max(1, len(words) // 200),  # ~200 WPM
                    "complexity_score": min(10, max(1, avg_sentence_length / 10))  # Simple complexity score
                }

            step = ExecutionStep(
                step_id=uuid4(),
                action="analyze_content",
                parameters={
                    "cache_key": cache_key,
                    "analysis_types": analysis_types
                },
                result=analysis_results,
                started_at=step_started,
                completed_at=datetime.utcnow(),
                duration_ms=int((datetime.utcnow() - step_started).total_seconds() * 1000)
            )
            execution_steps.append(step)

            return {
                "analysis_id": f"analysis_{uuid4().hex[:8]}",
                "cache_key": cache_key,
                "analysis_results": analysis_results,
                "analysis_types": analysis_types,
                "status": "analyzed"
            }

        except Exception as e:
            self.logger.error(f"Content analysis failed: {e}")
            raise

    async def _handle_batch_document_processing(
        self, parameters: Dict[str, Any], context: ExecutionContext, execution_steps: List[ExecutionStep]
    ) -> Dict[str, Any]:
        """Handle batch processing of multiple documents."""

        documents = parameters.get("documents", [])  # List of {file_path, source_url, options}
        parallel = parameters.get("parallel", False)

        step_started = datetime.utcnow()
        try:
            results = []

            if parallel:
                # Process documents concurrently
                tasks = []
                for doc in documents:
                    task_params = {
                        "file_path": doc.get("file_path"),
                        "source_url": doc.get("source_url"),
                        "security_level": doc.get("security_level", "basic"),
                        "extraction_options": doc.get("extraction_options", {}),
                        "auto_index": doc.get("auto_index", False)
                    }
                    tasks.append(self._handle_document_processing(task_params, context, []))

                batch_results = await asyncio.gather(*tasks, return_exceptions=True)

                for i, result in enumerate(batch_results):
                    if isinstance(result, Exception):
                        results.append({
                            "document": documents[i],
                            "success": False,
                            "error": str(result)
                        })
                    else:
                        results.append({
                            "document": documents[i],
                            "success": True,
                            "result": result
                        })
            else:
                # Process documents sequentially
                for doc in documents:
                    try:
                        task_params = {
                            "file_path": doc.get("file_path"),
                            "source_url": doc.get("source_url"),
                            "security_level": doc.get("security_level", "basic"),
                            "extraction_options": doc.get("extraction_options", {}),
                            "auto_index": doc.get("auto_index", False)
                        }
                        result = await self._handle_document_processing(task_params, context, [])
                        results.append({
                            "document": doc,
                            "success": True,
                            "result": result
                        })
                    except Exception as e:
                        results.append({
                            "document": doc,
                            "success": False,
                            "error": str(e)
                        })

            successful_count = sum(1 for r in results if r["success"])
            total_content_length = sum(r["result"].get("content_length", 0) for r in results if r["success"])

            step = ExecutionStep(
                step_id=uuid4(),
                action="batch_process_documents",
                parameters={
                    "document_count": len(documents),
                    "parallel": parallel
                },
                result={
                    "successful_count": successful_count,
                    "failed_count": len(results) - successful_count,
                    "total_content_length": total_content_length
                },
                started_at=step_started,
                completed_at=datetime.utcnow(),
                duration_ms=int((datetime.utcnow() - step_started).total_seconds() * 1000)
            )
            execution_steps.append(step)

            return {
                "batch_id": f"batch_{uuid4().hex[:8]}",
                "total_documents": len(documents),
                "successful_count": successful_count,
                "failed_count": len(results) - successful_count,
                "total_content_length": total_content_length,
                "results": results,
                "status": "batch_processed"
            }

        except Exception as e:
            self.logger.error(f"Batch document processing failed: {e}")
            raise
    
    def _analyze_data_structure(self, data: Any) -> Dict[str, Any]:
        """Analyze data structure and provide summary."""
        try:
            if isinstance(data, pd.DataFrame):
                return {
                    "type": "DataFrame",
                    "shape": data.shape,
                    "columns": list(data.columns),
                    "dtypes": data.dtypes.to_dict(),
                    "memory_usage": data.memory_usage(deep=True).sum()
                }
            elif isinstance(data, list):
                return {
                    "type": "list",
                    "length": len(data),
                    "sample": data[:3] if len(data) > 0 else []
                }
            elif isinstance(data, dict):
                return {
                    "type": "dict",
                    "keys": list(data.keys()),
                    "size": len(data)
                }
            else:
                return {
                    "type": str(type(data)),
                    "size": len(str(data))
                }
        except Exception as e:
            return {"type": "unknown", "error": str(e)}
    
    def _find_strong_correlations(self, corr_matrix: pd.DataFrame, threshold: float = 0.7) -> List[Dict[str, Any]]:
        """Find strong correlations in correlation matrix."""
        strong_corrs = []
        
        for i in range(len(corr_matrix.columns)):
            for j in range(i + 1, len(corr_matrix.columns)):
                corr_value = corr_matrix.iloc[i, j]
                if abs(corr_value) >= threshold:
                    strong_corrs.append({
                        "variable1": corr_matrix.columns[i],
                        "variable2": corr_matrix.columns[j],
                        "correlation": float(corr_value),
                        "strength": "strong" if abs(corr_value) >= 0.8 else "moderate"
                    })
        
        return strong_corrs
    
    async def _contribute_to_collaboration(
        self, objective: str, context: Optional[ExecutionContext] = None
    ) -> Dict[str, Any]:
        """Contribute data processing capabilities to collaboration."""
        try:
            analysis = await llm_service.analyze_task(
                task_description=f"Data processing contribution to: {objective}",
                context=f"Available capabilities: {[cap.name for cap in self.capabilities]}"
            )
            
            return {
                "agent_id": self.id,
                "agent_name": self.name,
                "agent_type": "data_processing",
                "capabilities": [cap.name for cap in self.capabilities],
                "contribution_analysis": analysis.get("analysis", {}),
                "suggested_actions": [
                    "Extract and process relevant data",
                    "Perform statistical analysis",
                    "Generate insights and patterns",
                    "Create data visualizations",
                    "Assess data quality and integrity"
                ]
            }
            
        except Exception as e:
            self.logger.error(f"Collaboration contribution analysis failed: {e}")
            return {
                "agent_id": self.id,
                "agent_name": self.name,
                "agent_type": "data_processing",
                "capabilities": [cap.name for cap in self.capabilities],
                "error": str(e)
            }
    
    # Task 1.4.2 - Vector Database Integration task handlers

    async def _handle_document_indexing(
        self, parameters: Dict[str, Any], context: ExecutionContext, execution_steps: List[ExecutionStep]
    ) -> Dict[str, Any]:
        """Handle document indexing to vector store with embeddings."""
        try:
            document_id = parameters.get("document_id")
            title = parameters.get("title")
            content = parameters.get("content")
            metadata = parameters.get("metadata", {})

            if not document_id or not title or not content:
                raise ValueError("Missing required parameters: document_id, title, content")

            # Add execution step
            execution_steps.append(ExecutionStep(
                step_id=uuid4(),
                name="Index document to vector store",
                status=ExecutionStatus.RUNNING,
                started_at=datetime.utcnow(),
                description=f"Indexing document '{title}' with embeddings"
            ))

            # Index document
            result = await self._index_document_to_vector_store(document_id, title, content, metadata)

            # Update execution step
            execution_steps[-1].status = ExecutionStatus.COMPLETED
            execution_steps[-1].completed_at = datetime.utcnow()
            execution_steps[-1].result = result

            return result

        except Exception as e:
            self.logger.error(f"Document indexing failed: {e}")
            if execution_steps:
                execution_steps[-1].status = ExecutionStatus.FAILED
                execution_steps[-1].completed_at = datetime.utcnow()
                execution_steps[-1].error = str(e)
            return {"error": str(e)}

    async def _handle_semantic_search(
        self, parameters: Dict[str, Any], context: ExecutionContext, execution_steps: List[ExecutionStep]
    ) -> Dict[str, Any]:
        """Handle semantic search with vector similarity."""
        try:
            query = parameters.get("query")
            filters = parameters.get("filters")
            similarity_threshold = parameters.get("similarity_threshold", 0.7)
            max_results = parameters.get("max_results", 10)

            if not query:
                raise ValueError("Missing required parameter: query")

            # Add execution step
            execution_steps.append(ExecutionStep(
                step_id=uuid4(),
                name="Perform semantic search",
                status=ExecutionStatus.RUNNING,
                started_at=datetime.utcnow(),
                description=f"Searching for '{query}' with semantic similarity"
            ))

            # Perform semantic search
            result = await self._perform_semantic_search(query, filters, similarity_threshold, max_results)

            # Update execution step
            execution_steps[-1].status = ExecutionStatus.COMPLETED
            execution_steps[-1].completed_at = datetime.utcnow()
            execution_steps[-1].result = {"results_found": len(result.get("results", []))}

            return result

        except Exception as e:
            self.logger.error(f"Semantic search failed: {e}")
            if execution_steps:
                execution_steps[-1].status = ExecutionStatus.FAILED
                execution_steps[-1].completed_at = datetime.utcnow()
                execution_steps[-1].error = str(e)
            return {"error": str(e)}

    async def _handle_hybrid_search(
        self, parameters: Dict[str, Any], context: ExecutionContext, execution_steps: List[ExecutionStep]
    ) -> Dict[str, Any]:
        """Handle hybrid search combining text and vector search."""
        try:
            query = parameters.get("query")
            text_weight = parameters.get("text_weight", 0.3)
            vector_weight = parameters.get("vector_weight", 0.7)
            filters = parameters.get("filters")
            max_results = parameters.get("max_results", 10)

            if not query:
                raise ValueError("Missing required parameter: query")

            # Add execution step
            execution_steps.append(ExecutionStep(
                step_id=uuid4(),
                name="Perform hybrid search",
                status=ExecutionStatus.RUNNING,
                started_at=datetime.utcnow(),
                description=f"Hybrid search for '{query}' with text weight {text_weight}, vector weight {vector_weight}"
            ))

            # Perform hybrid search
            result = await self._perform_hybrid_search(query, text_weight, vector_weight, filters, max_results)

            # Update execution step
            execution_steps[-1].status = ExecutionStatus.COMPLETED
            execution_steps[-1].completed_at = datetime.utcnow()
            execution_steps[-1].result = {"results_found": len(result.get("results", []))}

            return result

        except Exception as e:
            self.logger.error(f"Hybrid search failed: {e}")
            if execution_steps:
                execution_steps[-1].status = ExecutionStatus.FAILED
                execution_steps[-1].completed_at = datetime.utcnow()
                execution_steps[-1].error = str(e)
            return {"error": str(e)}

    async def _handle_document_similarity_search(
        self, parameters: Dict[str, Any], context: ExecutionContext, execution_steps: List[ExecutionStep]
    ) -> Dict[str, Any]:
        """Handle document similarity search."""
        try:
            document_id = parameters.get("document_id")
            similarity_threshold = parameters.get("similarity_threshold", 0.7)
            max_results = parameters.get("max_results", 10)

            if not document_id:
                raise ValueError("Missing required parameter: document_id")

            # Add execution step
            execution_steps.append(ExecutionStep(
                step_id=uuid4(),
                name="Find similar documents",
                status=ExecutionStatus.RUNNING,
                started_at=datetime.utcnow(),
                description=f"Finding documents similar to {document_id}"
            ))

            # Find similar documents
            result = await self._find_similar_documents(document_id, similarity_threshold, max_results)

            # Update execution step
            execution_steps[-1].status = ExecutionStatus.COMPLETED
            execution_steps[-1].completed_at = datetime.utcnow()
            execution_steps[-1].result = {"similar_documents_found": len(result.get("similar_documents", []))}

            return result

        except Exception as e:
            self.logger.error(f"Document similarity search failed: {e}")
            if execution_steps:
                execution_steps[-1].status = ExecutionStatus.FAILED
                execution_steps[-1].completed_at = datetime.utcnow()
                execution_steps[-1].error = str(e)
            return {"error": str(e)}

    async def _handle_document_index_update(
        self, parameters: Dict[str, Any], context: ExecutionContext, execution_steps: List[ExecutionStep]
    ) -> Dict[str, Any]:
        """Handle real-time document index updates."""
        try:
            document_id = parameters.get("document_id")
            title = parameters.get("title")
            content = parameters.get("content")
            metadata = parameters.get("metadata")

            if not document_id:
                raise ValueError("Missing required parameter: document_id")

            # Add execution step
            execution_steps.append(ExecutionStep(
                step_id=uuid4(),
                name="Update document index",
                status=ExecutionStatus.RUNNING,
                started_at=datetime.utcnow(),
                description=f"Updating index for document {document_id}"
            ))

            # Update document index
            result = await self._update_document_index(document_id, title, content, metadata)

            # Update execution step
            execution_steps[-1].status = ExecutionStatus.COMPLETED
            execution_steps[-1].completed_at = datetime.utcnow()
            execution_steps[-1].result = result

            return result

        except Exception as e:
            self.logger.error(f"Document index update failed: {e}")
            if execution_steps:
                execution_steps[-1].status = ExecutionStatus.FAILED
                execution_steps[-1].completed_at = datetime.utcnow()
                execution_steps[-1].error = str(e)
            return {"error": str(e)}

    async def _handle_batch_index_updates(
        self, parameters: Dict[str, Any], context: ExecutionContext, execution_steps: List[ExecutionStep]
    ) -> Dict[str, Any]:
        """Handle batch document index updates."""
        try:
            updates = parameters.get("updates", [])

            if not updates:
                raise ValueError("Missing required parameter: updates")

            # Add execution step
            execution_steps.append(ExecutionStep(
                step_id=uuid4(),
                name="Batch update document indexes",
                status=ExecutionStatus.RUNNING,
                started_at=datetime.utcnow(),
                description=f"Updating {len(updates)} document indexes"
            ))

            # Batch update indexes
            result = await self._batch_update_document_indexes(updates)

            # Update execution step
            execution_steps[-1].status = ExecutionStatus.COMPLETED
            execution_steps[-1].completed_at = datetime.utcnow()
            execution_steps[-1].result = {"updates_processed": len(updates)}

            return result

        except Exception as e:
            self.logger.error(f"Batch index update failed: {e}")
            if execution_steps:
                execution_steps[-1].status = ExecutionStatus.FAILED
                execution_steps[-1].completed_at = datetime.utcnow()
                execution_steps[-1].error = str(e)
            return {"error": str(e)}

  # Task 1.4.3 - RAG System Implementation task handlers

    async def _handle_rag_question_answering(
        self, parameters: Dict[str, Any], context: ExecutionContext, execution_steps: List[ExecutionStep]
    ) -> Dict[str, Any]:
        """Handle RAG question answering without citations."""
        try:
            query = parameters.get("query")
            conversation_id = parameters.get("conversation_id", str(uuid.uuid4()))
            max_context_items = parameters.get("max_context_items", 5)
            similarity_threshold = parameters.get("similarity_threshold", 0.7)
            language = parameters.get("language", "en")
            max_tokens = parameters.get("max_tokens", 1000)
            temperature = parameters.get("temperature", 0.7)

            if not query:
                raise ValueError("Missing required parameter: query")

            # Add execution step
            execution_steps.append(ExecutionStep(
                step_id=uuid4(),
                name="RAG Question Answering",
                status=ExecutionStatus.RUNNING,
                started_at=datetime.utcnow(),
                description=f"Processing RAG query: '{query[:50]}...'"
            ))

            # Create RAG query
            from app.services.rag_service import RAGService, RAGQuery

            rag_service = RAGService()
            rag_query = RAGQuery(
                query=query,
                conversation_id=conversation_id,
                user_id=str(context.user_id) if context else str(uuid.uuid4()),
                max_context_items=max_context_items,
                similarity_threshold=similarity_threshold,
                include_sources=False,  # No citations for this task type
                language=language,
                max_tokens=max_tokens,
                temperature=temperature
            )

            # Process RAG query
            rag_response = await rag_service.process_query(rag_query)

            # Update execution step
            execution_steps[-1].status = ExecutionStatus.COMPLETED
            execution_steps[-1].completed_at = datetime.utcnow()
            execution_steps[-1].result = {
                "confidence": rag_response.confidence_score,
                "processing_time": rag_response.processing_time_ms,
                "context_items": len(rag_response.context_items)
            }

            return {
                "answer": rag_response.answer,
                "query": rag_response.query,
                "confidence_score": rag_response.confidence_score,
                "language": rag_response.language,
                "processing_time_ms": rag_response.processing_time_ms,
                "tokens_used": rag_response.tokens_used,
                "model_used": rag_response.model_used,
                "conversation_id": rag_response.conversation_id,
                "context_items_count": len(rag_response.context_items)
            }

        except Exception as e:
            self.logger.error(f"RAG question answering failed: {e}")
            if execution_steps:
                execution_steps[-1].status = ExecutionStatus.FAILED
                execution_steps[-1].completed_at = datetime.utcnow()
                execution_steps[-1].error = str(e)
            return {"error": str(e)}

    async def _handle_rag_with_citations(
        self, parameters: Dict[str, Any], context: ExecutionContext, execution_steps: List[ExecutionStep]
    ) -> Dict[str, Any]:
        """Handle RAG question answering with source citations."""
        try:
            query = parameters.get("query")
            conversation_id = parameters.get("conversation_id", str(uuid.uuid4()))
            max_context_items = parameters.get("max_context_items", 5)
            similarity_threshold = parameters.get("similarity_threshold", 0.7)
            language = parameters.get("language", "en")
            max_tokens = parameters.get("max_tokens", 1000)
            temperature = parameters.get("temperature", 0.7)

            if not query:
                raise ValueError("Missing required parameter: query")

            # Add execution step
            execution_steps.append(ExecutionStep(
                step_id=uuid4(),
                name="RAG with Citations",
                status=ExecutionStatus.RUNNING,
                started_at=datetime.utcnow(),
                description=f"Processing RAG query with citations: '{query[:50]}...'"
            ))

            # Create RAG query with citations
            from app.services.rag_service import RAGService, RAGQuery

            rag_service = RAGService()
            rag_query = RAGQuery(
                query=query,
                conversation_id=conversation_id,
                user_id=str(context.user_id) if context else str(uuid.uuid4()),
                max_context_items=max_context_items,
                similarity_threshold=similarity_threshold,
                include_sources=True,  # Include citations
                language=language,
                max_tokens=max_tokens,
                temperature=temperature
            )

            # Process RAG query
            rag_response = await rag_service.process_query(rag_query)

            # Format citations for response
            formatted_citations = []
            for citation in rag_response.citations:
                formatted_citations.append({
                    "source": citation.source,
                    "title": citation.title,
                    "author": citation.author,
                    "url": citation.url,
                    "confidence": citation.confidence,
                    "text_snippet": citation.text_snippet,
                    "document_id": citation.document_id,
                    "chunk_id": citation.chunk_id
                })

            # Update execution step
            execution_steps[-1].status = ExecutionStatus.COMPLETED
            execution_steps[-1].completed_at = datetime.utcnow()
            execution_steps[-1].result = {
                "confidence": rag_response.confidence_score,
                "processing_time": rag_response.processing_time_ms,
                "context_items": len(rag_response.context_items),
                "citations": len(formatted_citations)
            }

            return {
                "answer": rag_response.answer,
                "query": rag_response.query,
                "citations": formatted_citations,
                "confidence_score": rag_response.confidence_score,
                "language": rag_response.language,
                "processing_time_ms": rag_response.processing_time_ms,
                "tokens_used": rag_response.tokens_used,
                "model_used": rag_response.model_used,
                "conversation_id": rag_response.conversation_id,
                "context_items_count": len(rag_response.context_items)
            }

        except Exception as e:
            self.logger.error(f"RAG with citations failed: {e}")
            if execution_steps:
                execution_steps[-1].status = ExecutionStatus.FAILED
                execution_steps[-1].completed_at = datetime.utcnow()
                execution_steps[-1].error = str(e)
            return {"error": str(e)}

    async def _handle_multilingual_rag(
        self, parameters: Dict[str, Any], context: ExecutionContext, execution_steps: List[ExecutionStep]
    ) -> Dict[str, Any]:
        """Handle multilingual RAG question answering."""
        try:
            query = parameters.get("query")
            language = parameters.get("language", "en")
            conversation_id = parameters.get("conversation_id", str(uuid.uuid4()))
            max_context_items = parameters.get("max_context_items", 5)
            similarity_threshold = parameters.get("similarity_threshold", 0.7)
            include_citations = parameters.get("include_citations", True)

            if not query:
                raise ValueError("Missing required parameter: query")

            # Add execution step
            execution_steps.append(ExecutionStep(
                step_id=uuid4(),
                name="Multilingual RAG",
                status=ExecutionStatus.RUNNING,
                started_at=datetime.utcnow(),
                description=f"Processing multilingual RAG query in {language}: '{query[:50]}...'"
            ))

            # Create multilingual RAG query
            from app.services.rag_service import RAGService, RAGQuery

            rag_service = RAGService()
            rag_query = RAGQuery(
                query=query,
                conversation_id=conversation_id,
                user_id=str(context.user_id) if context else str(uuid.uuid4()),
                max_context_items=max_context_items,
                similarity_threshold=similarity_threshold,
                include_sources=include_citations,
                language=language,
                max_tokens=1500,  # More tokens for multilingual
                temperature=0.7
            )

            # Process RAG query
            rag_response = await rag_service.process_query(rag_query)

            # Format response
            response_data = {
                "answer": rag_response.answer,
                "query": rag_response.query,
                "language": rag_response.language,
                "confidence_score": rag_response.confidence_score,
                "processing_time_ms": rag_response.processing_time_ms,
                "tokens_used": rag_response.tokens_used,
                "model_used": rag_response.model_used,
                "conversation_id": rag_response.conversation_id,
                "context_items_count": len(rag_response.context_items)
            }

            # Add citations if requested
            if include_citations and rag_response.citations:
                formatted_citations = []
                for citation in rag_response.citations:
                    formatted_citations.append({
                        "source": citation.source,
                        "title": citation.title,
                        "author": citation.author,
                        "url": citation.url,
                        "confidence": citation.confidence,
                        "text_snippet": citation.text_snippet,
                        "document_id": citation.document_id,
                        "chunk_id": citation.chunk_id
                    })
                response_data["citations"] = formatted_citations

            # Update execution step
            execution_steps[-1].status = ExecutionStatus.COMPLETED
            execution_steps[-1].completed_at = datetime.utcnow()
            execution_steps[-1].result = {
                "language": language,
                "confidence": rag_response.confidence_score,
                "processing_time": rag_response.processing_time_ms
            }

            return response_data

        except Exception as e:
            self.logger.error(f"Multilingual RAG failed: {e}")
            if execution_steps:
                execution_steps[-1].status = ExecutionStatus.FAILED
                execution_steps[-1].completed_at = datetime.utcnow()
                execution_steps[-1].error = str(e)
            return {"error": str(e)}

    async def _handle_conversation_query(
        self, parameters: Dict[str, Any], context: ExecutionContext, execution_steps: List[ExecutionStep]
    ) -> Dict[str, Any]:
        """Handle conversation-aware RAG query."""
        try:
            query = parameters.get("query")
            conversation_id = parameters.get("conversation_id")
            language = parameters.get("language", "en")
            include_history = parameters.get("include_history", True)

            if not query:
                raise ValueError("Missing required parameter: query")

            # Generate conversation ID if not provided
            if not conversation_id:
                conversation_id = str(uuid.uuid4())

            # Add execution step
            execution_steps.append(ExecutionStep(
                step_id=uuid4(),
                name="Conversation Query",
                status=ExecutionStatus.RUNNING,
                started_at=datetime.utcnow(),
                description=f"Processing conversation query: '{query[:50]}...'"
            ))

            # Create conversation-aware RAG query
            from app.services.rag_service import RAGService, RAGQuery

            rag_service = RAGService()
            rag_query = RAGQuery(
                query=query,
                conversation_id=conversation_id,
                user_id=str(context.user_id) if context else str(uuid.uuid4()),
                max_context_items=7,  # More context for conversation
                similarity_threshold=0.6,  # Lower threshold for conversation
                include_sources=True,
                language=language,
                max_tokens=1200,
                temperature=0.8  # Higher temperature for conversation
            )

            # Process RAG query
            rag_response = await rag_service.process_query(rag_query)

            # Get conversation history if requested
            conversation_history = []
            if include_history:
                conversation_history = await rag_service.get_conversation_history(
                    conversation_id, max_messages=10
                )

            # Format response
            response_data = {
                "answer": rag_response.answer,
                "query": rag_response.query,
                "conversation_id": rag_response.conversation_id,
                "confidence_score": rag_response.confidence_score,
                "language": rag_response.language,
                "processing_time_ms": rag_response.processing_time_ms,
                "tokens_used": rag_response.tokens_used,
                "model_used": rag_response.model_used,
                "context_items_count": len(rag_response.context_items)
            }

            # Add citations
            if rag_response.citations:
                formatted_citations = []
                for citation in rag_response.citations:
                    formatted_citations.append({
                        "source": citation.source,
                        "title": citation.title,
                        "author": citation.author,
                        "url": citation.url,
                        "confidence": citation.confidence,
                        "text_snippet": citation.text_snippet,
                        "document_id": citation.document_id,
                        "chunk_id": citation.chunk_id
                    })
                response_data["citations"] = formatted_citations

            # Add conversation history
            if conversation_history:
                response_data["conversation_history"] = conversation_history

            # Update execution step
            execution_steps[-1].status = ExecutionStatus.COMPLETED
            execution_steps[-1].completed_at = datetime.utcnow()
            execution_steps[-1].result = {
                "conversation_id": conversation_id,
                "confidence": rag_response.confidence_score,
                "history_items": len(conversation_history)
            }

            return response_data

        except Exception as e:
            self.logger.error(f"Conversation query failed: {e}")
            if execution_steps:
                execution_steps[-1].status = ExecutionStatus.FAILED
                execution_steps[-1].completed_at = datetime.utcnow()
                execution_steps[-1].error = str(e)
            return {"error": str(e)}

    async def _handle_clear_conversation(
        self, parameters: Dict[str, Any], context: ExecutionContext, execution_steps: List[ExecutionStep]
    ) -> Dict[str, Any]:
        """Handle conversation memory clearing."""
        try:
            conversation_id = parameters.get("conversation_id")
            user_id = parameters.get("user_id")

            if not conversation_id:
                raise ValueError("Missing required parameter: conversation_id")

            # Add execution step
            execution_steps.append(ExecutionStep(
                step_id=uuid4(),
                name="Clear Conversation",
                status=ExecutionStatus.RUNNING,
                started_at=datetime.utcnow(),
                description=f"Clearing conversation memory for: {conversation_id}"
            ))

            # Clear conversation memory
            from app.services.rag_service import RAGService

            rag_service = RAGService()
            success = await rag_service.clear_conversation_memory(conversation_id)

            # Update execution step
            execution_steps[-1].status = ExecutionStatus.COMPLETED
            execution_steps[-1].completed_at = datetime.utcnow()
            execution_steps[-1].result = {"conversation_id": conversation_id, "cleared": success}

            return {
                "conversation_id": conversation_id,
                "success": success,
                "message": "Conversation memory cleared successfully" if success else "Failed to clear conversation memory"
            }

        except Exception as e:
            self.logger.error(f"Clear conversation failed: {e}")
            if execution_steps:
                execution_steps[-1].status = ExecutionStatus.FAILED
                execution_steps[-1].completed_at = datetime.utcnow()
                execution_steps[-1].error = str(e)
            return {"error": str(e)}

  # Enhanced vector database tools for Task 1.4.2
    async def _index_document_to_vector_store(self, document_id: str, title: str, content: str,
                                            metadata: Dict[str, Any] = None) -> Dict[str, Any]:
        """Index document to vector store with embeddings."""
        try:
            from app.services.vector_store import VectorStoreService

            vector_store = VectorStoreService()

            # Add document with automatic embedding generation
            result = await vector_store.add_document_with_embeddings(
                document_id=document_id,
                title=title,
                content=content,
                metadata=metadata or {},
                chunk_size=500,
                overlap=50
            )

            self.logger.info(f"Document {document_id} indexed to vector store")
            return result

        except Exception as e:
            self.logger.error(f"Document indexing failed: {e}")
            return {"error": str(e)}

    async def _perform_semantic_search(self, query: str, filters: Dict[str, Any] = None,
                                     similarity_threshold: float = 0.7, max_results: int = 10) -> Dict[str, Any]:
        """Perform semantic search on indexed documents."""
        try:
            from app.services.vector_store import VectorStoreService

            vector_store = VectorStoreService()

            # Perform semantic search
            results = await vector_store.semantic_search(
                query=query,
                n_results=max_results,
                filters=filters,
                similarity_threshold=similarity_threshold,
                include_scores=True
            )

            self.logger.info(f"Semantic search for '{query}' returned {len(results.get('results', []))} results")
            return results

        except Exception as e:
            self.logger.error(f"Semantic search failed: {e}")
            return {"error": str(e), "results": []}

    async def _perform_hybrid_search(self, query: str, text_weight: float = 0.3,
                                   vector_weight: float = 0.7, filters: Dict[str, Any] = None,
                                   max_results: int = 10) -> Dict[str, Any]:
        """Perform hybrid search combining text and vector search."""
        try:
            from app.services.vector_store import VectorStoreService

            vector_store = VectorStoreService()

            # Perform hybrid search
            results = await vector_store.hybrid_search(
                query=query,
                text_weight=text_weight,
                vector_weight=vector_weight,
                n_results=max_results,
                filters=filters
            )

            self.logger.info(f"Hybrid search for '{query}' returned {len(results.get('results', []))} results")
            return results

        except Exception as e:
            self.logger.error(f"Hybrid search failed: {e}")
            return {"error": str(e), "results": []}

    async def _find_similar_documents(self, document_id: str, similarity_threshold: float = 0.7,
                                    max_results: int = 10) -> Dict[str, Any]:
        """Find documents similar to a given document."""
        try:
            from app.services.vector_store import VectorStoreService

            vector_store = VectorStoreService()

            # Find similar documents
            results = await vector_store.find_similar_documents(
                document_id=document_id,
                n_results=max_results,
                similarity_threshold=similarity_threshold
            )

            self.logger.info(f"Found {len(results.get('similar_documents', []))} documents similar to {document_id}")
            return results

        except Exception as e:
            self.logger.error(f"Similar document search failed: {e}")
            return {"error": str(e), "similar_documents": []}

    async def _update_document_index(self, document_id: str, title: str = None,
                                   content: str = None, metadata: Dict[str, Any] = None) -> Dict[str, Any]:
        """Update document index in real-time."""
        try:
            from app.services.vector_store import VectorStoreService

            vector_store = VectorStoreService()

            # Update document embeddings
            result = await vector_store.update_document_embeddings(
                document_id=document_id,
                title=title,
                content=content,
                metadata=metadata
            )

            self.logger.info(f"Document index updated for {document_id}")
            return result

        except Exception as e:
            self.logger.error(f"Document index update failed: {e}")
            return {"error": str(e)}

    async def _batch_update_document_indexes(self, updates: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Batch update multiple document indexes."""
        try:
            from app.services.vector_store import VectorStoreService

            vector_store = VectorStoreService()

            # Batch update embeddings
            result = await vector_store.batch_update_embeddings(updates)

            self.logger.info(f"Batch update completed for {len(updates)} documents")
            return result

        except Exception as e:
            self.logger.error(f"Batch index update failed: {e}")
            return {"error": str(e)}

    # Tool methods
    async def _process_with_pandas(self, data: Any, operations: List[str]) -> Dict[str, Any]:
        """Process data using pandas operations."""
        try:
            import pandas as pd
            
            # Convert data to DataFrame if needed
            if isinstance(data, list):
                df = pd.DataFrame(data)
            elif isinstance(data, dict):
                df = pd.DataFrame([data])
            else:
                df = data
            
            results = {"original_shape": df.shape}
            
            for operation in operations:
                if operation == "describe":
                    results["description"] = df.describe().to_dict()
                elif operation == "info":
                    results["info"] = {"columns": list(df.columns), "dtypes": df.dtypes.to_dict()}
                elif operation == "head":
                    results["head"] = df.head().to_dict()
            
            return results
            
        except Exception as e:
            self.logger.error(f"Pandas processing failed: {e}")
            return {"error": str(e)}
    
    async def _perform_statistical_analysis(self, data: Any) -> Dict[str, Any]:
        """Perform statistical analysis on data."""
        try:
            import pandas as pd
            import numpy as np
            
            if isinstance(data, list):
                df = pd.DataFrame(data)
            else:
                df = data
            
            numeric_cols = df.select_dtypes(include=[np.number]).columns
            
            results = {
                "basic_stats": df[numeric_cols].describe().to_dict() if len(numeric_cols) > 0 else {},
                "correlations": df[numeric_cols].corr().to_dict() if len(numeric_cols) > 1 else {},
                "missing_values": df.isnull().sum().to_dict(),
                "data_types": df.dtypes.to_dict()
            }
            
            return results
            
        except Exception as e:
            self.logger.error(f"Statistical analysis failed: {e}")
            return {"error": str(e)}
    
    async def _detect_patterns(self, data: Any) -> Dict[str, Any]:
        """Detect patterns in data."""
        try:
            # Simple pattern detection
            patterns = {
                "data_size": len(data) if isinstance(data, (list, dict)) else "unknown",
                "data_type": type(data).__name__,
                "patterns_found": ["basic_structure_analyzed"]
            }
            
            return patterns
            
        except Exception as e:
            self.logger.error(f"Pattern detection failed: {e}")
            return {"error": str(e)}
    
    async def _check_data_quality(self, data: Any) -> Dict[str, Any]:
        """Check data quality."""
        try:
            import pandas as pd
            
            if isinstance(data, list):
                df = pd.DataFrame(data)
            else:
                df = data
            
            quality_report = {
                "total_rows": len(df),
                "total_columns": len(df.columns),
                "missing_values": df.isnull().sum().to_dict(),
                "duplicate_rows": df.duplicated().sum(),
                "data_types": df.dtypes.to_dict(),
                "quality_score": 0.8  # Simple placeholder score
            }
            
            return quality_report
            
        except Exception as e:
            self.logger.error(f"Data quality check failed: {e}")
            return {"error": str(e)}
    
    async def _index_knowledge(self, data: Any) -> Dict[str, Any]:
        """Index knowledge from data."""
        try:
            # Simple knowledge indexing
            knowledge_index = {
                "indexed_items": len(data) if isinstance(data, (list, dict)) else 1,
                "index_created": True,
                "knowledge_type": "structured_data"
            }

            return knowledge_index

        except Exception as e:
            self.logger.error(f"Knowledge indexing failed: {e}")
            return {"error": str(e)}

    # Enhanced document processing tool methods
    async def _process_document(self, file_path: str = None, source_url: str = None,
                               security_level: str = "basic", **kwargs) -> Dict[str, Any]:
        """Process a document using the advanced document processor."""
        try:
            if not self.document_processor:
                return {"error": "Document processor not available"}

            request = DocumentProcessingRequest(
                file_path=file_path,
                source_url=source_url,
                security_level=SecurityLevel(security_level) if SecurityLevel else "basic",
                extraction_options=kwargs
            )

            result = await self.document_processor.process_document(request, user_id=uuid4())

            return {
                "success": result.success,
                "content": result.content[:1000] if result.success else "",  # Preview
                "content_length": len(result.content) if result.success else 0,
                "processing_id": result.processing_id,
                "processing_time": result.processing_time,
                "security_validation": result.security_validation,
                "error": result.error if not result.success else None
            }

        except Exception as e:
            self.logger.error(f"Document processing tool failed: {e}")
            return {"error": str(e)}

    async def _extract_entities(self, content: str, extraction_types: List[str] = None, **kwargs) -> Dict[str, Any]:
        """Extract entities from text content."""
        try:
            if extraction_types is None:
                extraction_types = ["PERSON", "ORG", "GPE", "EVENT"]

            entity_prompt = f"""
            Extract entities from this text. Focus on: {', '.join(extraction_types)}

            Text: {content[:3000]}

            Return entities in JSON format with entity type, text, and confidence score.
            """

            entity_result = await llm_service.generate_completion(
                prompt=entity_prompt,
                temperature=0.1,
                max_tokens=1000
            )

            try:
                entities = json.loads(entity_result["content"])
                if not isinstance(entities, list):
                    entities = []
            except json.JSONDecodeError:
                entities = []

            return {
                "entities_found": len(entities),
                "entities": entities[:50],  # Return first 50 entities
                "entity_types": list(set(e.get("type", "UNKNOWN") for e in entities))
            }

        except Exception as e:
            self.logger.error(f"Entity extraction tool failed: {e}")
            return {"error": str(e)}

    async def _build_knowledge_graph(self, entities: List[Dict[str, Any]], **kwargs) -> Dict[str, Any]:
        """Build a knowledge graph from extracted entities."""
        try:
            nodes_created = len(entities)
            edges_created = 0

            # Simple relationship detection based on co-occurrence
            for i, entity1 in enumerate(entities):
                for j, entity2 in enumerate(entities[i+1:], i+1):
                    # Simple relationship logic - could be enhanced with LLM
                    if entity1.get("type") == "PERSON" and entity2.get("type") == "ORG":
                        edges_created += 1

            return {
                "nodes_created": nodes_created,
                "edges_created": edges_created,
                "graph_complexity": "medium" if edges_created > nodes_created else "simple"
            }

        except Exception as e:
            self.logger.error(f"Knowledge graph builder tool failed: {e}")
            return {"error": str(e)}

    async def _summarize_document(self, content: str, summary_length: str = "medium", **kwargs) -> Dict[str, Any]:
        """Generate intelligent document summary."""
        try:
            length_guidelines = {
                "short": "100-150 words",
                "medium": "200-300 words",
                "long": "400-500 words"
            }
            target_length = length_guidelines.get(summary_length, "200-300 words")

            summary_prompt = f"""
            Summarize this document in {target_length}.

            Content: {content[:4000]}

            Return JSON with: summary, key_points, topics
            """

            summary_result = await llm_service.generate_completion(
                prompt=summary_prompt,
                temperature=0.3,
                max_tokens=600
            )

            try:
                summary_data = json.loads(summary_result["content"])
            except json.JSONDecodeError:
                summary_data = {
                    "summary": summary_result["content"][:500],
                    "key_points": [],
                    "topics": []
                }

            return {
                "summary": summary_data.get("summary", ""),
                "key_points": summary_data.get("key_points", []),
                "topics": summary_data.get("topics", []),
                "summary_length": len(summary_data.get("summary", "")),
                "reading_time": max(1, len(content.split()) // 200)
            }

        except Exception as e:
            self.logger.error(f"Document summarizer tool failed: {e}")
            return {"error": str(e)}

    async def _analyze_content(self, content: str, analysis_types: List[str] = None, **kwargs) -> Dict[str, Any]:
        """Perform comprehensive content analysis."""
        try:
            if analysis_types is None:
                analysis_types = ["sentiment", "topics", "readability"]

            results = {}

            # Basic analysis
            words = content.split()
            sentences = content.split('.')
            results["basic_stats"] = {
                "word_count": len(words),
                "sentence_count": len(sentences),
                "avg_sentence_length": round(sum(len(sentence.split()) for sentence in sentences if sentence.strip()) / len(sentences), 1) if sentences else 0
            }

            # Sentiment analysis (simplified)
            positive_words = ["good", "great", "excellent", "positive", "amazing", "wonderful"]
            negative_words = ["bad", "terrible", "awful", "negative", "horrible", "poor"]

            positive_count = sum(1 for word in words if word.lower() in positive_words)
            negative_count = sum(1 for word in words if word.lower() in negative_words)

            if "sentiment" in analysis_types:
                if positive_count > negative_count:
                    sentiment = "positive"
                elif negative_count > positive_count:
                    sentiment = "negative"
                else:
                    sentiment = "neutral"

                results["sentiment"] = {
                    "overall_sentiment": sentiment,
                    "positive_words": positive_count,
                    "negative_words": negative_count,
                    "confidence": 0.6  # Simple confidence score
                }

            return results

        except Exception as e:
            self.logger.error(f"Content analyzer tool failed: {e}")
            return {"error": str(e)}

    # Task 1.5.1 - Multi-Browser Support Task Handlers
    async def _handle_browser_compatibility_check(
        self, parameters: Dict[str, Any], context: ExecutionContext, execution_steps: List[ExecutionStep]
    ) -> Dict[str, Any]:
        """Handle browser compatibility checking."""
        try:
            browser_type = parameters.get("browser_type", "chromium")

            step = ExecutionStep(
                step_id=uuid4(),
                action="check_browser_compatibility",
                parameters={"browser_type": browser_type},
                started_at=datetime.utcnow()
            )
            execution_steps.append(step)

            compatibility_info = await browser_automation_service.check_browser_compatibility(browser_type)

            step.completed_at = datetime.utcnow()
            step.duration_ms = int((step.completed_at - step.started_at).total_seconds() * 1000)
            step.result = compatibility_info
            step.status = ExecutionStatus.COMPLETED

            return compatibility_info

        except Exception as e:
            self.logger.error(f"Browser compatibility check failed: {e}")
            if execution_steps:
                execution_steps[-1].status = ExecutionStatus.FAILED
                execution_steps[-1].completed_at = datetime.utcnow()
                execution_steps[-1].error = str(e)
            return {"error": str(e)}

    async def _handle_get_available_browsers(
        self, parameters: Dict[str, Any], context: ExecutionContext, execution_steps: List[ExecutionStep]
    ) -> Dict[str, Any]:
        """Handle getting available browsers."""
        try:
            step = ExecutionStep(
                step_id=uuid4(),
                action="get_available_browsers",
                parameters={},
                started_at=datetime.utcnow()
            )
            execution_steps.append(step)

            browsers = await browser_automation_service.get_available_browsers()

            step.completed_at = datetime.utcnow()
            step.duration_ms = int((step.completed_at - step.started_at).total_seconds() * 1000)
            step.result = {"browsers": browsers}
            step.status = ExecutionStatus.COMPLETED

            return {"available_browsers": browsers}

        except Exception as e:
            self.logger.error(f"Get available browsers failed: {e}")
            if execution_steps:
                execution_steps[-1].status = ExecutionStatus.FAILED
                execution_steps[-1].completed_at = datetime.utcnow()
                execution_steps[-1].error = str(e)
            return {"error": str(e)}

    async def _handle_get_device_profiles(
        self, parameters: Dict[str, Any], context: ExecutionContext, execution_steps: List[ExecutionStep]
    ) -> Dict[str, Any]:
        """Handle getting device profiles for mobile emulation."""
        try:
            step = ExecutionStep(
                step_id=uuid4(),
                action="get_device_profiles",
                parameters={},
                started_at=datetime.utcnow()
            )
            execution_steps.append(step)

            device_profiles = await browser_automation_service.get_device_profiles()

            step.completed_at = datetime.utcnow()
            step.duration_ms = int((step.completed_at - step.started_at).total_seconds() * 1000)
            step.result = {"device_profiles": device_profiles}
            step.status = ExecutionStatus.COMPLETED

            return {"device_profiles": device_profiles}

        except Exception as e:
            self.logger.error(f"Get device profiles failed: {e}")
            if execution_steps:
                execution_steps[-1].status = ExecutionStatus.FAILED
                execution_steps[-1].completed_at = datetime.utcnow()
                execution_steps[-1].error = str(e)
            return {"error": str(e)}

    async def _handle_create_browser_config(
        self, parameters: Dict[str, Any], context: ExecutionContext, execution_steps: List[ExecutionStep]
    ) -> Dict[str, Any]:
        """Handle creating browser configuration."""
        try:
            browser_type = parameters.get("browser_type", "chromium")
            execution_mode = parameters.get("execution_mode", "headless")
            device_profile = parameters.get("device_profile")
            viewport = parameters.get("viewport")
            user_agent = parameters.get("user_agent")

            step = ExecutionStep(
                step_id=uuid4(),
                action="create_browser_config",
                parameters=parameters,
                started_at=datetime.utcnow()
            )
            execution_steps.append(step)

            config = await browser_automation_service.create_browser_config(
                browser_type=browser_type,
                execution_mode=execution_mode,
                device_profile=device_profile,
                viewport=viewport,
                user_agent=user_agent
            )

            step.completed_at = datetime.utcnow()
            step.duration_ms = int((step.completed_at - step.started_at).total_seconds() * 1000)
            step.result = config.dict()
            step.status = ExecutionStatus.COMPLETED

            return {"browser_config": config.dict()}

        except Exception as e:
            self.logger.error(f"Create browser config failed: {e}")
            if execution_steps:
                execution_steps[-1].status = ExecutionStatus.FAILED
                execution_steps[-1].completed_at = datetime.utcnow()
                execution_steps[-1].error = str(e)
            return {"error": str(e)}

    async def _handle_create_browser_instance(
        self, parameters: Dict[str, Any], context: ExecutionContext, execution_steps: List[ExecutionStep]
    ) -> Dict[str, Any]:
        """Handle creating browser instance."""
        try:
            config_dict = parameters.get("browser_config")
            if not config_dict:
                raise ValueError("Browser config is required")

            config = BrowserConfig(**config_dict)

            step = ExecutionStep(
                step_id=uuid4(),
                action="create_browser_instance",
                parameters={"browser_type": config.browser_type.value},
                started_at=datetime.utcnow()
            )
            execution_steps.append(step)

            instance_id = await browser_automation_service.create_browser_instance(config)

            step.completed_at = datetime.utcnow()
            step.duration_ms = int((step.completed_at - step.started_at).total_seconds() * 1000)
            step.result = {"instance_id": instance_id}
            step.status = ExecutionStatus.COMPLETED

            return {"browser_instance_id": instance_id}

        except Exception as e:
            self.logger.error(f"Create browser instance failed: {e}")
            if execution_steps:
                execution_steps[-1].status = ExecutionStatus.FAILED
                execution_steps[-1].completed_at = datetime.utcnow()
                execution_steps[-1].error = str(e)
            return {"error": str(e)}

    async def _handle_cross_browser_test(
        self, parameters: Dict[str, Any], context: ExecutionContext, execution_steps: List[ExecutionStep]
    ) -> Dict[str, Any]:
        """Handle cross-browser testing."""
        try:
            url = parameters.get("url")
            browsers = parameters.get("browsers", ["chromium", "firefox", "webkit"])
            test_actions = parameters.get("actions", [])

            if not url:
                raise ValueError("URL is required for cross-browser testing")

            step = ExecutionStep(
                step_id=uuid4(),
                action="cross_browser_test",
                parameters={"url": url, "browsers": browsers},
                started_at=datetime.utcnow()
            )
            execution_steps.append(step)

            results = {}

            for browser_type in browsers:
                try:
                    # Create browser config
                    config = await browser_automation_service.create_browser_config(
                        browser_type=browser_type,
                        execution_mode="headless"
                    )

                    # Create workflow
                    workflow = await browser_automation_service.create_workflow_with_browser_config(
                        description=f"Cross-browser test for {url}",
                        browser_config=config,
                        target_url=url
                    )

                    # Add test actions if specified
                    if test_actions:
                        from app.agents.browser_agent import BrowserAction
                        workflow.actions.extend([BrowserAction(**action) for action in test_actions])

                    # Execute workflow
                    result = await browser_automation_service.execute_workflow_with_browser_config(workflow)

                    results[browser_type] = {
                        "success": result.success,
                        "execution_time_ms": result.execution_time_ms,
                        "errors": result.errors,
                        "screenshots": result.screenshots[:1] if result.screenshots else []  # Take first screenshot
                    }

                except Exception as e:
                    results[browser_type] = {
                        "success": False,
                        "error": str(e)
                    }

            step.completed_at = datetime.utcnow()
            step.duration_ms = int((step.completed_at - step.started_at).total_seconds() * 1000)
            step.result = {"test_results": results}
            step.status = ExecutionStatus.COMPLETED

            return {
                "url": url,
                "browsers_tested": browsers,
                "test_results": results,
                "summary": {
                    "total_browsers": len(browsers),
                    "successful": sum(1 for r in results.values() if r.get("success")),
                    "failed": sum(1 for r in results.values() if not r.get("success"))
                }
            }

        except Exception as e:
            self.logger.error(f"Cross-browser test failed: {e}")
            if execution_steps:
                execution_steps[-1].status = ExecutionStatus.FAILED
                execution_steps[-1].completed_at = datetime.utcnow()
                execution_steps[-1].error = str(e)
            return {"error": str(e)}

    async def _handle_mobile_emulation_test(
        self, parameters: Dict[str, Any], context: ExecutionContext, execution_steps: List[ExecutionStep]
    ) -> Dict[str, Any]:
        """Handle mobile device emulation testing."""
        try:
            url = parameters.get("url")
            device_profiles = parameters.get("device_profiles", ["iphone_13", "pixel_6", "ipad_pro"])

            if not url:
                raise ValueError("URL is required for mobile emulation testing")

            step = ExecutionStep(
                step_id=uuid4(),
                action="mobile_emulation_test",
                parameters={"url": url, "device_profiles": device_profiles},
                started_at=datetime.utcnow()
            )
            execution_steps.append(step)

            results = {}

            for device_profile in device_profiles:
                try:
                    # Create browser config with device profile
                    config = await browser_automation_service.create_browser_config(
                        browser_type="chromium",  # Chromium has best mobile emulation
                        execution_mode="headless",
                        device_profile=device_profile
                    )

                    # Create workflow
                    workflow = await browser_automation_service.create_workflow_with_browser_config(
                        description=f"Mobile emulation test for {device_profile}",
                        browser_config=config,
                        target_url=url
                    )

                    # Execute workflow
                    result = await browser_automation_service.execute_workflow_with_browser_config(workflow)

                    results[device_profile] = {
                        "success": result.success,
                        "execution_time_ms": result.execution_time_ms,
                        "errors": result.errors,
                        "screenshots": result.screenshots[:1] if result.screenshots else [],
                        "viewport": config.device_profile.viewport if config.device_profile else None,
                        "user_agent": config.device_profile.user_agent if config.device_profile else None
                    }

                except Exception as e:
                    results[device_profile] = {
                        "success": False,
                        "error": str(e)
                    }

            step.completed_at = datetime.utcnow()
            step.duration_ms = int((step.completed_at - step.started_at).total_seconds() * 1000)
            step.result = {"test_results": results}
            step.status = ExecutionStatus.COMPLETED

            return {
                "url": url,
                "device_profiles_tested": device_profiles,
                "test_results": results,
                "summary": {
                    "total_devices": len(device_profiles),
                    "successful": sum(1 for r in results.values() if r.get("success")),
                    "failed": sum(1 for r in results.values() if not r.get("success"))
                }
            }

        except Exception as e:
            self.logger.error(f"Mobile emulation test failed: {e}")
            if execution_steps:
                execution_steps[-1].status = ExecutionStatus.FAILED
                execution_steps[-1].completed_at = datetime.utcnow()
                execution_steps[-1].error = str(e)
            return {"error": str(e)}

    async def _handle_browser_performance_test(
        self, parameters: Dict[str, Any], context: ExecutionContext, execution_steps: List[ExecutionStep]
    ) -> Dict[str, Any]:
        """Handle browser performance testing."""
        try:
            url = parameters.get("url")
            browser_type = parameters.get("browser_type", "chromium")
            iterations = parameters.get("iterations", 3)

            if not url:
                raise ValueError("URL is required for performance testing")

            step = ExecutionStep(
                step_id=uuid4(),
                action="browser_performance_test",
                parameters={"url": url, "browser_type": browser_type, "iterations": iterations},
                started_at=datetime.utcnow()
            )
            execution_steps.append(step)

            performance_results = []

            for i in range(iterations):
                try:
                    start_time = datetime.utcnow()

                    # Create browser config
                    config = await browser_automation_service.create_browser_config(
                        browser_type=browser_type,
                        execution_mode="headless"
                    )

                    # Create simple performance workflow
                    workflow = await browser_automation_service.create_workflow_with_browser_config(
                        description=f"Performance test iteration {i+1}",
                        browser_config=config,
                        target_url=url
                    )

                    # Execute workflow
                    result = await browser_automation_service.execute_workflow_with_browser_config(workflow)

                    end_time = datetime.utcnow()
                    total_time = (end_time - start_time).total_seconds() * 1000

                    performance_results.append({
                        "iteration": i + 1,
                        "success": result.success,
                        "total_time_ms": total_time,
                        "workflow_execution_time_ms": result.execution_time_ms,
                        "errors": result.errors
                    })

                except Exception as e:
                    performance_results.append({
                        "iteration": i + 1,
                        "success": False,
                        "error": str(e)
                    })

            # Calculate performance statistics
            successful_results = [r for r in performance_results if r.get("success")]
            performance_stats = {}

            if successful_results:
                total_times = [r["total_time_ms"] for r in successful_results]
                workflow_times = [r["workflow_execution_time_ms"] for r in successful_results]

                performance_stats = {
                    "successful_iterations": len(successful_results),
                    "failed_iterations": len(performance_results) - len(successful_results),
                    "average_total_time_ms": sum(total_times) / len(total_times),
                    "min_total_time_ms": min(total_times),
                    "max_total_time_ms": max(total_times),
                    "average_workflow_time_ms": sum(workflow_times) / len(workflow_times),
                    "min_workflow_time_ms": min(workflow_times),
                    "max_workflow_time_ms": max(workflow_times)
                }
            else:
                performance_stats = {
                    "successful_iterations": 0,
                    "failed_iterations": len(performance_results),
                    "error": "All iterations failed"
                }

            step.completed_at = datetime.utcnow()
            step.duration_ms = int((step.completed_at - step.started_at).total_seconds() * 1000)
            step.result = {"performance_stats": performance_stats}
            step.status = ExecutionStatus.COMPLETED

            return {
                "url": url,
                "browser_type": browser_type,
                "iterations": iterations,
                "performance_results": performance_results,
                "performance_statistics": performance_stats
            }

        except Exception as e:
            self.logger.error(f"Browser performance test failed: {e}")
            if execution_steps:
                execution_steps[-1].status = ExecutionStatus.FAILED
                execution_steps[-1].completed_at = datetime.utcnow()
                execution_steps[-1].error = str(e)
            return {"error": str(e)}

    # Enhanced browser tools for Task 1.5.1
    async def _get_browser_compatibility_info(self, browser_type: str) -> Dict[str, Any]:
        """Get browser compatibility information."""
        try:
            return await browser_automation_service.check_browser_compatibility(browser_type)
        except Exception as e:
            self.logger.error(f"Get browser compatibility info failed: {e}")
            return {"error": str(e)}

    async def _test_cross_browser_compatibility(self, url: str, browsers: List[str] = None) -> Dict[str, Any]:
        """Test cross-browser compatibility for a URL."""
        try:
            if browsers is None:
                browsers = ["chromium", "firefox", "webkit"]

            return await self._handle_cross_browser_test({
                "url": url,
                "browsers": browsers
            }, ExecutionContext(), [])

        except Exception as e:
            self.logger.error(f"Cross-browser compatibility test failed: {e}")
            return {"error": str(e)}

    async def _test_mobile_responsiveness(self, url: str, devices: List[str] = None) -> Dict[str, Any]:
        """Test mobile responsiveness across different devices."""
        try:
            if devices is None:
                devices = ["iphone_13", "pixel_6", "ipad_pro"]

            return await self._handle_mobile_emulation_test({
                "url": url,
                "device_profiles": devices
            }, ExecutionContext(), [])

        except Exception as e:
            self.logger.error(f"Mobile responsiveness test failed: {e}")
            return {"error": str(e)}

    # Task 1.5.3 - Advanced Capabilities Handler Methods
    async def _handle_visual_regression_test(self, parameters: Dict[str, Any], context: ExecutionContext, execution_steps: List[ExecutionStep]) -> Dict[str, Any]:
        """Handle visual regression testing."""
        try:
            if not HAS_ADVANCED_CAPABILITIES or not self.visual_testing_service:
                return {"error": "Visual testing service not available"}

            step = ExecutionStep(
                step_id=str(uuid4()),
                name="Visual Regression Test",
                started_at=datetime.utcnow()
            )
            execution_steps.append(step)

            test_config = VisualTestConfig(
                test_type=VisualTestType.VISUAL_REGRESSION,
                threshold=parameters.get("threshold", 0.1),
                baseline_dir=parameters.get("baseline_dir", "visual_baselines"),
                output_dir=parameters.get("output_dir", "visual_test_results"),
                viewport_sizes=parameters.get("viewport_sizes", [(1920, 1080)])
            )

            test_id = parameters.get("test_id", f"visual_test_{int(time.time())}")
            url = parameters["url"]
            update_baseline = parameters.get("update_baseline", False)

            # Create browser context and page
            browser_config = BrowserConfig(
                browser_type=BrowserType.CHROMIUM,
                headless=True,
                execution_mode=ExecutionMode.AUTOMATED
            )

            browser = await browser_manager.create_browser(browser_config)
            context = await browser.new_context()
            page = await context.new_page()

            try:
                result = await self.visual_testing_service.run_visual_regression_test(
                    page, test_config, test_id, url, update_baseline
                )

                step.status = ExecutionStatus.COMPLETED
                step.completed_at = datetime.utcnow()
                step.result = {
                    "test_id": test_id,
                    "passed": result.passed,
                    "confidence": result.confidence,
                    "diff_percentage": result.diff_percentage,
                    "execution_time_ms": result.execution_time_ms,
                    "diff_count": result.diff_count
                }

                return {
                    "success": True,
                    "test_result": {
                        "test_id": result.test_id,
                        "test_type": result.test_type,
                        "passed": result.passed,
                        "confidence": result.confidence,
                        "diff_count": result.diff_count,
                        "total_pixels": result.total_pixels,
                        "diff_percentage": result.diff_percentage,
                        "execution_time_ms": result.execution_time_ms,
                        "screenshot_path": result.screenshot_path,
                        "baseline_path": result.baseline_path,
                        "diff_path": result.diff_path,
                        "diffs": [
                            {
                                "diff_type": diff.diff_type,
                                "confidence": diff.confidence,
                                "bounding_box": diff.bounding_box,
                                "pixel_count": diff.pixel_count,
                                "percentage": diff.percentage
                            } for diff in result.diffs
                        ],
                        "metadata": result.metadata
                    }
                }

            finally:
                await context.close()
                await browser.close()

        except Exception as e:
            self.logger.error(f"Visual regression test failed: {e}")
            if execution_steps:
                execution_steps[-1].status = ExecutionStatus.FAILED
                execution_steps[-1].completed_at = datetime.utcnow()
                execution_steps[-1].error = str(e)
            return {"error": str(e)}

    async def _handle_captcha_detection_solving(self, parameters: Dict[str, Any], context: ExecutionContext, execution_steps: List[ExecutionStep]) -> Dict[str, Any]:
        """Handle CAPTCHA detection and solving."""
        try:
            if not HAS_ADVANCED_CAPABILITIES or not self.captcha_solver_service:
                return {"error": "CAPTCHA solver service not available"}

            step = ExecutionStep(
                step_id=str(uuid4()),
                name="CAPTCHA Detection and Solving",
                started_at=datetime.utcnow()
            )
            execution_steps.append(step)

            url = parameters["url"]
            solver_config = CaptchaConfig(
                solver_type=SolverType(parameters.get("solver_type", "ocr")),
                max_attempts=parameters.get("max_attempts", 3),
                timeout_seconds=parameters.get("timeout_seconds", 30),
                confidence_threshold=parameters.get("confidence_threshold", 0.7)
            )

            # Create browser context and page
            browser_config = BrowserConfig(
                browser_type=BrowserType.CHROMIUM,
                headless=parameters.get("headless", False)
            )

            browser = await browser_manager.create_browser(browser_config)
            context = await browser.new_context()
            page = await context.new_page()

            try:
                # Navigate to URL
                await page.goto(url, wait_until="networkidle")

                # Detect CAPTCHAs
                challenges = await self.captcha_solver_service.detect_captcha(page)

                results = []
                for challenge in challenges:
                    # Solve CAPTCHA
                    solve_result = await self.captcha_solver_service.solve_captcha(challenge, solver_config)

                    # Apply solution if successful
                    if solve_result.success:
                        applied = await self.captcha_solver_service.apply_solution(page, solve_result)
                        solve_result.metadata["solution_applied"] = applied

                    results.append({
                        "challenge_id": challenge.challenge_id,
                        "captcha_type": challenge.captcha_type,
                        "solve_result": {
                            "success": solve_result.success,
                            "solution": solve_result.solution.solution if solve_result.solution else None,
                            "confidence": solve_result.solution.confidence if solve_result.solution else 0.0,
                            "solver_used": solve_result.solution.solver_used.value if solve_result.solution else None,
                            "attempts_made": solve_result.attempts_made,
                            "total_time_ms": solve_result.total_time_ms,
                            "metadata": solve_result.metadata
                        }
                    })

                step.status = ExecutionStatus.COMPLETED
                step.completed_at = datetime.utcnow()
                step.result = {
                    "challenges_detected": len(challenges),
                    "challenges_solved": sum(1 for r in results if r["solve_result"]["success"]),
                    "total_results": len(results)
                }

                return {
                    "success": True,
                    "url": url,
                    "challenges_detected": len(challenges),
                    "results": results,
                    "statistics": self.captcha_solver_service.get_statistics()
                }

            finally:
                await context.close()
                await browser.close()

        except Exception as e:
            self.logger.error(f"CAPTCHA detection and solving failed: {e}")
            if execution_steps:
                execution_steps[-1].status = ExecutionStatus.FAILED
                execution_steps[-1].completed_at = datetime.utcnow()
                execution_steps[-1].error = str(e)
            return {"error": str(e)}

    async def _handle_network_simulation_test(self, parameters: Dict[str, Any], context: ExecutionContext, execution_steps: List[ExecutionStep]) -> Dict[str, Any]:
        """Handle network simulation testing."""
        try:
            if not HAS_ADVANCED_CAPABILITIES or not self.network_simulation_service:
                return {"error": "Network simulation service not available"}

            step = ExecutionStep(
                step_id=str(uuid4()),
                name="Network Simulation Test",
                started_at=datetime.utcnow()
            )
            execution_steps.append(step)

            url = parameters["url"]
            network_condition = NetworkCondition(parameters.get("condition", "online"))
            test_duration = parameters.get("test_duration_seconds", 30)

            # Create browser context and page
            browser_config = BrowserConfig(
                browser_type=BrowserType.CHROMIUM,
                headless=True
            )

            browser = await browser_manager.create_browser(browser_config)
            browser_context = await browser.new_context()
            page = await browser_context.new_page()

            try:
                # Apply network conditions
                apply_result = await self.network_simulation_service.apply_network_conditions(
                    browser_context, network_condition
                )

                # Test performance under network conditions
                test_config = {
                    "test_duration_seconds": test_duration,
                    "test_urls": [url],
                    "concurrent_requests": parameters.get("concurrent_requests", 3)
                }

                performance_result = await self.network_simulation_service.test_network_performance(
                    browser_context, network_condition, test_config
                )

                # Remove network conditions
                remove_result = await self.network_simulation_service.remove_network_conditions(
                    browser_context, apply_result.get("test_id", "unknown")
                )

                step.status = ExecutionStatus.COMPLETED
                step.completed_at = datetime.utcnow()
                step.result = {
                    "network_condition": network_condition,
                    "test_duration": test_duration,
                    "performance_summary": performance_result.summary
                }

                return {
                    "success": True,
                    "network_condition": network_condition,
                    "apply_result": apply_result,
                    "performance_result": {
                        "test_id": performance_result.test_id,
                        "profile_name": performance_result.profile_name,
                        "start_time": performance_result.start_time.isoformat(),
                        "end_time": performance_result.end_time.isoformat(),
                        "total_duration_ms": performance_result.total_duration_ms,
                        "summary": performance_result.summary,
                        "sample_count": len(performance_result.metrics),
                        "errors": performance_result.errors,
                        "success": performance_result.success
                    },
                    "remove_result": remove_result
                }

            finally:
                await browser_context.close()
                await browser.close()

        except Exception as e:
            self.logger.error(f"Network simulation test failed: {e}")
            if execution_steps:
                execution_steps[-1].status = ExecutionStatus.FAILED
                execution_steps[-1].completed_at = datetime.utcnow()
                execution_steps[-1].error = str(e)
            return {"error": str(e)}

    async def _handle_human_behavior_workflow(self, parameters: Dict[str, Any], context: ExecutionContext, execution_steps: List[ExecutionStep]) -> Dict[str, Any]:
        """Handle human behavior simulation workflow."""
        try:
            if not HAS_ADVANCED_CAPABILITIES or not self.advanced_browser_service:
                return {"error": "Advanced browser service not available"}

            step = ExecutionStep(
                step_id=str(uuid4()),
                name="Human Behavior Workflow",
                started_at=datetime.utcnow()
            )
            execution_steps.append(step)

            workflow_steps = parameters["workflow_steps"]
            human_config = HumanBehaviorConfig(
                typing_speed_wpm=parameters.get("typing_speed_wpm", 60),
                typing_variance=parameters.get("typing_variance", 0.3),
                click_delay_range=parameters.get("click_delay_range", (0.1, 0.5)),
                random_delays=parameters.get("random_delays", True),
                micro_movements=parameters.get("micro_movements", True)
            )

            advanced_config = AdvancedInteractionConfig(
                automation_mode=AutomationMode.HUMAN,
                human_behavior=human_config
            )

            # Create browser context and page
            browser_config = BrowserConfig(
                browser_type=BrowserType.CHROMIUM,
                headless=parameters.get("headless", False)
            )

            browser = await browser_manager.create_browser(browser_config)
            browser_context = await self.advanced_browser_service.create_advanced_context(browser, advanced_config)
            page = await browser_context.new_page()

            try:
                # Execute workflow with human behavior
                result = await self.advanced_browser_service.execute_advanced_workflow(
                    page, workflow_steps, advanced_config
                )

                step.status = ExecutionStatus.COMPLETED
                step.completed_at = datetime.utcnow()
                step.result = {
                    "workflow_id": result.get("workflow_id"),
                    "total_steps": result.get("total_steps"),
                    "successful_steps": result.get("successful_steps"),
                    "failed_steps": result.get("failed_steps"),
                    "total_execution_time_ms": result.get("total_execution_time_ms")
                }

                return {
                    "success": result.get("success", False),
                    "workflow_result": result,
                    "human_behavior_config": {
                        "typing_speed_wpm": human_config.typing_speed_wpm,
                        "typing_variance": human_config.typing_variance,
                        "random_delays": human_config.random_delays,
                        "micro_movements": human_config.micro_movements
                    }
                }

            finally:
                await browser_context.close()
                await browser.close()

        except Exception as e:
            self.logger.error(f"Human behavior workflow failed: {e}")
            if execution_steps:
                execution_steps[-1].status = ExecutionStatus.FAILED
                execution_steps[-1].completed_at = datetime.utcnow()
                execution_steps[-1].error = str(e)
            return {"error": str(e)}

    async def _handle_advanced_file_operations(self, parameters: Dict[str, Any], context: ExecutionContext, execution_steps: List[ExecutionStep]) -> Dict[str, Any]:
        """Handle advanced file operations."""
        try:
            if not HAS_ADVANCED_CAPABILITIES or not self.advanced_browser_service:
                return {"error": "Advanced browser service not available"}

            step = ExecutionStep(
                step_id=str(uuid4()),
                name="Advanced File Operations",
                started_at=datetime.utcnow()
            )
            execution_steps.append(step)

            operation_type = parameters["operation_type"]  # upload or download
            url = parameters["url"]

            # Create browser context and page
            browser_config = BrowserConfig(
                browser_type=BrowserType.CHROMIUM,
                headless=parameters.get("headless", False)
            )

            browser = await browser_manager.create_browser(browser_config)
            browser_context = await browser.new_context()
            page = await browser_context.new_page()

            try:
                await page.goto(url, wait_until="networkidle")

                result = None
                if operation_type == "upload":
                    file_config = FileOperationConfig(
                        download_dir=parameters.get("download_dir", "downloads"),
                        upload_dir=parameters.get("upload_dir", "uploads"),
                        allowed_extensions=parameters.get("allowed_extensions", [".pdf", ".jpg", ".png", ".doc"]),
                        max_file_size_mb=parameters.get("max_file_size_mb", 100)
                    )

                    result = await self.advanced_browser_service.handle_file_upload(
                        page,
                        parameters["selector"],
                        parameters["file_paths"],
                        file_config
                    )

                elif operation_type == "download":
                    file_config = FileOperationConfig(download_dir=parameters.get("download_dir", "downloads"))

                    result = await self.advanced_browser_service.handle_file_download(
                        page,
                        parameters["download_trigger"],
                        parameters.get("expected_files", 1),
                        file_config,
                        parameters.get("timeout_seconds", 30)
                    )

                step.status = ExecutionStatus.COMPLETED
                step.completed_at = datetime.utcnow()
                step.result = {
                    "operation_type": operation_type,
                    "success": result.get("success", False) if result else False
                }

                return {
                    "success": True,
                    "operation_type": operation_type,
                    "url": url,
                    "result": result
                }

            finally:
                await browser_context.close()
                await browser.close()

        except Exception as e:
            self.logger.error(f"Advanced file operations failed: {e}")
            if execution_steps:
                execution_steps[-1].status = ExecutionStatus.FAILED
                execution_steps[-1].completed_at = datetime.utcnow()
                execution_steps[-1].error = str(e)
            return {"error": str(e)}

    async def _handle_geolocation_test(self, parameters: Dict[str, Any], context: ExecutionContext, execution_steps: List[ExecutionStep]) -> Dict[str, Any]:
        """Handle geolocation testing."""
        try:
            if not HAS_ADVANCED_CAPABILITIES or not self.advanced_browser_service:
                return {"error": "Advanced browser service not available"}

            step = ExecutionStep(
                step_id=str(uuid4()),
                name="Geolocation Test",
                started_at=datetime.utcnow()
            )
            execution_steps.append(step)

            url = parameters["url"]
            location_name = parameters.get("location", "new_york")

            geo_config = self.advanced_browser_service.get_geolocation_config(location_name)
            if not geo_config:
                geo_config = GeolocationConfig(
                    latitude=parameters.get("latitude", 40.7128),
                    longitude=parameters.get("longitude", -74.0060),
                    accuracy=parameters.get("accuracy", 100.0)
                )

            advanced_config = AdvancedInteractionConfig(
                geolocation=geo_config
            )

            # Create browser context and page
            browser_config = BrowserConfig(
                browser_type=BrowserType.CHROMIUM,
                headless=True
            )

            browser = await browser_manager.create_browser(browser_config)
            browser_context = await self.advanced_browser_service.create_advanced_context(browser, advanced_config)
            page = await browser_context.new_page()

            try:
                await page.goto(url, wait_until="networkidle")

                # Test geolocation
                geolocation_result = await page.evaluate("""
                () => {
                    return new Promise((resolve) => {
                        navigator.geolocation.getCurrentPosition(
                            (position) => {
                                resolve({
                                    success: true,
                                    latitude: position.coords.latitude,
                                    longitude: position.coords.longitude,
                                    accuracy: position.coords.accuracy,
                                    altitude: position.coords.altitude,
                                    altitudeAccuracy: position.coords.altitudeAccuracy,
                                    heading: position.coords.heading,
                                    speed: position.coords.speed
                                });
                            },
                            (error) => {
                                resolve({
                                    success: false,
                                    error: error.message,
                                    code: error.code
                                });
                            }
                        );
                    });
                }
                """)

                step.status = ExecutionStatus.COMPLETED
                step.completed_at = datetime.utcnow()
                step.result = {
                    "location_name": location_name,
                    "configured_location": {
                        "latitude": geo_config.latitude,
                        "longitude": geo_config.longitude,
                        "accuracy": geo_config.accuracy
                    },
                    "detected_location": geolocation_result
                }

                return {
                    "success": True,
                    "location_name": location_name,
                    "configured_geolocation": {
                        "latitude": geo_config.latitude,
                        "longitude": geo_config.longitude,
                        "accuracy": geo_config.accuracy,
                        "altitude": geo_config.altitude,
                        "altitude_accuracy": geo_config.altitude_accuracy,
                        "heading": geo_config.heading,
                        "speed": geo_config.speed
                    },
                    "detected_geolocation": geolocation_result
                }

            finally:
                await browser_context.close()
                await browser.close()

        except Exception as e:
            self.logger.error(f"Geolocation test failed: {e}")
            if execution_steps:
                execution_steps[-1].status = ExecutionStatus.FAILED
                execution_steps[-1].completed_at = datetime.utcnow()
                execution_steps[-1].error = str(e)
            return {"error": str(e)}

    async def _handle_user_agent_test(self, parameters: Dict[str, Any], context: ExecutionContext, execution_steps: List[ExecutionStep]) -> Dict[str, Any]:
        """Handle user agent testing."""
        try:
            if not HAS_ADVANCED_CAPABILITIES or not self.advanced_browser_service:
                return {"error": "Advanced browser service not available"}

            step = ExecutionStep(
                step_id=str(uuid4()),
                name="User Agent Test",
                started_at=datetime.utcnow()
            )
            execution_steps.append(step)

            url = parameters["url"]
            agent_name = parameters.get("user_agent", "chrome_windows")

            user_agent_config = self.advanced_browser_service.get_user_agent_config(agent_name)
            if not user_agent_config:
                # Create custom user agent config
                user_agent_config = UserAgentConfig(
                    user_agent=parameters.get("custom_user_agent", ""),
                    viewport_width=parameters.get("viewport_width", 1920),
                    viewport_height=parameters.get("viewport_height", 1080),
                    locale=parameters.get("locale", "en-US")
                )

            advanced_config = AdvancedInteractionConfig(
                user_agent=user_agent_config
            )

            # Create browser context and page
            browser_config = BrowserConfig(
                browser_type=BrowserType.CHROMIUM,
                headless=True
            )

            browser = await browser_manager.create_browser(browser_config)
            browser_context = await self.advanced_browser_service.create_advanced_context(browser, advanced_config)
            page = await browser_context.new_page()

            try:
                await page.goto(url, wait_until="networkidle")

                # Test user agent detection
                detected_user_agent = await page.evaluate("navigator.userAgent")
                detected_viewport = await page.evaluate("() => ({width: window.innerWidth, height: window.innerHeight})")
                detected_locale = await page.evaluate("navigator.language")
                detected_platform = await page.evaluate("navigator.platform")

                step.status = ExecutionStatus.COMPLETED
                step.completed_at = datetime.utcnow()
                step.result = {
                    "agent_name": agent_name,
                    "configured_user_agent": user_agent_config.user_agent,
                    "detected_user_agent": detected_user_agent,
                    "match": detected_user_agent == user_agent_config.user_agent
                }

                return {
                    "success": True,
                    "agent_name": agent_name,
                    "configured": {
                        "user_agent": user_agent_config.user_agent,
                        "viewport_width": user_agent_config.viewport_width,
                        "viewport_height": user_agent_config.viewport_height,
                        "locale": user_agent_config.locale,
                        "timezone_id": user_agent_config.timezone_id
                    },
                    "detected": {
                        "user_agent": detected_user_agent,
                        "viewport": detected_viewport,
                        "locale": detected_locale,
                        "platform": detected_platform
                    },
                    "match_success": detected_user_agent == user_agent_config.user_agent
                }

            finally:
                await browser_context.close()
                await browser.close()

        except Exception as e:
            self.logger.error(f"User agent test failed: {e}")
            if execution_steps:
                execution_steps[-1].status = ExecutionStatus.FAILED
                execution_steps[-1].completed_at = datetime.utcnow()
                execution_steps[-1].error = str(e)
            return {"error": str(e)}

    async def _handle_stealth_mode_test(self, parameters: Dict[str, Any], context: ExecutionContext, execution_steps: List[ExecutionStep]) -> Dict[str, Any]:
        """Handle stealth mode testing."""
        try:
            if not HAS_ADVANCED_CAPABILITIES or not self.advanced_browser_service:
                return {"error": "Advanced browser service not available"}

            step = ExecutionStep(
                step_id=str(uuid4()),
                name="Stealth Mode Test",
                started_at=datetime.utcnow()
            )
            execution_steps.append(step)

            url = parameters["url"]
            stealth_options = parameters.get("stealth_options", {})

            advanced_config = AdvancedInteractionConfig(
                automation_mode=AutomationMode.STEALTH,
                stealth_options=stealth_options
            )

            # Create browser context and page
            browser_config = BrowserConfig(
                browser_type=BrowserType.CHROMIUM,
                headless=True
            )

            browser = await browser_manager.create_browser(browser_config)
            browser_context = await self.advanced_browser_service.create_advanced_context(browser, advanced_config)
            page = await browser_context.new_page()

            try:
                await page.goto(url, wait_until="networkidle")

                # Test stealth effectiveness
                stealth_test_results = await page.evaluate("""
                () => {
                    const results = {};

                    // Test webdriver property
                    results.webdriver_property = navigator.webdriver === undefined;

                    // Test plugins
                    results.plugins_length = navigator.plugins.length > 0;

                    // Test languages
                    results.languages_present = navigator.languages && navigator.languages.length > 0;

                    // Test chrome object
                    results.chrome_object = !!window.chrome;

                    // Test iframe contentWindow
                    try {
                        const iframe = document.createElement('iframe');
                        document.body.appendChild(iframe);
                        results.iframe_test = iframe.contentWindow === window;
                        document.body.removeChild(iframe);
                    } catch (e) {
                        results.iframe_test = false;
                    }

                    // Test permissions API
                    results.permissions_api = !!navigator.permissions;

                    return results;
                }
                """)

                # Calculate stealth score
                stealth_indicators = [
                    stealth_test_results.get("webdriver_property", False),
                    stealth_test_results.get("plugins_length", False),
                    stealth_test_results.get("languages_present", False),
                    stealth_test_results.get("chrome_object", False),
                    not stealth_test_results.get("iframe_test", True),  # Should be False for stealth
                    stealth_test_results.get("permissions_api", False)
                ]

                stealth_score = sum(stealth_indicators) / len(stealth_indicators)

                step.status = ExecutionStatus.COMPLETED
                step.completed_at = datetime.utcnow()
                step.result = {
                    "stealth_score": stealth_score,
                    "stealth_indicators": stealth_indicators,
                    "test_results": stealth_test_results
                }

                return {
                    "success": True,
                    "stealth_mode": True,
                    "stealth_score": stealth_score,
                    "stealth_effectiveness": "High" if stealth_score > 0.8 else "Medium" if stealth_score > 0.5 else "Low",
                    "test_results": stealth_test_results,
                    "stealth_options": stealth_options
                }

            finally:
                await browser_context.close()
                await browser.close()

        except Exception as e:
            self.logger.error(f"Stealth mode test failed: {e}")
            if execution_steps:
                execution_steps[-1].status = ExecutionStatus.FAILED
                execution_steps[-1].completed_at = datetime.utcnow()
                execution_steps[-1].error = str(e)
            return {"error": str(e)}

    async def _handle_advanced_workflow_execution(self, parameters: Dict[str, Any], context: ExecutionContext, execution_steps: List[ExecutionStep]) -> Dict[str, Any]:
        """Handle advanced workflow execution with multiple capabilities."""
        try:
            if not HAS_ADVANCED_CAPABILITIES or not self.advanced_browser_service:
                return {"error": "Advanced browser service not available"}

            step = ExecutionStep(
                step_id=str(uuid4()),
                name="Advanced Workflow Execution",
                started_at=datetime.utcnow()
            )
            execution_steps.append(step)

            workflow_steps = parameters["workflow_steps"]
            automation_mode = AutomationMode(parameters.get("automation_mode", "normal"))

            # Build advanced configuration
            advanced_config = AdvancedInteractionConfig(
                automation_mode=automation_mode,
                geolocation=GeolocationConfig(**parameters["geolocation"]) if parameters.get("geolocation") else None,
                user_agent=UserAgentConfig(**parameters["user_agent"]) if parameters.get("user_agent") else None,
                file_operations=FileOperationConfig(**parameters["file_operations"]) if parameters.get("file_operations") else None,
                human_behavior=HumanBehaviorConfig(**parameters["human_behavior"]) if parameters.get("human_behavior") else None,
                stealth_options=parameters.get("stealth_options", {}),
                permissions=parameters.get("permissions", ["geolocation", "notifications"]),
                extra_headers=parameters.get("extra_headers", {})
            )

            # Create browser context and page
            browser_config = BrowserConfig(
                browser_type=BrowserType(parameters.get("browser_type", "chromium")),
                headless=parameters.get("headless", False)
            )

            browser = await browser_manager.create_browser(browser_config)
            browser_context = await self.advanced_browser_service.create_advanced_context(browser, advanced_config)
            page = await browser_context.new_page()

            try:
                # Execute advanced workflow
                result = await self.advanced_browser_service.execute_advanced_workflow(
                    page, workflow_steps, advanced_config
                )

                step.status = ExecutionStatus.COMPLETED
                step.completed_at = datetime.utcnow()
                step.result = {
                    "workflow_id": result.get("workflow_id"),
                    "automation_mode": automation_mode,
                    "total_steps": result.get("total_steps"),
                    "successful_steps": result.get("successful_steps"),
                    "failed_steps": result.get("failed_steps"),
                    "total_execution_time_ms": result.get("total_execution_time_ms")
                }

                return {
                    "success": result.get("success", False),
                    "workflow_result": result,
                    "automation_config": {
                        "automation_mode": automation_mode,
                        "geolocation": advanced_config.geolocation.__dict__ if advanced_config.geolocation else None,
                        "user_agent": advanced_config.user_agent.__dict__ if advanced_config.user_agent else None,
                        "permissions": advanced_config.permissions,
                        "stealth_options": advanced_config.stealth_options
                    }
                }

            finally:
                await browser_context.close()
                await browser.close()

        except Exception as e:
            self.logger.error(f"Advanced workflow execution failed: {e}")
            if execution_steps:
                execution_steps[-1].status = ExecutionStatus.FAILED
                execution_steps[-1].completed_at = datetime.utcnow()
                execution_steps[-1].error = str(e)
            return {"error": str(e)}
