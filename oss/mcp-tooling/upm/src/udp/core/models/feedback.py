"""
User Feedback model for the Universal Dependency Platform.

This model captures user feedback on package recommendations, usage,
and ratings to improve the AI recommendation engine.
"""

from datetime import datetime
from typing import Dict, Any, Optional
import uuid
from sqlalchemy import (
    Column,
    String,
    Text,
    Float,
    DateTime,
    JSON,
    Integer,
    ForeignKey,
    Index,
)
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB

from .base import Base


class UserFeedback(Base):
    """
    User feedback on packages and recommendations.

    This table stores user feedback that is used to train and improve
    the recommendation engine. It captures ratings, usage patterns,
    and explicit feedback on recommendation quality.
    """

    __tablename__ = "user_feedback"

    # Primary key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # User information
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    # Package information
    package_name = Column(String(255), nullable=False)
    ecosystem = Column(String(50), nullable=False)

    # Feedback details
    feedback_score = Column(Float, nullable=False)  # 0.0 to 1.0
    feedback_type = Column(
        String(50), nullable=False
    )  # recommendation, usage, rating, review
    feedback_data = Column(JSONB, default=dict)  # Additional feedback metadata

    # Context information
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=True)
    recommendation_context = Column(
        JSONB, default=dict
    )  # Context when recommendation was made

    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="feedback")
    project = relationship("Project", back_populates="feedback")

    # Indexes for performance
    __table_args__ = (
        Index("idx_feedback_user_package", "user_id", "package_name", "ecosystem"),
        Index("idx_feedback_package_ecosystem", "package_name", "ecosystem"),
        Index("idx_feedback_type_score", "feedback_type", "feedback_score"),
        Index("idx_feedback_created_at", "created_at"),
    )

    def __repr__(self):
        return f"<UserFeedback(user_id={self.user_id}, package={self.package_name}, score={self.feedback_score})>"

    def to_dict(self) -> Dict[str, Any]:
        """Convert feedback to dictionary."""
        return {
            "id": str(self.id),
            "user_id": str(self.user_id),
            "package_name": self.package_name,
            "ecosystem": self.ecosystem,
            "feedback_score": self.feedback_score,
            "feedback_type": self.feedback_type,
            "feedback_data": self.feedback_data or {},
            "project_id": str(self.project_id) if self.project_id else None,
            "recommendation_context": self.recommendation_context or {},
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }


class RecommendationMetrics(Base):
    """
    Metrics tracking for recommendation performance.

    This table tracks various metrics about recommendation performance
    including click-through rates, acceptance rates, and user satisfaction.
    """

    __tablename__ = "recommendation_metrics"

    # Primary key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Dimension fields
    date = Column(DateTime, nullable=False)
    ecosystem = Column(String(50), nullable=False)
    user_segment = Column(
        String(100), nullable=True
    )  # e.g., "enterprise", "individual", "team"

    # Metrics
    total_recommendations = Column(Integer, default=0)
    accepted_recommendations = Column(Integer, default=0)
    rejected_recommendations = Column(Integer, default=0)
    ignored_recommendations = Column(Integer, default=0)

    # Performance metrics
    average_confidence_score = Column(Float, default=0.0)
    average_user_satisfaction = Column(Float, default=0.0)  # From explicit feedback

    # Additional metrics
    click_through_rate = Column(Float, default=0.0)
    conversion_rate = Column(Float, default=0.0)

    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Indexes
    __table_args__ = (
        Index("idx_metrics_date_ecosystem", "date", "ecosystem"),
        Index("idx_metrics_date", "date"),
    )

    def __repr__(self):
        return f"<RecommendationMetrics(date={self.date}, ecosystem={self.ecosystem}, recommendations={self.total_recommendations})>"

    @property
    def acceptance_rate(self) -> float:
        """Calculate acceptance rate."""
        if self.total_recommendations == 0:
            return 0.0
        return (self.accepted_recommendations / self.total_recommendations) * 100

    @property
    def rejection_rate(self) -> float:
        """Calculate rejection rate."""
        if self.total_recommendations == 0:
            return 0.0
        return (self.rejected_recommendations / self.total_recommendations) * 100
