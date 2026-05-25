"""
Query Pattern Learning System
Learn from query patterns to provide intelligent suggestions and auto-completion
"""

import re
import time
import json
import hashlib
from typing import Dict, List, Optional, Any, Tuple, Set
from dataclasses import dataclass, field
from collections import defaultdict, Counter
from datetime import datetime, timedelta
import threading
from pathlib import Path

try:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.cluster import KMeans
    from sklearn.metrics.pairwise import cosine_similarity
    import numpy as np
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False

from .config import AIConfig

@dataclass
class QueryPattern:
    """Represents a learned query pattern"""
    pattern_id: str
    template: str
    frequency: int
    avg_execution_time: float
    success_rate: float
    category: str  # 'select', 'join', 'aggregate', 'insert', 'update', 'delete'
    tables_involved: List[str]
    common_columns: List[str]
    parameters: List[str] = field(default_factory=list)
    examples: List[str] = field(default_factory=list)
    last_used: float = 0.0

@dataclass
class QuerySuggestion:
    """Query suggestion with context"""
    suggestion: str
    confidence: float
    category: str
    reason: str
    template_id: Optional[str] = None
    estimated_performance: str = "unknown"

@dataclass
class AutoCompletionItem:
    """Auto-completion suggestion"""
    text: str
    type: str  # 'keyword', 'table', 'column', 'function', 'template'
    context: str
    score: float
    metadata: Dict[str, Any] = field(default_factory=dict)

class QueryPatternLearner:
    """Learn from query patterns to provide intelligent suggestions"""
    
    def __init__(self, conn_params: Dict[str, str], config: Optional[AIConfig] = None):
        self.conn_params = conn_params
        self.config = config or AIConfig.create_default()
        
        # Pattern storage
        self.patterns: Dict[str, QueryPattern] = {}
        self.query_history: List[Dict[str, Any]] = []
        
        # Learning components
        self.vectorizer = None
        self.pattern_clusters = None
        self.schema_cache = {}
        
        # Statistics
        self.stats = {
            'queries_learned': 0,
            'patterns_identified': 0,
            'suggestions_provided': 0,
            'last_analysis': 0
        }
        
        # Load persisted patterns
        self._load_patterns()
        
        # Start background learning if enabled
        if config and config.enable_query_learner:
            self._start_background_learning()
    
    def _load_patterns(self):
        """Load previously learned patterns from disk"""
        try:
            cache_dir = self.config.get_cache_dir()
            patterns_file = cache_dir / "query_patterns.json"
            
            if patterns_file.exists():
                with open(patterns_file, 'r') as f:
                    data = json.load(f)
                    
                # Reconstruct patterns
                for pattern_data in data.get('patterns', []):
                    pattern = QueryPattern(**pattern_data)
                    self.patterns[pattern.pattern_id] = pattern
                
                self.stats.update(data.get('stats', {}))
                
        except Exception as e:
            print(f"Error loading query patterns: {e}")
    
    def _save_patterns(self):
        """Save learned patterns to disk"""
        try:
            cache_dir = self.config.get_cache_dir()
            cache_dir.mkdir(parents=True, exist_ok=True)
            
            patterns_file = cache_dir / "query_patterns.json"
            
            # Convert patterns to serializable format
            patterns_data = []
            for pattern in self.patterns.values():
                patterns_data.append({
                    'pattern_id': pattern.pattern_id,
                    'template': pattern.template,
                    'frequency': pattern.frequency,
                    'avg_execution_time': pattern.avg_execution_time,
                    'success_rate': pattern.success_rate,
                    'category': pattern.category,
                    'tables_involved': pattern.tables_involved,
                    'common_columns': pattern.common_columns,
                    'parameters': pattern.parameters,
                    'examples': pattern.examples[:5],  # Keep only recent examples
                    'last_used': pattern.last_used
                })
            
            data = {
                'patterns': patterns_data,
                'stats': self.stats,
                'updated_at': time.time()
            }
            
            with open(patterns_file, 'w') as f:
                json.dump(data, f, indent=2)
                
        except Exception as e:
            print(f"Error saving query patterns: {e}")
    
    def _start_background_learning(self):
        """Start background thread for continuous learning"""
        def learning_loop():
            while True:
                try:
                    # Analyze patterns every hour
                    time.sleep(3600)
                    self._analyze_patterns()
                except Exception as e:
                    print(f"Error in background learning: {e}")
        
        thread = threading.Thread(target=learning_loop, daemon=True)
        thread.start()
    
    def learn_from_query(self, query: str, execution_time: float = 0.0, 
                        success: bool = True, result_count: int = 0):
        """Learn from a single query execution"""
        if not query or not query.strip():
            return
        
        # Clean and normalize the query
        normalized_query = self._normalize_query(query)
        
        # Extract query information
        query_info = self._extract_query_info(normalized_query)
        
        # Create or update pattern
        pattern_id = self._generate_pattern_id(query_info)
        
        if pattern_id in self.patterns:
            # Update existing pattern
            pattern = self.patterns[pattern_id]
            pattern.frequency += 1
            
            # Update average execution time
            total_time = pattern.avg_execution_time * (pattern.frequency - 1) + execution_time
            pattern.avg_execution_time = total_time / pattern.frequency
            
            # Update success rate
            total_successes = pattern.success_rate * (pattern.frequency - 1) + (1 if success else 0)
            pattern.success_rate = total_successes / pattern.frequency
            
            # Add example if not too similar to existing ones
            if self._should_add_example(query, pattern.examples):
                pattern.examples.append(query)
                pattern.examples = pattern.examples[-10:]  # Keep last 10 examples
            
            pattern.last_used = time.time()
            
        else:
            # Create new pattern
            pattern = QueryPattern(
                pattern_id=pattern_id,
                template=query_info['template'],
                frequency=1,
                avg_execution_time=execution_time,
                success_rate=1.0 if success else 0.0,
                category=query_info['category'],
                tables_involved=query_info['tables'],
                common_columns=query_info['columns'],
                parameters=query_info['parameters'],
                examples=[query],
                last_used=time.time()
            )
            self.patterns[pattern_id] = pattern
            self.stats['patterns_identified'] += 1
        
        # Add to query history
        self.query_history.append({
            'query': query,
            'normalized': normalized_query,
            'pattern_id': pattern_id,
            'execution_time': execution_time,
            'success': success,
            'result_count': result_count,
            'timestamp': time.time()
        })
        
        # Limit history size
        if len(self.query_history) > 10000:
            self.query_history = self.query_history[-5000:]  # Keep last 5000
        
        self.stats['queries_learned'] += 1
        
        # Periodically save patterns
        if self.stats['queries_learned'] % 50 == 0:
            self._save_patterns()
    
    def _normalize_query(self, query: str) -> str:
        """Normalize query for pattern matching"""
        # Remove comments
        query = re.sub(r'--.*?\n', '\n', query)
        query = re.sub(r'/\*.*?\*/', '', query, flags=re.DOTALL)
        
        # Normalize whitespace
        query = ' '.join(query.split())
        
        # Convert to lowercase for analysis
        return query.lower().strip()
    
    def _extract_query_info(self, query: str) -> Dict[str, Any]:
        """Extract structured information from query"""
        info = {
            'template': query,
            'category': 'unknown',
            'tables': [],
            'columns': [],
            'parameters': []
        }
        
        # Determine query category
        query_upper = query.upper()
        if query_upper.startswith('SELECT'):
            info['category'] = 'select'
        elif query_upper.startswith('INSERT'):
            info['category'] = 'insert'
        elif query_upper.startswith('UPDATE'):
            info['category'] = 'update'
        elif query_upper.startswith('DELETE'):
            info['category'] = 'delete'
        elif any(query_upper.startswith(cmd) for cmd in ['CREATE', 'ALTER', 'DROP']):
            info['category'] = 'ddl'
        
        # Extract tables
        table_patterns = [
            r'from\s+(\w+)',
            r'join\s+(\w+)',
            r'update\s+(\w+)',
            r'insert\s+into\s+(\w+)',
            r'delete\s+from\s+(\w+)'
        ]
        
        for pattern in table_patterns:
            matches = re.findall(pattern, query, re.IGNORECASE)
            info['tables'].extend(matches)
        
        # Remove duplicates and common keywords
        info['tables'] = list(set(info['tables']))
        info['tables'] = [t for t in info['tables'] if t.lower() not in 
                         ['select', 'from', 'where', 'order', 'group', 'having', 'limit']]
        
        # Extract columns (basic extraction)
        if info['category'] == 'select':
            # Try to extract SELECT columns
            select_match = re.search(r'select\s+(.+?)\s+from', query, re.IGNORECASE)
            if select_match:
                select_part = select_match.group(1)
                if select_part != '*':
                    columns = [col.strip() for col in select_part.split(',')]
                    # Clean column names (remove aliases, functions, etc.)
                    clean_columns = []
                    for col in columns:
                        col_match = re.search(r'(\w+)(?:\s+as\s+\w+)?$', col.strip(), re.IGNORECASE)
                        if col_match:
                            clean_columns.append(col_match.group(1))
                    info['columns'] = clean_columns
        
        # Create template by replacing literal values with placeholders
        template = self._create_template(query)
        info['template'] = template
        
        # Extract parameters (placeholders)
        info['parameters'] = re.findall(r'\$\d+|\?|:\w+', query)
        
        return info
    
    def _create_template(self, query: str) -> str:
        """Create a template from query by replacing literals with placeholders"""
        template = query
        
        # Replace string literals
        template = re.sub(r"'[^']*'", '?', template)
        template = re.sub(r'"[^"]*"', '?', template)
        
        # Replace numeric literals
        template = re.sub(r'\b\d+\.?\d*\b', '?', template)
        
        # Replace IN lists
        template = re.sub(r'in\s*\([^)]+\)', 'in (?)', template, flags=re.IGNORECASE)
        
        return template
    
    def _generate_pattern_id(self, query_info: Dict[str, Any]) -> str:
        """Generate unique ID for query pattern"""
        # Create signature from template and structure
        signature_parts = [
            query_info['category'],
            query_info['template'],
            ','.join(sorted(query_info['tables'])),
            ','.join(sorted(query_info['columns'][:5]))  # Limit columns for grouping
        ]
        
        signature = '|'.join(signature_parts)
        return hashlib.md5(signature.encode()).hexdigest()[:12]
    
    def _should_add_example(self, query: str, existing_examples: List[str]) -> bool:
        """Determine if query should be added as an example"""
        if len(existing_examples) < 3:
            return True
        
        # Check similarity to existing examples
        for example in existing_examples[-3:]:  # Check last 3 examples
            if self._calculate_query_similarity(query, example) > 0.8:
                return False
        
        return True
    
    def _calculate_query_similarity(self, query1: str, query2: str) -> float:
        """Calculate similarity between two queries"""
        if not SKLEARN_AVAILABLE:
            # Simple character-based similarity
            return len(set(query1.lower()) & set(query2.lower())) / len(set(query1.lower()) | set(query2.lower()))
        
        try:
            vectorizer = TfidfVectorizer(ngram_range=(1, 2))
            tfidf = vectorizer.fit_transform([query1, query2])
            return cosine_similarity(tfidf[0], tfidf[1])[0][0]
        except:
            return 0.5  # Default similarity
    
    def _analyze_patterns(self):
        """Analyze learned patterns for insights"""
        if not self.patterns or not SKLEARN_AVAILABLE:
            return
        
        try:
            # Vectorize query templates
            templates = [pattern.template for pattern in self.patterns.values()]
            
            if len(templates) < 3:
                return
            
            self.vectorizer = TfidfVectorizer(
                max_features=1000,
                ngram_range=(1, 3),
                stop_words='english'
            )
            
            template_vectors = self.vectorizer.fit_transform(templates)
            
            # Cluster similar patterns
            n_clusters = min(10, len(templates) // 3)
            if n_clusters > 1:
                self.pattern_clusters = KMeans(n_clusters=n_clusters, random_state=42)
                cluster_labels = self.pattern_clusters.fit_predict(template_vectors)
                
                # Update patterns with cluster information
                for i, pattern in enumerate(self.patterns.values()):
                    pattern.metadata = getattr(pattern, 'metadata', {})
                    pattern.metadata['cluster'] = int(cluster_labels[i])
            
            self.stats['last_analysis'] = time.time()
            
        except Exception as e:
            print(f"Error analyzing patterns: {e}")
    
    def get_query_suggestions(self, partial_query: str, context: Dict[str, Any] = None) -> List[QuerySuggestion]:
        """Get query suggestions based on learned patterns"""
        suggestions = []
        
        if not partial_query:
            return self._get_popular_templates()
        
        partial_normalized = self._normalize_query(partial_query)
        partial_info = self._extract_query_info(partial_normalized)
        
        # Find similar patterns
        similar_patterns = self._find_similar_patterns(partial_info)
        
        for pattern, similarity in similar_patterns[:5]:  # Top 5 suggestions
            # Generate suggestion based on pattern
            suggestion = self._generate_suggestion_from_pattern(pattern, partial_query)
            
            suggestions.append(QuerySuggestion(
                suggestion=suggestion,
                confidence=similarity * (pattern.frequency / max(p.frequency for p in self.patterns.values())),
                category=pattern.category,
                reason=f"Based on {pattern.frequency} similar queries",
                template_id=pattern.pattern_id,
                estimated_performance="fast" if pattern.avg_execution_time < 1.0 else "moderate"
            ))
        
        self.stats['suggestions_provided'] += len(suggestions)
        return suggestions
    
    def _get_popular_templates(self) -> List[QuerySuggestion]:
        """Get popular query templates for empty input"""
        suggestions = []
        
        # Sort patterns by frequency
        popular_patterns = sorted(
            self.patterns.values(), 
            key=lambda p: p.frequency, 
            reverse=True
        )[:10]
        
        for pattern in popular_patterns:
            if pattern.examples:
                suggestions.append(QuerySuggestion(
                    suggestion=pattern.examples[0],  # Use first example
                    confidence=0.8,
                    category=pattern.category,
                    reason=f"Popular template (used {pattern.frequency} times)",
                    template_id=pattern.pattern_id
                ))
        
        return suggestions
    
    def _find_similar_patterns(self, query_info: Dict[str, Any]) -> List[Tuple[QueryPattern, float]]:
        """Find patterns similar to the given query info"""
        similarities = []
        
        for pattern in self.patterns.values():
            similarity = self._calculate_pattern_similarity(query_info, pattern)
            if similarity > 0.3:  # Minimum similarity threshold
                similarities.append((pattern, similarity))
        
        # Sort by similarity
        similarities.sort(key=lambda x: x[1], reverse=True)
        return similarities
    
    def _calculate_pattern_similarity(self, query_info: Dict[str, Any], pattern: QueryPattern) -> float:
        """Calculate similarity between query info and pattern"""
        score = 0.0
        
        # Category match
        if query_info['category'] == pattern.category:
            score += 0.3
        
        # Table overlap
        query_tables = set(query_info['tables'])
        pattern_tables = set(pattern.tables_involved)
        if query_tables and pattern_tables:
            table_overlap = len(query_tables & pattern_tables) / len(query_tables | pattern_tables)
            score += table_overlap * 0.4
        
        # Column overlap
        query_columns = set(query_info['columns'])
        pattern_columns = set(pattern.common_columns)
        if query_columns and pattern_columns:
            column_overlap = len(query_columns & pattern_columns) / len(query_columns | pattern_columns)
            score += column_overlap * 0.2
        
        # Template similarity (if available)
        if SKLEARN_AVAILABLE and self.vectorizer:
            try:
                query_template = query_info['template']
                pattern_template = pattern.template
                
                template_vectors = self.vectorizer.transform([query_template, pattern_template])
                template_similarity = cosine_similarity(template_vectors[0], template_vectors[1])[0][0]
                score += template_similarity * 0.1
            except:
                pass
        
        return score
    
    def _generate_suggestion_from_pattern(self, pattern: QueryPattern, partial_query: str) -> str:
        """Generate a query suggestion from a pattern"""
        if pattern.examples:
            # Use the most recent example as base
            base_example = pattern.examples[-1]
            
            # Try to adapt it to the partial query
            # This is a simplified approach - in practice, you'd want more sophisticated merging
            if len(partial_query.strip()) > len(base_example.strip()) * 0.5:
                return partial_query  # User has already typed most of it
            else:
                return base_example
        else:
            return pattern.template
    
    def get_auto_completion(self, partial_query: str, cursor_position: int = -1) -> List[AutoCompletionItem]:
        """Get auto-completion suggestions for query"""
        if cursor_position == -1:
            cursor_position = len(partial_query)
        
        # Get the word being typed
        before_cursor = partial_query[:cursor_position]
        current_word = self._get_current_word(before_cursor)
        
        completions = []
        
        # Add SQL keywords
        completions.extend(self._get_keyword_completions(current_word, before_cursor))
        
        # Add table names
        completions.extend(self._get_table_completions(current_word, before_cursor))
        
        # Add column names
        completions.extend(self._get_column_completions(current_word, before_cursor))
        
        # Add function names
        completions.extend(self._get_function_completions(current_word))
        
        # Add template completions
        completions.extend(self._get_template_completions(partial_query))
        
        # Sort by score
        completions.sort(key=lambda x: x.score, reverse=True)
        
        return completions[:20]  # Return top 20 suggestions
    
    def _get_current_word(self, text: str) -> str:
        """Extract the current word being typed"""
        words = re.split(r'\s+', text)
        return words[-1] if words else ""
    
    def _get_keyword_completions(self, current_word: str, context: str) -> List[AutoCompletionItem]:
        """Get SQL keyword completions"""
        keywords = [
            'SELECT', 'FROM', 'WHERE', 'JOIN', 'INNER JOIN', 'LEFT JOIN', 'RIGHT JOIN',
            'ORDER BY', 'GROUP BY', 'HAVING', 'LIMIT', 'OFFSET', 'INSERT', 'UPDATE',
            'DELETE', 'CREATE', 'ALTER', 'DROP', 'INDEX', 'TABLE', 'VIEW', 'AND', 'OR',
            'NOT', 'NULL', 'IS', 'IN', 'BETWEEN', 'LIKE', 'EXISTS', 'CASE', 'WHEN',
            'THEN', 'ELSE', 'END', 'COUNT', 'SUM', 'AVG', 'MAX', 'MIN', 'DISTINCT'
        ]
        
        completions = []
        current_upper = current_word.upper()
        
        for keyword in keywords:
            if keyword.startswith(current_upper):
                score = 1.0 - (len(keyword) - len(current_word)) * 0.1
                completions.append(AutoCompletionItem(
                    text=keyword,
                    type='keyword',
                    context='SQL keyword',
                    score=max(0.1, score)
                ))
        
        return completions
    
    def _get_table_completions(self, current_word: str, context: str) -> List[AutoCompletionItem]:
        """Get table name completions"""
        completions = []
        
        # Get table names from patterns
        all_tables = set()
        for pattern in self.patterns.values():
            all_tables.update(pattern.tables_involved)
        
        for table in all_tables:
            if table.lower().startswith(current_word.lower()):
                score = 0.8 - (len(table) - len(current_word)) * 0.05
                completions.append(AutoCompletionItem(
                    text=table,
                    type='table',
                    context='Database table',
                    score=max(0.1, score)
                ))
        
        return completions
    
    def _get_column_completions(self, current_word: str, context: str) -> List[AutoCompletionItem]:
        """Get column name completions"""
        completions = []
        
        # Get column names from patterns
        all_columns = set()
        for pattern in self.patterns.values():
            all_columns.update(pattern.common_columns)
        
        for column in all_columns:
            if column.lower().startswith(current_word.lower()):
                score = 0.7 - (len(column) - len(current_word)) * 0.05
                completions.append(AutoCompletionItem(
                    text=column,
                    type='column',
                    context='Database column',
                    score=max(0.1, score)
                ))
        
        return completions
    
    def _get_function_completions(self, current_word: str) -> List[AutoCompletionItem]:
        """Get SQL function completions"""
        functions = [
            'COUNT', 'SUM', 'AVG', 'MAX', 'MIN', 'COALESCE', 'NULLIF',
            'UPPER', 'LOWER', 'TRIM', 'LENGTH', 'SUBSTRING', 'REPLACE',
            'NOW', 'DATE_PART', 'DATE_TRUNC', 'AGE', 'EXTRACT',
            'CAST', 'CONCAT', 'FORMAT', 'ROUND', 'CEIL', 'FLOOR', 'ABS'
        ]
        
        completions = []
        current_upper = current_word.upper()
        
        for func in functions:
            if func.startswith(current_upper):
                score = 0.6 - (len(func) - len(current_word)) * 0.05
                completions.append(AutoCompletionItem(
                    text=f"{func}(",
                    type='function',
                    context='SQL function',
                    score=max(0.1, score)
                ))
        
        return completions
    
    def _get_template_completions(self, partial_query: str) -> List[AutoCompletionItem]:
        """Get template-based completions"""
        completions = []
        
        # Find patterns that could complete this query
        partial_info = self._extract_query_info(self._normalize_query(partial_query))
        similar_patterns = self._find_similar_patterns(partial_info)
        
        for pattern, similarity in similar_patterns[:3]:  # Top 3 templates
            if pattern.examples:
                example = pattern.examples[-1]  # Most recent example
                
                # Check if this could be a completion
                if len(example) > len(partial_query) and similarity > 0.5:
                    completions.append(AutoCompletionItem(
                        text=example,
                        type='template',
                        context=f'Query template (used {pattern.frequency} times)',
                        score=similarity * 0.5,
                        metadata={'pattern_id': pattern.pattern_id}
                    ))
        
        return completions
    
    def get_pattern_statistics(self) -> Dict[str, Any]:
        """Get statistics about learned patterns"""
        if not self.patterns:
            return {'total_patterns': 0}
        
        patterns = list(self.patterns.values())
        
        # Category distribution
        categories = Counter(p.category for p in patterns)
        
        # Table usage
        table_usage = Counter()
        for p in patterns:
            table_usage.update(p.tables_involved)
        
        # Performance statistics
        avg_exec_times = [p.avg_execution_time for p in patterns if p.avg_execution_time > 0]
        
        return {
            'total_patterns': len(patterns),
            'total_queries_learned': self.stats['queries_learned'],
            'category_distribution': dict(categories),
            'most_used_tables': dict(table_usage.most_common(10)),
            'avg_execution_time': np.mean(avg_exec_times) if avg_exec_times else 0,
            'most_frequent_patterns': [
                {'template': p.template[:100], 'frequency': p.frequency, 'category': p.category}
                for p in sorted(patterns, key=lambda x: x.frequency, reverse=True)[:5]
            ],
            'recent_activity': len([
                p for p in patterns 
                if p.last_used > time.time() - 86400  # Last 24 hours
            ])
        }
    
    def export_patterns(self, filepath: str):
        """Export patterns to a file"""
        try:
            export_data = {
                'metadata': {
                    'exported_at': time.time(),
                    'total_patterns': len(self.patterns),
                    'statistics': self.get_pattern_statistics()
                },
                'patterns': []
            }
            
            for pattern in self.patterns.values():
                export_data['patterns'].append({
                    'pattern_id': pattern.pattern_id,
                    'template': pattern.template,
                    'frequency': pattern.frequency,
                    'category': pattern.category,
                    'tables_involved': pattern.tables_involved,
                    'common_columns': pattern.common_columns,
                    'avg_execution_time': pattern.avg_execution_time,
                    'success_rate': pattern.success_rate,
                    'examples': pattern.examples[:3]  # Include a few examples
                })
            
            with open(filepath, 'w') as f:
                json.dump(export_data, f, indent=2)
                
        except Exception as e:
            raise Exception(f"Failed to export patterns: {e}")
    
    def clear_patterns(self, older_than_days: Optional[int] = None):
        """Clear learned patterns, optionally only older ones"""
        if older_than_days:
            cutoff_time = time.time() - (older_than_days * 86400)
            patterns_to_remove = [
                pid for pid, pattern in self.patterns.items()
                if pattern.last_used < cutoff_time
            ]
            
            for pid in patterns_to_remove:
                del self.patterns[pid]
        else:
            self.patterns.clear()
            self.query_history.clear()
        
        self._save_patterns()