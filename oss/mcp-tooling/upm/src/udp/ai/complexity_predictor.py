"""
Workflow complexity prediction and resource estimation.

Provides ML-based prediction of workflow execution complexity,
resource requirements, and performance optimization recommendations.
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple
from uuid import uuid4

import structlog
from pydantic import BaseModel, Field

from udp.domain.models import EcosystemType, SecurityLevel
from udp.workflows.state import DependencyAnalysisState

logger = structlog.get_logger()


class ResourceRequirements(BaseModel):
    """Resource requirements prediction."""
    
    cpu_cores: float = Field(..., ge=0.1, le=32.0, description="Estimated CPU cores needed")
    memory_gb: float = Field(..., ge=0.1, le=128.0, description="Estimated memory in GB")
    disk_gb: float = Field(..., ge=0.1, le=1000.0, description="Estimated disk space in GB")
    network_mbps: float = Field(..., ge=0.1, le=10000.0, description="Estimated network bandwidth in Mbps")
    execution_time_seconds: float = Field(..., ge=1.0, le=7200.0, description="Estimated execution time in seconds")
    confidence_score: float = Field(..., ge=0.0, le=1.0, description="Prediction confidence")
    
    class Config:
        use_enum_values = True


class ComplexityFactors(BaseModel):
    """Workflow complexity factors."""
    
    package_count_factor: float = Field(..., ge=0.0, le=10.0, description="Package count complexity factor")
    ecosystem_diversity_factor: float = Field(..., ge=0.0, le=10.0, description="Ecosystem diversity factor")
    dependency_depth_factor: float = Field(..., ge=0.0, le=10.0, description="Dependency depth factor")
    conflict_resolution_factor: float = Field(..., ge=0.0, le=10.0, description="Conflict resolution complexity")
    security_analysis_factor: float = Field(..., ge=0.0, le=10.0, description="Security analysis complexity")
    policy_evaluation_factor: float = Field(..., ge=0.0, le=10.0, description="Policy evaluation complexity")
    cross_ecosystem_factor: float = Field(..., ge=0.0, le=10.0, description="Cross-ecosystem complexity")
    
    @property
    def overall_complexity(self) -> float:
        """Calculate overall complexity score."""
        factors = [
            self.package_count_factor,
            self.ecosystem_diversity_factor,
            self.dependency_depth_factor,
            self.conflict_resolution_factor,
            self.security_analysis_factor,
            self.policy_evaluation_factor,
            self.cross_ecosystem_factor
        ]
        return sum(factors) / len(factors)
    
    class Config:
        use_enum_values = True


class WorkflowComplexityPrediction(BaseModel):
    """Comprehensive workflow complexity prediction."""
    
    complexity_score: float = Field(..., ge=0.0, le=10.0, description="Overall complexity score (0-10)")
    complexity_level: str = Field(..., description="Complexity level (low/medium/high/critical)")
    complexity_factors: ComplexityFactors = Field(..., description="Detailed complexity factors")
    resource_requirements: ResourceRequirements = Field(..., description="Predicted resource requirements")
    bottlenecks: List[str] = Field(default_factory=list, description="Predicted bottlenecks")
    optimization_suggestions: List[str] = Field(default_factory=list, description="Performance optimization suggestions")
    scaling_recommendations: List[str] = Field(default_factory=list, description="Scaling recommendations")
    confidence_score: float = Field(..., ge=0.0, le=1.0, description="Overall prediction confidence")
    
    @property
    def is_high_complexity(self) -> bool:
        """Check if workflow has high complexity."""
        return self.complexity_score >= 7.0
    
    @property
    def requires_scaling(self) -> bool:
        """Check if workflow requires horizontal scaling."""
        return (
            self.complexity_score >= 6.0 or 
            self.resource_requirements.execution_time_seconds > 300.0 or
            self.resource_requirements.cpu_cores > 4.0
        )
    
    class Config:
        use_enum_values = True


class WorkflowComplexityPredictor:
    """
    ML-based workflow complexity predictor.
    
    Analyzes workflow characteristics to predict execution complexity,
    resource requirements, and performance bottlenecks.
    """
    
    def __init__(self, organization_id: Optional[str] = None):
        self.organization_id = organization_id
        self.logger = logger.bind(component="complexity_predictor")
        
        # Complexity calculation weights
        self.complexity_weights = {
            "package_count": 0.25,
            "ecosystem_diversity": 0.20,
            "dependency_depth": 0.15,
            "conflict_resolution": 0.15,
            "security_analysis": 0.10,
            "policy_evaluation": 0.10,
            "cross_ecosystem": 0.05
        }
        
        # Resource estimation models (in production, these would be trained ML models)
        self.base_resource_requirements = {
            "cpu_cores": 1.0,
            "memory_gb": 2.0,
            "disk_gb": 1.0,
            "network_mbps": 10.0,
            "execution_time_seconds": 30.0
        }
    
    async def predict_workflow_complexity(
        self, 
        state: DependencyAnalysisState
    ) -> WorkflowComplexityPrediction:
        """
        Predict workflow complexity and resource requirements.
        
        Analyzes workflow state to predict execution complexity,
        resource needs, and potential bottlenecks.
        """
        try:
            self.logger.info(
                "Starting workflow complexity prediction",
                workflow_id=state.get("workflow_id"),
                organization_id=self.organization_id
            )
            
            # Calculate complexity factors
            complexity_factors = await self._calculate_complexity_factors(state)
            
            # Calculate overall complexity score
            complexity_score = await self._calculate_overall_complexity(complexity_factors)
            
            # Determine complexity level
            complexity_level = self._determine_complexity_level(complexity_score)
            
            # Predict resource requirements
            resource_requirements = await self._predict_resource_requirements(
                complexity_factors, complexity_score
            )
            
            # Identify potential bottlenecks
            bottlenecks = await self._identify_bottlenecks(complexity_factors, state)
            
            # Generate optimization suggestions
            optimization_suggestions = await self._generate_optimization_suggestions(
                complexity_factors, bottlenecks
            )
            
            # Generate scaling recommendations
            scaling_recommendations = await self._generate_scaling_recommendations(
                complexity_score, resource_requirements
            )
            
            # Calculate prediction confidence
            confidence_score = await self._calculate_prediction_confidence(state, complexity_factors)
            
            prediction = WorkflowComplexityPrediction(
                complexity_score=complexity_score,
                complexity_level=complexity_level,
                complexity_factors=complexity_factors,
                resource_requirements=resource_requirements,
                bottlenecks=bottlenecks,
                optimization_suggestions=optimization_suggestions,
                scaling_recommendations=scaling_recommendations,
                confidence_score=confidence_score
            )
            
            self.logger.info(
                "Workflow complexity prediction completed",
                workflow_id=state.get("workflow_id"),
                complexity_score=complexity_score,
                complexity_level=complexity_level,
                estimated_time=resource_requirements.execution_time_seconds,
                confidence=confidence_score
            )
            
            return prediction
            
        except Exception as e:
            self.logger.error(
                "Workflow complexity prediction failed",
                error=str(e),
                workflow_id=state.get("workflow_id")
            )
            
            # Return conservative high-complexity prediction
            return await self._create_fallback_prediction()
    
    async def predict_execution_time(
        self, 
        state: DependencyAnalysisState
    ) -> Tuple[float, float]:
        """
        Predict workflow execution time.
        
        Returns tuple of (estimated_seconds, confidence_score).
        """
        try:
            complexity_factors = await self._calculate_complexity_factors(state)
            complexity_score = await self._calculate_overall_complexity(complexity_factors)
            
            # Base execution time
            base_time = self.base_resource_requirements["execution_time_seconds"]
            
            # Complexity multiplier (1.0 to 10.0)
            complexity_multiplier = 1.0 + (complexity_score / 10.0) * 9.0
            
            # Factor-specific adjustments
            package_adjustment = min(len(state.get("resolved_packages", [])) / 50.0, 5.0)
            ecosystem_adjustment = len(set(
                pkg.get("ecosystem") for pkg in state.get("resolved_packages", [])
                if pkg.get("ecosystem")
            )) * 0.5
            
            vulnerability_adjustment = len(state.get("vulnerabilities", [])) * 0.1
            conflict_adjustment = len(state.get("cross_language_conflicts", [])) * 2.0
            
            # Calculate total estimated time
            estimated_time = base_time * complexity_multiplier + (
                package_adjustment + ecosystem_adjustment + 
                vulnerability_adjustment + conflict_adjustment
            )
            
            # Cap at maximum reasonable time
            estimated_time = min(estimated_time, 3600.0)  # 1 hour max
            
            # Calculate confidence based on data completeness
            confidence = await self._calculate_prediction_confidence(state, complexity_factors)
            
            return estimated_time, confidence
            
        except Exception as e:
            self.logger.error(
                "Execution time prediction failed",
                error=str(e),
                workflow_id=state.get("workflow_id")
            )
            
            # Return conservative estimate
            return 300.0, 0.3  # 5 minutes, low confidence
    
    async def recommend_workflow_routing(
        self, 
        state: DependencyAnalysisState
    ) -> Dict[str, Any]:
        """
        Recommend optimal workflow routing based on complexity.
        
        Suggests workflow path, parallelization opportunities,
        and resource allocation strategies.
        """
        try:
            complexity_prediction = await self.predict_workflow_complexity(state)
            
            routing_recommendation = {
                "workflow_path": "standard",
                "parallelization": False,
                "resource_allocation": "standard",
                "priority": "normal",
                "timeout_seconds": 600,
                "retry_strategy": "exponential_backoff"
            }
            
            # Adjust based on complexity
            if complexity_prediction.complexity_score >= 8.0:
                routing_recommendation.update({
                    "workflow_path": "high_complexity",
                    "parallelization": True,
                    "resource_allocation": "high",
                    "priority": "high",
                    "timeout_seconds": 1800,
                    "retry_strategy": "linear_backoff"
                })
            elif complexity_prediction.complexity_score >= 6.0:
                routing_recommendation.update({
                    "workflow_path": "medium_complexity",
                    "parallelization": True,
                    "resource_allocation": "medium",
                    "timeout_seconds": 1200
                })
            elif complexity_prediction.complexity_score <= 3.0:
                routing_recommendation.update({
                    "workflow_path": "fast_track",
                    "resource_allocation": "minimal",
                    "timeout_seconds": 300
                })
            
            # Add specific recommendations
            routing_recommendation["recommendations"] = []
            
            if complexity_prediction.requires_scaling:
                routing_recommendation["recommendations"].append(
                    "Consider horizontal scaling for this workflow"
                )
            
            if len(complexity_prediction.bottlenecks) > 0:
                routing_recommendation["recommendations"].append(
                    f"Address bottlenecks: {', '.join(complexity_prediction.bottlenecks)}"
                )
            
            routing_recommendation["confidence"] = complexity_prediction.confidence_score
            
            return routing_recommendation
            
        except Exception as e:
            self.logger.error(
                "Workflow routing recommendation failed",
                error=str(e),
                workflow_id=state.get("workflow_id")
            )
            
            # Return safe default routing
            return {
                "workflow_path": "standard",
                "parallelization": False,
                "resource_allocation": "standard",
                "priority": "normal",
                "timeout_seconds": 600,
                "retry_strategy": "exponential_backoff",
                "recommendations": ["Manual review recommended due to prediction failure"],
                "confidence": 0.3
            }
    
    # Private helper methods
    
    async def _calculate_complexity_factors(self, state: DependencyAnalysisState) -> ComplexityFactors:
        """Calculate detailed complexity factors."""
        resolved_packages = state.get("resolved_packages", [])
        vulnerabilities = state.get("vulnerabilities", [])
        conflicts = state.get("cross_language_conflicts", [])
        policy_violations = state.get("policy_violations", [])
        cross_ecosystem_deps = state.get("cross_ecosystem_dependencies", [])
        
        # Package count factor (0-10 scale)
        package_count = len(resolved_packages)
        package_count_factor = min(package_count / 100.0 * 10.0, 10.0)
        
        # Ecosystem diversity factor
        ecosystems = set(pkg.get("ecosystem") for pkg in resolved_packages if pkg.get("ecosystem"))
        ecosystem_diversity_factor = min(len(ecosystems) / 5.0 * 10.0, 10.0)
        
        # Dependency depth factor (estimated)
        dependency_depth_factor = min(package_count / 50.0 * 10.0, 10.0)
        
        # Conflict resolution factor
        conflict_resolution_factor = min(len(conflicts) / 10.0 * 10.0, 10.0)
        
        # Security analysis factor
        critical_vulns = len([v for v in vulnerabilities 
                            if v.get("severity") == SecurityLevel.CRITICAL.value])
        high_vulns = len([v for v in vulnerabilities 
                         if v.get("severity") == SecurityLevel.HIGH.value])
        security_analysis_factor = min((critical_vulns * 2 + high_vulns) / 5.0 * 10.0, 10.0)
        
        # Policy evaluation factor
        policy_evaluation_factor = min(len(policy_violations) / 5.0 * 10.0, 10.0)
        
        # Cross-ecosystem factor
        cross_ecosystem_factor = min(len(cross_ecosystem_deps) / 3.0 * 10.0, 10.0)
        
        return ComplexityFactors(
            package_count_factor=package_count_factor,
            ecosystem_diversity_factor=ecosystem_diversity_factor,
            dependency_depth_factor=dependency_depth_factor,
            conflict_resolution_factor=conflict_resolution_factor,
            security_analysis_factor=security_analysis_factor,
            policy_evaluation_factor=policy_evaluation_factor,
            cross_ecosystem_factor=cross_ecosystem_factor
        )
    
    async def _calculate_overall_complexity(self, factors: ComplexityFactors) -> float:
        """Calculate weighted overall complexity score."""
        weighted_score = (
            factors.package_count_factor * self.complexity_weights["package_count"] +
            factors.ecosystem_diversity_factor * self.complexity_weights["ecosystem_diversity"] +
            factors.dependency_depth_factor * self.complexity_weights["dependency_depth"] +
            factors.conflict_resolution_factor * self.complexity_weights["conflict_resolution"] +
            factors.security_analysis_factor * self.complexity_weights["security_analysis"] +
            factors.policy_evaluation_factor * self.complexity_weights["policy_evaluation"] +
            factors.cross_ecosystem_factor * self.complexity_weights["cross_ecosystem"]
        )
        
        return min(weighted_score, 10.0)
    
    def _determine_complexity_level(self, complexity_score: float) -> str:
        """Determine complexity level from score."""
        if complexity_score >= 8.0:
            return "critical"
        elif complexity_score >= 6.0:
            return "high"
        elif complexity_score >= 4.0:
            return "medium"
        else:
            return "low"
    
    async def _predict_resource_requirements(
        self, 
        factors: ComplexityFactors, 
        complexity_score: float
    ) -> ResourceRequirements:
        """Predict resource requirements based on complexity."""
        base = self.base_resource_requirements
        
        # Complexity multiplier (1.0 to 5.0)
        multiplier = 1.0 + (complexity_score / 10.0) * 4.0
        
        # Calculate resource requirements
        cpu_cores = min(base["cpu_cores"] * multiplier, 16.0)
        memory_gb = min(base["memory_gb"] * multiplier, 64.0)
        disk_gb = min(base["disk_gb"] * (1.0 + factors.package_count_factor / 10.0), 100.0)
        network_mbps = min(base["network_mbps"] * (1.0 + factors.ecosystem_diversity_factor / 10.0), 1000.0)
        execution_time = min(base["execution_time_seconds"] * multiplier, 3600.0)
        
        # Calculate confidence based on factor certainty
        confidence = max(0.5, 1.0 - (complexity_score / 20.0))
        
        return ResourceRequirements(
            cpu_cores=cpu_cores,
            memory_gb=memory_gb,
            disk_gb=disk_gb,
            network_mbps=network_mbps,
            execution_time_seconds=execution_time,
            confidence_score=confidence
        )
    
    async def _identify_bottlenecks(
        self, 
        factors: ComplexityFactors, 
        state: DependencyAnalysisState
    ) -> List[str]:
        """Identify potential workflow bottlenecks."""
        bottlenecks = []
        
        if factors.package_count_factor >= 7.0:
            bottlenecks.append("Large number of packages may slow dependency resolution")
        
        if factors.ecosystem_diversity_factor >= 6.0:
            bottlenecks.append("Multiple ecosystems increase analysis complexity")
        
        if factors.conflict_resolution_factor >= 5.0:
            bottlenecks.append("Dependency conflicts require additional resolution time")
        
        if factors.security_analysis_factor >= 6.0:
            bottlenecks.append("High vulnerability count increases security scan time")
        
        if factors.cross_ecosystem_factor >= 4.0:
            bottlenecks.append("Cross-ecosystem dependencies add complexity")
        
        # Check for specific bottleneck conditions
        resolved_packages = state.get("resolved_packages", [])
        if len(resolved_packages) > 200:
            bottlenecks.append("Very large dependency graph may cause memory pressure")
        
        vulnerabilities = state.get("vulnerabilities", [])
        if len(vulnerabilities) > 50:
            bottlenecks.append("Large number of vulnerabilities increases analysis time")
        
        return bottlenecks
    
    async def _generate_optimization_suggestions(
        self, 
        factors: ComplexityFactors, 
        bottlenecks: List[str]
    ) -> List[str]:
        """Generate performance optimization suggestions."""
        suggestions = []
        
        if factors.package_count_factor >= 6.0:
            suggestions.append("Consider dependency pruning to reduce package count")
            suggestions.append("Implement parallel dependency resolution")
        
        if factors.ecosystem_diversity_factor >= 5.0:
            suggestions.append("Consider ecosystem consolidation where possible")
            suggestions.append("Use ecosystem-specific optimization strategies")
        
        if factors.conflict_resolution_factor >= 4.0:
            suggestions.append("Pre-resolve known conflicts to speed up workflow")
            suggestions.append("Implement conflict caching for repeated resolutions")
        
        if factors.security_analysis_factor >= 5.0:
            suggestions.append("Use incremental security scanning")
            suggestions.append("Cache vulnerability database queries")
        
        if len(bottlenecks) > 3:
            suggestions.append("Consider breaking workflow into smaller chunks")
            suggestions.append("Implement workflow checkpointing for recovery")
        
        return suggestions
    
    async def _generate_scaling_recommendations(
        self, 
        complexity_score: float, 
        resource_requirements: ResourceRequirements
    ) -> List[str]:
        """Generate scaling recommendations."""
        recommendations = []
        
        if complexity_score >= 8.0:
            recommendations.append("Use high-performance compute instances")
            recommendations.append("Consider horizontal scaling across multiple workers")
        
        if resource_requirements.cpu_cores > 4.0:
            recommendations.append("Allocate additional CPU cores for parallel processing")
        
        if resource_requirements.memory_gb > 8.0:
            recommendations.append("Ensure sufficient memory allocation")
        
        if resource_requirements.execution_time_seconds > 600.0:
            recommendations.append("Consider workflow optimization or chunking")
            recommendations.append("Implement progress monitoring for long-running workflows")
        
        if resource_requirements.network_mbps > 100.0:
            recommendations.append("Ensure high-bandwidth network connectivity")
        
        return recommendations
    
    async def _calculate_prediction_confidence(
        self, 
        state: DependencyAnalysisState, 
        factors: ComplexityFactors
    ) -> float:
        """Calculate prediction confidence score."""
        # Base confidence
        confidence = 0.7
        
        # Adjust based on data completeness
        resolved_packages = state.get("resolved_packages", [])
        if len(resolved_packages) > 10:
            confidence += 0.1
        
        if "vulnerabilities" in state:
            confidence += 0.1
        
        if state.get("policy_violations") is not None:
            confidence += 0.1
        
        # Adjust based on complexity certainty
        overall_complexity = factors.overall_complexity
        if 3.0 <= overall_complexity <= 7.0:
            confidence += 0.1  # More confident in medium complexity ranges
        
        return min(confidence, 0.95)
    
    async def _create_fallback_prediction(self) -> WorkflowComplexityPrediction:
        """Create fallback prediction for error cases."""
        fallback_factors = ComplexityFactors(
            package_count_factor=5.0,
            ecosystem_diversity_factor=5.0,
            dependency_depth_factor=5.0,
            conflict_resolution_factor=5.0,
            security_analysis_factor=5.0,
            policy_evaluation_factor=5.0,
            cross_ecosystem_factor=5.0
        )
        
        fallback_resources = ResourceRequirements(
            cpu_cores=2.0,
            memory_gb=4.0,
            disk_gb=5.0,
            network_mbps=50.0,
            execution_time_seconds=300.0,
            confidence_score=0.3
        )
        
        return WorkflowComplexityPrediction(
            complexity_score=6.0,
            complexity_level="medium",
            complexity_factors=fallback_factors,
            resource_requirements=fallback_resources,
            bottlenecks=["Prediction failed - manual assessment recommended"],
            optimization_suggestions=["Review workflow configuration"],
            scaling_recommendations=["Use standard resource allocation"],
            confidence_score=0.3
        )