"""
Workflow Templates Pydantic Schemas

Request and response schemas for workflow template management including:
- Template CRUD operations
- Component management
- Versioning and rating
- Search and filtering
"""

import uuid
from datetime import datetime
from typing import Dict, List, Optional, Any, Union
from enum import Enum

from pydantic import BaseModel, Field, validator, EmailStr


# Enums
class TemplateStatusEnum(str, Enum):
    DRAFT = "draft"
    PUBLISHED = "published"
    ARCHIVED = "archived"
    DEPRECATED = "deprecated"


class ComponentStatusEnum(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    DEPRECATED = "deprecated"


class ComponentTypeEnum(str, Enum):
    ACTION = "action"
    TRIGGER = "trigger"
    CONDITION = "condition"
    TRANSFORM = "transform"
    INTEGRATION = "integration"
    UTILITY = "utility"
    CUSTOM = "custom"


class DifficultyLevelEnum(str, Enum):
    BEGINNER = "beginner"
    INTERMEDIATE = "intermediate"
    ADVANCED = "advanced"
    EXPERT = "expert"


class UsageTypeEnum(str, Enum):
    VIEW = "view"
    INSTANTIATE = "instantiate"
    DOWNLOAD = "download"


# Template Schemas

class TemplateVariableSchema(BaseModel):
    """Schema for template variables."""
    name: str = Field(..., description="Variable name")
    type: str = Field(..., description="Variable type (string, number, boolean, etc.)")
    description: Optional[str] = Field(None, description="Variable description")
    required: bool = Field(True, description="Whether variable is required")
    default_value: Optional[Any] = Field(None, description="Default value for variable")
    validation: Optional[Dict[str, Any]] = Field(None, description="Validation rules")


class WorkflowTemplateCreate(BaseModel):
    """Schema for creating a workflow template."""
    name: str = Field(..., min_length=1, max_length=255, description="Template name")
    description: Optional[str] = Field(None, description="Template description")
    definition: Dict[str, Any] = Field(..., description="Workflow definition")
    category: str = Field(..., description="Template category")
    tags: Optional[List[str]] = Field(default_factory=list, description="Template tags")
    difficulty_level: DifficultyLevelEnum = Field(DifficultyLevelEnum.BEGINNER, description="Difficulty level")
    estimated_runtime: Optional[str] = Field(None, description="Estimated runtime")
    variables: Optional[List[TemplateVariableSchema]] = Field(default_factory=list, description="Template variables")
    is_public: bool = Field(False, description="Whether template is public")

    @validator('definition')
    def validate_definition(cls, v):
        if not isinstance(v, dict):
            raise ValueError('Definition must be a dictionary')
        if 'nodes' not in v:
            raise ValueError('Definition must contain nodes')
        return v


class WorkflowTemplateUpdate(BaseModel):
    """Schema for updating a workflow template."""
    name: Optional[str] = Field(None, min_length=1, max_length=255, description="Template name")
    description: Optional[str] = Field(None, description="Template description")
    definition: Optional[Dict[str, Any]] = Field(None, description="Workflow definition")
    category: Optional[str] = Field(None, description="Template category")
    tags: Optional[List[str]] = Field(None, description="Template tags")
    difficulty_level: Optional[DifficultyLevelEnum] = Field(None, description="Difficulty level")
    estimated_runtime: Optional[str] = Field(None, description="Estimated runtime")
    variables: Optional[List[TemplateVariableSchema]] = Field(None, description="Template variables")
    is_public: Optional[bool] = Field(None, description="Whether template is public")


class TemplateVersionSchema(BaseModel):
    """Schema for template version information."""
    version: str = Field(..., description="Version number")
    changelog: Optional[str] = Field(None, description="Version changelog")
    created_at: datetime = Field(..., description="Version creation date")
    created_by: uuid.UUID = Field(..., description="User who created version")


class TemplateRatingSchema(BaseModel):
    """Schema for template rating."""
    rating: int = Field(..., ge=1, le=5, description="Rating (1-5 stars)")
    review: Optional[str] = Field(None, description="Optional review text")
    helpful_count: int = Field(0, description="Number of helpful votes")
    created_at: datetime = Field(..., description="Rating date")
    user_id: uuid.UUID = Field(..., description="User who rated")


class UserInfoSchema(BaseModel):
    """Schema for user information."""
    id: uuid.UUID
    email: str
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None


class CategorySchema(BaseModel):
    """Schema for category information."""
    id: uuid.UUID
    name: str
    description: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None


class WorkflowTemplateResponse(BaseModel):
    """Schema for workflow template response."""
    id: uuid.UUID
    name: str
    description: Optional[str] = None
    definition: Dict[str, Any]
    category: CategorySchema
    tags: List[str]
    difficulty_level: DifficultyLevelEnum
    estimated_runtime: Optional[str] = None
    is_public: bool
    is_featured: bool
    status: TemplateStatusEnum
    version: str
    rating: Optional[float] = None
    rating_count: int = 0
    usage_count: int = 0
    download_count: int = 0
    created_by: UserInfoSchema
    created_at: datetime
    updated_at: datetime
    published_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# Component Schemas

class ComponentConfigurationSchema(BaseModel):
    """Schema for component configuration."""
    type: str = Field(..., description="Configuration field type")
    label: str = Field(..., description="Field label")
    description: Optional[str] = Field(None, description="Field description")
    required: bool = Field(False, description="Whether field is required")
    default: Optional[Any] = Field(None, description="Default value")
    options: Optional[List[Any]] = Field(None, description="Available options for select fields")


class WorkflowComponentCreate(BaseModel):
    """Schema for creating a workflow component."""
    name: str = Field(..., min_length=1, max_length=255, description="Component name")
    description: Optional[str] = Field(None, description="Component description")
    component_type: ComponentTypeEnum = Field(..., description="Component type")
    category: str = Field(..., description="Component category")
    definition: Dict[str, Any] = Field(..., description="Component definition")
    input_schema: Optional[Dict[str, Any]] = Field(None, description="Input schema")
    output_schema: Optional[Dict[str, Any]] = Field(None, description="Output schema")
    configuration_schema: Optional[Dict[str, Any]] = Field(None, description="Configuration schema")
    default_configuration: Optional[Dict[str, Any]] = Field(None, description="Default configuration")
    tags: Optional[List[str]] = Field(default_factory=list, description="Component tags")
    is_public: bool = Field(False, description="Whether component is public")

    @validator('definition')
    def validate_definition(cls, v):
        if not isinstance(v, dict):
            raise ValueError('Definition must be a dictionary')
        if 'component_type' not in v:
            raise ValueError('Definition must contain component_type')
        return v


class WorkflowComponentUpdate(BaseModel):
    """Schema for updating a workflow component."""
    name: Optional[str] = Field(None, min_length=1, max_length=255, description="Component name")
    description: Optional[str] = Field(None, description="Component description")
    component_type: Optional[ComponentTypeEnum] = Field(None, description="Component type")
    category: Optional[str] = Field(None, description="Component category")
    definition: Optional[Dict[str, Any]] = Field(None, description="Component definition")
    input_schema: Optional[Dict[str, Any]] = Field(None, description="Input schema")
    output_schema: Optional[Dict[str, Any]] = Field(None, description="Output schema")
    configuration_schema: Optional[Dict[str, Any]] = Field(None, description="Configuration schema")
    default_configuration: Optional[Dict[str, Any]] = Field(None, description="Default configuration")
    tags: Optional[List[str]] = Field(None, description="Component tags")
    is_public: Optional[bool] = Field(None, description="Whether component is public")


class WorkflowComponentResponse(BaseModel):
    """Schema for workflow component response."""
    id: uuid.UUID
    name: str
    description: Optional[str] = None
    component_type: ComponentTypeEnum
    category: CategorySchema
    definition: Dict[str, Any]
    input_schema: Optional[Dict[str, Any]] = None
    output_schema: Optional[Dict[str, Any]] = None
    configuration_schema: Optional[Dict[str, Any]] = None
    default_configuration: Optional[Dict[str, Any]] = None
    tags: List[str]
    is_public: bool
    is_verified: bool
    status: ComponentStatusEnum
    version: str
    usage_count: int = 0
    rating: Optional[float] = None
    rating_count: int = 0
    created_by: UserInfoSchema
    created_at: datetime
    updated_at: datetime
    verified_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# Template Instantiation Schemas

class TemplateInstantiateRequest(BaseModel):
    """Schema for template instantiation request."""
    name: Optional[str] = Field(None, description="Name for the instantiated workflow")
    description: Optional[str] = Field(None, description="Description for the instantiated workflow")
    variable_values: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Values for template variables")
    configuration: Optional[Dict[str, Any]] = Field(None, description="Additional configuration")


class TemplateInstantiateResponse(BaseModel):
    """Schema for template instantiation response."""
    workflow_id: uuid.UUID
    workflow_name: str
    message: str


# Rating Schemas

class TemplateRatingCreate(BaseModel):
    """Schema for creating a template rating."""
    rating: int = Field(..., ge=1, le=5, description="Rating (1-5 stars)")
    review: Optional[str] = Field(None, max_length=2000, description="Optional review text")


class TemplateRatingResponse(BaseModel):
    """Schema for template rating response."""
    id: uuid.UUID
    template_id: uuid.UUID
    user_id: uuid.UUID
    rating: int
    review: Optional[str] = None
    helpful_count: int = 0
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Version Schemas

class TemplateVersionResponse(BaseModel):
    """Schema for template version response."""
    id: uuid.UUID
    template_id: uuid.UUID
    version: str
    definition: Dict[str, Any]
    changelog: Optional[str] = None
    is_major: bool = False
    is_breaking: bool = False
    created_by: uuid.UUID
    created_at: datetime

    class Config:
        from_attributes = True


# Category Schemas

class CategoryCreate(BaseModel):
    """Schema for creating a category."""
    name: str = Field(..., min_length=1, max_length=100, description="Category name")
    description: Optional[str] = Field(None, description="Category description")
    icon: Optional[str] = Field(None, description="Category icon")
    color: Optional[str] = Field(None, description="Category color (hex code)")
    applies_to_templates: bool = Field(True, description="Whether category applies to templates")
    applies_to_components: bool = Field(True, description="Whether category applies to components")
    parent_id: Optional[uuid.UUID] = Field(None, description="Parent category ID")


class CategoryUpdate(BaseModel):
    """Schema for updating a category."""
    name: Optional[str] = Field(None, min_length=1, max_length=100, description="Category name")
    description: Optional[str] = Field(None, description="Category description")
    icon: Optional[str] = Field(None, description="Category icon")
    color: Optional[str] = Field(None, description="Category color (hex code)")
    is_active: Optional[bool] = Field(None, description="Whether category is active")
    applies_to_templates: Optional[bool] = Field(None, description="Whether category applies to templates")
    applies_to_components: Optional[bool] = Field(None, description="Whether category applies to components")


class CategoryResponse(BaseModel):
    """Schema for category response."""
    id: uuid.UUID
    name: str
    description: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    is_active: bool
    applies_to_templates: bool
    applies_to_components: bool
    sort_order: int
    parent_id: Optional[uuid.UUID] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Search and Filter Schemas

class TemplateSearchRequest(BaseModel):
    """Schema for template search request."""
    query: Optional[str] = Field(None, description="Search query")
    category: Optional[str] = Field(None, description="Filter by category")
    tags: Optional[List[str]] = Field(None, description="Filter by tags")
    difficulty_level: Optional[DifficultyLevelEnum] = Field(None, description="Filter by difficulty level")
    rating_min: Optional[float] = Field(None, ge=0, le=5, description="Minimum rating")
    is_public: Optional[bool] = Field(None, description="Filter by public status")
    featured: Optional[bool] = Field(None, description="Filter by featured status")
    sort_by: str = Field("created_at", description="Sort field")
    sort_desc: bool = Field(True, description="Sort descending")


class ComponentSearchRequest(BaseModel):
    """Schema for component search request."""
    query: Optional[str] = Field(None, description="Search query")
    category: Optional[str] = Field(None, description="Filter by category")
    component_type: Optional[ComponentTypeEnum] = Field(None, description="Filter by component type")
    tags: Optional[List[str]] = Field(None, description="Filter by tags")
    status: Optional[ComponentStatusEnum] = Field(None, description="Filter by status")
    is_public: Optional[bool] = Field(None, description="Filter by public status")
    is_verified: Optional[bool] = Field(None, description="Filter by verified status")
    sort_by: str = Field("name", description="Sort field")
    sort_desc: bool = Field(False, description="Sort descending")


# Validation Schemas

class TemplateValidationRequest(BaseModel):
    """Schema for template validation request."""
    definition: Dict[str, Any] = Field(..., description="Template definition to validate")


class ComponentValidationRequest(BaseModel):
    """Schema for component validation request."""
    definition: Dict[str, Any] = Field(..., description="Component definition to validate")


class ValidationResult(BaseModel):
    """Schema for validation result."""
    is_valid: bool = Field(..., description="Whether the object is valid")
    errors: List[str] = Field(default_factory=list, description="Validation errors")
    warnings: List[str] = Field(default_factory=list, description="Validation warnings")
    suggestions: List[str] = Field(default_factory=list, description="Improvement suggestions")
    complexity_score: Optional[float] = Field(None, description="Complexity score (0-1)")
    estimated_runtime: Optional[str] = Field(None, description="Estimated runtime")


# Analytics Schemas

class TemplateStatsResponse(BaseModel):
    """Schema for template statistics response."""
    total_templates: int
    total_instantiations: int
    average_rating: float
    popular_categories: List[Dict[str, Any]]
    recent_activity: List[Dict[str, Any]]
    usage_by_difficulty: Dict[str, int]


class ComponentStatsResponse(BaseModel):
    """Schema for component statistics response."""
    total_components: int
    total_usages: int
    average_rating: float
    popular_components: List[Dict[str, Any]]
    recent_uploads: List[Dict[str, Any]]
    usage_by_type: Dict[str, int]


# Usage Log Schemas

class UsageLogResponse(BaseModel):
    """Schema for usage log response."""
    id: uuid.UUID
    template_id: Optional[uuid.UUID] = None
    component_id: Optional[uuid.UUID] = None
    user_id: uuid.UUID
    usage_type: str
    context: Optional[Dict[str, Any]] = None
    created_at: datetime

    class Config:
        from_attributes = True


# Import existing schemas to extend them
from app.schemas.commons import PaginatedResponse, SearchResponse

# Template Marketplace Schemas

class MarketplaceTemplateResponse(BaseModel):
    """Enhanced template response for marketplace."""
    id: uuid.UUID
    name: str
    description: Optional[str] = None
    category: CategorySchema
    tags: List[str]
    difficulty_level: DifficultyLevelEnum
    estimated_runtime: Optional[str] = None
    rating: Optional[float] = None
    rating_count: int = 0
    download_count: int = 0
    is_featured: bool
    created_by: UserInfoSchema
    created_at: datetime
    preview_image: Optional[str] = None  # URL to preview image
    demo_workflow: Optional[uuid.UUID] = None  # ID of demo workflow

    class Config:
        from_attributes = True


class MarketplaceFilters(BaseModel):
    """Schema for marketplace filters."""
    categories: Optional[List[str]] = Field(None, description="Filter by categories")
    tags: Optional[List[str]] = Field(None, description="Filter by tags")
    difficulty_levels: Optional[List[DifficultyLevelEnum]] = Field(None, description="Filter by difficulty levels")
    rating_min: Optional[float] = Field(None, ge=0, le=5, description="Minimum rating")
    featured_only: bool = Field(False, description="Show only featured templates")
    verified_only: bool = Field(False, description="Show only verified components")
    price_range: Optional[tuple[float, float]] = Field(None, description="Price range (if applicable)")