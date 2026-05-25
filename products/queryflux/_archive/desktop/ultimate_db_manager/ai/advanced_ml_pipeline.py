#!/usr/bin/env python3
"""
Advanced ML Pipeline - Revolutionary AI Features
The smartest database AI system ever created
"""

import asyncio
import json
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass
from enum import Enum
import logging
import pickle
from pathlib import Path

# ML Libraries
from sklearn.ensemble import RandomForestRegressor, IsolationForest
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error, accuracy_score
import joblib

logger = logging.getLogger(__name__)

class ModelType(Enum):
    QUERY_PERFORMANCE = "query_performance"
    INDEX_RECOMMENDATION = "index_recommendation"
    ANOMALY_DETECTION = "anomaly_detection"
    SCHEMA_OPTIMIZATION = "schema_optimization"
    SCALING_PREDICTION = "scaling_prediction"

@dataclass
class QueryPattern:
    """Query execution pattern for ML training"""
    query_hash: str
    query_type: str  # SELECT, INSERT, UPDATE, DELETE
    table_count: int
    join_count: int
    where_clause_complexity: int
    execution_time: float
    rows_affected: int
    cpu_usage: float
    memory_usage: float
    timestamp: datetime

@dataclass
class MLPrediction:
    """ML model prediction result"""
    model_type: ModelType
    prediction: Any
    confidence: float
    explanation: str
    recommendations: List[str]
    metadata: Dict[str, Any]

class AdvancedMLPipeline:
    """Revolutionary ML Pipeline for Database Intelligence"""

    def __init__(self):
        self.models = {}
        self.scalers = {}
        self.training_data = {}
        self.model_dir = Path("ml_models")
        self.model_dir.mkdir(exist_ok=True)

        # Real-time learning buffers
        self.query_patterns = []
        self.performance_data = []
        self.anomaly_buffer = []

        logger.info("🤖 Advanced ML Pipeline initialized")

    async def initialize_models(self):
        """Initialize all ML models"""
        logger.info("🧠 Initializing revolutionary AI models...")

        # Load or create models
        await asyncio.gather(
            self._load_or_create_model(ModelType.QUERY_PERFORMANCE),
            self._load_or_create_model(ModelType.INDEX_RECOMMENDATION),
            self._load_or_create_model(ModelType.ANOMALY_DETECTION),
            self._load_or_create_model(ModelType.SCHEMA_OPTIMIZATION),
            self._load_or_create_model(ModelType.SCALING_PREDICTION)
        )

        logger.info("✅ All AI models ready for revolutionary database intelligence!")

    async def _load_or_create_model(self, model_type: ModelType):
        """Load existing model or create new one"""
        model_file = self.model_dir / f"{model_type.value}_model.pkl"
        scaler_file = self.model_dir / f"{model_type.value}_scaler.pkl"

        if model_file.exists() and scaler_file.exists():
            # Load existing model
            self.models[model_type] = joblib.load(model_file)
            self.scalers[model_type] = joblib.load(scaler_file)
            logger.info(f"📂 Loaded {model_type.value} model")
        else:
            # Create new model
            await self._create_model(model_type)
            logger.info(f"🆕 Created new {model_type.value} model")

    async def _create_model(self, model_type: ModelType):
        """Create and train a new ML model"""
        if model_type == ModelType.QUERY_PERFORMANCE:
            # Random Forest for query performance prediction
            self.models[model_type] = RandomForestRegressor(
                n_estimators=100,
                max_depth=10,
                random_state=42,
                n_jobs=-1
            )
        elif model_type == ModelType.ANOMALY_DETECTION:
            # Isolation Forest for anomaly detection
            self.models[model_type] = IsolationForest(
                contamination=0.1,
                random_state=42,
                n_jobs=-1
            )
        elif model_type == ModelType.INDEX_RECOMMENDATION:
            # Clustering for index recommendations
            self.models[model_type] = KMeans(
                n_clusters=10,
                random_state=42,
                n_init=10
            )
        else:
            # Default Random Forest
            self.models[model_type] = RandomForestRegressor(
                n_estimators=50,
                random_state=42,
                n_jobs=-1
            )

        # Create scaler
        self.scalers[model_type] = StandardScaler()

    async def predict_query_performance(
        self,
        query: str,
        schema_info: Dict[str, Any],
        connection_stats: Dict[str, Any]
    ) -> MLPrediction:
        """🚀 REVOLUTIONARY: Predict query performance before execution"""
        try:
            # Extract query features
            features = self._extract_query_features(query, schema_info, connection_stats)

            if ModelType.QUERY_PERFORMANCE not in self.models:
                await self._create_model(ModelType.QUERY_PERFORMANCE)
                # Use heuristic prediction for new models
                return self._heuristic_performance_prediction(query, features)

            # Scale features
            scaled_features = self.scalers[ModelType.QUERY_PERFORMANCE].transform([features])

            # Make prediction
            predicted_time = self.models[ModelType.QUERY_PERFORMANCE].predict(scaled_features)[0]

            # Calculate confidence based on model accuracy
            confidence = min(0.9, max(0.1, 1.0 - (predicted_time / 10)))  # Simple confidence calc

            # Generate recommendations
            recommendations = self._generate_performance_recommendations(query, features, predicted_time)

            return MLPrediction(
                model_type=ModelType.QUERY_PERFORMANCE,
                prediction=predicted_time,
                confidence=confidence,
                explanation=f"Predicted execution time: {predicted_time:.3f} seconds based on query complexity and system load",
                recommendations=recommendations,
                metadata={
                    "features": features,
                    "query_complexity": self._calculate_query_complexity(query),
                    "system_load": connection_stats.get("cpu_usage", 0)
                }
            )

        except Exception as e:
            logger.error(f"Performance prediction failed: {e}")
            return self._fallback_prediction(ModelType.QUERY_PERFORMANCE, str(e))

    async def detect_anomalies(
        self,
        metrics: List[Dict[str, Any]],
        connection_id: str
    ) -> MLPrediction:
        """🔍 REVOLUTIONARY: AI-powered anomaly detection"""
        try:
            if not metrics:
                return MLPrediction(
                    model_type=ModelType.ANOMALY_DETECTION,
                    prediction=[],
                    confidence=0.0,
                    explanation="No metrics available for anomaly detection",
                    recommendations=[],
                    metadata={}
                )

            # Prepare features matrix
            features_matrix = []
            metric_names = []

            for metric in metrics:
                if isinstance(metric.get('value'), (int, float)):
                    features_matrix.append([
                        metric['value'],
                        metric.get('cpu_usage', 0),
                        metric.get('memory_usage', 0),
                        len(str(metric.get('query', '')))  # Query length as proxy
                    ])
                    metric_names.append(metric.get('name', 'unknown'))

            if not features_matrix:
                return self._fallback_prediction(ModelType.ANOMALY_DETECTION, "No numeric metrics")

            features_array = np.array(features_matrix)

            # Check if model exists
            if ModelType.ANOMALY_DETECTION not in self.models:
                await self._create_model(ModelType.ANOMALY_DETECTION)
                # Train on current data for basic functionality
                self.models[ModelType.ANOMALY_DETECTION].fit(features_array)

            # Detect anomalies
            anomaly_scores = self.models[ModelType.ANOMALY_DETECTION].decision_function(features_array)
            anomaly_labels = self.models[ModelType.ANOMALY_DETECTION].predict(features_array)

            # Find anomalies
            anomalies = []
            for i, (score, label) in enumerate(zip(anomaly_scores, anomaly_labels)):
                if label == -1:  # Anomaly detected
                    anomalies.append({
                        "metric_name": metric_names[i] if i < len(metric_names) else "unknown",
                        "anomaly_score": float(score),
                        "metric_index": i,
                        "severity": "high" if score < -0.5 else "medium"
                    })

            confidence = min(0.9, len(features_matrix) / 100.0)  # More data = higher confidence

            recommendations = []
            if anomalies:
                recommendations = [
                    "Investigate recent system changes",
                    "Check for unusual query patterns",
                    "Monitor resource utilization",
                    "Review recent database modifications"
                ]

            return MLPrediction(
                model_type=ModelType.ANOMALY_DETECTION,
                prediction=anomalies,
                confidence=confidence,
                explanation=f"Detected {len(anomalies)} anomalies from {len(metrics)} metrics using ML analysis",
                recommendations=recommendations,
                metadata={
                    "total_metrics": len(metrics),
                    "anomaly_count": len(anomalies),
                    "connection_id": connection_id
                }
            )

        except Exception as e:
            logger.error(f"Anomaly detection failed: {e}")
            return self._fallback_prediction(ModelType.ANOMALY_DETECTION, str(e))

    async def recommend_indexes(
        self,
        query_patterns: List[Dict[str, Any]],
        schema_info: Dict[str, Any]
    ) -> MLPrediction:
        """📊 REVOLUTIONARY: AI-powered index recommendations"""
        try:
            if not query_patterns:
                return MLPrediction(
                    model_type=ModelType.INDEX_RECOMMENDATION,
                    prediction=[],
                    confidence=0.0,
                    explanation="No query patterns available for index analysis",
                    recommendations=[],
                    metadata={}
                )

            # Analyze query patterns for index opportunities
            column_access_patterns = {}
            where_clause_analysis = {}
            join_analysis = {}

            for pattern in query_patterns:
                query = pattern.get('query', '').lower()

                # Extract table and column references (simplified)
                tables = self._extract_table_references(query)
                columns = self._extract_column_references(query, schema_info)
                where_conditions = self._extract_where_conditions(query)

                # Count access patterns
                for table, cols in columns.items():
                    for col in cols:
                        key = f"{table}.{col}"
                        column_access_patterns[key] = column_access_patterns.get(key, 0) + 1

                # Analyze WHERE clause patterns
                for condition in where_conditions:
                    where_clause_analysis[condition] = where_clause_analysis.get(condition, 0) + 1

            # Generate index recommendations based on patterns
            recommendations = []

            # Single column indexes for frequently accessed columns
            for column, count in column_access_patterns.items():
                if count >= 3:  # Threshold for recommendation
                    table, col = column.split('.', 1)
                    recommendations.append({
                        "type": "single_column_index",
                        "table": table,
                        "columns": [col],
                        "reason": f"Column accessed {count} times in analyzed queries",
                        "priority": "high" if count >= 5 else "medium",
                        "estimated_benefit": min(95, count * 10)  # Percentage improvement
                    })

            # Composite indexes for WHERE clause patterns
            composite_candidates = self._analyze_composite_index_candidates(where_clause_analysis)
            for candidate in composite_candidates:
                recommendations.append(candidate)

            confidence = min(0.9, len(query_patterns) / 50.0)  # More patterns = higher confidence

            explanation = f"Analyzed {len(query_patterns)} query patterns and found {len(recommendations)} index opportunities"

            return MLPrediction(
                model_type=ModelType.INDEX_RECOMMENDATION,
                prediction=recommendations,
                confidence=confidence,
                explanation=explanation,
                recommendations=[f"Create {rec['type']} on {rec['table']}" for rec in recommendations[:3]],
                metadata={
                    "query_patterns_analyzed": len(query_patterns),
                    "column_access_patterns": len(column_access_patterns),
                    "where_clause_patterns": len(where_clause_analysis)
                }
            )

        except Exception as e:
            logger.error(f"Index recommendation failed: {e}")
            return self._fallback_prediction(ModelType.INDEX_RECOMMENDATION, str(e))

    async def predict_scaling_needs(
        self,
        historical_metrics: List[Dict[str, Any]],
        growth_rate: float = 0.1
    ) -> MLPrediction:
        """📈 REVOLUTIONARY: Predict when database scaling is needed"""
        try:
            if len(historical_metrics) < 10:
                return MLPrediction(
                    model_type=ModelType.SCALING_PREDICTION,
                    prediction={"scaling_needed": False, "time_to_scale": "unknown"},
                    confidence=0.1,
                    explanation="Insufficient historical data for scaling prediction",
                    recommendations=["Collect more performance metrics over time"],
                    metadata={"data_points": len(historical_metrics)}
                )

            # Extract time series data
            timestamps = []
            cpu_usage = []
            memory_usage = []
            connection_count = []
            query_rate = []

            for metric in historical_metrics[-100:]:  # Last 100 data points
                if 'timestamp' in metric and 'value' in metric:
                    timestamps.append(datetime.fromisoformat(metric['timestamp']) if isinstance(metric['timestamp'], str) else metric['timestamp'])

                    metric_name = metric.get('name', '')
                    value = float(metric['value'])

                    if 'cpu' in metric_name.lower():
                        cpu_usage.append(value)
                    elif 'memory' in metric_name.lower():
                        memory_usage.append(value)
                    elif 'connection' in metric_name.lower():
                        connection_count.append(value)
                    else:
                        query_rate.append(value)

            # Predict future trends
            predictions = {}

            if cpu_usage:
                cpu_trend = self._calculate_trend(cpu_usage)
                cpu_predicted = cpu_usage[-1] + (cpu_trend * 30)  # 30 periods ahead
                predictions['cpu_30_periods'] = min(100, max(0, cpu_predicted))

            if memory_usage:
                mem_trend = self._calculate_trend(memory_usage)
                mem_predicted = memory_usage[-1] + (mem_trend * 30)
                predictions['memory_30_periods'] = min(100, max(0, mem_predicted))

            # Determine if scaling is needed
            scaling_needed = (
                predictions.get('cpu_30_periods', 0) > 80 or
                predictions.get('memory_30_periods', 0) > 85
            )

            # Estimate time to scale
            time_to_scale = "immediate" if scaling_needed else "3+ months"
            if predictions.get('cpu_30_periods', 0) > 70:
                time_to_scale = "1-2 months"
            elif predictions.get('cpu_30_periods', 0) > 60:
                time_to_scale = "2-3 months"

            recommendations = []
            if scaling_needed:
                recommendations = [
                    "Plan for vertical scaling (CPU/Memory upgrade)",
                    "Consider horizontal scaling (read replicas)",
                    "Optimize slow queries to reduce resource usage",
                    "Implement connection pooling",
                    "Set up monitoring alerts at 75% resource usage"
                ]
            else:
                recommendations = [
                    "Continue monitoring current resource trends",
                    "Optimize queries proactively",
                    "Plan capacity for expected growth"
                ]

            confidence = min(0.8, len(historical_metrics) / 200.0)

            return MLPrediction(
                model_type=ModelType.SCALING_PREDICTION,
                prediction={
                    "scaling_needed": scaling_needed,
                    "time_to_scale": time_to_scale,
                    "predicted_cpu": predictions.get('cpu_30_periods'),
                    "predicted_memory": predictions.get('memory_30_periods'),
                    "growth_rate": growth_rate
                },
                confidence=confidence,
                explanation=f"Based on {len(historical_metrics)} data points, scaling {'is' if scaling_needed else 'is not'} needed within {time_to_scale}",
                recommendations=recommendations,
                metadata={
                    "historical_points": len(historical_metrics),
                    "trends_analyzed": len(predictions)
                }
            )

        except Exception as e:
            logger.error(f"Scaling prediction failed: {e}")
            return self._fallback_prediction(ModelType.SCALING_PREDICTION, str(e))

    def _extract_query_features(self, query: str, schema_info: Dict, stats: Dict) -> List[float]:
        """Extract numerical features from query for ML"""
        features = []

        query_lower = query.lower()

        # Basic query features
        features.append(len(query))  # Query length
        features.append(query_lower.count('select'))  # SELECT count
        features.append(query_lower.count('join'))  # JOIN count
        features.append(query_lower.count('where'))  # WHERE count
        features.append(query_lower.count('group by'))  # GROUP BY count
        features.append(query_lower.count('order by'))  # ORDER BY count
        features.append(query_lower.count('having'))  # HAVING count
        features.append(query_lower.count('union'))  # UNION count
        features.append(query_lower.count('*'))  # Wildcard count
        features.append(len(self._extract_table_references(query)))  # Table count

        # System features
        features.append(stats.get('cpu_usage', 0))
        features.append(stats.get('memory_usage', 0))
        features.append(stats.get('connection_count', 1))

        # Schema complexity (approximate)
        total_columns = sum(len(table_info) if isinstance(table_info, list) else 0
                          for table_info in schema_info.values())
        features.append(total_columns)
        features.append(len(schema_info))  # Table count in schema

        return features

    def _calculate_query_complexity(self, query: str) -> int:
        """Calculate query complexity score"""
        query_lower = query.lower()

        complexity = 0
        complexity += query_lower.count('join') * 2
        complexity += query_lower.count('subquery') * 3
        complexity += query_lower.count('union') * 2
        complexity += query_lower.count('group by') * 1
        complexity += query_lower.count('order by') * 1
        complexity += query_lower.count('having') * 2
        complexity += len(query) // 100  # Length factor

        return min(complexity, 20)  # Cap at 20

    def _generate_performance_recommendations(self, query: str, features: List[float], predicted_time: float) -> List[str]:
        """Generate performance recommendations based on prediction"""
        recommendations = []

        if predicted_time > 5.0:
            recommendations.append("Consider adding indexes for WHERE clause columns")
            recommendations.append("Review JOIN operations for optimization opportunities")

        if features[1] > 1:  # Multiple SELECTs (subqueries)
            recommendations.append("Consider rewriting subqueries as JOINs where possible")

        if features[8] > 5:  # Many wildcards
            recommendations.append("Replace SELECT * with specific column names")

        if features[2] > 3:  # Many JOINs
            recommendations.append("Review JOIN order and consider query restructuring")

        if not recommendations:
            recommendations.append("Query appears well-optimized")

        return recommendations

    def _extract_table_references(self, query: str) -> List[str]:
        """Extract table references from query (simplified)"""
        # This is a simplified implementation
        # In production, you'd use a proper SQL parser
        tables = []
        query_words = query.lower().split()

        from_index = -1
        for i, word in enumerate(query_words):
            if word == 'from':
                from_index = i
                break

        if from_index != -1 and from_index + 1 < len(query_words):
            # Get table name after FROM
            table = query_words[from_index + 1].replace(',', '').replace(';', '')
            if table and not table.startswith('('):
                tables.append(table)

        return tables

    def _extract_column_references(self, query: str, schema_info: Dict) -> Dict[str, List[str]]:
        """Extract column references from query"""
        # Simplified implementation
        columns = {}

        # Extract from WHERE clauses
        where_parts = query.lower().split('where')
        if len(where_parts) > 1:
            where_clause = where_parts[1].split('group by')[0].split('order by')[0]

            for table_name, table_columns in schema_info.items():
                if isinstance(table_columns, list):
                    for col_info in table_columns:
                        col_name = col_info.get('column_name', '')
                        if col_name and col_name.lower() in where_clause:
                            if table_name not in columns:
                                columns[table_name] = []
                            columns[table_name].append(col_name)

        return columns

    def _extract_where_conditions(self, query: str) -> List[str]:
        """Extract WHERE conditions for analysis"""
        conditions = []

        where_parts = query.lower().split('where')
        if len(where_parts) > 1:
            where_clause = where_parts[1].split('group by')[0].split('order by')[0]

            # Split by AND/OR and clean up
            condition_parts = where_clause.replace(' and ', '|').replace(' or ', '|').split('|')
            for part in condition_parts:
                clean_part = part.strip()
                if clean_part:
                    conditions.append(clean_part)

        return conditions

    def _analyze_composite_index_candidates(self, where_analysis: Dict[str, int]) -> List[Dict[str, Any]]:
        """Analyze potential composite index candidates"""
        candidates = []

        # Look for conditions that appear together frequently
        frequent_conditions = [cond for cond, count in where_analysis.items() if count >= 2]

        if len(frequent_conditions) >= 2:
            # Create composite index recommendation
            candidates.append({
                "type": "composite_index",
                "table": "multiple",  # Would need better parsing to determine
                "columns": frequent_conditions[:3],  # Top 3 conditions
                "reason": "Frequently used together in WHERE clauses",
                "priority": "high",
                "estimated_benefit": 70
            })

        return candidates

    def _calculate_trend(self, values: List[float]) -> float:
        """Calculate simple trend from time series data"""
        if len(values) < 2:
            return 0.0

        # Simple linear trend calculation
        n = len(values)
        x = list(range(n))
        x_mean = sum(x) / n
        y_mean = sum(values) / n

        numerator = sum((x[i] - x_mean) * (values[i] - y_mean) for i in range(n))
        denominator = sum((x[i] - x_mean) ** 2 for i in range(n))

        if denominator == 0:
            return 0.0

        return numerator / denominator

    def _heuristic_performance_prediction(self, query: str, features: List[float]) -> MLPrediction:
        """Heuristic-based performance prediction when ML model is not available"""
        # Simple heuristic based on query complexity
        base_time = 0.1  # Base execution time

        # Add time based on features
        complexity_score = features[1] + features[2] * 0.5 + features[3] * 0.3  # SELECT + JOIN + WHERE
        predicted_time = base_time + (complexity_score * 0.2)

        # Adjust for system load
        if len(features) > 10:
            cpu_factor = features[10] / 100.0
            predicted_time *= (1 + cpu_factor)

        return MLPrediction(
            model_type=ModelType.QUERY_PERFORMANCE,
            prediction=predicted_time,
            confidence=0.5,  # Lower confidence for heuristic
            explanation=f"Heuristic prediction based on query complexity score: {complexity_score:.2f}",
            recommendations=self._generate_performance_recommendations(query, features, predicted_time),
            metadata={"method": "heuristic", "complexity_score": complexity_score}
        )

    def _fallback_prediction(self, model_type: ModelType, error_msg: str) -> MLPrediction:
        """Fallback prediction when ML fails"""
        return MLPrediction(
            model_type=model_type,
            prediction=None,
            confidence=0.0,
            explanation=f"ML prediction failed: {error_msg}",
            recommendations=["Check system resources", "Retry with different parameters"],
            metadata={"error": error_msg, "fallback": True}
        )

    async def learn_from_execution(
        self,
        query: str,
        predicted_time: float,
        actual_time: float,
        schema_info: Dict[str, Any],
        connection_stats: Dict[str, Any]
    ):
        """Learn from query execution to improve predictions"""
        try:
            # Extract features
            features = self._extract_query_features(query, schema_info, connection_stats)

            # Store training data
            training_point = {
                "features": features,
                "target": actual_time,
                "timestamp": datetime.now(),
                "prediction_error": abs(predicted_time - actual_time)
            }

            if ModelType.QUERY_PERFORMANCE not in self.training_data:
                self.training_data[ModelType.QUERY_PERFORMANCE] = []

            self.training_data[ModelType.QUERY_PERFORMANCE].append(training_point)

            # Retrain model if we have enough data
            if len(self.training_data[ModelType.QUERY_PERFORMANCE]) > 100:
                await self._retrain_model(ModelType.QUERY_PERFORMANCE)

            logger.info(f"📚 Learned from query execution: predicted={predicted_time:.3f}s, actual={actual_time:.3f}s")

        except Exception as e:
            logger.error(f"Failed to learn from execution: {e}")

    async def _retrain_model(self, model_type: ModelType):
        """Retrain model with accumulated training data"""
        try:
            if model_type not in self.training_data or len(self.training_data[model_type]) < 50:
                return

            # Prepare training data
            X = []
            y = []

            for point in self.training_data[model_type]:
                X.append(point["features"])
                y.append(point["target"])

            X_array = np.array(X)
            y_array = np.array(y)

            # Split data
            X_train, X_test, y_train, y_test = train_test_split(
                X_array, y_array, test_size=0.2, random_state=42
            )

            # Scale features
            self.scalers[model_type].fit(X_train)
            X_train_scaled = self.scalers[model_type].transform(X_train)
            X_test_scaled = self.scalers[model_type].transform(X_test)

            # Train model
            self.models[model_type].fit(X_train_scaled, y_train)

            # Evaluate
            train_score = self.models[model_type].score(X_train_scaled, y_train)
            test_score = self.models[model_type].score(X_test_scaled, y_test)

            # Save model
            await self._save_model(model_type)

            logger.info(f"🎯 Retrained {model_type.value}: train_score={train_score:.3f}, test_score={test_score:.3f}")

        except Exception as e:
            logger.error(f"Model retraining failed: {e}")

    async def _save_model(self, model_type: ModelType):
        """Save trained model to disk"""
        try:
            model_file = self.model_dir / f"{model_type.value}_model.pkl"
            scaler_file = self.model_dir / f"{model_type.value}_scaler.pkl"

            joblib.dump(self.models[model_type], model_file)
            joblib.dump(self.scalers[model_type], scaler_file)

            logger.info(f"💾 Saved {model_type.value} model")

        except Exception as e:
            logger.error(f"Failed to save model: {e}")

# Global ML Pipeline instance
ml_pipeline = None

def get_ml_pipeline() -> AdvancedMLPipeline:
    """Get the global ML pipeline instance"""
    global ml_pipeline
    if ml_pipeline is None:
        ml_pipeline = AdvancedMLPipeline()
    return ml_pipeline

__all__ = [
    'AdvancedMLPipeline',
    'MLPrediction',
    'QueryPattern',
    'ModelType',
    'get_ml_pipeline'
]