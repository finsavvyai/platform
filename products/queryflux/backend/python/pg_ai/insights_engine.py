"""
Data Insights Engine
AI-powered data analysis and insights generation for PostgreSQL databases
"""

import time
import numpy as np
import pandas as pd
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, field
from datetime import datetime, timedelta
import json
import re
import psycopg2
import psycopg2.extras

try:
    from scipy import stats
    from sklearn.preprocessing import StandardScaler
    from sklearn.decomposition import PCA
    from sklearn.cluster import KMeans
    import matplotlib.pyplot as plt
    import seaborn as sns
    SCIPY_AVAILABLE = True
    SKLEARN_AVAILABLE = True
except ImportError:
    SCIPY_AVAILABLE = False
    SKLEARN_AVAILABLE = False

from .config import AIConfig

@dataclass
class DataInsight:
    """Individual data insight"""
    insight_type: str  # 'correlation', 'anomaly', 'trend', 'distribution', 'quality'
    title: str
    description: str
    confidence: float  # 0.0 to 1.0
    severity: str  # 'info', 'warning', 'critical'
    table_name: Optional[str] = None
    column_names: List[str] = field(default_factory=list)
    value: Optional[Any] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    visualizations: List[str] = field(default_factory=list)

@dataclass
class DataQualityReport:
    """Data quality assessment"""
    table_name: str
    total_rows: int
    quality_score: float  # 0-100
    issues: List[DataInsight] = field(default_factory=list)
    recommendations: List[str] = field(default_factory=list)
    column_profiles: Dict[str, Dict[str, Any]] = field(default_factory=dict)

@dataclass
class CorrelationInsight:
    """Correlation analysis result"""
    column1: str
    column2: str
    correlation_coefficient: float
    p_value: float
    relationship_type: str  # 'strong_positive', 'moderate_positive', 'weak_positive', etc.
    interpretation: str

@dataclass
class TrendAnalysis:
    """Time series trend analysis"""
    column_name: str
    trend_type: str  # 'increasing', 'decreasing', 'seasonal', 'stable', 'volatile'
    slope: float
    confidence: float
    seasonality_detected: bool
    anomalies: List[Dict[str, Any]] = field(default_factory=list)

class DataInsightsEngine:
    """AI-powered data analysis and insights generation"""
    
    def __init__(self, conn_params: Dict[str, str], config: Optional[AIConfig] = None):
        self.conn_params = conn_params
        self.config = config or AIConfig.create_default()
        
        # Analysis cache
        self.analysis_cache = {}
        self.sample_cache = {}
        
        # Insight generation rules
        self.insight_rules = self._load_insight_rules()
        
    def _load_insight_rules(self) -> Dict[str, Any]:
        """Load rules for generating insights"""
        return {
            'data_quality': {
                'null_percentage_warning': 20.0,  # Warn if > 20% nulls
                'null_percentage_critical': 50.0,  # Critical if > 50% nulls
                'duplicate_percentage_warning': 5.0,
                'outlier_percentage_warning': 10.0,
                'min_sample_size': 1000
            },
            'correlations': {
                'strong_threshold': 0.7,
                'moderate_threshold': 0.4,
                'weak_threshold': 0.2,
                'significance_level': 0.05
            },
            'trends': {
                'min_data_points': 10,
                'significance_threshold': 0.05,
                'seasonality_threshold': 0.3
            },
            'anomalies': {
                'z_score_threshold': 2.5,
                'iqr_multiplier': 1.5,
                'isolation_forest_contamination': 0.1
            }
        }
    
    def analyze_table(self, table_name: str, sample_size: int = 10000) -> Dict[str, Any]:
        """Perform comprehensive analysis of a table"""
        start_time = time.time()
        
        try:
            # Get table metadata and sample data
            table_info = self._get_table_info(table_name)
            sample_data = self._get_sample_data(table_name, sample_size)
            
            if sample_data is None or sample_data.empty:
                return self._create_error_result("No data available for analysis")
            
            # Perform various analyses
            results = {
                'table_name': table_name,
                'analysis_timestamp': time.time(),
                'sample_size': len(sample_data),
                'total_rows': table_info['row_count'],
                'insights': [],
                'quality_report': None,
                'correlations': [],
                'trends': [],
                'statistical_summary': {}
            }
            
            # Data quality analysis
            quality_report = self._analyze_data_quality(table_name, sample_data, table_info)
            results['quality_report'] = quality_report
            results['insights'].extend(quality_report.issues)
            
            # Statistical summary
            results['statistical_summary'] = self._generate_statistical_summary(sample_data)
            
            # Correlation analysis
            correlations = self._analyze_correlations(sample_data)
            results['correlations'] = correlations
            results['insights'].extend(self._correlations_to_insights(correlations, table_name))
            
            # Trend analysis (for time-based columns)
            trends = self._analyze_trends(sample_data)
            results['trends'] = trends
            results['insights'].extend(self._trends_to_insights(trends, table_name))
            
            # Anomaly detection
            anomalies = self._detect_anomalies(sample_data)
            results['insights'].extend(self._anomalies_to_insights(anomalies, table_name))
            
            # Distribution analysis
            distribution_insights = self._analyze_distributions(sample_data)
            results['insights'].extend(self._distributions_to_insights(distribution_insights, table_name))
            
            # Generate recommendations
            results['recommendations'] = self._generate_recommendations(results)
            
            results['analysis_duration'] = time.time() - start_time
            
            return results
            
        except Exception as e:
            return self._create_error_result(f"Analysis failed: {str(e)}")
    
    def _get_table_info(self, table_name: str) -> Dict[str, Any]:
        """Get basic table information"""
        with psycopg2.connect(**self.conn_params) as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                # Get table statistics
                cur.execute("""
                    SELECT 
                        schemaname, tablename, 
                        n_live_tup as row_count,
                        n_dead_tup as dead_rows,
                        last_vacuum, last_autovacuum,
                        last_analyze, last_autoanalyze
                    FROM pg_stat_user_tables 
                    WHERE tablename = %s
                """, (table_name,))
                
                stats = cur.fetchone()
                
                # Get column information
                cur.execute("""
                    SELECT 
                        column_name, data_type, is_nullable,
                        character_maximum_length, numeric_precision, numeric_scale
                    FROM information_schema.columns
                    WHERE table_name = %s AND table_schema = 'public'
                    ORDER BY ordinal_position
                """, (table_name,))
                
                columns = [dict(row) for row in cur.fetchall()]
                
                return {
                    'table_name': table_name,
                    'row_count': stats['row_count'] if stats else 0,
                    'dead_rows': stats['dead_rows'] if stats else 0,
                    'columns': columns,
                    'last_analyze': stats['last_analyze'] if stats else None
                }
    
    def _get_sample_data(self, table_name: str, sample_size: int) -> Optional[pd.DataFrame]:
        """Get sample data from table"""
        cache_key = f"{table_name}:{sample_size}"
        
        # Check cache first
        if cache_key in self.sample_cache:
            cached_time, data = self.sample_cache[cache_key]
            if time.time() - cached_time < 300:  # 5 minutes cache
                return data
        
        try:
            with psycopg2.connect(**self.conn_params) as conn:
                # Use TABLESAMPLE for large tables, simple LIMIT for smaller ones
                query = f"""
                    SELECT * FROM {table_name} 
                    ORDER BY RANDOM() 
                    LIMIT {sample_size}
                """
                
                df = pd.read_sql_query(query, conn)
                
                # Cache the result
                self.sample_cache[cache_key] = (time.time(), df)
                
                return df
                
        except Exception as e:
            print(f"Error sampling data from {table_name}: {e}")
            return None
    
    def _analyze_data_quality(self, table_name: str, data: pd.DataFrame, 
                             table_info: Dict[str, Any]) -> DataQualityReport:
        """Analyze data quality"""
        issues = []
        recommendations = []
        column_profiles = {}
        
        total_rows = len(data)
        quality_score = 100.0
        
        for column in data.columns:
            col_data = data[column]
            profile = {
                'data_type': str(col_data.dtype),
                'null_count': col_data.isnull().sum(),
                'null_percentage': (col_data.isnull().sum() / total_rows) * 100,
                'unique_count': col_data.nunique(),
                'uniqueness_ratio': col_data.nunique() / total_rows
            }
            
            # Check for null values
            if profile['null_percentage'] > self.insight_rules['data_quality']['null_percentage_critical']:
                issues.append(DataInsight(
                    insight_type='quality',
                    title=f"High null rate in {column}",
                    description=f"Column '{column}' has {profile['null_percentage']:.1f}% null values",
                    confidence=0.9,
                    severity='critical',
                    table_name=table_name,
                    column_names=[column],
                    value=profile['null_percentage']
                ))
                quality_score -= 15
                
            elif profile['null_percentage'] > self.insight_rules['data_quality']['null_percentage_warning']:
                issues.append(DataInsight(
                    insight_type='quality',
                    title=f"Moderate null rate in {column}",
                    description=f"Column '{column}' has {profile['null_percentage']:.1f}% null values",
                    confidence=0.8,
                    severity='warning',
                    table_name=table_name,
                    column_names=[column],
                    value=profile['null_percentage']
                ))
                quality_score -= 5
            
            # Check for duplicates in columns that should be unique
            if profile['uniqueness_ratio'] < 0.95 and 'id' in column.lower():
                issues.append(DataInsight(
                    insight_type='quality',
                    title=f"Potential duplicate values in {column}",
                    description=f"Column '{column}' appears to be an ID but has duplicates",
                    confidence=0.7,
                    severity='warning',
                    table_name=table_name,
                    column_names=[column]
                ))
                quality_score -= 10
            
            # Numeric column analysis
            if pd.api.types.is_numeric_dtype(col_data):
                profile.update({
                    'min': col_data.min(),
                    'max': col_data.max(),
                    'mean': col_data.mean(),
                    'std': col_data.std(),
                    'median': col_data.median()
                })
                
                # Check for outliers
                if SCIPY_AVAILABLE:
                    q1 = col_data.quantile(0.25)
                    q3 = col_data.quantile(0.75)
                    iqr = q3 - q1
                    outliers = col_data[(col_data < q1 - 1.5 * iqr) | (col_data > q3 + 1.5 * iqr)]
                    outlier_percentage = (len(outliers) / total_rows) * 100
                    
                    profile['outlier_count'] = len(outliers)
                    profile['outlier_percentage'] = outlier_percentage
                    
                    if outlier_percentage > self.insight_rules['data_quality']['outlier_percentage_warning']:
                        issues.append(DataInsight(
                            insight_type='quality',
                            title=f"High outlier rate in {column}",
                            description=f"Column '{column}' has {outlier_percentage:.1f}% outliers",
                            confidence=0.6,
                            severity='info',
                            table_name=table_name,
                            column_names=[column],
                            value=outlier_percentage
                        ))
            
            # Text column analysis
            elif pd.api.types.is_string_dtype(col_data):
                non_null_data = col_data.dropna()
                if len(non_null_data) > 0:
                    profile.update({
                        'avg_length': non_null_data.str.len().mean(),
                        'min_length': non_null_data.str.len().min(),
                        'max_length': non_null_data.str.len().max(),
                        'empty_strings': (non_null_data == '').sum()
                    })
                    
                    # Check for empty strings
                    empty_percentage = (profile['empty_strings'] / total_rows) * 100
                    if empty_percentage > 5:
                        issues.append(DataInsight(
                            insight_type='quality',
                            title=f"Empty strings in {column}",
                            description=f"Column '{column}' has {empty_percentage:.1f}% empty strings",
                            confidence=0.8,
                            severity='warning',
                            table_name=table_name,
                            column_names=[column]
                        ))
            
            column_profiles[column] = profile
        
        # Generate recommendations based on issues
        if any(issue.severity == 'critical' for issue in issues):
            recommendations.append("Address critical data quality issues before proceeding with analysis")
        
        high_null_columns = [issue.column_names[0] for issue in issues 
                           if issue.insight_type == 'quality' and 'null' in issue.title.lower()]
        if high_null_columns:
            recommendations.append(f"Consider data imputation strategies for columns: {', '.join(high_null_columns)}")
        
        return DataQualityReport(
            table_name=table_name,
            total_rows=total_rows,
            quality_score=max(0, quality_score),
            issues=issues,
            recommendations=recommendations,
            column_profiles=column_profiles
        )
    
    def _generate_statistical_summary(self, data: pd.DataFrame) -> Dict[str, Any]:
        """Generate statistical summary of the data"""
        summary = {
            'total_rows': len(data),
            'total_columns': len(data.columns),
            'numeric_columns': [],
            'text_columns': [],
            'datetime_columns': [],
            'memory_usage': data.memory_usage(deep=True).sum()
        }
        
        for column in data.columns:
            col_data = data[column]
            
            if pd.api.types.is_numeric_dtype(col_data):
                col_summary = {
                    'name': column,
                    'count': col_data.count(),
                    'mean': col_data.mean(),
                    'std': col_data.std(),
                    'min': col_data.min(),
                    'q1': col_data.quantile(0.25),
                    'median': col_data.median(),
                    'q3': col_data.quantile(0.75),
                    'max': col_data.max(),
                    'skewness': col_data.skew() if SCIPY_AVAILABLE else None,
                    'kurtosis': col_data.kurtosis() if SCIPY_AVAILABLE else None
                }
                summary['numeric_columns'].append(col_summary)
                
            elif pd.api.types.is_string_dtype(col_data):
                col_summary = {
                    'name': column,
                    'count': col_data.count(),
                    'unique': col_data.nunique(),
                    'top_value': col_data.mode().iloc[0] if not col_data.mode().empty else None,
                    'top_frequency': col_data.value_counts().iloc[0] if not col_data.empty else 0
                }
                summary['text_columns'].append(col_summary)
                
            elif pd.api.types.is_datetime64_any_dtype(col_data):
                col_summary = {
                    'name': column,
                    'count': col_data.count(),
                    'min': col_data.min(),
                    'max': col_data.max(),
                    'range_days': (col_data.max() - col_data.min()).days if col_data.count() > 0 else 0
                }
                summary['datetime_columns'].append(col_summary)
        
        return summary
    
    def _analyze_correlations(self, data: pd.DataFrame) -> List[CorrelationInsight]:
        """Analyze correlations between numeric columns"""
        if not SCIPY_AVAILABLE:
            return []
        
        correlations = []
        numeric_columns = data.select_dtypes(include=[np.number]).columns
        
        if len(numeric_columns) < 2:
            return correlations
        
        # Calculate correlation matrix
        corr_matrix = data[numeric_columns].corr()
        
        # Extract significant correlations
        for i in range(len(numeric_columns)):
            for j in range(i + 1, len(numeric_columns)):
                col1, col2 = numeric_columns[i], numeric_columns[j]
                correlation = corr_matrix.iloc[i, j]
                
                if pd.isna(correlation):
                    continue
                
                # Calculate p-value
                try:
                    _, p_value = stats.pearsonr(data[col1].dropna(), data[col2].dropna())
                except:
                    p_value = 1.0
                
                # Classify relationship strength
                abs_corr = abs(correlation)
                if abs_corr >= self.insight_rules['correlations']['strong_threshold']:
                    strength = 'strong'
                elif abs_corr >= self.insight_rules['correlations']['moderate_threshold']:
                    strength = 'moderate'
                elif abs_corr >= self.insight_rules['correlations']['weak_threshold']:
                    strength = 'weak'
                else:
                    continue  # Skip very weak correlations
                
                direction = 'positive' if correlation > 0 else 'negative'
                relationship_type = f"{strength}_{direction}"
                
                # Generate interpretation
                interpretation = self._interpret_correlation(col1, col2, correlation, p_value)
                
                correlations.append(CorrelationInsight(
                    column1=col1,
                    column2=col2,
                    correlation_coefficient=correlation,
                    p_value=p_value,
                    relationship_type=relationship_type,
                    interpretation=interpretation
                ))
        
        return correlations
    
    def _interpret_correlation(self, col1: str, col2: str, correlation: float, p_value: float) -> str:
        """Generate human-readable interpretation of correlation"""
        abs_corr = abs(correlation)
        direction = "increases" if correlation > 0 else "decreases"
        
        if p_value > 0.05:
            significance = "but this relationship is not statistically significant"
        else:
            significance = "and this relationship is statistically significant"
        
        if abs_corr >= 0.7:
            strength = "strongly"
        elif abs_corr >= 0.4:
            strength = "moderately"
        else:
            strength = "weakly"
        
        return f"As {col1} increases, {col2} {strength} {direction}, {significance} (r={correlation:.3f}, p={p_value:.3f})"
    
    def _analyze_trends(self, data: pd.DataFrame) -> List[TrendAnalysis]:
        """Analyze trends in time-based data"""
        if not SCIPY_AVAILABLE:
            return []
        
        trends = []
        datetime_columns = data.select_dtypes(include=['datetime64', 'datetimetz']).columns
        
        if len(datetime_columns) == 0:
            # Try to find columns that might be timestamps
            for col in data.columns:
                if 'date' in col.lower() or 'time' in col.lower():
                    try:
                        data[col] = pd.to_datetime(data[col])
                        datetime_columns = [col]
                        break
                    except:
                        continue
        
        if len(datetime_columns) == 0:
            return trends
        
        time_col = datetime_columns[0]  # Use first datetime column
        numeric_columns = data.select_dtypes(include=[np.number]).columns
        
        for col in numeric_columns:
            try:
                # Sort by time and remove nulls
                time_series_data = data[[time_col, col]].dropna().sort_values(time_col)
                
                if len(time_series_data) < self.insight_rules['trends']['min_data_points']:
                    continue
                
                # Convert datetime to numeric for regression
                time_numeric = pd.to_numeric(time_series_data[time_col])
                values = time_series_data[col]
                
                # Perform linear regression
                slope, intercept, r_value, p_value, std_err = stats.linregress(time_numeric, values)
                
                # Determine trend type
                if p_value <= self.insight_rules['trends']['significance_threshold']:
                    if slope > 0:
                        trend_type = 'increasing'
                    else:
                        trend_type = 'decreasing'
                else:
                    trend_type = 'stable'
                
                # Check for seasonality (simplified)
                seasonality_detected = False
                if len(time_series_data) >= 12:  # Need at least 12 points
                    # Simple seasonality detection using autocorrelation
                    try:
                        # This is a simplified approach
                        values_diff = values.diff().dropna()
                        if len(values_diff) > 1:
                            autocorr = values_diff.autocorr(lag=1)
                            seasonality_detected = abs(autocorr) > self.insight_rules['trends']['seasonality_threshold']
                    except:
                        pass
                
                trends.append(TrendAnalysis(
                    column_name=col,
                    trend_type=trend_type,
                    slope=slope,
                    confidence=r_value**2,  # R-squared as confidence measure
                    seasonality_detected=seasonality_detected
                ))
                
            except Exception as e:
                print(f"Error analyzing trend for column {col}: {e}")
                continue
        
        return trends
    
    def _detect_anomalies(self, data: pd.DataFrame) -> Dict[str, List[Dict[str, Any]]]:
        """Detect anomalies in numeric columns"""
        anomalies = {}
        numeric_columns = data.select_dtypes(include=[np.number]).columns
        
        for col in numeric_columns:
            col_anomalies = []
            col_data = data[col].dropna()
            
            if len(col_data) < 10:  # Need minimum data points
                continue
            
            # Z-score method
            if len(col_data) > 30:  # Z-score works better with larger samples
                z_scores = np.abs(stats.zscore(col_data))
                z_anomalies = col_data[z_scores > self.insight_rules['anomalies']['z_score_threshold']]
                
                for idx, value in z_anomalies.items():
                    col_anomalies.append({
                        'method': 'z_score',
                        'index': idx,
                        'value': value,
                        'z_score': z_scores[idx],
                        'severity': 'high' if z_scores[idx] > 3 else 'medium'
                    })
            
            # IQR method
            q1 = col_data.quantile(0.25)
            q3 = col_data.quantile(0.75)
            iqr = q3 - q1
            
            if iqr > 0:
                lower_bound = q1 - self.insight_rules['anomalies']['iqr_multiplier'] * iqr
                upper_bound = q3 + self.insight_rules['anomalies']['iqr_multiplier'] * iqr
                
                iqr_anomalies = col_data[(col_data < lower_bound) | (col_data > upper_bound)]
                
                for idx, value in iqr_anomalies.items():
                    # Avoid duplicates from z-score method
                    if not any(a['index'] == idx for a in col_anomalies):
                        col_anomalies.append({
                            'method': 'iqr',
                            'index': idx,
                            'value': value,
                            'deviation': max(abs(value - lower_bound), abs(value - upper_bound)),
                            'severity': 'medium'
                        })
            
            if col_anomalies:
                anomalies[col] = col_anomalies
        
        return anomalies
    
    def _analyze_distributions(self, data: pd.DataFrame) -> Dict[str, Dict[str, Any]]:
        """Analyze data distributions"""
        distributions = {}
        numeric_columns = data.select_dtypes(include=[np.number]).columns
        
        for col in numeric_columns:
            col_data = data[col].dropna()
            
            if len(col_data) < 10:
                continue
            
            distribution_info = {
                'column': col,
                'sample_size': len(col_data),
                'skewness': col_data.skew() if SCIPY_AVAILABLE else None,
                'kurtosis': col_data.kurtosis() if SCIPY_AVAILABLE else None,
                'distribution_type': 'unknown'
            }
            
            if SCIPY_AVAILABLE:
                # Test for normality
                try:
                    _, p_value = stats.normaltest(col_data)
                    distribution_info['normality_p_value'] = p_value
                    
                    if p_value > 0.05:
                        distribution_info['distribution_type'] = 'normal'
                    elif abs(distribution_info['skewness']) > 1:
                        distribution_info['distribution_type'] = 'highly_skewed'
                    elif abs(distribution_info['skewness']) > 0.5:
                        distribution_info['distribution_type'] = 'moderately_skewed'
                    else:
                        distribution_info['distribution_type'] = 'approximately_normal'
                        
                except:
                    pass
            
            distributions[col] = distribution_info
        
        return distributions
    
    def _correlations_to_insights(self, correlations: List[CorrelationInsight], 
                                 table_name: str) -> List[DataInsight]:
        """Convert correlation analysis to insights"""
        insights = []
        
        for corr in correlations:
            if abs(corr.correlation_coefficient) >= 0.7 and corr.p_value <= 0.05:
                insights.append(DataInsight(
                    insight_type='correlation',
                    title=f"Strong correlation between {corr.column1} and {corr.column2}",
                    description=corr.interpretation,
                    confidence=0.9,
                    severity='info',
                    table_name=table_name,
                    column_names=[corr.column1, corr.column2],
                    value=corr.correlation_coefficient
                ))
        
        return insights
    
    def _trends_to_insights(self, trends: List[TrendAnalysis], table_name: str) -> List[DataInsight]:
        """Convert trend analysis to insights"""
        insights = []
        
        for trend in trends:
            if trend.trend_type != 'stable' and trend.confidence > 0.5:
                severity = 'info'
                if trend.confidence > 0.8:
                    severity = 'warning' if trend.trend_type == 'decreasing' else 'info'
                
                insights.append(DataInsight(
                    insight_type='trend',
                    title=f"{trend.column_name} shows {trend.trend_type} trend",
                    description=f"Column '{trend.column_name}' has a {trend.trend_type} trend with {trend.confidence:.1%} confidence",
                    confidence=trend.confidence,
                    severity=severity,
                    table_name=table_name,
                    column_names=[trend.column_name],
                    metadata={
                        'slope': trend.slope,
                        'seasonality': trend.seasonality_detected
                    }
                ))
        
        return insights
    
    def _anomalies_to_insights(self, anomalies: Dict[str, List[Dict[str, Any]]], 
                              table_name: str) -> List[DataInsight]:
        """Convert anomaly detection to insights"""
        insights = []
        
        for col, col_anomalies in anomalies.items():
            if len(col_anomalies) > 0:
                high_severity_count = sum(1 for a in col_anomalies if a.get('severity') == 'high')
                total_anomalies = len(col_anomalies)
                
                severity = 'critical' if high_severity_count > 0 else 'warning'
                
                insights.append(DataInsight(
                    insight_type='anomaly',
                    title=f"Anomalies detected in {col}",
                    description=f"Found {total_anomalies} anomalous values in column '{col}'",
                    confidence=0.8,
                    severity=severity,
                    table_name=table_name,
                    column_names=[col],
                    value=total_anomalies,
                    metadata={'anomalies': col_anomalies[:5]}  # Include first 5 anomalies
                ))
        
        return insights
    
    def _distributions_to_insights(self, distributions: Dict[str, Dict[str, Any]], 
                                  table_name: str) -> List[DataInsight]:
        """Convert distribution analysis to insights"""
        insights = []
        
        for col, dist_info in distributions.items():
            if dist_info['distribution_type'] == 'highly_skewed':
                insights.append(DataInsight(
                    insight_type='distribution',
                    title=f"{col} is highly skewed",
                    description=f"Column '{col}' has high skewness ({dist_info['skewness']:.2f}), consider data transformation",
                    confidence=0.7,
                    severity='info',
                    table_name=table_name,
                    column_names=[col],
                    value=dist_info['skewness']
                ))
        
        return insights
    
    def _generate_recommendations(self, analysis_results: Dict[str, Any]) -> List[str]:
        """Generate actionable recommendations based on analysis"""
        recommendations = []
        
        # Quality-based recommendations
        quality_report = analysis_results.get('quality_report')
        if quality_report and quality_report.quality_score < 70:
            recommendations.append("Improve data quality before using for critical analysis")
        
        # Correlation-based recommendations
        correlations = analysis_results.get('correlations', [])
        strong_correlations = [c for c in correlations if abs(c.correlation_coefficient) > 0.8]
        if strong_correlations:
            recommendations.append("Consider feature selection to reduce multicollinearity in predictive models")
        
        # Anomaly-based recommendations
        insights = analysis_results.get('insights', [])
        anomaly_insights = [i for i in insights if i.insight_type == 'anomaly']
        if anomaly_insights:
            recommendations.append("Investigate and handle anomalous values before analysis")
        
        # Distribution-based recommendations
        skewed_columns = [i.column_names[0] for i in insights 
                         if i.insight_type == 'distribution' and 'skewed' in i.title]
        if skewed_columns:
            recommendations.append(f"Consider log transformation for skewed columns: {', '.join(skewed_columns)}")
        
        # General recommendations
        recommendations.extend([
            "Regularly monitor data quality metrics",
            "Consider setting up automated data quality checks",
            "Document any data preprocessing steps for reproducibility"
        ])
        
        return recommendations
    
    def _create_error_result(self, error_message: str) -> Dict[str, Any]:
        """Create error result structure"""
        return {
            'error': True,
            'message': error_message,
            'insights': [],
            'recommendations': [
                "Check database connection and table permissions",
                "Ensure table has sufficient data for analysis"
            ]
        }
    
    def compare_tables(self, table1: str, table2: str) -> Dict[str, Any]:
        """Compare two tables and identify differences"""
        try:
            # Analyze both tables
            analysis1 = self.analyze_table(table1)
            analysis2 = self.analyze_table(table2)
            
            if analysis1.get('error') or analysis2.get('error'):
                return {'error': True, 'message': 'Failed to analyze one or both tables'}
            
            comparison = {
                'table1': table1,
                'table2': table2,
                'comparison_timestamp': time.time(),
                'differences': [],
                'similarities': [],
                'recommendations': []
            }
            
            # Compare basic statistics
            stats1 = analysis1['statistical_summary']
            stats2 = analysis2['statistical_summary']
            
            # Row count comparison
            if stats1['total_rows'] != stats2['total_rows']:
                comparison['differences'].append({
                    'type': 'row_count',
                    'description': f"{table1} has {stats1['total_rows']} rows, {table2} has {stats2['total_rows']} rows"
                })
            
            # Column count comparison
            if stats1['total_columns'] != stats2['total_columns']:
                comparison['differences'].append({
                    'type': 'column_count',
                    'description': f"{table1} has {stats1['total_columns']} columns, {table2} has {stats2['total_columns']} columns"
                })
            
            # Quality score comparison
            quality1 = analysis1['quality_report'].quality_score
            quality2 = analysis2['quality_report'].quality_score
            
            if abs(quality1 - quality2) > 10:
                comparison['differences'].append({
                    'type': 'quality_score',
                    'description': f"Data quality differs: {table1} ({quality1:.1f}) vs {table2} ({quality2:.1f})"
                })
            
            return comparison
            
        except Exception as e:
            return {'error': True, 'message': f'Comparison failed: {str(e)}'}
    
    def generate_data_profile_report(self, table_name: str) -> str:
        """Generate a comprehensive data profile report"""
        analysis = self.analyze_table(table_name)
        
        if analysis.get('error'):
            return f"Error generating report: {analysis['message']}"
        
        report_lines = [
            f"# Data Profile Report: {table_name}",
            f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            "",
            "## Summary",
            f"- Total Rows: {analysis['total_rows']:,}",
            f"- Sample Size: {analysis['sample_size']:,}",
            f"- Data Quality Score: {analysis['quality_report'].quality_score:.1f}/100",
            f"- Analysis Duration: {analysis['analysis_duration']:.2f} seconds",
            ""
        ]
        
        # Quality issues
        if analysis['quality_report'].issues:
            report_lines.extend([
                "## Data Quality Issues",
                ""
            ])
            for issue in analysis['quality_report'].issues:
                report_lines.append(f"- **{issue.title}**: {issue.description}")
            report_lines.append("")
        
        # Key insights
        insights = analysis['insights']
        if insights:
            report_lines.extend([
                "## Key Insights",
                ""
            ])
            for insight in insights[:10]:  # Top 10 insights
                report_lines.append(f"- **{insight.title}**: {insight.description}")
            report_lines.append("")
        
        # Recommendations
        if analysis['recommendations']:
            report_lines.extend([
                "## Recommendations",
                ""
            ])
            for rec in analysis['recommendations']:
                report_lines.append(f"- {rec}")
            report_lines.append("")
        
        return "\n".join(report_lines)