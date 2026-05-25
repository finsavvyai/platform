#!/usr/bin/env python3
"""
QuantumBeam Backup Dashboard
Web interface for backup management, monitoring, and validation
"""

import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from dataclasses import asdict
import yaml

from flask import Flask, render_template, request, jsonify, send_file, abort
from flask_cors import CORS
import plotly.graph_objs as go
import plotly.utils
from backup_manager import BackupManager, BackupJob, BackupStatus, BackupType, StorageType
from backup_validator import BackupValidator, BackupValidationReport, ValidationStatus

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# Initialize backup components
backup_manager = BackupManager()
backup_validator = BackupValidator()

@app.route('/')
def dashboard():
    """Main dashboard page"""
    return render_template('backup_dashboard.html')

@app.route('/api/jobs')
def get_backup_jobs():
    """Get list of backup jobs"""
    jobs = backup_manager.list_jobs()

    # Convert to JSON-serializable format
    jobs_data = []
    for job in jobs:
        job_dict = asdict(job)
        job_dict['created_at'] = job.created_at.isoformat()
        if job.last_run:
            job_dict['last_run'] = job.last_run.isoformat()
        if job.next_run:
            job_dict['next_run'] = job.next_run.isoformat()
        job_dict['status'] = job.status.value
        job_dict['backup_type'] = job.backup_type.value
        job_dict['storage_type'] = job.storage_type.value
        jobs_data.append(job_dict)

    return jsonify(jobs_data)

@app.route('/api/job/<job_id>')
def get_backup_job(job_id):
    """Get specific backup job details"""
    # Find job by ID (simplified - in production, use proper lookup)
    job = None
    for j in backup_manager.list_jobs():
        if j.id == job_id:
            job = j
            break

    if not job:
        return jsonify({'error': 'Job not found'}), 404

    job_dict = asdict(job)
    job_dict['created_at'] = job.created_at.isoformat()
    if job.last_run:
        job_dict['last_run'] = job.last_run.isoformat()
    if job.next_run:
        job_dict['next_run'] = job.next_run.isoformat()
    job_dict['status'] = job.status.value
    job_dict['backup_type'] = job.backup_type.value
    job_dict['storage_type'] = job.storage_type.value

    return jsonify(job_dict)

@app.route('/api/job/<job_id>/run', methods=['POST'])
async def run_backup_job(job_id):
    """Run a backup job immediately"""
    try:
        result = await backup_manager.run_backup_job(job_id)

        # Convert result to dict
        result_dict = {
            'job_id': result.job_id,
            'status': result.status.value,
            'start_time': result.start_time.isoformat(),
            'end_time': result.end_time.isoformat(),
            'size_bytes': result.size_bytes,
            'file_count': result.file_count,
            'storage_location': result.storage_location,
            'checksum': result.checksum
        }

        if result.error_message:
            result_dict['error_message'] = result.error_message

        if result.validation_result:
            result_dict['validation_result'] = result.validation_result

        return jsonify(result_dict)

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/validate', methods=['POST'])
async def validate_backup():
    """Validate a backup"""
    data = request.get_json()

    try:
        backup_path = data.get('backup_path')
        backup_name = data.get('backup_name', 'Manual Validation')
        expected_checksum = data.get('expected_checksum')
        storage_location = data.get('storage_location')

        if not backup_path:
            return jsonify({'error': 'backup_path is required'}), 400

        report = await backup_validator.validate_backup(
            backup_path, backup_name, expected_checksum, storage_location
        )

        # Convert report to dict
        report_dict = {
            'backup_id': report.backup_id,
            'backup_name': report.backup_name,
            'backup_path': report.backup_path,
            'validation_timestamp': report.validation_timestamp.isoformat(),
            'overall_status': report.overall_status.value,
            'total_tests': report.total_tests,
            'passed_tests': report.passed_tests,
            'failed_tests': report.failed_tests,
            'skipped_tests': report.skipped_tests,
            'warning_tests': report.warning_tests,
            'summary': report.summary,
            'recommendations': report.recommendations,
            'test_results': []
        }

        for result in report.test_results:
            test_result_dict = {
                'test_name': result.test_name,
                'status': result.status.value,
                'start_time': result.start_time.isoformat(),
                'end_time': result.end_time.isoformat(),
                'duration_seconds': result.duration_seconds,
                'details': result.details
            }
            if result.error_message:
                test_result_dict['error_message'] = result.error_message
            if result.warnings:
                test_result_dict['warnings'] = result.warnings
            report_dict['test_results'].append(test_result_dict)

        return jsonify(report_dict)

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/validate/<validation_id>/report')
def get_validation_report(validation_id):
    """Get validation report (simplified - in production, store reports)"""
    # This is a placeholder - in production, retrieve stored report
    return jsonify({'error': 'Report not found'}), 404

@app.route('/api/metrics/summary')
def get_metrics_summary():
    """Get backup metrics summary"""
    jobs = backup_manager.list_jobs()

    summary = {
        'total_jobs': len(jobs),
        'active_jobs': len([j for j in jobs if j.status == BackupStatus.RUNNING]),
        'completed_jobs': len([j for j in jobs if j.status == BackupStatus.COMPLETED]),
        'failed_jobs': len([j for j in jobs if j.status == BackupStatus.FAILED]),
        'job_types': {},
        'storage_types': {},
        'last_24h_backups': 0,
        'last_7d_backups': 0,
        'total_storage_used': 0,
        'average_backup_size': 0,
        'success_rate': 0
    }

    # Job types breakdown
    for job in jobs:
        job_type = job.backup_type.value.replace('_', ' ').title()
        summary['job_types'][job_type] = summary['job_types'].get(job_type, 0) + 1

    # Storage types breakdown
    for job in jobs:
        storage_type = job.storage_type.value.upper()
        summary['storage_types'][storage_type] = summary['storage_types'].get(storage_type, 0) + 1

    # Recent backups (simplified)
    now = datetime.now()
    yesterday = now - timedelta(days=1)
    week_ago = now - timedelta(days=7)

    for job in jobs:
        if job.last_run:
            if job.last_run >= yesterday:
                summary['last_24h_backups'] += 1
            if job.last_run >= week_ago:
                summary['last_7d_backups'] += 1

    # Storage metrics (simplified)
    completed_jobs = [j for j in jobs if j.status == BackupStatus.COMPLETED]
    if completed_jobs:
        summary['total_storage_used'] = sum(j.size_bytes for j in completed_jobs)
        summary['average_backup_size'] = summary['total_storage_used'] / len(completed_jobs)

    # Success rate
    total_completed = len([j for j in jobs if j.status in [BackupStatus.COMPLETED, BackupStatus.FAILED]])
    successful = len([j for j in jobs if j.status == BackupStatus.COMPLETED])
    if total_completed > 0:
        summary['success_rate'] = (successful / total_completed) * 100

    return jsonify(summary)

@app.route('/api/storage/usage')
def get_storage_usage():
    """Get storage usage information"""
    # This is a placeholder - in production, query actual storage usage
    usage_data = {
        'total_quota_gb': 1000,
        'used_gb': 650,
        'available_gb': 350,
        'usage_percentage': 65.0,
        'breakdown': {
            'database_backups': 300,
            'file_backups': 250,
            'log_backups': 50,
            'other': 50
        },
        'trend': [
            {'date': '2024-01-01', 'usage_gb': 500},
            {'date': '2024-01-08', 'usage_gb': 530},
            {'date': '2024-01-15', 'usage_gb': 560},
            {'date': '2024-01-22', 'usage_gb': 590},
            {'date': '2024-01-29', 'usage_gb': 620},
            {'date': '2024-02-05', 'usage_gb': 650}
        ]
    }

    return jsonify(usage_data)

@app.route('/api/backups/recent')
def get_recent_backups():
    """Get recent backup results"""
    # This is a placeholder - in production, query actual backup results
    recent_backups = [
        {
            'id': 'backup-1643723400-1234',
            'job_name': 'Primary Database Backup',
            'status': 'completed',
            'size_bytes': 2048576000,
            'start_time': '2024-02-01T02:00:00Z',
            'end_time': '2024-02-01T02:15:30Z',
            'duration_seconds': 930,
            'storage_location': 's3://quantumbeam-backups/database/primary/primary-db-backup-20240201-0200.dump.gz'
        },
        {
            'id': 'backup-1643637000-5678',
            'job_name': 'Application Files Backup',
            'status': 'completed',
            'size_bytes': 1073741824,
            'start_time': '2024-01-31T04:00:00Z',
            'end_time': '2024-01-31T04:08:15Z',
            'duration_seconds': 495,
            'storage_location': 's3://quantumbeam-backups/files/application/app-files-backup-20240131-0400.tar.gz'
        },
        {
            'id': 'backup-1643550600-9012',
            'job_name': 'Redis Backup',
            'status': 'failed',
            'size_bytes': 0,
            'start_time': '2024-01-30T03:00:00Z',
            'end_time': '2024-01-30T03:01:00Z',
            'duration_seconds': 60,
            'error_message': 'Redis connection timeout'
        }
    ]

    return jsonify(recent_backups)

@app.route('/api/charts/backup-timeline')
def get_backup_timeline_chart():
    """Generate backup timeline chart"""
    # Placeholder data - in production, use real backup history
    dates = ['2024-01-28', '2024-01-29', '2024-01-30', '2024-01-31', '2024-02-01']
    successful = [3, 4, 2, 4, 3]
    failed = [0, 1, 1, 0, 0]

    fig = go.Figure()

    fig.add_trace(go.Scatter(
        x=dates,
        y=successful,
        mode='lines+markers',
        name='Successful Backups',
        line=dict(color='green', width=2),
        marker=dict(color='green', size=6)
    ))

    fig.add_trace(go.Scatter(
        x=dates,
        y=failed,
        mode='lines+markers',
        name='Failed Backups',
        line=dict(color='red', width=2),
        marker=dict(color='red', size=6)
    ))

    fig.update_layout(
        title='Backup Timeline (Last 5 Days)',
        xaxis_title='Date',
        yaxis_title='Number of Backups',
        height=400
    )

    return jsonify(fig.to_json())

@app.route('/api/charts/storage-breakdown')
def get_storage_breakdown_chart():
    """Generate storage breakdown chart"""
    breakdown = {
        'Database Backups': 300,
        'Application Files': 250,
        'Log Files': 50,
        'Configuration': 30,
        'Other': 20
    }

    fig = go.Figure(data=[go.Pie(
        labels=list(breakdown.keys()),
        values=list(breakdown.values()),
        hole=0.3
    )])

    fig.update_layout(
        title='Storage Usage by Type',
        height=400
    )

    return jsonify(fig.to_json())

@app.route('/api/charts/success-rate')
def get_success_rate_chart():
    """Generate success rate trend chart"""
    dates = ['2024-01-28', '2024-01-29', '2024-01-30', '2024-01-31', '2024-02-01']
    success_rates = [100, 80, 66.7, 100, 100]

    fig = go.Figure()

    fig.add_trace(go.Scatter(
        x=dates,
        y=success_rates,
        mode='lines+markers',
        line=dict(color='blue', width=2),
        marker=dict(color='blue', size=6),
        name='Success Rate (%)'
    ))

    fig.update_layout(
        title='Backup Success Rate Trend',
        xaxis_title='Date',
        yaxis_title='Success Rate (%)',
        yaxis=dict(range=[0, 100]),
        height=400
    )

    return jsonify(fig.to_json())

@app.route('/api/config')
def get_backup_config():
    """Get backup configuration (simplified for security)"""
    config = {
        'global_settings': {
            'max_concurrent_backups': backup_manager.config.get('global_settings', {}).get('max_concurrent_backups', 3),
            'backup_timeout_seconds': backup_manager.config.get('global_settings', {}).get('backup_timeout_seconds', 7200)
        },
        'storage': {
            'default_type': backup_manager.config.get('storage', {}).get('default_type', 's3')
        },
        'encryption': {
            'enabled': backup_manager.config.get('encryption', {}).get('enabled', True)
        },
        'compression': {
            'enabled': backup_manager.config.get('compression', {}).get('enabled', True)
        },
        'validation': {
            'enabled': backup_manager.config.get('validation', {}).get('enabled', True)
        }
    }

    return jsonify(config)

@app.route('/api/health')
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'version': '1.0.0',
        'services': {
            'backup_manager': 'healthy',
            'backup_validator': 'healthy'
        }
    })

@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': 'Internal server error'}), 500

if __name__ == '__main__':
    # Start backup scheduler
    backup_manager.start_scheduler()

    app.run(debug=True, host='0.0.0.0', port=8081)