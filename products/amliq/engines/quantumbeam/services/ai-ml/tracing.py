"""
Distributed Tracing for AI/ML Services

Comprehensive OpenTelemetry tracing implementation for Python AI/ML services
with automatic instrumentation and custom spans for quantum algorithms.
"""

import os
import sys
import time
import json
import logging
import traceback
from typing import Dict, List, Optional, Any, Callable
from contextlib import contextmanager
from functools import wraps
from dataclasses import dataclass, asdict
from datetime import datetime

# OpenTelemetry imports
from opentelemetry import trace, baggage, context
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.exporter.jaeger.thrift import JaegerExporter
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.sdk.resources import Resource
from opentelemetry.semconv.trace import SpanAttributes
from opentelemetry.instrumentation.flask import FlaskInstrumentor
from opentelemetry.instrumentation.requests import RequestsInstrumentor
from opentelemetry.instrumentation.urllib3 import URLLib3Instrumentor
from opentelemetry.instrumentation.redis import RedisInstrumentor
from opentelemetry.instrumentation.psycopg2 import Psycopg2Instrumentor
from opentelemetry.propagate import set_global_textmap
from opentelemetry.propagators.b3 import B3MultiFormat
from opentelemetry.propagators.composite import CompositePropagator

# AI/ML framework imports
import numpy as np
import torch
import tensorflow as tf
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score


@dataclass
class TracingConfig:
    """Configuration for distributed tracing"""
    enabled: bool = True
    service_name: str = "ai-ml-service"
    service_version: str = "1.0.0"
    environment: str = "production"
    sampling_rate: float = 0.1
    jaeger_endpoint: Optional[str] = None
    otlp_endpoint: Optional[str] = None
    otlp_headers: Optional[Dict[str, str]] = None
    batch_size: int = 512
    batch_timeout: float = 5.0
    export_timeout: float = 30.0
    debug: bool = False
    propagators: List[str] = None
    resource_attributes: Dict[str, str] = None

    def __post_init__(self):
        if self.propagators is None:
            self.propagators = ["tracecontext", "baggage", "b3"]
        if self.resource_attributes is None:
            self.resource_attributes = {}


@dataclass
class SpanContext:
    """Context information for spans"""
    trace_id: Optional[str] = None
    span_id: Optional[str] = None
    parent_span_id: Optional[str] = None
    baggage: Optional[Dict[str, str]] = None
    correlation_id: Optional[str] = None
    user_id: Optional[str] = None
    session_id: Optional[str] = None
    request_id: Optional[str] = None


@dataclass
class MLModelMetrics:
    """Metrics for ML model operations"""
    model_name: str
    model_version: str
    input_shape: Optional[tuple] = None
    output_shape: Optional[tuple] = None
    parameters_count: Optional[int] = None
    inference_time_ms: Optional[float] = None
    accuracy: Optional[float] = None
    precision: Optional[float] = None
    recall: Optional[float] = None
    f1_score: Optional[float] = None
    loss: Optional[float] = None
    batch_size: Optional[int] = None
    device: Optional[str] = None
    memory_usage_mb: Optional[float] = None


@dataclass
class QuantumAlgorithmMetrics:
    """Metrics for quantum algorithm operations"""
    algorithm_name: str
    qubits_count: int
    circuit_depth: int
    execution_time_ms: float
    success_probability: Optional[float] = None
    fidelity: Optional[float] = None
    noise_level: Optional[float] = None
    optimization_iterations: Optional[int] = None
    quantum_backend: Optional[str] = None
    measurement_outcomes: Optional[Dict[str, float]] = None


class AITracingService:
    """Distributed tracing service for AI/ML applications"""

    def __init__(self, config: TracingConfig):
        self.config = config
        self.logger = self._setup_logger()
        self.tracer_provider: Optional[TracerProvider] = None
        self.tracer = None

        if config.enabled:
            self._initialize_tracing()
            self._setup_auto_instrumentation()

    def _setup_logger(self) -> logging.Logger:
        """Setup structured logger"""
        logger = logging.getLogger("ai-ml-tracing")
        logger.setLevel(logging.INFO if not self.config.debug else logging.DEBUG)

        handler = logging.StreamHandler()
        formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        handler.setFormatter(formatter)
        logger.addHandler(handler)

        return logger

    def _initialize_tracing(self):
        """Initialize OpenTelemetry tracing"""
        try:
            # Create resource with service information
            resource = Resource.create(
                attributes={
                    "service.name": self.config.service_name,
                    "service.version": self.config.service_version,
                    "environment": self.config.environment,
                    "service.instance.id": self._get_instance_id(),
                    "host.name": self._get_hostname(),
                    "process.pid": str(os.getpid()),
                    **self.config.resource_attributes
                }
            )

            # Create tracer provider
            self.tracer_provider = TracerProvider(resource=resource)
            trace.set_tracer_provider(self.tracer_provider)

            # Setup exporters
            self._setup_exporters()

            # Setup propagators
            self._setup_propagators()

            # Get tracer
            self.tracer = trace.get_tracer(__name__)

            self.logger.info("OpenTelemetry tracing initialized successfully")

        except Exception as e:
            self.logger.error(f"Failed to initialize tracing: {e}")
            if self.config.debug:
                self.logger.error(traceback.format_exc())

    def _setup_exporters(self):
        """Setup trace exporters"""
        if not self.tracer_provider:
            return

        processors = []

        # Jaeger exporter
        if self.config.jaeger_endpoint:
            try:
                jaeger_exporter = JaegerExporter(
                    endpoint=self.config.jaeger_endpoint,
                    collector_endpoint=self.config.jaeger_endpoint,
                )

                jaeger_processor = BatchSpanProcessor(
                    jaeger_exporter,
                    max_export_batch_size=self.config.batch_size,
                    schedule_delay_millis=int(self.config.batch_timeout * 1000),
                    export_timeout_millis=int(self.config.export_timeout * 1000)
                )
                processors.append(jaeger_processor)
                self.logger.info(f"Jaeger exporter configured: {self.config.jaeger_endpoint}")

            except Exception as e:
                self.logger.error(f"Failed to setup Jaeger exporter: {e}")

        # OTLP exporter
        if self.config.otlp_endpoint:
            try:
                otlp_headers = self.config.otlp_headers or {}
                otlp_exporter = OTLPSpanExporter(
                    endpoint=self.config.otlp_endpoint,
                    headers=otlp_headers
                )

                otlp_processor = BatchSpanProcessor(
                    otlp_exporter,
                    max_export_batch_size=self.config.batch_size,
                    schedule_delay_millis=int(self.config.batch_timeout * 1000),
                    export_timeout_millis=int(self.config.export_timeout * 1000)
                )
                processors.append(otlp_processor)
                self.logger.info(f"OTLP exporter configured: {self.config.otlp_endpoint}")

            except Exception as e:
                self.logger.error(f"Failed to setup OTLP exporter: {e}")

        # Add processors to tracer provider
        for processor in processors:
            self.tracer_provider.add_span_processor(processor)

    def _setup_propagators(self):
        """Setup context propagators"""
        propagators = []

        for propagator_name in self.config.propagators:
            if propagator_name == "tracecontext":
                from opentelemetry.propagators.tracecontext import TraceContext propagators.append(TraceContext())
            elif propagator_name == "baggage":
                from opentelemetry.propagators.baggage import BaggagePropagator
                propagators.append(BaggagePropagator())
            elif propagator_name == "b3":
                propagators.append(B3MultiFormat())

        if propagators:
            composite_propagator = CompositePropagator(propagators)
            set_global_textmap(composite_propagator)
            self.logger.info(f"Propagators configured: {self.config.propagators}")

    def _setup_auto_instrumentation(self):
        """Setup automatic instrumentation for common libraries"""
        try:
            # Flask
            try:
                FlaskInstrumentor().instrument()
                self.logger.info("Flask instrumentation enabled")
            except ImportError:
                pass

            # Requests
            try:
                RequestsInstrumentor().instrument()
                self.logger.info("Requests instrumentation enabled")
            except ImportError:
                pass

            # Redis
            try:
                RedisInstrumentor().instrument()
                self.logger.info("Redis instrumentation enabled")
            except ImportError:
                pass

            # PostgreSQL
            try:
                Psycopg2Instrumentor().instrument()
                self.logger.info("PostgreSQL instrumentation enabled")
            except ImportError:
                pass

            # URL lib
            try:
                URLLib3Instrumentor().instrument()
                self.logger.info("urllib3 instrumentation enabled")
            except ImportError:
                pass

        except Exception as e:
            self.logger.error(f"Failed to setup auto-instrumentation: {e}")

    def _get_instance_id(self) -> str:
        """Get unique instance ID"""
        import uuid
        return str(uuid.uuid4())

    def _get_hostname(self) -> str:
        """Get hostname"""
        import socket
        return socket.gethostname()

    def start_span(self, name: str, **attributes) -> trace.Span:
        """Start a new span"""
        if not self.tracer:
            return trace.get_current_span()

        span = self.tracer.start_span(name, attributes=attributes)
        return span

    def add_span_attributes(self, span: trace.Span, **attributes):
        """Add attributes to a span"""
        if span:
            for key, value in attributes.items():
                if isinstance(value, (str, int, float, bool)):
                    span.set_attribute(key, value)
                else:
                    span.set_attribute(key, str(value))

    def add_span_event(self, span: trace.Span, name: str, **attributes):
        """Add an event to a span"""
        if span:
            span.add_event(name, attributes=attributes)

    def record_exception(self, span: trace.Span, exception: Exception):
        """Record an exception in a span"""
        if span:
            span.record_exception(exception)

    @contextmanager
    def trace_span(self, name: str, **attributes):
        """Context manager for tracing operations"""
        if not self.tracer:
            yield
            return

        span = self.start_span(name, **attributes)
        try:
            yield span
        except Exception as e:
            self.record_exception(span, e)
            raise
        finally:
            span.end()

    def trace_function(self, name: Optional[str] = None):
        """Decorator for tracing functions"""
        def decorator(func: Callable) -> Callable:
            span_name = name or f"{func.__module__}.{func.__name__}"

            @wraps(func)
            def wrapper(*args, **kwargs):
                if not self.tracer:
                    return func(*args, **kwargs)

                with self.trace_span(
                    span_name,
                    function_name=func.__name__,
                    module=func.__module__,
                    args_count=len(args),
                    kwargs_count=len(kwargs)
                ):
                    return func(*args, **kwargs)

            return wrapper
        return decorator

    def trace_ml_inference(self, model_name: str, model_version: str):
        """Decorator for tracing ML model inference"""
        def decorator(func: Callable) -> Callable:
            @wraps(func)
            def wrapper(*args, **kwargs):
                if not self.tracer:
                    return func(*args, **kwargs)

                start_time = time.time()
                model_metrics = MLModelMetrics(
                    model_name=model_name,
                    model_version=model_version,
                    batch_size=kwargs.get('batch_size'),
                    device=self._get_device_info()
                )

                with self.trace_span(
                    f"ml.inference.{model_name}",
                    ml_model_name=model_name,
                    ml_model_version=model_version,
                    ml_operation="inference"
                ) as span:
                    try:
                        # Record input shape if available
                        if args and hasattr(args[0], 'shape'):
                            model_metrics.input_shape = args[0].shape
                            span.set_attribute("ml.input_shape", str(args[0].shape))

                        # Execute inference
                        result = func(*args, **kwargs)

                        # Record output shape if available
                        if hasattr(result, 'shape'):
                            model_metrics.output_shape = result.shape
                            span.set_attribute("ml.output_shape", str(result.shape))

                        # Calculate inference time
                        inference_time = (time.time() - start_time) * 1000
                        model_metrics.inference_time_ms = inference_time
                        span.set_attribute("ml.inference_time_ms", inference_time)

                        # Calculate metrics if labels are provided
                        if 'labels' in kwargs and 'predictions' in locals():
                            labels = kwargs['labels']
                            predictions = result
                            model_metrics.accuracy = accuracy_score(labels, predictions)
                            model_metrics.precision = precision_score(labels, predictions, average='weighted')
                            model_metrics.recall = recall_score(labels, predictions, average='weighted')
                            model_metrics.f1_score = f1_score(labels, predictions, average='weighted')

                            span.set_attribute("ml.accuracy", model_metrics.accuracy)
                            span.set_attribute("ml.precision", model_metrics.precision)
                            span.set_attribute("ml.recall", model_metrics.recall)
                            span.set_attribute("ml.f1_score", model_metrics.f1_score)

                        # Record memory usage
                        try:
                            import psutil
                            process = psutil.Process()
                            memory_mb = process.memory_info().rss / 1024 / 1024
                            model_metrics.memory_usage_mb = memory_mb
                            span.set_attribute("ml.memory_usage_mb", memory_mb)
                        except ImportError:
                            pass

                        # Add model metrics to span
                        self._add_ml_metrics_to_span(span, model_metrics)

                        return result

                    except Exception as e:
                        span.set_attribute("ml.error", str(e))
                        span.set_status(trace.Status(trace.StatusCode.ERROR, str(e)))
                        raise

            return wrapper
        return decorator

    def trace_quantum_algorithm(self, algorithm_name: str):
        """Decorator for tracing quantum algorithm execution"""
        def decorator(func: Callable) -> Callable:
            @wraps(func)
            def wrapper(*args, **kwargs):
                if not self.tracer:
                    return func(*args, **kwargs)

                start_time = time.time()

                with self.trace_span(
                    f"quantum.algorithm.{algorithm_name}",
                    quantum_algorithm_name=algorithm_name,
                    quantum_operation="execution"
                ) as span:
                    try:
                        # Extract quantum parameters
                        qubits_count = kwargs.get('qubits_count', len(args[0]) if args and hasattr(args[0], '__len__') else 0)
                        circuit_depth = kwargs.get('circuit_depth', 0)

                        # Execute algorithm
                        result = func(*args, **kwargs)

                        # Calculate execution time
                        execution_time = (time.time() - start_time) * 1000

                        # Create metrics
                        quantum_metrics = QuantumAlgorithmMetrics(
                            algorithm_name=algorithm_name,
                            qubits_count=qubits_count,
                            circuit_depth=circuit_depth,
                            execution_time_ms=execution_time
                        )

                        # Extract additional metrics from result
                        if isinstance(result, dict):
                            quantum_metrics.success_probability = result.get('success_probability')
                            quantum_metrics.fidelity = result.get('fidelity')
                            quantum_metrics.noise_level = result.get('noise_level')
                            quantum_metrics.optimization_iterations = result.get('iterations')
                            quantum_metrics.measurement_outcomes = result.get('outcomes')
                        elif hasattr(result, 'success_probability'):
                            quantum_metrics.success_probability = result.success_probability

                        # Add quantum metrics to span
                        self._add_quantum_metrics_to_span(span, quantum_metrics)

                        return result

                    except Exception as e:
                        span.set_attribute("quantum.error", str(e))
                        span.set_status(trace.Status(trace.StatusCode.ERROR, str(e)))
                        raise

            return wrapper
        return decorator

    def trace_data_preprocessing(self, operation_name: str):
        """Decorator for tracing data preprocessing operations"""
        def decorator(func: Callable) -> Callable:
            @wraps(func)
            def wrapper(*args, **kwargs):
                if not self.tracer:
                    return func(*args, **kwargs)

                start_time = time.time()

                with self.trace_span(
                    f"data.preprocessing.{operation_name}",
                    data_operation=operation_name,
                    data_stage="preprocessing"
                ) as span:
                    try:
                        # Record input data info
                        if args:
                            input_data = args[0]
                            if hasattr(input_data, 'shape'):
                                span.set_attribute("data.input_shape", str(input_data.shape))
                                span.set_attribute("data.input_size", input_data.size)
                            elif hasattr(input_data, '__len__'):
                                span.set_attribute("data.input_count", len(input_data))

                        # Execute preprocessing
                        result = func(*args, **kwargs)

                        # Record output data info
                        if hasattr(result, 'shape'):
                            span.set_attribute("data.output_shape", str(result.shape))
                            span.set_attribute("data.output_size", result.size)
                        elif hasattr(result, '__len__'):
                            span.set_attribute("data.output_count", len(result))

                        # Record processing time
                        processing_time = (time.time() - start_time) * 1000
                        span.set_attribute("data.processing_time_ms", processing_time)

                        return result

                    except Exception as e:
                        span.set_attribute("data.error", str(e))
                        span.set_status(trace.Status(trace.StatusCode.ERROR, str(e)))
                        raise

            return wrapper
        return decorator

    def _get_device_info(self) -> str:
        """Get ML device information"""
        try:
            if torch.cuda.is_available():
                return f"cuda:{torch.cuda.current_device()}"
            elif hasattr(tf.config, 'list_physical_devices'):
                gpus = tf.config.list_physical_devices('GPU')
                if gpus:
                    return f"gpu:{len(gpus)}"
            return "cpu"
        except Exception:
            return "unknown"

    def _add_ml_metrics_to_span(self, span: trace.Span, metrics: MLModelMetrics):
        """Add ML model metrics to span"""
        for key, value in asdict(metrics).items():
            if value is not None:
                span.set_attribute(f"ml.{key}", value)

    def _add_quantum_metrics_to_span(self, span: trace.Span, metrics: QuantumAlgorithmMetrics):
        """Add quantum algorithm metrics to span"""
        for key, value in asdict(metrics).items():
            if value is not None:
                span.set_attribute(f"quantum.{key}", value)

    def extract_trace_context(self, headers: Dict[str, str]) -> SpanContext:
        """Extract trace context from HTTP headers"""
        try:
            # Use OpenTelemetry propagator to extract context
            from opentelemetry.propagate import extract

            ctx = extract(headers)
            span_ctx = trace.get_current_span(ctx).get_span_context() if trace.get_current_span(ctx) else None

            if span_ctx:
                return SpanContext(
                    trace_id=span_ctx.trace_id,
                    span_id=span_ctx.span_id,
                    correlation_id=headers.get('X-Correlation-ID'),
                    user_id=headers.get('X-User-ID'),
                    session_id=headers.get('X-Session-ID'),
                    request_id=headers.get('X-Request-ID')
                )
        except Exception as e:
            self.logger.error(f"Failed to extract trace context: {e}")

        return SpanContext()

    def inject_trace_context(self, headers: Dict[str, str]) -> Dict[str, str]:
        """Inject trace context into HTTP headers"""
        try:
            from opentelemetry.propagate import inject

            if not headers:
                headers = {}

            inject(headers)

            # Add additional headers
            current_span = trace.get_current_span()
            if current_span:
                span_ctx = current_span.get_span_context()
                if span_ctx:
                    headers['X-Trace-ID'] = format(span_ctx.trace_id, '032x')
                    headers['X-Span-ID'] = format(span_ctx.span_id, '016x')
                    headers['X-Sampled'] = str(span_ctx.trace_flags.sampled)

            return headers

        except Exception as e:
            self.logger.error(f"Failed to inject trace context: {e}")
            return headers or {}

    def get_trace_id(self) -> Optional[str]:
        """Get current trace ID"""
        current_span = trace.get_current_span()
        if current_span:
            span_ctx = current_span.get_span_context()
            if span_ctx:
                return format(span_ctx.trace_id, '032x')
        return None

    def get_span_id(self) -> Optional[str]:
        """Get current span ID"""
        current_span = trace.get_current_span()
        if current_span:
            span_ctx = current_span.get_span_context()
            if span_ctx:
                return format(span_ctx.span_id, '016x')
        return None

    def shutdown(self):
        """Shutdown the tracing service"""
        if self.tracer_provider:
            try:
                self.tracer_provider.shutdown()
                self.logger.info("Tracing service shutdown successfully")
            except Exception as e:
                self.logger.error(f"Failed to shutdown tracing service: {e}")


# Global tracing service instance
_tracing_service: Optional[AITracingService] = None


def initialize_tracing(config: Optional[TracingConfig] = None) -> AITracingService:
    """Initialize the global tracing service"""
    global _tracing_service

    if config is None:
        config = TracingConfig(
            service_name=os.getenv("OTEL_SERVICE_NAME", "ai-ml-service"),
            environment=os.getenv("OTEL_ENVIRONMENT", "production"),
            jaeger_endpoint=os.getenv("JAEGER_ENDPOINT"),
            otlp_endpoint=os.getenv("OTEL_ENDPOINT"),
            sampling_rate=float(os.getenv("OTEL_SAMPLING_RATE", "0.1")),
            debug=os.getenv("OTEL_DEBUG", "false").lower() == "true"
        )

    _tracing_service = AITracingService(config)
    return _tracing_service


def get_tracing_service() -> Optional[AITracingService]:
    """Get the global tracing service"""
    return _tracing_service


def trace_function(name: Optional[str] = None):
    """Decorator for tracing functions"""
    tracing = get_tracing_service()
    if tracing:
        return tracing.trace_function(name)
    else:
        def decorator(func):
            return func
        return decorator


def trace_ml_inference(model_name: str, model_version: str = "1.0.0"):
    """Decorator for tracing ML model inference"""
    tracing = get_tracing_service()
    if tracing:
        return tracing.trace_ml_inference(model_name, model_version)
    else:
        def decorator(func):
            return func
        return decorator


def trace_quantum_algorithm(algorithm_name: str):
    """Decorator for tracing quantum algorithm execution"""
    tracing = get_tracing_service()
    if tracing:
        return tracing.trace_quantum_algorithm(algorithm_name)
    else:
        def decorator(func):
            return func
        return decorator


def trace_data_preprocessing(operation_name: str):
    """Decorator for tracing data preprocessing operations"""
    tracing = get_tracing_service()
    if tracing:
        return tracing.trace_data_preprocessing(operation_name)
    else:
        def decorator(func):
            return func
        return decorator


@contextmanager
def trace_span(name: str, **attributes):
    """Context manager for tracing operations"""
    tracing = get_tracing_service()
    if tracing:
        with tracing.trace_span(name, **attributes):
            yield
    else:
        yield


# Flask integration
def setup_flask_tracing(app, config: Optional[TracingConfig] = None):
    """Setup tracing for Flask application"""
    tracing = initialize_tracing(config)

    if tracing:
        # Auto-instrument Flask
        try:
            FlaskInstrumentor().instrument_app(app)
            tracing.logger.info("Flask application instrumented for tracing")
        except Exception as e:
            tracing.logger.error(f"Failed to instrument Flask: {e}")

        # Add tracing middleware
        @app.before_request
        def before_request():
            # Extract trace context from headers
            trace_ctx = tracing.extract_trace_context(dict(app.request.headers))

            # Add context to Flask request
            app.request.trace_context = trace_ctx
            app.request.trace_id = trace_ctx.trace_id
            app.request.correlation_id = trace_ctx.correlation_id

        @app.after_request
        def after_request(response):
            # Add tracing headers to response
            if hasattr(app.request, 'trace_id') and app.request.trace_id:
                response.headers['X-Trace-ID'] = app.request.trace_id

            return response

    return tracing


# FastAPI integration
def setup_fastapi_tracing(app, config: Optional[TracingConfig] = None):
    """Setup tracing for FastAPI application"""
    tracing = initialize_tracing(config)

    if tracing:
        # Auto-instrument FastAPI
        try:
            from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
            FastAPIInstrumentor().instrument_app(app)
            tracing.logger.info("FastAPI application instrumented for tracing")
        except ImportError:
            tracing.logger.warning("FastAPI instrumentation not available")
        except Exception as e:
            tracing.logger.error(f"Failed to instrument FastAPI: {e}")

    return tracing


# Example usage and convenience functions
def example_ml_usage():
    """Example of how to use ML tracing"""

    # Initialize tracing
    tracing = initialize_tracing()

    # Method 1: Using decorators
    @trace_ml_inference("fraud_detector", "2.1.0")
    def predict_fraud(features):
        """Fraud detection model inference"""
        # Your ML code here
        return model.predict(features)

    # Method 2: Using context manager
    def batch_inference(data_batch):
        with trace_span("ml.batch_inference", batch_size=len(data_batch)):
            results = []
            for item in data_batch:
                with trace_span("ml.single_inference"):
                    result = model.predict(item)
                    results.append(result)
            return results

    # Method 3: Manual tracing
    def complex_ml_pipeline(input_data):
        span = tracing.start_span("ml.complex_pipeline")
        tracing.add_span_attributes(span, pipeline_stage="preprocessing")

        try:
            # Preprocessing
            with trace_span("data.preprocessing"):
                processed_data = preprocess(input_data)

            # Feature extraction
            with trace_span("ml.feature_extraction"):
                features = extract_features(processed_data)

            # Inference
            with trace_span("ml.inference"):
                predictions = model.predict(features)

            # Post-processing
            with trace_span("ml.post_processing"):
                results = postprocess(predictions)

            return results

        except Exception as e:
            tracing.record_exception(span, e)
            raise
        finally:
            span.end()


def example_quantum_usage():
    """Example of how to use quantum algorithm tracing"""

    tracing = initialize_tracing()

    @trace_quantum_algorithm("grover_search")
    def grover_search(target_state, num_qubits):
        """Grover's quantum search algorithm"""
        # Quantum algorithm implementation
        return quantum_circuit.execute()


# Initialize tracing when module is imported
if os.getenv("OTEL_AUTO_INITIALIZE", "true").lower() == "true":
    initialize_tracing()