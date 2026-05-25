"""
Query Optimizer Model
Custom ML model for SQL query optimization and performance prediction
"""

import time
import hashlib
import re
import numpy as np
import pandas as pd
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass
import pickle
import json

try:
    from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
    from sklearn.model_selection import train_test_split, cross_val_score
    from sklearn.preprocessing import StandardScaler, LabelEncoder
    from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score
    from sklearn.feature_extraction.text import TfidfVectorizer
    import xgboost as xgb
    import lightgbm as lgb
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False

try:
    import sqlparse
    from sqlparse import sql, tokens as sqlparse_tokens
    SQLPARSE_AVAILABLE = True
except ImportError:
    SQLPARSE_AVAILABLE = False

try:
    import torch
    import torch.nn as nn
    import torch.optim as optim
    from transformers import AutoTokenizer, AutoModel
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False

from .ml_config import MLConfig, ModelType

@dataclass
class QueryFeatures:
    """Extracted features from SQL query"""
    query_hash: str
    query_type: str  # SELECT, INSERT, UPDATE, DELETE, etc.
    query_length: int
    table_count: int
    join_count: int
    where_condition_count: int
    subquery_count: int
    aggregate_function_count: int
    has_order_by: bool
    has_group_by: bool
    has_distinct: bool
    has_limit: bool
    estimated_complexity_score: float
    syntactic_features: Dict[str, int]
    semantic_features: Optional[np.ndarray] = None

@dataclass
class OptimizationSuggestion:
    """Query optimization suggestion"""
    suggestion_type: str  # 'index', 'rewrite', 'structure', 'execution_plan'
    description: str
    original_query: str
    optimized_query: Optional[str]
    expected_improvement: float  # Estimated percentage improvement
    confidence: float
    priority: str  # 'high', 'medium', 'low'
    implementation_effort: str  # 'low', 'medium', 'high'

@dataclass
class QueryPerformanceMetrics:
    """Query performance metrics"""
    execution_time_ms: float
    rows_examined: int
    rows_returned: int
    index_usage: List[str]
    cache_hits: int
    cpu_usage: float
    memory_usage: float
    io_operations: int

class QueryOptimizerModel:
    """ML model for SQL query optimization and performance prediction"""

    def __init__(self, config: Optional[MLConfig] = None):
        self.config = config or MLConfig.create_default()

        # Models
        self.performance_predictor = None
        self.complexity_estimator = None
        self.optimization_classifier = None
        self.query_embedder = None

        # Feature extractors
        self.tfidf_vectorizer = None
        self.scaler = StandardScaler()
        self.label_encoders = {}

        # Training data
        self.training_queries = []
        self.training_features = []
        self.training_performance = []

        # Query patterns and rules
        self.optimization_rules = self._load_optimization_rules()
        self.query_patterns = {}

        # Statistics
        self.model_stats = {
            'trained_at': None,
            'training_samples': 0,
            'performance_metrics': {},
            'feature_importance': {}
        }

    def _load_optimization_rules(self) -> Dict[str, List[Dict]]:
        """Load predefined optimization rules"""
        return {
            'index_suggestions': [
                {
                    'pattern': r'WHERE\s+(\w+)\s*=',
                    'suggestion': 'Consider adding an index on column: {column}',
                    'priority': 'high'
                },
                {
                    'pattern': r'JOIN\s+\w+\s+ON\s+\w+\.(\w+)\s*=\s*\w+\.(\w+)',
                    'suggestion': 'Consider adding indexes on join columns: {columns}',
                    'priority': 'high'
                },
                {
                    'pattern': r'ORDER\s+BY\s+(\w+)',
                    'suggestion': 'Consider adding an index on ORDER BY column: {column}',
                    'priority': 'medium'
                }
            ],
            'query_rewrite': [
                {
                    'pattern': r'SELECT\s+\*\s+FROM',
                    'suggestion': 'Avoid SELECT * - specify only needed columns',
                    'priority': 'medium'
                },
                {
                    'pattern': r'(\w+)\s+IN\s+\(SELECT',
                    'suggestion': 'Consider using EXISTS instead of IN with subquery',
                    'priority': 'medium'
                },
                {
                    'pattern': r'LIKE\s+\'%.*%\'',
                    'suggestion': 'Avoid leading wildcards in LIKE patterns',
                    'priority': 'low'
                }
            ],
            'structural_optimizations': [
                {
                    'pattern': r'SELECT.*FROM.*WHERE.*OR.*OR',
                    'suggestion': 'Consider breaking complex OR conditions into UNION',
                    'priority': 'medium'
                },
                {
                    'pattern': r'(\w+)\s+IS\s+NOT\s+NULL',
                    'suggestion': 'Consider restructuring to avoid IS NOT NULL',
                    'priority': 'low'
                }
            ]
        }

    def extract_features(self, query: str, schema_info: Optional[Dict] = None) -> QueryFeatures:
        """Extract features from SQL query"""
        query_hash = hashlib.md5(query.encode()).hexdigest()[:12]

        # Basic features
        query_length = len(query)
        query_upper = query.upper()

        # Query type
        query_type = 'UNKNOWN'
        for qtype in ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP', 'ALTER']:
            if query_upper.strip().startswith(qtype):
                query_type = qtype
                break

        # Count features
        features = {
            'table_count': len(re.findall(r'\bFROM\s+(\w+)', query_upper)) +
                          len(re.findall(r'\bJOIN\s+(\w+)', query_upper)),
            'join_count': len(re.findall(r'\b(INNER|LEFT|RIGHT|FULL|CROSS)\s+JOIN\b', query_upper)),
            'where_condition_count': len(re.findall(r'\bWHERE\b', query_upper)),
            'subquery_count': query.count('(') - query.count('()'),
            'aggregate_function_count': len(re.findall(
                r'\b(COUNT|SUM|AVG|MIN|MAX|GROUP_CONCAT)\s*\(', query_upper
            ))
        }

        # Boolean features
        has_order_by = bool(re.search(r'\bORDER\s+BY\b', query_upper))
        has_group_by = bool(re.search(r'\bGROUP\s+BY\b', query_upper))
        has_distinct = bool(re.search(r'\bDISTINCT\b', query_upper))
        has_limit = bool(re.search(r'\bLIMIT\b', query_upper))

        # Complexity estimation
        complexity_score = self._estimate_query_complexity(query, features)

        # Syntactic features (keyword counts)
        syntactic_features = {}
        keywords = ['SELECT', 'FROM', 'WHERE', 'JOIN', 'GROUP', 'ORDER', 'HAVING',
                   'UNION', 'CASE', 'WHEN', 'LIKE', 'IN', 'EXISTS', 'NOT']

        for keyword in keywords:
            syntactic_features[f'{keyword.lower()}_count'] = len(
                re.findall(rf'\b{keyword}\b', query_upper)
            )

        # Semantic features (if available)
        semantic_features = None
        if self.query_embedder and TORCH_AVAILABLE:
            semantic_features = self._get_query_embeddings(query)

        return QueryFeatures(
            query_hash=query_hash,
            query_type=query_type,
            query_length=query_length,
            table_count=features['table_count'],
            join_count=features['join_count'],
            where_condition_count=features['where_condition_count'],
            subquery_count=features['subquery_count'],
            aggregate_function_count=features['aggregate_function_count'],
            has_order_by=has_order_by,
            has_group_by=has_group_by,
            has_distinct=has_distinct,
            has_limit=has_limit,
            estimated_complexity_score=complexity_score,
            syntactic_features=syntactic_features,
            semantic_features=semantic_features
        )

    def _estimate_query_complexity(self, query: str, features: Dict) -> float:
        """Estimate query complexity based on features"""
        complexity = 0.0

        # Base complexity from query type
        query_upper = query.upper()
        if query_upper.strip().startswith('SELECT'):
            complexity += 1.0
        elif query_upper.strip().startswith(('INSERT', 'UPDATE', 'DELETE')):
            complexity += 2.0
        elif query_upper.strip().startswith(('CREATE', 'ALTER', 'DROP')):
            complexity += 3.0

        # Add complexity based on features
        complexity += features['table_count'] * 0.5
        complexity += features['join_count'] * 1.0
        complexity += features['subquery_count'] * 2.0
        complexity += features['aggregate_function_count'] * 0.3

        # Complexity from special patterns
        if re.search(r'\bDISTINCT\b', query_upper):
            complexity += 1.0
        if re.search(r'\bGROUP\s+BY\b', query_upper):
            complexity += 1.5
        if re.search(r'\bORDER\s+BY\b', query_upper):
            complexity += 0.5
        if re.search(r'\bLIKE\s+[\'"][%].*[%][\'"]', query_upper):
            complexity += 2.0  # Full text search

        return min(complexity, 10.0)  # Cap at 10

    def _get_query_embeddings(self, query: str) -> Optional[np.ndarray]:
        """Get semantic embeddings for query (if available)"""
        try:
            if not hasattr(self, '_tokenizer') or self._tokenizer is None:
                return None

            # Tokenize and encode
            inputs = self._tokenizer(query, return_tensors='pt',
                                   max_length=512, truncation=True, padding=True)

            with torch.no_grad():
                outputs = self.query_embedder(**inputs)
                embeddings = outputs.last_hidden_state.mean(dim=1).numpy()

            return embeddings[0]  # Return first (and only) embedding

        except Exception as e:
            print(f"Error getting query embeddings: {e}")
            return None

    def add_training_sample(self, query: str, performance_metrics: QueryPerformanceMetrics,
                           schema_info: Optional[Dict] = None):
        """Add a training sample"""
        features = self.extract_features(query, schema_info)

        self.training_queries.append(query)
        self.training_features.append(features)
        self.training_performance.append(performance_metrics)

    def prepare_training_data(self) -> Tuple[np.ndarray, np.ndarray]:
        """Prepare training data for model training"""
        if not self.training_features:
            raise ValueError("No training data available")

        # Convert features to numerical format
        feature_vectors = []
        target_values = []

        for features, performance in zip(self.training_features, self.training_performance):
            # Numerical features
            feature_vector = [
                features.query_length,
                features.table_count,
                features.join_count,
                features.where_condition_count,
                features.subquery_count,
                features.aggregate_function_count,
                int(features.has_order_by),
                int(features.has_group_by),
                int(features.has_distinct),
                int(features.has_limit),
                features.estimated_complexity_score
            ]

            # Add syntactic features
            for value in features.syntactic_features.values():
                feature_vector.append(value)

            # Add semantic features if available
            if features.semantic_features is not None:
                feature_vector.extend(features.semantic_features)

            feature_vectors.append(feature_vector)
            target_values.append(performance.execution_time_ms)

        X = np.array(feature_vectors)
        y = np.array(target_values)

        return X, y

    def train_models(self) -> Dict[str, float]:
        """Train all ML models"""
        if not SKLEARN_AVAILABLE:
            raise ImportError("scikit-learn not available")

        X, y = self.prepare_training_data()

        if len(X) < self.config.min_training_samples:
            raise ValueError(f"Need at least {self.config.min_training_samples} samples, got {len(X)}")

        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=self.config.test_split, random_state=42
        )

        # Scale features
        X_train_scaled = self.scaler.fit_transform(X_train)
        X_test_scaled = self.scaler.transform(X_test)

        metrics = {}

        # Train performance predictor (main model)
        self.performance_predictor = self._train_performance_predictor(
            X_train_scaled, X_test_scaled, y_train, y_test
        )
        metrics.update(self.performance_predictor['metrics'])

        # Train complexity estimator
        complexity_targets = [f.estimated_complexity_score for f in self.training_features]
        complexity_train, complexity_test = train_test_split(
            complexity_targets, test_size=self.config.test_split, random_state=42
        )

        self.complexity_estimator = self._train_complexity_estimator(
            X_train_scaled, X_test_scaled, complexity_train, complexity_test
        )

        # Update model stats
        self.model_stats.update({
            'trained_at': time.time(),
            'training_samples': len(X),
            'performance_metrics': metrics,
            'feature_importance': self._get_feature_importance()
        })

        print(f"Training completed with {len(X)} samples")
        print(f"Performance predictor R²: {metrics.get('r2_score', 'N/A'):.3f}")

        return metrics

    def _train_performance_predictor(self, X_train, X_test, y_train, y_test) -> Dict:
        """Train the main performance prediction model"""
        models = {}
        metrics = {}

        # Random Forest
        rf_model = RandomForestRegressor(n_estimators=100, random_state=42)
        rf_model.fit(X_train, y_train)
        rf_pred = rf_model.predict(X_test)

        models['random_forest'] = rf_model
        metrics['rf_r2'] = r2_score(y_test, rf_pred)
        metrics['rf_mae'] = mean_absolute_error(y_test, rf_pred)
        metrics['rf_rmse'] = np.sqrt(mean_squared_error(y_test, rf_pred))

        # Gradient Boosting
        gb_model = GradientBoostingRegressor(n_estimators=100, random_state=42)
        gb_model.fit(X_train, y_train)
        gb_pred = gb_model.predict(X_test)

        models['gradient_boosting'] = gb_model
        metrics['gb_r2'] = r2_score(y_test, gb_pred)
        metrics['gb_mae'] = mean_absolute_error(y_test, gb_pred)
        metrics['gb_rmse'] = np.sqrt(mean_squared_error(y_test, gb_pred))

        # XGBoost (if available)
        try:
            xgb_model = xgb.XGBRegressor(n_estimators=100, random_state=42)
            xgb_model.fit(X_train, y_train)
            xgb_pred = xgb_model.predict(X_test)

            models['xgboost'] = xgb_model
            metrics['xgb_r2'] = r2_score(y_test, xgb_pred)
            metrics['xgb_mae'] = mean_absolute_error(y_test, xgb_pred)
            metrics['xgb_rmse'] = np.sqrt(mean_squared_error(y_test, xgb_pred))
        except:
            pass

        # Select best model based on R² score
        best_model_name = 'random_forest'
        best_r2 = metrics.get('rf_r2', 0)

        for model_name in ['gradient_boosting', 'xgboost']:
            r2_key = f"{model_name.split('_')[0]}_r2"
            if r2_key in metrics and metrics[r2_key] > best_r2:
                best_model_name = model_name
                best_r2 = metrics[r2_key]

        best_model = models[best_model_name]

        # Overall metrics
        metrics['r2_score'] = best_r2
        metrics['best_model'] = best_model_name

        return {
            'model': best_model,
            'all_models': models,
            'metrics': metrics
        }

    def _train_complexity_estimator(self, X_train, X_test, y_train, y_test) -> Dict:
        """Train complexity estimation model"""
        model = RandomForestRegressor(n_estimators=50, random_state=42)
        model.fit(X_train, y_train)

        predictions = model.predict(X_test)
        r2 = r2_score(y_test, predictions)

        return {
            'model': model,
            'r2_score': r2
        }

    def _get_feature_importance(self) -> Dict[str, float]:
        """Get feature importance from the main model"""
        if not self.performance_predictor:
            return {}

        model = self.performance_predictor['model']
        if hasattr(model, 'feature_importances_'):
            # Create feature names
            feature_names = [
                'query_length', 'table_count', 'join_count', 'where_count',
                'subquery_count', 'aggregate_count', 'has_order_by', 'has_group_by',
                'has_distinct', 'has_limit', 'complexity_score'
            ]

            # Add syntactic feature names
            if self.training_features:
                sample_features = self.training_features[0]
                feature_names.extend(sample_features.syntactic_features.keys())

            importances = model.feature_importances_
            if len(importances) == len(feature_names):
                return dict(zip(feature_names, importances))

        return {}

    def predict_performance(self, query: str, schema_info: Optional[Dict] = None) -> Dict[str, Any]:
        """Predict query performance"""
        if not self.performance_predictor:
            raise ValueError("Model not trained yet")

        features = self.extract_features(query, schema_info)
        feature_vector = self._features_to_vector(features)
        feature_vector_scaled = self.scaler.transform([feature_vector])

        model = self.performance_predictor['model']
        predicted_time = model.predict(feature_vector_scaled)[0]

        # Get prediction confidence (if available)
        confidence = 0.5  # Default
        if hasattr(model, 'predict_proba'):
            try:
                # For models that support it, calculate confidence
                predictions = []
                for estimator in model.estimators_:
                    predictions.append(estimator.predict(feature_vector_scaled)[0])
                confidence = 1.0 - (np.std(predictions) / np.mean(predictions))
            except:
                pass

        return {
            'predicted_execution_time_ms': max(0, predicted_time),
            'confidence': min(1.0, max(0.0, confidence)),
            'query_complexity': features.estimated_complexity_score,
            'feature_vector': feature_vector
        }

    def _features_to_vector(self, features: QueryFeatures) -> List[float]:
        """Convert QueryFeatures to numerical vector"""
        vector = [
            features.query_length,
            features.table_count,
            features.join_count,
            features.where_condition_count,
            features.subquery_count,
            features.aggregate_function_count,
            int(features.has_order_by),
            int(features.has_group_by),
            int(features.has_distinct),
            int(features.has_limit),
            features.estimated_complexity_score
        ]

        # Add syntactic features
        for value in features.syntactic_features.values():
            vector.append(value)

        # Add semantic features if available
        if features.semantic_features is not None:
            vector.extend(features.semantic_features)

        return vector

    def suggest_optimizations(self, query: str, schema_info: Optional[Dict] = None) -> List[OptimizationSuggestion]:
        """Suggest query optimizations"""
        suggestions = []

        # Rule-based suggestions
        suggestions.extend(self._get_rule_based_suggestions(query))

        # ML-based suggestions (if model is trained)
        if self.performance_predictor:
            suggestions.extend(self._get_ml_based_suggestions(query, schema_info))

        # Sort by priority and confidence
        suggestions.sort(key=lambda x: (
            {'high': 3, 'medium': 2, 'low': 1}[x.priority],
            x.confidence
        ), reverse=True)

        return suggestions

    def _get_rule_based_suggestions(self, query: str) -> List[OptimizationSuggestion]:
        """Get rule-based optimization suggestions"""
        suggestions = []
        query_upper = query.upper()

        for category, rules in self.optimization_rules.items():
            for rule in rules:
                pattern = rule['pattern']
                matches = re.finditer(pattern, query_upper)

                for match in matches:
                    suggestion_text = rule['suggestion']

                    # Extract column names from match
                    if match.groups():
                        if 'column' in suggestion_text:
                            column = match.group(1)
                            suggestion_text = suggestion_text.format(column=column)
                        elif 'columns' in suggestion_text and len(match.groups()) >= 2:
                            columns = f"{match.group(1)}, {match.group(2)}"
                            suggestion_text = suggestion_text.format(columns=columns)

                    suggestions.append(OptimizationSuggestion(
                        suggestion_type=category,
                        description=suggestion_text,
                        original_query=query,
                        optimized_query=None,  # Rule-based don't provide rewrites
                        expected_improvement=self._estimate_rule_improvement(rule),
                        confidence=0.7,
                        priority=rule['priority'],
                        implementation_effort='low' if category == 'index_suggestions' else 'medium'
                    ))

        return suggestions

    def _get_ml_based_suggestions(self, query: str, schema_info: Optional[Dict] = None) -> List[OptimizationSuggestion]:
        """Get ML-based optimization suggestions"""
        suggestions = []

        # Predict current performance
        current_prediction = self.predict_performance(query, schema_info)
        current_time = current_prediction['predicted_execution_time_ms']
        complexity = current_prediction['query_complexity']

        # Generate variations and predict their performance
        variations = self._generate_query_variations(query)

        for variation_type, optimized_query in variations:
            try:
                optimized_prediction = self.predict_performance(optimized_query, schema_info)
                optimized_time = optimized_prediction['predicted_execution_time_ms']

                if optimized_time < current_time:
                    improvement = ((current_time - optimized_time) / current_time) * 100

                    suggestions.append(OptimizationSuggestion(
                        suggestion_type='ml_optimization',
                        description=f"ML suggests {variation_type} optimization",
                        original_query=query,
                        optimized_query=optimized_query,
                        expected_improvement=improvement,
                        confidence=0.6,
                        priority='high' if improvement > 20 else 'medium',
                        implementation_effort='low'
                    ))
            except:
                continue

        return suggestions

    def _generate_query_variations(self, query: str) -> List[Tuple[str, str]]:
        """Generate query variations for optimization testing"""
        variations = []
        query_upper = query.upper()

        # Add LIMIT if missing and it's a SELECT
        if query_upper.strip().startswith('SELECT') and 'LIMIT' not in query_upper:
            variations.append(('add_limit', query.rstrip(';') + ' LIMIT 1000;'))

        # Replace SELECT * with specific columns (simplified)
        if 'SELECT *' in query_upper:
            # This would need more sophisticated logic to determine actual columns
            variations.append(('select_specific', query.replace('SELECT *', 'SELECT id, name')))

        # Add more variations based on patterns...

        return variations

    def _estimate_rule_improvement(self, rule: Dict) -> float:
        """Estimate improvement percentage for rule-based suggestions"""
        # Simple heuristic based on rule type and priority
        base_improvement = {
            'high': 25.0,
            'medium': 15.0,
            'low': 5.0
        }
        return base_improvement.get(rule['priority'], 10.0)

    def learn_from_execution(self, query: str, actual_performance: QueryPerformanceMetrics):
        """Learn from actual query execution"""
        # Add to training data
        self.add_training_sample(query, actual_performance)

        # If we have enough new samples, consider retraining
        if len(self.training_features) % 100 == 0:  # Every 100 new samples
            if self.performance_predictor:
                try:
                    self.train_models()
                    print("Model retrained with new data")
                except Exception as e:
                    print(f"Retraining failed: {e}")

    def get_model_stats(self) -> Dict[str, Any]:
        """Get model statistics"""
        stats = dict(self.model_stats)
        stats['total_queries_seen'] = len(self.training_features)

        if self.performance_predictor:
            stats['model_available'] = True
            stats['model_type'] = self.performance_predictor.get('best_model', 'unknown')
        else:
            stats['model_available'] = False

        return stats

    def save_model(self, filepath: str):
        """Save the trained model"""
        model_data = {
            'performance_predictor': self.performance_predictor,
            'complexity_estimator': self.complexity_estimator,
            'scaler': self.scaler,
            'model_stats': self.model_stats,
            'optimization_rules': self.optimization_rules,
            'config': self.config
        }

        with open(filepath, 'wb') as f:
            pickle.dump(model_data, f)

    def load_model(self, filepath: str):
        """Load a trained model"""
        with open(filepath, 'rb') as f:
            model_data = pickle.load(f)

        self.performance_predictor = model_data['performance_predictor']
        self.complexity_estimator = model_data['complexity_estimator']
        self.scaler = model_data['scaler']
        self.model_stats = model_data['model_stats']
        self.optimization_rules = model_data.get('optimization_rules', self._load_optimization_rules())

        if 'config' in model_data:
            self.config = model_data['config']