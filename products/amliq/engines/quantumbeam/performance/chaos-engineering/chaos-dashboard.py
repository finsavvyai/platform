#!/usr/bin/env python3
"""
QuantumBeam Chaos Engineering Dashboard
Web interface for chaos experiment management and visualization
"""

import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from dataclasses import asdict
import yaml

from flask import Flask, render_template, request, jsonify, send_file
from flask_cors import CORS
import plotly.graph_objs as go
import plotly.utils
from chaos_manager import ChaosManager, ChaosExperiment, ExperimentStatus, FaultType

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# Initialize chaos manager
chaos_manager = ChaosManager()

@app.route('/')
def dashboard():
    """Main dashboard page"""
    return render_template('chaos_dashboard.html')

@app.route('/api/experiments')
def get_experiments():
    """Get list of experiments"""
    status_filter = request.args.get('status')

    if status_filter:
        try:
            status_enum = ExperimentStatus(status_filter)
            experiments = chaos_manager.list_experiments(status_enum)
        except ValueError:
            experiments = chaos_manager.list_experiments()
    else:
        experiments = chaos_manager.list_experiments()

    # Convert to JSON-serializable format
    exp_data = []
    for exp in experiments:
        exp_dict = asdict(exp)
        exp_dict['created_at'] = exp.created_at.isoformat()
        if exp.started_at:
            exp_dict['started_at'] = exp.started_at.isoformat()
        if exp.completed_at:
            exp_dict['completed_at'] = exp.completed_at.isoformat()
        exp_dict['status'] = exp.status.value
        exp_dict['fault_type'] = exp.fault_type.value
        exp_data.append(exp_dict)

    return jsonify(exp_data)

@app.route('/api/experiment/<experiment_id>')
def get_experiment(experiment_id):
    """Get specific experiment details"""
    experiment = chaos_manager._get_experiment(experiment_id)
    if not experiment:
        return jsonify({'error': 'Experiment not found'}), 404

    exp_dict = asdict(experiment)
    exp_dict['created_at'] = experiment.created_at.isoformat()
    if experiment.started_at:
        exp_dict['started_at'] = experiment.started_at.isoformat()
    if experiment.completed_at:
        exp_dict['completed_at'] = experiment.completed_at.isoformat()
    exp_dict['status'] = experiment.status.value
    exp_dict['fault_type'] = experiment.fault_type.value

    return jsonify(exp_dict)

@app.route('/api/experiment/<experiment_id>/report')
def get_experiment_report(experiment_id):
    """Get experiment report"""
    output_format = request.args.get('format', 'json')

    try:
        report = chaos_manager.generate_report(experiment_id, output_format)

        if output_format == 'json':
            return jsonify(json.loads(report))
        else:
            return report, 200, {'Content-Type': 'application/x-yaml'}

    except ValueError as e:
        return jsonify({'error': str(e)}), 404

@app.route('/api/experiment', methods=['POST'])
def create_experiment():
    """Create new experiment"""
    data = request.get_json()

    try:
        fault_type = FaultType(data['fault_type'])
        experiment_id = chaos_manager.create_experiment(
            name=data['name'],
            fault_type=fault_type,
            target_pods=data['target_pods'],
            namespace=data.get('namespace'),
            parameters=data.get('parameters', {}),
            duration_seconds=data.get('duration_seconds', 300),
            blast_radius=data.get('blast_radius', 'moderate')
        )

        return jsonify({'experiment_id': experiment_id}), 201

    except (KeyError, ValueError) as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/experiment/<experiment_id>/run', methods=['POST'])
async def run_experiment(experiment_id):
    """Run an experiment"""
    try:
        import asyncio
        results = await asyncio.run(chaos_manager.run_experiment(experiment_id))
        return jsonify(results)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/metrics/summary')
def get_metrics_summary():
    """Get metrics summary for dashboard"""
    experiments = chaos_manager.list_experiments()

    summary = {
        'total_experiments': len(experiments),
        'status_breakdown': {},
        'fault_type_breakdown': {},
        'blast_radius_breakdown': {},
        'recent_experiments': [],
        'success_rate': 0,
        'avg_duration': 0
    }

    # Status breakdown
    for status in ExperimentStatus:
        count = len([exp for exp in experiments if exp.status == status])
        summary['status_breakdown'][status.value] = count

    # Fault type breakdown
    for fault_type in FaultType:
        count = len([exp for exp in experiments if exp.fault_type == fault_type])
        summary['fault_type_breakdown'][fault_type.value] = count

    # Blast radius breakdown
    blast_radii = {}
    for exp in experiments:
        blast_radii[exp.blast_radius] = blast_radii.get(exp.blast_radius, 0) + 1
    summary['blast_radius_breakdown'] = blast_radii

    # Recent experiments (last 7 days)
    seven_days_ago = datetime.now() - timedelta(days=7)
    recent = [exp for exp in experiments if exp.created_at >= seven_days_ago]
    recent.sort(key=lambda x: x.created_at, reverse=True)

    for exp in recent[:10]:  # Last 10 experiments
        summary['recent_experiments'].append({
            'id': exp.id,
            'name': exp.name,
            'status': exp.status.value,
            'fault_type': exp.fault_type.value,
            'created_at': exp.created_at.isoformat(),
            'duration_seconds': exp.duration_seconds
        })

    # Success rate
    completed = [exp for exp in experiments if exp.status == ExperimentStatus.COMPLETED]
    failed = [exp for exp in experiments if exp.status == ExperimentStatus.FAILED]

    total_completed = len(completed) + len(failed)
    if total_completed > 0:
        summary['success_rate'] = (len(completed) / total_completed) * 100

    # Average duration
    if completed:
        total_duration = sum(exp.duration_seconds for exp in completed)
        summary['avg_duration'] = total_duration / len(completed)

    return jsonify(summary)

@app.route('/api/charts/experiment-timeline')
def get_experiment_timeline_chart():
    """Generate experiment timeline chart"""
    experiments = chaos_manager.list_experiments()

    data = []
    for exp in experiments:
        if exp.started_at and exp.completed_at:
            data.append({
                'x': [exp.started_at, exp.completed_at],
                'y': [exp.name, exp.name],
                'status': exp.status.value,
                'fault_type': exp.fault_type.value
            })

    # Create Plotly figure
    fig = go.Figure()

    for exp_data in data:
        color = {
            'completed': 'green',
            'failed': 'red',
            'running': 'blue',
            'pending': 'orange'
        }.get(exp_data['status'], 'gray')

        fig.add_trace(go.Scatter(
            x=exp_data['x'],
            y=exp_data['y'],
            mode='lines+markers',
            line=dict(color=color, width=3),
            marker=dict(color=color, size=8),
            name=exp_data['y'],
            hovertemplate='<b>%{y}</b><br>' +
                         'Start: %{x[0]}<br>' +
                         'End: %{x[1]}<br>' +
                         'Status: ' + exp_data['status'] + '<br>' +
                         'Fault: ' + exp_data['fault_type'] + '<extra></extra>'
        ))

    fig.update_layout(
        title='Chaos Experiment Timeline',
        xaxis_title='Time',
        yaxis_title='Experiment',
        height=max(400, len(data) * 40),
        showlegend=False
    )

    return jsonify(fig.to_json())

@app.route('/api/charts/fault-type-distribution')
def get_fault_type_distribution_chart():
    """Generate fault type distribution chart"""
    experiments = chaos_manager.list_experiments()

    fault_counts = {}
    for fault_type in FaultType:
        count = len([exp for exp in experiments if exp.fault_type == fault_type])
        if count > 0:
            fault_counts[fault_type.value.replace('_', ' ').title()] = count

    # Create pie chart
    fig = go.Figure(data=[go.Pie(
        labels=list(fault_counts.keys()),
        values=list(fault_counts.values()),
        hole=0.3
    )])

    fig.update_layout(
        title='Experiment Distribution by Fault Type',
        height=400
    )

    return jsonify(fig.to_json())

@app.route('/api/charts/success-rate-trend')
def get_success_rate_trend_chart():
    """Generate success rate trend chart"""
    experiments = chaos_manager.list_experiments()

    # Group experiments by week
    weekly_stats = {}

    for exp in experiments:
        if exp.completed_at:
            week_start = exp.completed_at - timedelta(days=exp.completed_at.weekday())
            week_key = week_start.strftime('%Y-%m-%d')

            if week_key not in weekly_stats:
                weekly_stats[week_key] = {'completed': 0, 'failed': 0}

            if exp.status == ExperimentStatus.COMPLETED:
                weekly_stats[week_key]['completed'] += 1
            elif exp.status == ExperimentStatus.FAILED:
                weekly_stats[week_key]['failed'] += 1

    # Calculate success rates
    weeks = sorted(weekly_stats.keys())
    success_rates = []

    for week in weeks:
        total = weekly_stats[week]['completed'] + weekly_stats[week]['failed']
        if total > 0:
            success_rate = (weekly_stats[week]['completed'] / total) * 100
            success_rates.append(success_rate)
        else:
            success_rates.append(0)

    # Create line chart
    fig = go.Figure()

    fig.add_trace(go.Scatter(
        x=weeks,
        y=success_rates,
        mode='lines+markers',
        line=dict(color='blue', width=2),
        marker=dict(color='blue', size=6),
        name='Success Rate'
    ))

    fig.update_layout(
        title='Weekly Success Rate Trend',
        xaxis_title='Week',
        yaxis_title='Success Rate (%)',
        yaxis=dict(range=[0, 100]),
        height=400
    )

    return jsonify(fig.to_json())

@app.route('/api/health')
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'version': '1.0.0'
    })

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=8080)