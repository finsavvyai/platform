"""
Architecture pattern recognition engine.

This module implements AI-driven pattern recognition for analyzing
project architectures and detecting common patterns, anti-patterns,
and improvement opportunities.
"""

import re
import ast
import json
import logging
from typing import Dict, List, Optional, Tuple, Any, Set
from pathlib import Path
from dataclasses import asdict
import numpy as np
from collections import defaultdict, Counter

from .models import (
    ArchitecturePattern,
    PatternMatch,
    ProjectArchitecture,
    ComplexityLevel,
    ArchitectureRecommendation,
    IntegrationPattern,
    IntegrationTechnology,
    BestPractice,
    PerformanceRecommendation,
)

logger = logging.getLogger(__name__)


class PatternRecognitionEngine:
    """AI-powered architecture pattern recognition engine."""

    def __init__(self):
        """Initialize the pattern recognition engine."""
        self.pattern_rules = self._load_pattern_rules()
        self.anti_patterns = self._load_anti_patterns()
        self.best_practices = self._load_best_practices()
        self.integration_patterns = self._load_integration_patterns()

        # Pattern recognition weights
        self.language_weights = {
            "java": 0.3,
            "python": 0.25,
            "javascript": 0.2,
            "typescript": 0.15,
            "go": 0.1,
        }

        # Framework pattern mappings
        self.framework_patterns = {
            "spring": [
                ArchitecturePattern.MICROSERVICES,
                ArchitecturePattern.API_GATEWAY,
            ],
            "flask": [ArchitecturePattern.REST_API],
            "django": [ArchitecturePattern.MONOLITH],
            "fastapi": [ArchitecturePattern.REST_API, ArchitecturePattern.ASYNC],
            "react": [ArchitecturePattern.FACADE_PATTERN],
            "angular": [ArchitecturePattern.FACADE_PATTERN],
            "vue": [ArchitecturePattern.FACADE_PATTERN],
            "express": [ArchitecturePattern.REST_API, ArchitecturePattern.API_GATEWAY],
            "grpc": [ArchitecturePattern.GRPC],
            "kafka": [ArchitecturePattern.EVENT_DRIVEN],
            "rabbitmq": [ArchitecturePattern.MESSAGE_QUEUE],
            "istio": [ArchitecturePattern.SERVICE_MESH],
            "linkerd": [ArchitecturePattern.SERVICE_MESH],
        }

    async def analyze_architecture(
        self,
        project_arch: ProjectArchitecture,
        project_structure: Optional[Dict[str, Any]] = None,
        dependencies: Optional[List[Dict[str, Any]]] = None,
    ) -> ArchitectureRecommendation:
        """
        Analyze project architecture and generate recommendations.

        Args:
            project_arch: Project architecture information
            project_structure: Optional project file structure
            dependencies: Optional dependency information

        Returns:
            Complete architecture recommendation
        """
        logger.info(f"Analyzing architecture for project {project_arch.project_id}")

        # Detect current patterns
        detected_patterns = await self._detect_patterns(project_arch, project_structure)

        # Generate integration pattern recommendations
        integration_recommendations = await self._recommend_integration_patterns(
            project_arch, detected_patterns
        )

        # Generate best practice recommendations
        best_practices = await self._recommend_best_practices(
            project_arch, detected_patterns
        )

        # Generate performance recommendations
        performance_recs = await self._recommend_performance_optimizations(
            project_arch, dependencies
        )

        # Identify anti-patterns
        anti_patterns = await self._detect_anti_patterns(
            project_arch, project_structure
        )

        # Calculate overall confidence
        confidence = self._calculate_confidence(
            detected_patterns, project_arch.complexity_indicators
        )

        # Generate migration path if needed
        migration_path = self._generate_migration_path(
            detected_patterns, integration_recommendations
        )

        # Estimate implementation effort
        estimated_effort = self._estimate_effort(
            integration_recommendations, best_practices, performance_recs
        )

        return ArchitectureRecommendation(
            project_id=project_arch.project_id,
            detected_patterns=detected_patterns,
            integration_patterns=integration_recommendations,
            best_practices=best_practices,
            performance_recommendations=performance_recs,
            anti_patterns=anti_patterns,
            migration_path=migration_path,
            estimated_effort=estimated_effort,
            confidence_score=confidence,
        )

    async def _detect_patterns(
        self,
        project_arch: ProjectArchitecture,
        project_structure: Optional[Dict[str, Any]],
    ) -> List[PatternMatch]:
        """Detect architecture patterns in the project."""
        patterns = []

        # Analyze language distribution
        if len(project_arch.languages) > 3:
            patterns.append(
                PatternMatch(
                    pattern=ArchitecturePattern.BRIDGE_PATTERN,
                    confidence=0.8,
                    evidence=[
                        f"Detected {len(project_arch.languages)} different languages"
                    ],
                    strength=0.7,
                )
            )

        # Analyze dependency count
        if project_arch.dependency_count > 100:
            patterns.append(
                PatternMatch(
                    pattern=ArchitecturePattern.MONOLITH,
                    confidence=0.6,
                    evidence=[
                        f"High dependency count: {project_arch.dependency_count}"
                    ],
                    strength=0.5,
                )
            )
            patterns.append(
                PatternMatch(
                    pattern=ArchitecturePattern.MICROSERVICES,
                    confidence=0.4,
                    evidence=["Consider microservices for better modularity"],
                    strength=0.3,
                )
            )

        # Analyze frameworks
        detected_framework_patterns = set()
        for framework in project_arch.frameworks:
            if framework.lower() in self.framework_patterns:
                detected_framework_patterns.update(
                    self.framework_patterns[framework.lower()]
                )

        for pattern in detected_framework_patterns:
            patterns.append(
                PatternMatch(
                    pattern=pattern,
                    confidence=0.7,
                    evidence=[f"Framework indicates {pattern.value} pattern"],
                    strength=0.6,
                )
            )

        # Analyze integration points
        if len(project_arch.integration_points) > 5:
            patterns.append(
                PatternMatch(
                    pattern=ArchitecturePattern.API_GATEWAY,
                    confidence=0.75,
                    evidence=[
                        f"Multiple integration points: {len(project_arch.integration_points)}"
                    ],
                    strength=0.65,
                )
            )

        # Analyze performance requirements
        if project_arch.performance_requirements == "high":
            patterns.append(
                PatternMatch(
                    pattern=ArchitecturePattern.EVENT_DRIVEN,
                    confidence=0.6,
                    evidence=["High performance requirements suggest async patterns"],
                    strength=0.5,
                )
            )

        # Analyze scaling requirements
        if project_arch.scaling_requirements in ["high", "very_high"]:
            patterns.append(
                PatternMatch(
                    pattern=ArchitecturePattern.MICROSERVICES,
                    confidence=0.8,
                    evidence=["High scaling requirements favor microservices"],
                    strength=0.7,
                )
            )

            if project_arch.team_size > 10:
                patterns.append(
                    PatternMatch(
                        pattern=ArchitecturePattern.SERVICE_MESH,
                        confidence=0.6,
                        evidence=["Large team with high scaling needs"],
                        strength=0.5,
                    )
                )

        # Analyze project structure if provided
        if project_structure:
            structure_patterns = self._analyze_project_structure(project_structure)
            patterns.extend(structure_patterns)

        return sorted(patterns, key=lambda p: p.confidence, reverse=True)

    async def _recommend_integration_patterns(
        self, project_arch: ProjectArchitecture, detected_patterns: List[PatternMatch]
    ) -> List[IntegrationPattern]:
        """Recommend integration patterns for cross-language communication."""
        recommendations = []

        # Check if cross-language integration is needed
        if (
            len(project_arch.languages) > 1
            or project_arch.cross_language_dependencies > 0
        ):
            # REST API recommendation (default choice)
            recommendations.append(
                IntegrationPattern(
                    pattern="REST API Integration",
                    technology=IntegrationTechnology.REST,
                    description="Use REST APIs for language-agnostic communication",
                    benefits=[
                        "Standard protocol with wide language support",
                        "Easy to implement and debug",
                        "Good tooling ecosystem",
                        "Stateless design",
                    ],
                    drawbacks=[
                        "Higher overhead than binary protocols",
                        "Limited real-time capabilities",
                        "Can lead to chattiness",
                    ],
                    implementation_complexity=ComplexityLevel.LOW,
                    performance_impact="medium",
                    example_code=self._get_rest_example(),
                    configuration={
                        "content_type": "application/json",
                        "authentication": "JWT",
                        "rate_limiting": True,
                    },
                )
            )

            # gRPC recommendation (for high performance)
            if project_arch.performance_requirements in ["high", "very_high"]:
                recommendations.append(
                    IntegrationPattern(
                        pattern="gRPC Integration",
                        technology=IntegrationTechnology.GRPC,
                        description="Use gRPC for high-performance binary communication",
                        benefits=[
                            "High performance binary protocol",
                            "Strong typing with Protocol Buffers",
                            "Bidirectional streaming",
                            "Built-in code generation",
                        ],
                        drawbacks=[
                            "More complex setup",
                            "Limited browser support",
                            "Steeper learning curve",
                        ],
                        implementation_complexity=ComplexityLevel.MEDIUM,
                        performance_impact="low",
                        example_code=self._get_grpc_example(),
                        configuration={
                            "proto_version": "proto3",
                            "compression": "gzip",
                            "keepalive": True,
                        },
                    )
                )

            # Message Queue recommendation (for async communication)
            if any(
                p.pattern == ArchitecturePattern.EVENT_DRIVEN for p in detected_patterns
            ):
                recommendations.append(
                    IntegrationPattern(
                        pattern="Message Queue Integration",
                        technology=IntegrationTechnology.MESSAGE_BUS,
                        description="Use message queues for asynchronous communication",
                        benefits=[
                            "Decoupled communication",
                            "Load balancing",
                            "Durability and replay",
                            "Scalability",
                        ],
                        drawbacks=[
                            "Increased complexity",
                            "Eventual consistency",
                            "Debugging challenges",
                        ],
                        implementation_complexity=ComplexityLevel.MEDIUM,
                        performance_impact="low",
                        example_code=self._get_message_queue_example(),
                        configuration={
                            "broker": "rabbitmq",
                            "exchange_type": "topic",
                            "durable": True,
                        },
                    )
                )

            # Py4J recommendation (Python-Java integration)
            if "java" in project_arch.languages and "python" in project_arch.languages:
                recommendations.append(
                    IntegrationPattern(
                        pattern="Py4J Bridge",
                        technology=IntegrationTechnology.PY4J,
                        description="Use Py4J for direct Python-Java integration",
                        benefits=[
                            "Direct method calls between Python and Java",
                            "Low latency",
                            "Simple API",
                            "Bi-directional communication",
                        ],
                        drawbacks=[
                            "Python-Java specific",
                            "JVM dependency",
                            "Memory management considerations",
                        ],
                        implementation_complexity=ComplexityLevel.MEDIUM,
                        performance_impact="low",
                        example_code=self._get_py4j_example(),
                        configuration={
                            "port": 25333,
                            "autoshutdown": True,
                            "memory": "512m",
                        },
                    )
                )

            # WebAssembly recommendation (universal integration)
            if project_arch.performance_requirements == "very_high":
                recommendations.append(
                    IntegrationPattern(
                        pattern="WebAssembly Bridge",
                        technology=IntegrationTechnology.WEBASSEMBLY,
                        description="Use WebAssembly for near-native performance integration",
                        benefits=[
                            "Near-native performance",
                            "Language agnostic",
                            "Sandboxed execution",
                            "Portable",
                        ],
                        drawbacks=[
                            "Emerging technology",
                            "Limited language support",
                            "Complex build process",
                        ],
                        implementation_complexity=ComplexityLevel.HIGH,
                        performance_impact="very_low",
                        example_code=self._get_wasm_example(),
                        configuration={
                            "runtime": "wasmtime",
                            "optimization": "O3",
                            "memory_limit": "256MB",
                        },
                    )
                )

        return recommendations

    async def _recommend_best_practices(
        self, project_arch: ProjectArchitecture, detected_patterns: List[PatternMatch]
    ) -> List[BestPractice]:
        """Recommend best practices based on detected patterns."""
        practices = []

        # General cross-language best practices
        if len(project_arch.languages) > 1:
            practices.append(
                BestPractice(
                    category="Cross-Language Integration",
                    title="Define Clear Service Boundaries",
                    description="Establish clear boundaries between language-specific services",
                    rationale="Prevents tight coupling and makes the system more maintainable",
                    implementation_steps=[
                        "Identify natural domain boundaries",
                        "Assign single responsibility to each service",
                        "Define clear contracts between services",
                        "Implement versioned APIs",
                    ],
                    anti_patterns=[
                        "Shared database between services",
                        "Direct library dependencies across languages",
                        "Tight coupling through shared models",
                    ],
                    code_examples={
                        "java": "// Define interface\npublic interface PaymentService { ... }",
                        "python": "# Define abstract base class\nfrom abc import ABC, abstractmeta\nclass PaymentService(ABC): ...",
                    },
                    resources=[
                        "https://microservices.io/patterns/decomposition/decompose-by-business-capability.html",
                        "https://12factor.net/",
                    ],
                )
            )

        # API design best practices
        if any(
            p.pattern in [ArchitecturePattern.REST_API, ArchitecturePattern.API_GATEWAY]
            for p in detected_patterns
        ):
            practices.append(
                BestPractice(
                    category="API Design",
                    title="Follow RESTful Principles",
                    description="Design RESTful APIs that are intuitive and consistent",
                    rationale="Improves API usability and developer experience",
                    implementation_steps=[
                        "Use nouns for resources, not verbs",
                        "Use HTTP methods correctly (GET, POST, PUT, DELETE)",
                        "Implement proper status codes",
                        "Version your APIs",
                        "Use pagination for large collections",
                    ],
                    anti_patterns=[
                        "RPC-style endpoints with actions in URL",
                        "Inconsistent response formats",
                        "Missing error handling",
                    ],
                    code_examples={
                        "rest": "GET /api/v1/users?page=2&limit=50\nPOST /api/v1/users\nPUT /api/v1/users/{id}"
                    },
                    resources=[
                        "https://restfulapi.net/",
                        "https://www.vinaysahni.com/best-practices-for-a-pragmatic-restful-api",
                    ],
                )
            )

        # Performance best practices
        if project_arch.performance_requirements in ["high", "very_high"]:
            practices.append(
                BestPractice(
                    category="Performance",
                    title="Implement Circuit Breaker Pattern",
                    description="Use circuit breakers to prevent cascading failures",
                    rationale="Improves system resilience and prevents service degradation",
                    implementation_steps=[
                        "Configure timeout thresholds",
                        "Implement fallback mechanisms",
                        "Monitor failure rates",
                        "Set recovery strategies",
                    ],
                    anti_patterns=[
                        "No timeout configuration",
                        "Synchronous calls without fallbacks",
                        "Ignoring failure signals",
                    ],
                    code_examples={
                        "java": "// Using Resilience4j\nCircuitBreakerConfig config = CircuitBreakerConfig.custom()\n  .failureRateThreshold(50)\n  .waitDurationInOpenState(Duration.ofMillis(1000))\n  .ringBufferSizeInHalfOpenState(2)\n  .ringBufferSizeInClosedState(2)\n  .build();",
                        "python": "# Using circuitbreaker\nfrom circuitbreaker import circuit\n\n@circuit(failure_threshold=5, recovery_timeout=30)\ndef external_service_call():\n    ...",
                    },
                    resources=[
                        "https://martinfowler.com/bliki/CircuitBreaker.html",
                        "https://resilience4j.readme.io/",
                    ],
                )
            )

        return practices

    async def _recommend_performance_optimizations(
        self,
        project_arch: ProjectArchitecture,
        dependencies: Optional[List[Dict[str, Any]]],
    ) -> List[PerformanceRecommendation]:
        """Recommend performance optimizations."""
        recommendations = []

        # Dependency optimization
        if project_arch.dependency_count > 50:
            recommendations.append(
                PerformanceRecommendation(
                    component="Dependency Management",
                    issue="High number of dependencies may impact startup time and memory usage",
                    recommendation="Analyze and remove unused dependencies. Consider using lighter alternatives.",
                    expected_improvement="20-30% faster startup, reduced memory footprint",
                    implementation_effort=ComplexityLevel.LOW,
                    priority="high",
                    metrics={
                        "startup_time_improvement": 0.25,
                        "memory_reduction": 0.15,
                    },
                )
            )

        # Cross-language communication optimization
        if project_arch.cross_language_dependencies > 0:
            recommendations.append(
                PerformanceRecommendation(
                    component="Cross-Language Communication",
                    issue="Cross-language calls introduce overhead",
                    recommendation="Implement batching and caching for cross-language calls",
                    expected_improvement="40-60% reduction in communication overhead",
                    implementation_effort=ComplexityLevel.MEDIUM,
                    priority="medium",
                    metrics={"latency_reduction": 0.5, "throughput_improvement": 0.4},
                )
            )

        # Database connection optimization
        recommendations.append(
            PerformanceRecommendation(
                component="Database Connections",
                issue="Inefficient database connections across services",
                recommendation="Use connection pooling and implement read replicas for read-heavy workloads",
                expected_improvement="50-70% better database throughput",
                implementation_effort=ComplexityLevel.MEDIUM,
                priority="high",
                metrics={"query_latency": 0.4, "connection_efficiency": 0.6},
            )
        )

        return recommendations

    async def _detect_anti_patterns(
        self,
        project_arch: ProjectArchitecture,
        project_structure: Optional[Dict[str, Any]],
    ) -> List[str]:
        """Detect architectural anti-patterns."""
        anti_patterns = []

        # Check for potential monolith issues
        if project_arch.dependency_count > 200:
            anti_patterns.append("Large monolith with too many dependencies")

        # Check for distributed monolith
        if (
            len(project_arch.languages) > 1
            and project_arch.cross_language_dependencies > 10
        ):
            anti_patterns.append("Distributed monolith - services too tightly coupled")

        # Check for shared database anti-pattern
        # This would be detected from project structure analysis

        return anti_patterns

    def _analyze_project_structure(
        self, structure: Dict[str, Any]
    ) -> List[PatternMatch]:
        """Analyze project file structure for patterns."""
        patterns = []

        # This would analyze the actual file structure
        # Implementation depends on the structure format

        return patterns

    def _calculate_confidence(
        self, detected_patterns: List[PatternMatch], complexity_indicators: List[str]
    ) -> float:
        """Calculate overall confidence in the analysis."""
        if not detected_patterns:
            return 0.0

        # Base confidence from pattern detection
        base_confidence = np.mean([p.confidence for p in detected_patterns[:5]])

        # Adjust based on complexity indicators
        complexity_penalty = len(complexity_indicators) * 0.05

        return max(0.0, min(1.0, base_confidence - complexity_penalty))

    def _generate_migration_path(
        self,
        detected_patterns: List[PatternMatch],
        integration_recommendations: List[IntegrationPattern],
    ) -> Optional[str]:
        """Generate migration path recommendations."""
        if not detected_patterns and not integration_recommendations:
            return None

        # Simple migration path generation
        if any(p.pattern == ArchitecturePattern.MONOLITH for p in detected_patterns):
            return (
                "Phase 1: Identify service boundaries\n"
                "Phase 2: Extract core services\n"
                "Phase 3: Implement API gateway\n"
                "Phase 4: Gradual migration to microservices"
            )

        return None

    def _estimate_effort(
        self,
        integration_patterns: List[IntegrationPattern],
        best_practices: List[BestPractice],
        performance_recs: List[PerformanceRecommendation],
    ) -> str:
        """Estimate implementation effort."""
        total_effort = 0

        # Calculate effort from recommendations
        for pattern in integration_patterns:
            if pattern.implementation_complexity == ComplexityLevel.LOW:
                total_effort += 1
            elif pattern.implementation_complexity == ComplexityLevel.MEDIUM:
                total_effort += 3
            elif pattern.implementation_complexity == ComplexityLevel.HIGH:
                total_effort += 5
            elif pattern.implementation_complexity == ComplexityLevel.VERY_HIGH:
                total_effort += 8

        total_effort += len(best_practices) * 0.5
        total_effort += len(performance_recs) * 2

        if total_effort < 5:
            return "Low (1-2 weeks)"
        elif total_effort < 15:
            return "Medium (1-2 months)"
        elif total_effort < 30:
            return "High (3-4 months)"
        else:
            return "Very High (5+ months)"

    def _load_pattern_rules(self) -> Dict[str, Any]:
        """Load pattern recognition rules."""
        # In a real implementation, this would load from configuration
        return {}

    def _load_anti_patterns(self) -> Dict[str, Any]:
        """Load anti-pattern definitions."""
        # In a real implementation, this would load from configuration
        return {}

    def _load_best_practices(self) -> Dict[str, Any]:
        """Load best practice definitions."""
        # In a real implementation, this would load from configuration
        return {}

    def _load_integration_patterns(self) -> Dict[str, Any]:
        """Load integration pattern definitions."""
        # In a real implementation, this would load from configuration
        return {}

    # Example code generators
    def _get_rest_example(self) -> str:
        """Generate REST API example code."""
        return """# Spring Boot (Java)
@RestController
@RequestMapping("/api/v1/users")
public class UserController {

    @GetMapping("/{id}")
    public ResponseEntity<User> getUser(@PathVariable Long id) {
        User user = userService.findById(id);
        return ResponseEntity.ok(user);
    }

    @PostMapping
    public ResponseEntity<User> createUser(@RequestBody User user) {
        User created = userService.create(user);
        return ResponseEntity.created(URI.create("/api/v1/users/" + created.getId())).body(created);
    }
}

# FastAPI (Python)
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI()

class User(BaseModel):
    name: str
    email: str

@app.get("/api/v1/users/{user_id}")
async def get_user(user_id: int):
    user = await user_service.get_user(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@app.post("/api/v1/users")
async def create_user(user: User):
    return await user_service.create_user(user)
"""

    def _get_grpc_example(self) -> str:
        """Generate gRPC example code."""
        return """# Protocol Buffer definition
syntax = "proto3";

service UserService {
    rpc GetUser(GetUserRequest) returns (UserResponse);
    rpc CreateUser(CreateUserRequest) returns (UserResponse);
}

message GetUserRequest {
    int64 id = 1;
}

message UserResponse {
    int64 id = 1;
    string name = 2;
    string email = 3;
}

# Java gRPC Server
public class UserServiceImpl extends UserServiceGrpc.UserServiceImplBase {
    @Override
    public void getUser(GetUserRequest request, StreamObserver<UserResponse> responseObserver) {
        User user = userService.findById(request.getId());
        UserResponse response = UserResponse.newBuilder()
            .setId(user.getId())
            .setName(user.getName())
            .setEmail(user.getEmail())
            .build();
        responseObserver.onNext(response);
        responseObserver.onCompleted();
    }
}

# Python gRPC Client
import grpc
from user_pb2 import GetUserRequest
from user_pb2_grpc import UserServiceStub

channel = grpc.insecure_channel('localhost:50051')
stub = UserServiceStub(channel)

request = GetUserRequest(id=1)
response = stub.GetUser(request)
print(f"User: {response.name}, Email: {response.email}")
"""

    def _get_message_queue_example(self) -> str:
        """Generate message queue example code."""
        return """# Java with RabbitMQ
@Component
public class EventPublisher {

    @Autowired
    private RabbitTemplate rabbitTemplate;

    public void publishUserCreated(User user) {
        UserCreatedEvent event = new UserCreatedEvent(user.getId(), user.getName());
        rabbitTemplate.convertAndSend("user.exchange", "user.created", event);
    }
}

@RabbitListener(queues = "user.queue")
public void handleUserCreated(UserCreatedEvent event) {
    logger.info("Handling user created event: {}", event.getUserId());
    // Process event
}

# Python with Pika
import pika
import json

connection = pika.BlockingConnection(
    pika.ConnectionParameters('localhost'))
channel = connection.channel()

# Publish event
def publish_user_created(user_data):
    channel.basic_publish(
        exchange='user.exchange',
        routing_key='user.created',
        body=json.dumps(user_data),
        properties=pika.BasicProperties(
            delivery_mode=2,  # make message persistent
        ))
    print(" [x] Sent user created event")

# Consume events
def callback(ch, method, properties, body):
    event = json.loads(body)
    print(f" [x] Received user created: {event['user_id']}")
    # Process event

channel.basic_consume(
    queue='user.queue', on_message_callback=callback, auto_ack=True)

print(' [*] Waiting for messages. To exit press CTRL+C')
channel.start_consuming()
"""

    def _get_py4j_example(self) -> str:
        """Generate Py4J example code."""
        return """# Java Gateway
import py4j.GatewayServer;

public class PythonIntegrationGateway {
    public UserData getUser(long id) {
        // Implementation
        return userService.findById(id);
    }

    public static void main(String[] args) {
        GatewayServer gatewayServer = new GatewayServer(new PythonIntegrationGateway());
        gatewayServer.start();
        System.out.println("Gateway Server Started");
    }
}

# Python Client
from py4j.java_gateway import JavaGateway

# Connect to Java Gateway
gateway = JavaGateway.launch_gateway(classpath='.')

# Call Java methods
java_user = gateway.jvm.py4j.examples.UserData(1, "John Doe", "john@example.com")
print(f"User: {java_user.getName()}")

# Or connect to existing gateway
gateway = JavaGateway()  # Connect to default port 25333
user_service = gateway.entry_point
user = user_service.getUser(1)
print(f"Retrieved user from Java: {user.name}")
"""

    def _get_wasm_example(self) -> str:
        """Generate WebAssembly example code."""
        return """# Rust source for WASM
#[no_mangle]
pub extern "C" fn add_numbers(a: i32, b: i32) -> i32 {
    a + b
}

#[no_mangle]
pub extern "C" fn process_data(ptr: *const u8, len: usize) -> *const u8 {
    let data = unsafe {
        std::slice::from_raw_parts(ptr, len)
    };

    // Process data
    let result = format!("Processed: {:?}", data);

    // Return result
    Box::into_raw(result.into_boxed_str()) as *const u8
}

# Python using WASM
import wasmtime

# Load WASM module
engine = wasmtime.Engine()
module = wasmtime.Module.from_file(engine, "math_functions.wasm")

# Create instance
store = wasmtime.Store(engine)
instance = wasmtime.Instance(store, module, [])

# Get functions
add_func = instance.exports(store)["add_numbers"]
process_func = instance.exports(store)["process_data"]

# Call WASM functions
result = add_func(store, 5, 3)
print(f"5 + 3 = {result}")

# For data processing, you'd need proper memory management
# This is a simplified example
"""
