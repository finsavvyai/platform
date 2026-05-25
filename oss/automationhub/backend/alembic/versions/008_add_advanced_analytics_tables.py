"""Add advanced analytics tables

Revision ID: 008_add_advanced_analytics_tables
Revises: 007_add_multi_cloud_tables
Create Date: 2025-01-20 10:30:00.000000

"""
from typing import Dict, Any
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '008_add_advanced_analytics_tables'
down_revision = '007_add_multi_cloud_tables'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create advanced analytics tables
    # Analytics metrics table
    op.create_table(
        'analytics_metrics',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('tenant_id', sa.Integer(), nullable=False),
        sa.Column('provider_id', sa.Integer(), nullable=True),
        sa.Column('resource_id', sa.String(), nullable=True),
        sa.Column('resource_type', sa.String(), nullable=True),
        sa.Column('metric_name', sa.String(), nullable=False),
        sa.Column('metric_type', sa.String(), nullable=False),
        sa.Column('value', sa.Float(), nullable=False),
        sa.Column('unit', sa.String(), nullable=True),
        sa.Column('tags', sa.JSON(), nullable=True),
        sa.Column('timestamp', sa.DateTime(), nullable=False),
        sa.Column('collected_at', sa.DateTime(), nullable=False),
        sa.Column('metadata', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ),
        sa.ForeignKeyConstraint(['provider_id'], ['multi_cloud_providers.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_analytics_metrics_id'), 'analytics_metrics', ['id'], unique=False)
    op.create_index('ix_analytics_metrics_tenant_resource', 'analytics_metrics', ['tenant_id', 'resource_id'], unique=False)
    op.create_index('ix_analytics_metrics_metric_type', 'analytics_metrics', ['metric_type'], unique=False)
    op.create_index('ix_analytics_metrics_timestamp', 'analytics_metrics', ['timestamp'], unique=False)
    op.create_index('ix_analytics_metrics_collected_at', 'analytics_metrics', ['collected_at'], unique=False)

    # Anomaly detection table
    op.create_table(
        'anomaly_detection',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('tenant_id', sa.Integer(), nullable=False),
        sa.Column('metric_id', sa.Integer(), nullable=False),
        sa.Column('provider_id', sa.Integer(), nullable=True),
        sa.Column('resource_id', sa.String(), nullable=True),
        sa.Column('anomaly_type', sa.String(), nullable=False),
        sa.Column('severity', sa.String(), nullable=False),
        sa.Column('score', sa.Float(), nullable=False),
        sa.Column('threshold', sa.Float(), nullable=False),
        sa.Column('metric_value', sa.Float(), nullable=False),
        sa.Column('expected_value', sa.Float(), nullable=True),
        sa.Column('deviation', sa.Float(), nullable=True),
        sa.Column('confidence', sa.Float(), nullable=True),
        sa.Column('status', sa.String(), nullable=False, default='open'),
        sa.Column('description', sa.String(), nullable=True),
        sa.Column('analysis_details', sa.JSON(), nullable=True),
        sa.Column('first_detected_at', sa.DateTime(), nullable=False),
        sa.Column('last_detected_at', sa.DateTime(), nullable=False),
        sa.Column('resolved_at', sa.DateTime(), nullable=True),
        sa.Column('resolution_details', sa.JSON(), nullable=True),
        sa.Column('metadata', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['metric_id'], ['analytics_metrics.id'], ),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ),
        sa.ForeignKeyConstraint(['provider_id'], ['multi_cloud_providers.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_anomaly_detection_id'), 'anomaly_detection', ['id'], unique=False)
    op.create_index('ix_anomaly_detection_tenant_severity', 'anomaly_detection', ['tenant_id', 'severity'], unique=False)
    op.create_index('ix_anomaly_detection_status', 'anomaly_detection', ['status'], unique=False)
    op.create_index('ix_anomaly_detection_detected_at', 'anomaly_detection', ['first_detected_at'], unique=False)
    op.create_index('ix_anomaly_detection_anomaly_type', 'anomaly_detection', ['anomaly_type'], unique=False)

    # Predictive models table
    op.create_table(
        'predictive_models',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('tenant_id', sa.Integer(), nullable=False),
        sa.Column('provider_id', sa.Integer(), nullable=True),
        sa.Column('model_name', sa.String(), nullable=False),
        sa.Column('model_type', sa.String(), nullable=False),
        sa.Column('target_metric', sa.String(), nullable=False),
        sa.Column('algorithm', sa.String(), nullable=False),
        sa.Column('parameters', sa.JSON(), nullable=True),
        sa.Column('features', sa.JSON(), nullable=True),
        sa.Column('model_data', sa.Text(), nullable=True),
        sa.Column('accuracy', sa.Float(), nullable=True),
        sa.Column('precision', sa.Float(), nullable=True),
        sa.Column('recall', sa.Float(), nullable=True),
        sa.Column('f1_score', sa.Float(), nullable=True),
        sa.Column('mae', sa.Float(), nullable=True),
        sa.Column('mse', sa.Float(), nullable=True),
        sa.Column('rmse', sa.Float(), nullable=True),
        sa.Column('training_data_points', sa.Integer(), nullable=True),
        sa.Column('validation_data_points', sa.Integer(), nullable=True),
        sa.Column('training_start_at', sa.DateTime(), nullable=True),
        sa.Column('training_end_at', sa.DateTime(), nullable=True),
        sa.Column('last_trained_at', sa.DateTime(), nullable=True),
        sa.Column('last_prediction_at', sa.DateTime(), nullable=True),
        sa.Column('status', sa.String(), nullable=False, default='training'),
        sa.Column('performance_metrics', sa.JSON(), nullable=True),
        sa.Column('feature_importance', sa.JSON(), nullable=True),
        sa.Column('training_logs', sa.Text(), nullable=True),
        sa.Column('metadata', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ),
        sa.ForeignKeyConstraint(['provider_id'], ['multi_cloud_providers.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_predictive_models_id'), 'predictive_models', ['id'], unique=False)
    op.create_index('ix_predictive_models_tenant_model_type', 'predictive_models', ['tenant_id', 'model_type'], unique=False)
    op.create_index('ix_predictive_models_status', 'predictive_models', ['status'], unique=False)
    op.create_index('ix_predictive_models_algorithm', 'predictive_models', ['algorithm'], unique=False)

    # Performance forecasts table
    op.create_table(
        'performance_forecasts',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('tenant_id', sa.Integer(), nullable=False),
        sa.Column('provider_id', sa.Integer(), nullable=True),
        sa.Column('model_id', sa.Integer(), nullable=False),
        sa.Column('resource_id', sa.String(), nullable=True),
        sa.Column('metric_name', sa.String(), nullable=False),
        sa.Column('forecast_type', sa.String(), nullable=False),
        sa.Column('forecast_horizon', sa.Integer(), nullable=False),
        sa.Column('forecast_values', sa.JSON(), nullable=False),
        sa.Column('confidence_intervals', sa.JSON(), nullable=True),
        sa.Column('forecast_start_at', sa.DateTime(), nullable=False),
        sa.Column('forecast_end_at', sa.DateTime(), nullable=False),
        sa.Column('model_version', sa.String(), nullable=True),
        sa.Column('accuracy', sa.Float(), nullable=True),
        sa.Column('mae', sa.Float(), nullable=True),
        sa.Column('mse', sa.Float(), nullable=True),
        sa.Column('status', sa.String(), nullable=False, default='active'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['model_id'], ['predictive_models.id'], ),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ),
        sa.ForeignKeyConstraint(['provider_id'], ['multi_cloud_providers.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_performance_forecasts_id'), 'performance_forecasts', ['id'], unique=False)
    op.create_index('ix_performance_forecasts_tenant_metric', 'performance_forecasts', ['tenant_id', 'metric_name'], unique=False)
    op.create_index('ix_performance_forecasts_forecast_type', 'performance_forecasts', ['forecast_type'], unique=False)
    op.create_index('ix_performance_forecasts_start_at', 'performance_forecasts', ['forecast_start_at'], unique=False)

    # Intelligence reports table
    op.create_table(
        'intelligence_reports',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('tenant_id', sa.Integer(), nullable=False),
        sa.Column('provider_id', sa.Integer(), nullable=True),
        sa.Column('report_name', sa.String(), nullable=False),
        sa.Column('report_type', sa.String(), nullable=False),
        sa.Column('description', sa.String(), nullable=True),
        sa.Column('executive_summary', sa.Text(), nullable=True),
        sa.Column('analysis_period_start', sa.DateTime(), nullable=False),
        sa.Column('analysis_period_end', sa.DateTime(), nullable=False),
        sa.Column('total_metrics_analyzed', sa.Integer(), nullable=False),
        sa.Column('anomalies_detected', sa.Integer(), nullable=False),
        sa.Column('predictions_generated', sa.Integer(), nullable=False),
        sa.Column('key_insights', sa.JSON(), nullable=False),
        sa.Column('charts_data', sa.JSON(), nullable=False),
        sa.Column('recommendations', sa.JSON(), nullable=False),
        sa.Column('action_items', sa.JSON(), nullable=False),
        sa.Column('data_sources', sa.JSON(), nullable=True),
        sa.Column('methodology', sa.Text(), nullable=True),
        sa.Column('confidence_level', sa.Float(), nullable=True),
        sa.Column('report_metadata', sa.JSON(), nullable=True),
        sa.Column('status', sa.String(), nullable=False, default='completed'),
        sa.Column('generated_at', sa.DateTime(), nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=True),
        sa.Column('metadata', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ),
        sa.ForeignKeyConstraint(['provider_id'], ['multi_cloud_providers.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_intelligence_reports_id'), 'intelligence_reports', ['id'], unique=False)
    op.create_index('ix_intelligence_reports_tenant_type', 'intelligence_reports', ['tenant_id', 'report_type'], unique=False)
    op.create_index('ix_intelligence_reports_status', 'intelligence_reports', ['status'], unique=False)
    op.create_index('ix_intelligence_reports_generated_at', 'intelligence_reports', ['generated_at'], unique=False)

    # Insight patterns table
    op.create_table(
        'insight_patterns',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('tenant_id', sa.Integer(), nullable=False),
        sa.Column('provider_id', sa.Integer(), nullable=True),
        sa.Column('pattern_name', sa.String(), nullable=False),
        sa.Column('pattern_type', sa.String(), nullable=False),
        sa.Column('description', sa.String(), nullable=True),
        sa.Column('pattern_data', sa.JSON(), nullable=False),
        sa.Column('frequency', sa.Integer(), nullable=False),
        sa.Column('confidence', sa.Float(), nullable=False),
        sa.Column('significance', sa.Float(), nullable=False),
        sa.Column('recommendations', sa.JSON(), nullable=True),
        sa.Column('last_seen_at', sa.DateTime(), nullable=False),
        sa.Column('times_detected', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(), nullable=False, default='active'),
        sa.Column('metadata', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ),
        sa.ForeignKeyConstraint(['provider_id'], ['multi_cloud_providers.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_insight_patterns_id'), 'insight_patterns', ['id'], unique=False)
    op.create_index('ix_insight_patterns_tenant_pattern_type', 'insight_patterns', ['tenant_id', 'pattern_type'], unique=False)
    op.create_index('ix_insight_patterns_status', 'insight_patterns', ['status'], unique=False)
    op.create_index('ix_insight_patterns_significance', 'insight_patterns', ['significance'], unique=False)
    op.create_index('ix_insight_patterns_frequency', 'insight_patterns', ['frequency'], unique=False)

    # Anomaly alerts table
    op.create_table(
        'anomaly_alerts',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('tenant_id', sa.Integer(), nullable=False),
        sa.Column('provider_id', sa.Integer(), nullable=True),
        sa.Column('anomaly_id', sa.Integer(), nullable=False),
        sa.Column('resource_id', sa.String(), nullable=True),
        sa.Column('alert_type', sa.String(), nullable=False),
        sa.Column('severity', sa.String(), nullable=False),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('action_required', sa.String(), nullable=True),
        sa.Column('recommendations', sa.JSON(), nullable=True),
        sa.Column('threshold_value', sa.Float(), nullable=True),
        sa.Column('actual_value', sa.Float(), nullable=True),
        sa.Column('trigger_conditions', sa.JSON(), nullable=True),
        sa.Column('context_data', sa.JSON(), nullable=True),
        sa.Column('status', sa.String(), nullable=False, default='open'),
        sa.Column('acknowledged_at', sa.DateTime(), nullable=True),
        sa.Column('acknowledged_by', sa.String(), nullable=True),
        sa.Column('escalation_level', sa.Integer(), nullable=False, default=0),
        sa.Column('escalation_notified_at', sa.DateTime(), nullable=True),
        sa.Column('resolved_at', sa.DateTime(), nullable=True),
        sa.Column('resolution_method', sa.String(), nullable=True),
        sa.Column('metadata', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['anomaly_id'], ['anomaly_detection.id'], ),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ),
        sa.ForeignKeyConstraint(['provider_id'], ['multi_cloud_providers.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_anomaly_alerts_id'), 'anomaly_alerts', ['id'], unique=False)
    op.create_index('ix_anomaly_alerts_tenant_severity', 'anomaly_alerts', ['tenant_id', 'severity'], unique=False)
    op.create_index('ix_anomaly_alerts_status', 'anomaly_alerts', ['status'], unique=False)
    op.create_index('ix_anomaly_alerts_alert_type', 'anomaly_alerts', ['alert_type'], unique=False)
    op.create_index('ix_anomaly_alerts_escalation', 'anomaly_alerts', ['escalation_level'], unique=False)


def downgrade() -> None:
    # Drop indexes first
    op.drop_index('ix_anomaly_alerts_escalation', table_name='anomaly_alerts')
    op.drop_index('ix_anomaly_alerts_alert_type', table_name='anomaly_alerts')
    op.drop_index('ix_anomaly_alerts_status', table_name='anomaly_alerts')
    op.drop_index('ix_anomaly_alerts_tenant_severity', table_name='anomaly_alerts')
    op.drop_index(op.f('ix_anomaly_alerts_id'), table_name='anomaly_alerts')

    op.drop_index('ix_insight_patterns_frequency', table_name='insight_patterns')
    op.drop_index('ix_insight_patterns_significance', table_name='insight_patterns')
    op.drop_index('ix_insight_patterns_status', table_name='insight_patterns')
    op.drop_index('ix_insight_patterns_tenant_pattern_type', table_name='insight_patterns')
    op.drop_index(op.f('ix_insight_patterns_id'), table_name='insight_patterns')

    op.drop_index('ix_intelligence_reports_generated_at', table_name='intelligence_reports')
    op.drop_index('ix_intelligence_reports_status', table_name='intelligence_reports')
    op.drop_index('ix_intelligence_reports_tenant_type', table_name='intelligence_reports')
    op.drop_index(op.f('ix_intelligence_reports_id'), table_name='intelligence_reports')

    op.drop_index('ix_performance_forecasts_start_at', table_name='performance_forecasts')
    op.drop_index('ix_performance_forecasts_forecast_type', table_name='performance_forecasts')
    op.drop_index('ix_performance_forecasts_tenant_metric', table_name='performance_forecasts')
    op.drop_index(op.f('ix_performance_forecasts_id'), table_name='performance_forecasts')

    op.drop_index('ix_predictive_models_algorithm', table_name='predictive_models')
    op.drop_index('ix_predictive_models_status', table_name='predictive_models')
    op.drop_index('ix_predictive_models_tenant_model_type', table_name='predictive_models')
    op.drop_index(op.f('ix_predictive_models_id'), table_name='predictive_models')

    op.drop_index('ix_anomaly_detection_anomaly_type', table_name='anomaly_detection')
    op.drop_index('ix_anomaly_detection_detected_at', table_name='anomaly_detection')
    op.drop_index('ix_anomaly_detection_status', table_name='anomaly_detection')
    op.drop_index('ix_anomaly_detection_tenant_severity', table_name='anomaly_detection')
    op.drop_index(op.f('ix_anomaly_detection_id'), table_name='anomaly_detection')

    op.drop_index('ix_analytics_metrics_collected_at', table_name='analytics_metrics')
    op.drop_index('ix_analytics_metrics_timestamp', table_name='analytics_metrics')
    op.drop_index('ix_analytics_metrics_metric_type', table_name='analytics_metrics')
    op.drop_index('ix_analytics_metrics_tenant_resource', table_name='analytics_metrics')
    op.drop_index(op.f('ix_analytics_metrics_id'), table_name='analytics_metrics')

    # Drop tables
    op.drop_table('anomaly_alerts')
    op.drop_table('insight_patterns')
    op.drop_table('intelligence_reports')
    op.drop_table('performance_forecasts')
    op.drop_table('predictive_models')
    op.drop_table('anomaly_detection')
    op.drop_table('analytics_metrics')