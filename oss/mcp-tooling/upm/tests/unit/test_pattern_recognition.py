"""
Unit tests for Architecture Pattern Recognition Engine.

Tests the AI-powered pattern detection, recommendation generation,
and architecture analysis functionality.
"""

import pytest
import asyncio
from datetime import datetime
from unittest.mock import Mock, AsyncMock, patch

from src.udp.core.patterns.models import (
    ArchitecturePattern,
    ProjectArchitecture,
    PatternMatch,
    IntegrationPattern,
    IntegrationTechnology,
    ComplexityLevel,
    BestPractice,
    PerformanceRecommendation,
)
from src.udp.core.patterns.recognition_engine import PatternRecognitionEngine


class TestPatternRecognitionEngine:
    """Test cases for PatternRecognitionEngine."""

    @pytest.fixture
    def engine(self):
        """Create a pattern recognition engine instance."""
        return PatternRecognitionEngine()

    @pytest.fixture
    def sample_project_arch(self):
        """Create a sample project architecture for testing."""
        return ProjectArchitecture(
            project_id="test-project-123",
            languages=["java", "python"],
            frameworks=["spring", "fastapi"],
            dependency_count=50,
            cross_language_dependencies=5,
            integration_points=["api-gateway", "message-queue"],
            performance_requirements="high",
            scaling_requirements="high",
            team_size=10,
            complexity_indicators=["polyglot_complexity"],
        )

    @pytest.mark.asyncio
    async def test_analyze_architecture_basic(self, engine, sample_project_arch):
        """Test basic architecture analysis."""
        result = await engine.analyze_architecture(sample_project_arch)

        assert result.project_id == "test-project-123"
        assert len(result.detected_patterns) > 0
        assert len(result.integration_patterns) > 0
        assert result.confidence_score >= 0.0
        assert result.confidence_score <= 1.0

    @pytest.mark.asyncio
    async def test_detect_patterns_polyglot_project(self, engine):
        """Test pattern detection for polyglot projects."""
        arch = ProjectArchitecture(
            project_id="polyglot-test",
            languages=["java", "python", "javascript", "go"],
            dependency_count=150,
            cross_language_dependencies=15,
        )

        patterns = await engine._detect_patterns(arch, None)

        # Should detect bridge pattern due to multiple languages
        bridge_patterns = [
            p for p in patterns if p.pattern == ArchitecturePattern.BRIDGE_PATTERN
        ]
        assert len(bridge_patterns) > 0
        assert bridge_patterns[0].confidence >= 0.7

        # Should suggest microservices due to high dependency count
        microservices_patterns = [
            p for p in patterns if p.pattern == ArchitecturePattern.MICROSERVICES
        ]
        assert len(microservices_patterns) > 0

    @pytest.mark.asyncio
    async def test_detect_patterns_monolith(self, engine):
        """Test pattern detection for monolithic projects."""
        arch = ProjectArchitecture(
            project_id="monolith-test",
            languages=["java"],
            dependency_count=250,
            cross_language_dependencies=0,
        )

        patterns = await engine._detect_patterns(arch, None)

        # Should detect monolith pattern
        monolith_patterns = [
            p for p in patterns if p.pattern == ArchitecturePattern.MONOLITH
        ]
        assert len(monolith_patterns) > 0
        assert monolith_patterns[0].confidence >= 0.5

    @pytest.mark.asyncio
    async def test_detect_patterns_microservices_indicators(self, engine):
        """Test pattern detection for microservices indicators."""
        arch = ProjectArchitecture(
            project_id="microservices-test",
            languages=["java", "python"],
            dependency_count=30,  # Lower per service
            cross_language_dependencies=3,
            team_size=15,
            scaling_requirements="high",
            integration_points=["api-gateway", "service-mesh"],
        )

        patterns = await engine._detect_patterns(arch, None)

        # Should detect microservices pattern
        microservices_patterns = [
            p for p in patterns if p.pattern == ArchitecturePattern.MICROSERVICES
        ]
        assert len(microservices_patterns) > 0
        assert microservices_patterns[0].confidence >= 0.7

    @pytest.mark.asyncio
    async def test_recommend_integration_patterns_rest_api(
        self, engine, sample_project_arch
    ):
        """Test REST API integration pattern recommendation."""
        patterns = [PatternMatch(ArchitecturePattern.REST_API, 0.8)]

        recommendations = await engine._recommend_integration_patterns(
            sample_project_arch, patterns
        )

        # Should recommend REST API
        rest_patterns = [
            r for r in recommendations if r.technology == IntegrationTechnology.REST
        ]
        assert len(rest_patterns) > 0

        rest_rec = rest_patterns[0]
        assert rest_rec.implementation_complexity == ComplexityLevel.LOW
        assert "language-agnostic" in rest_rec.description.lower()
        assert len(rest_rec.benefits) > 0
        assert rest_rec.example_code is not None

    @pytest.mark.asyncio
    async def test_recommend_integration_patterns_grpc(self, engine):
        """Test gRPC integration pattern recommendation for high performance."""
        arch = ProjectArchitecture(
            project_id="grpc-test",
            languages=["java", "python"],
            performance_requirements="very_high",
        )

        recommendations = await engine._recommend_integration_patterns(arch, [])

        # Should recommend gRPC for high performance
        grpc_patterns = [
            r for r in recommendations if r.technology == IntegrationTechnology.GRPC
        ]
        assert len(grpc_patterns) > 0

        grpc_rec = grpc_patterns[0]
        assert grpc_rec.implementation_complexity == ComplexityLevel.MEDIUM
        assert "high performance" in grpc_rec.description.lower()
        assert "binary protocol" in grpc_rec.benefits[0].lower()

    @pytest.mark.asyncio
    async def test_recommend_integration_patterns_py4j(self, engine):
        """Test Py4J recommendation for Python-Java integration."""
        arch = ProjectArchitecture(
            project_id="py4j-test",
            languages=["java", "python"],
        )

        recommendations = await engine._recommend_integration_patterns(arch, [])

        # Should recommend Py4J for Python-Java integration
        py4j_patterns = [
            r for r in recommendations if r.technology == IntegrationTechnology.PY4J
        ]
        assert len(py4j_patterns) > 0

        py4j_rec = py4j_patterns[0]
        assert "Python-Java" in py4j_rec.description
        assert py4j_rec.implementation_complexity == ComplexityLevel.MEDIUM

    @pytest.mark.asyncio
    async def test_recommend_integration_patterns_wasm(self, engine):
        """Test WebAssembly recommendation for very high performance."""
        arch = ProjectArchitecture(
            project_id="wasm-test",
            languages=["java", "python", "rust"],
            performance_requirements="very_high",
        )

        recommendations = await engine._recommend_integration_patterns(arch, [])

        # Should recommend WebAssembly for very high performance
        wasm_patterns = [
            r
            for r in recommendations
            if r.technology == IntegrationTechnology.WEBASSEMBLY
        ]
        assert len(wasm_patterns) > 0

        wasm_rec = wasm_patterns[0]
        assert wasm_rec.implementation_complexity == ComplexityLevel.HIGH
        assert "near-native performance" in wasm_rec.description.lower()

    @pytest.mark.asyncio
    async def test_recommend_best_practices_cross_language(
        self, engine, sample_project_arch
    ):
        """Test best practice recommendations for cross-language projects."""
        patterns = [PatternMatch(ArchitecturePattern.BRIDGE_PATTERN, 0.8)]

        practices = await engine._recommend_best_practices(
            sample_project_arch, patterns
        )

        # Should recommend clear service boundaries
        boundary_practices = [
            p for p in practices if "service boundaries" in p.title.lower()
        ]
        assert len(boundary_practices) > 0

        practice = boundary_practices[0]
        assert practice.category == "Cross-Language Integration"
        assert len(practice.implementation_steps) > 0
        assert len(practice.anti_patterns) > 0

    @pytest.mark.asyncio
    async def test_recommend_best_practices_api_design(self, engine):
        """Test API design best practices."""
        arch = ProjectArchitecture(
            project_id="api-test",
            languages=["java", "python"],
        )

        patterns = [PatternMatch(ArchitecturePattern.REST_API, 0.8)]

        practices = await engine._recommend_best_practices(arch, patterns)

        # Should recommend RESTful principles
        rest_practices = [p for p in practices if "RESTful" in p.title]
        assert len(rest_practices) > 0

        practice = rest_practices[0]
        assert practice.category == "API Design"
        assert "API usability" in practice.rationale.lower()

    @pytest.mark.asyncio
    async def test_recommend_performance_optimizations(self, engine):
        """Test performance optimization recommendations."""
        arch = ProjectArchitecture(
            project_id="perf-test",
            dependency_count=150,
            cross_language_dependencies=10,
        )

        dependencies = [
            {"name": "unused-lib", "ecosystem": "maven"},
            {"name": "another-lib", "ecosystem": "pypi"},
        ]

        recommendations = await engine._recommend_performance_optimizations(
            arch, dependencies
        )

        # Should recommend dependency optimization
        dep_recs = [
            r for r in recommendations if "Dependency Management" in r.component
        ]
        assert len(dep_recs) > 0

        # Should recommend cross-language optimization
        cross_lang_recs = [
            r for r in recommendations if "Cross-Language Communication" in r.component
        ]
        assert len(cross_lang_recs) > 0

        # Check recommendation structure
        for rec in recommendations:
            assert rec.implementation_effort in ComplexityLevel
            assert rec.expected_improvement is not None
            assert rec.priority in ["low", "medium", "high"]

    @pytest.mark.asyncio
    async def test_detect_anti_patterns(self, engine):
        """Test anti-pattern detection."""
        # Test distributed monolith
        arch = ProjectArchitecture(
            project_id="anti-pattern-test",
            languages=["java", "python", "javascript", "go", "rust"],
            dependency_count=300,
            cross_language_dependencies=20,
        )

        anti_patterns = await engine._detect_anti_patterns(arch, None)

        # Should detect large monolith
        assert "Large monolith" in str(anti_patterns)

        # Should detect distributed monolith
        assert "Distributed monolith" in str(anti_patterns)

    def test_calculate_confidence(self, engine):
        """Test confidence score calculation."""
        patterns = [
            PatternMatch(ArchitecturePattern.MICROSERVICES, 0.8),
            PatternMatch(ArchitecturePattern.REST_API, 0.7),
            PatternMatch(ArchitecturePattern.BRIDGE_PATTERN, 0.6),
        ]

        complexity_indicators = ["high_dependency_count"]

        confidence = engine._calculate_confidence(patterns, complexity_indicators)

        # Should be average of top patterns minus complexity penalty
        expected_base = (0.8 + 0.7 + 0.6) / 3
        expected_confidence = max(0.0, expected_base - 0.05)  # 0.05 penalty

        assert abs(confidence - expected_confidence) < 0.01

    def test_generate_migration_path(self, engine):
        """Test migration path generation."""
        patterns = [PatternMatch(ArchitecturePattern.MONOLITH, 0.8)]
        integration_patterns = []

        migration_path = engine._generate_migration_path(patterns, integration_patterns)

        assert migration_path is not None
        assert "Phase 1" in migration_path
        assert "microservices" in migration_path.lower()

    def test_estimate_effort_low(self, engine):
        """Test effort estimation for low complexity."""
        integration_patterns = [
            IntegrationPattern(
                pattern="REST API",
                technology=IntegrationTechnology.REST,
                description="Test",
                implementation_complexity=ComplexityLevel.LOW,
            )
        ]

        effort = engine._estimate_effort(integration_patterns, [], [])

        assert effort == "Low (1-2 weeks)"

    def test_estimate_effort_high(self, engine):
        """Test effort estimation for high complexity."""
        integration_patterns = [
            IntegrationPattern(
                pattern="WebAssembly",
                technology=IntegrationTechnology.WEBASSEMBLY,
                description="Test",
                implementation_complexity=ComplexityLevel.HIGH,
            ),
            IntegrationPattern(
                pattern="gRPC",
                technology=IntegrationTechnology.GRPC,
                description="Test",
                implementation_complexity=ComplexityLevel.MEDIUM,
            ),
        ]

        best_practices = [
            BestPractice(
                category="Test", title="Test", description="Test", rationale="Test"
            )
        ] * 10

        performance_recs = [
            PerformanceRecommendation(
                component="Test",
                issue="Test",
                recommendation="Test",
                expected_improvement="Test",
                implementation_effort=ComplexityLevel.MEDIUM,
            )
        ] * 5

        effort = engine._estimate_effort(
            integration_patterns, best_practices, performance_recs
        )

        assert "High" in effort or "Very High" in effort

    def test_get_rest_example(self, engine):
        """Test REST API example code generation."""
        example = engine._get_rest_example()

        assert "@RestController" in example or "@app.get" in example
        assert "Spring Boot" in example or "FastAPI" in example
        assert "public" in example or "async def" in example

    def test_get_grpc_example(self, engine):
        """Test gRPC example code generation."""
        example = engine._get_grpc_example()

        assert 'syntax = "proto3"' in example
        assert "service UserService" in example
        assert "@Override" in example or "grpc.insecure_channel" in example

    def test_get_py4j_example(self, engine):
        """Test Py4J example code generation."""
        example = engine._get_py4j_example()

        assert "GatewayServer" in example
        assert "JavaGateway" in example
        assert "public class" in example or "from py4j" in example

    def test_get_wasm_example(self, engine):
        """Test WebAssembly example code generation."""
        example = engine._get_wasm_example()

        assert "#[no_mangle]" in example or "wasmtime" in example
        assert 'extern "C"' in example
        assert "WebAssembly" in example
