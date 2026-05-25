"""Base classes for bridge code generation."""

from __future__ import annotations

import abc
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional, Protocol

from pydantic import BaseModel


class BridgeType(str, Enum):
    """Types of bridges that can be generated."""

    PY4J = "py4j"  # Python to Java via Py4J
    REST_API = "rest_api"  # REST API client/server
    GRPC = "grpc"  # gRPC for high-performance RPC
    JNI = "jni"  # Java Native Interface
    CTYPES = "ctypes"  # Python to C via ctypes
    CFFI = "cffi"  # Python to C via CFFI
    WASM = "wasm"  # WebAssembly bridge


class Language(str, Enum):
    """Programming languages supported for bridge generation."""

    PYTHON = "python"
    JAVA = "java"
    KOTLIN = "kotlin"
    JAVASCRIPT = "javascript"
    TYPESCRIPT = "typescript"
    GO = "go"
    RUST = "rust"
    C = "c"
    CPP = "cpp"
    CSHARP = "csharp"


@dataclass
class MethodSignature:
    """Represents a method signature for bridge generation."""

    name: str
    return_type: str
    parameters: List[Parameter] = field(default_factory=list)
    is_async: bool = False
    docstring: Optional[str] = None
    throws: List[str] = field(default_factory=list)


@dataclass
class Parameter:
    """Represents a method parameter."""

    name: str
    type: str
    default_value: Optional[str] = None
    is_optional: bool = False
    docstring: Optional[str] = None


@dataclass
class InterfaceDefinition:
    """Represents an interface to be bridged."""

    name: str
    namespace: str
    methods: List[MethodSignature] = field(default_factory=list)
    docstring: Optional[str] = None
    extends: Optional[str] = None
    imports: List[str] = field(default_factory=list)


class BridgeConfig(BaseModel):
    """Configuration for bridge code generation."""

    bridge_type: BridgeType
    source_language: Language
    target_language: Language
    package_name: str
    output_dir: str
    interfaces: List[InterfaceDefinition] = []

    # Optional configuration
    base_port: int = 25333
    host: str = "127.0.0.1"
    namespace: str = "com.upm.bridge"
    generate_docs: bool = True
    generate_tests: bool = True
    include_example: bool = True

    # Advanced options
    use_async: bool = False
    enable_metrics: bool = True
    enable_logging: bool = True
    error_handling: str = "exception"  # exception, result, status

    model_config = {"arbitrary_types_allowed": True}


class TypeMapping(Protocol):
    """Protocol for type mapping between languages."""

    def map_type(self, source_type: str, target_language: Language) -> str:
        """Map a type from source to target language."""
        ...

    def map_default_value(
        self, value: str, target_type: str, target_language: Language
    ) -> str:
        """Map a default value to target language syntax."""
        ...


class DefaultTypeMapping:
    """Default type mappings between common languages."""

    # Python to Java type mappings
    PYTHON_TO_JAVA: Dict[str, str] = {
        "str": "String",
        "int": "Integer",
        "float": "Double",
        "bool": "Boolean",
        "list": "List<Object>",
        "dict": "Map<String, Object>",
        "Any": "Object",
        "None": "null",
        "bytes": "byte[]",
        "datetime": "java.time.Instant",
        "uuid.UUID": "java.util.UUID",
    }

    # Java to Python type mappings
    JAVA_TO_PYTHON: Dict[str, str] = {
        "String": "str",
        "Integer": "int",
        "int": "int",
        "Double": "float",
        "double": "float",
        "Boolean": "bool",
        "boolean": "bool",
        "List": "list",
        "Map": "dict",
        "Object": "Any",
        "byte[]": "bytes",
        "Instant": "datetime.datetime",
        "UUID": "uuid.UUID",
        "void": "None",
    }

    # JavaScript/TypeScript to Python
    JS_TO_PYTHON: Dict[str, str] = {
        "string": "str",
        "number": "float",
        "boolean": "bool",
        "any": "Any",
        "unknown": "Any",
        "Array": "list",
        "Object": "dict",
        "Date": "datetime.datetime",
        "null": "None",
        "undefined": "None",
        "void": "None",
    }

    @classmethod
    def map_type(cls, source_type: str, target_language: Language) -> str:
        """Map a type from source to target language."""
        # Handle generic types (e.g., List<String>, Map<K,V>)
        if "<" in source_type:
            base_type = source_type.split("<")[0]
            generic_part = source_type[
                source_type.index("<") + 1 : source_type.rindex(">")
            ]
            generics = [
                cls.map_type(g.strip(), target_language)
                for g in generic_part.split(",")
            ]
            mapped_base = cls._map_simple_type(base_type, target_language)
            return f"{mapped_base}<{', '.join(generics)}>"

        return cls._map_simple_type(source_type, target_language)

    @classmethod
    def _map_simple_type(cls, source_type: str, target_language: Language) -> str:
        """Map a simple (non-generic) type."""
        if target_language == Language.JAVA:
            return cls.PYTHON_TO_JAVA.get(source_type, source_type)
        elif target_language == Language.PYTHON:
            return cls.JAVA_TO_PYTHON.get(source_type, source_type)
        elif target_language == Language.TYPESCRIPT:
            return cls._map_to_typescript(source_type)
        elif target_language == Language.GO:
            return cls._map_to_go(source_type)
        return source_type

    @classmethod
    def _map_to_typescript(cls, source_type: str) -> str:
        """Map type to TypeScript."""
        mappings: Dict[str, str] = {
            "str": "string",
            "int": "number",
            "float": "number",
            "bool": "boolean",
            "list": "Array<any>",
            "dict": "Record<string, any>",
            "Any": "any",
            "None": "null",
            "bytes": "Uint8Array",
        }
        return mappings.get(source_type, source_type)

    @classmethod
    def _map_to_go(cls, source_type: str) -> str:
        """Map type to Go."""
        mappings: Dict[str, str] = {
            "str": "string",
            "int": "int",
            "float": "float64",
            "bool": "bool",
            "list": "[]interface{}",
            "dict": "map[string]interface{}",
            "Any": "interface{}",
            "None": "",
            "bytes": "[]byte",
        }
        return mappings.get(source_type, source_type)

    @classmethod
    def map_default_value(
        cls, value: str, target_type: str, target_language: Language
    ) -> str:
        """Map a default value to target language syntax."""
        if value == "None" or value == "null":
            if target_language in (Language.JAVA, Language.KOTLIN):
                return "null"
            elif target_language in (Language.JAVASCRIPT, Language.TYPESCRIPT):
                return "null"
            return "None"

        if value == "True" or value == "true":
            if target_language in (Language.JAVA, Language.KOTLIN):
                return "true"
            return "True"

        if value == "False" or value == "false":
            if target_language in (Language.JAVA, Language.KOTLIN):
                return "false"
            return "False"

        if value == "[]" or value == "list()":
            if target_language in (Language.JAVA, Language.KOTLIN):
                return f"new ArrayList<>()"
            elif target_language == Language.GO:
                return f"[]{target_type}{{}}"
            return "[]"

        if value == "{}" or value == "dict()":
            if target_language in (Language.JAVA, Language.KOTLIN):
                return f"new HashMap<>()"
            elif target_language == Language.GO:
                return f"map[string]{target_type[4:-1]}{{}}"
            return "{}"

        # String literals
        if value.startswith("'") or value.startswith('"'):
            return value

        # Numeric values
        try:
            float(value)
            return value
        except ValueError:
            pass

        return value


class BridgeTemplate(abc.ABC):
    """Abstract base class for bridge code templates."""

    def __init__(self, config: BridgeConfig) -> None:
        self.config = config
        self.type_mapper = DefaultTypeMapping()

    @abc.abstractmethod
    def generate_server_code(self, interface: InterfaceDefinition) -> str:
        """Generate server-side code for the interface."""

    @abc.abstractmethod
    def generate_client_code(self, interface: InterfaceDefinition) -> str:
        """Generate client-side code for the interface."""

    @abc.abstractmethod
    def generate_build_config(self) -> str:
        """Generate build configuration (e.g., pom.xml, build.gradle)."""

    def map_type(self, source_type: str) -> str:
        """Map a type from source to target language."""
        return self.type_mapper.map_type(source_type, self.config.target_language)

    def format_method_name(self, name: str, for_language: Language) -> str:
        """Format method name for target language conventions."""
        if for_language in (Language.JAVA, Language.KOTLIN, Language.CSHARP):
            # Convert snake_case to camelCase
            parts = name.split("_")
            return parts[0] + "".join(p.capitalize() for p in parts[1:])
        elif for_language == Language.GO:
            # Convert to PascalCase for exported functions
            return "".join(p.capitalize() for p in name.split("_"))
        return name

    def generate_imports(self, interface: InterfaceDefinition) -> List[str]:
        """Generate import statements for the interface."""
        imports = set(interface.imports)

        # Add standard imports based on types used
        for method in interface.methods:
            for param in method.parameters:
                self._collect_type_imports(param.type, imports)
            self._collect_type_imports(method.return_type, imports)

        return sorted(imports)

    def _collect_type_imports(self, type_str: str, imports: set[str]) -> None:
        """Collect imports needed for a type."""
        # Handle generic types
        base_type = type_str.split("<")[0].strip()

        standard_imports = {
            "List": "java.util.List",
            "Map": "java.util.Map",
            "ArrayList": "java.util.ArrayList",
            "HashMap": "java.util.HashMap",
            "UUID": "java.util.UUID",
            "Instant": "java.time.Instant",
        }

        if base_type in standard_imports:
            imports.add(standard_imports[base_type])
