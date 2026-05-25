#!/usr/bin/env node

/**
 * Questro Business Intelligence CLI
 *
 * Command-line interface for Questro's comprehensive BI capabilities including:
 * - KPI dashboard generation and monitoring
 * - Business impact analysis
 * - Predictive analytics and forecasting
 * - Custom report generation
 * - Data export for external BI tools
 */

import { createBusinessIntelligenceService } from '../services/business-intelligence';

// Mock D1 database for CLI usage
const mockD1Database = {
  prepare: (query: string) => ({
    bind: (...params: any[]) => ({
      run: () => Promise.resolve({ success: true }),
      first: () => Promise.resolve({
        id: 'cli-project-001',
        name: 'CLI BI Project',
        description: 'BI CLI Testing Project'
      }),
      all: () => Promise.resolve({ results: [] })
    })
  })
};

const biService = createBusinessIntelligenceService(mockD1Database as any, {
  enableRealTimeAnalytics: true,
  cacheDuration: 1800000, // 30 minutes
  enablePredictiveAnalytics: true,
  enableCostTracking: true,
  enableBusinessImpact: true,
  defaultTimeRange: '30d'
});

// CLI argument parsing
const args = process.argv.slice(2);
const command = args[0];
const options = parseOptions(args.slice(1));

function parseOptions(argsArray: string[]): Record<string, any> {
  const options: Record<string, any> = {};

  for (let i = 0; i < argsArray.length; i++) {
    const arg = argsArray[i];

    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const nextArg = argsArray[i + 1];

      if (nextArg && !nextArg.startsWith('--')) {
        options[key] = nextArg;
        i++;
      } else {
        options[key] = true;
      }
    }
  }

  return options;
}

// Main CLI handler
async function main() {
  console.log('📊 Questro Business Intelligence CLI');
  console.log('=====================================');

  try {
    switch (command) {
      case 'dashboard':
        await handleDashboard();
        break;

      case 'kpi':
        await handleKPI();
        break;

      case 'impact':
        await handleImpact();
        break;

      case 'predict':
        await handlePredict();
        break;

      case 'report':
        await handleReport();
        break;

      case 'export':
        await handleExport();
        break;

      case 'realtime':
        await handleRealTime();
        break;

      case 'metrics':
        await handleMetrics();
        break;

      case 'demo':
        await handleDemo();
        break;

      case 'help':
      case '--help':
      case '-h':
        showHelp();
        break;

      default:
        console.error(`❌ Unknown command: ${command}`);
        showHelp();
        process.exit(1);
    }
  } catch (error) {
    console.error('❌ CLI Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Dashboard command
async function handleDashboard() {
  console.log(`📈 Opening BI Dashboard...`);
  console.log(`🔗 Dashboard URL: http://localhost:8788/dashboard`);
  console.log(`📊 Features:`);
  console.log(`   • Real-time KPI monitoring`);
  console.log(`   • Interactive analytics`);
  console.log(`   • Custom report generation`);
  console.log(`   • Predictive analytics`);
  console.log(`   • Business impact analysis`);
  console.log('');
  console.log(`💡 To start the dashboard server, run:`);
  console.log(`   npm run bi-dashboard start`);
}

// KPI Dashboard command
async function handleKPI() {
  const timeRange = options['time-range'] || options.tr || '30d';
  const projects = options.projects ? options.projects.split(',') : [];
  const teams = options.teams ? options.teams.split(',') : [];
  const refresh = options.refresh || false;

  console.log(`📊 Generating KPI Dashboard...`);
  console.log(`⏰ Time Range: ${timeRange}`);
  console.log(`📁 Projects: ${projects.length > 0 ? projects.join(', ') : 'All'}`);
  console.log(`👥 Teams: ${teams.length > 0 ? teams.join(', ') : 'All'}`);
  console.log(`🔄 Refresh: ${refresh ? 'Yes' : 'No'}`);
  console.log('');

  try {
    const kpiData = await biService.getKPIDashboard({
      timeRange,
      projects,
      teams,
      refresh
    });

    console.log(`✅ KPI Dashboard Generated\n`);

    // Display Summary Metrics
    console.log(`📈 Key Performance Indicators:`);
    console.log(`   🎯 Test Success Rate: ${kpiData.summary.testSuccessRate.toFixed(1)}%`);
    console.log(`   📋 Test Coverage: ${kpiData.summary.testCoverage.toFixed(1)}%`);
    console.log(`   💰 Testing ROI: ${kpiData.summary.testingROI.toFixed(0)}%`);
    console.log(`   ⚡ Resource Utilization: ${kpiData.summary.resourceUtilization.toFixed(1)}%`);
    console.log(`   🔧 Test Automation Rate: ${kpiData.summary.testAutomationRate.toFixed(1)}%`);
    console.log(`   🏆 User Satisfaction: ${kpiData.summary.userSatisfaction.toFixed(1)}%`);
    console.log(`   💵 Cost Savings: $${kpiData.summary.costSavings.toLocaleString()}`);

    // Display Trends
    console.log(`\n📊 Performance Trends:`);
    kpiData.trends.slice(0, 8).forEach(trend => {
      const icon = trend.trend === 'up' ? '📈' : trend.trend === 'down' ? '📉' : '➡️';
      const sign = trend.change > 0 ? '+' : '';
      console.log(`   ${icon} ${trend.metric}: ${sign}${trend.change.toFixed(1)}%`);
    });

    // Display Alerts
    if (kpiData.alerts.length > 0) {
      console.log(`\n⚠️  Active Alerts (${kpiData.alerts.length}):`);
      kpiData.alerts.forEach(alert => {
        const icon = alert.severity === 'high' ? '🚨' : alert.severity === 'medium' ? '⚠️' : 'ℹ️';
        console.log(`   ${icon} [${alert.severity.toUpperCase()}] ${alert.message}`);
      });
    } else {
      console.log(`\n✅ No active alerts`);
    }

    // Display Insights
    if (kpiData.insights.length > 0) {
      console.log(`\n💡 Key Insights:`);
      kpiData.insights.forEach((insight, index) => {
        console.log(`   ${index + 1}. ${insight}`);
      });
    }

    // Export to file if requested
    if (options.output || options.o) {
      const fs = require('fs');
      const outputData = {
        generatedAt: new Date().toISOString(),
        timeRange,
        projects,
        teams,
        kpiData,
        metadata: {
          totalMetrics: Object.keys(kpiData.summary).length,
          totalTrends: kpiData.trends.length,
          totalAlerts: kpiData.alerts.length,
          totalInsights: kpiData.insights.length
        }
      };

      fs.writeFileSync(options.output, JSON.stringify(outputData, null, 2));
      console.log(`\n💾 KPI dashboard exported to: ${options.output}`);
    }

  } catch (error) {
    console.error('❌ KPI dashboard generation failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Business Impact Analysis command
async function handleImpact() {
  const projectId = options['project-id'] || options.pid;
  const timeRange = options['time-range'] || options.tr || '30d';
  const compareWith = options['compare-with'] || options.cw;

  console.log(`💼 Analyzing Business Impact...`);
  console.log(`🆔 Project ID: ${projectId || 'All Projects'}`);
  console.log(`⏰ Time Range: ${timeRange}`);
  if (compareWith) {
    console.log(`📊 Compare With: ${compareWith}`);
  }
  console.log('');

  try {
    const impactData = await biService.getBusinessImpactAnalysis({
      projectId,
      timeRange,
      compareWith
    });

    console.log(`✅ Business Impact Analysis Completed\n`);

    // Display Time Reduction Analysis
    console.log(`⏱️  Time Reduction Analysis:`);
    console.log(`   📝 Test Creation: ${impactData.timeReduction.testCreation}% reduction`);
    console.log(`   🏃 Test Execution: ${impactData.timeReduction.testExecution}% reduction`);
    console.log(`   🔧 Defect Resolution: ${impactData.timeReduction.defectResolution}% reduction`);
    console.log(`   🚀 Deployment: ${impactData.timeReduction.deployment}% reduction`);

    // Display Cost Savings Analysis
    console.log(`\n💰 Cost Savings Analysis:`);
    console.log(`   🐛 Reduced Defects: $${impactData.costSavings.reducedDefects.toLocaleString()}`);
    console.log(`   🤖 Automated Testing: $${impactData.costSavings.automatedTesting.toLocaleString()}`);
    console.log(`   ⚙️  Resource Optimization: $${impactData.costSavings.resourceOptimization.toLocaleString()}`);
    console.log(`   🛡️  Risk Mitigation: $${impactData.costSavings.riskMitigation.toLocaleString()}`);
    const totalSavings = Object.values(impactData.costSavings).reduce((sum, value) => sum + value, 0);
    console.log(`   💎 Total Savings: $${totalSavings.toLocaleString()}`);

    // Display Quality Improvement Analysis
    console.log(`\n📈 Quality Improvement Analysis:`);
    console.log(`   📉 Defect Reduction: ${impactData.qualityImprovement.defectReduction}% reduction`);
    console.log(`   📋 Coverage Increase: ${impactData.qualityImprovement.coverageIncrease}% increase`);
    console.log(`   🔐 Reliability Gain: ${impactData.qualityImprovement.reliabilityGain}% improvement`);
    console.log(`   😊 Customer Satisfaction: ${impactData.qualityImprovement.customerSatisfaction}% improvement`);

    // Display Strategic Value Analysis
    console.log(`\n🎯 Strategic Value Analysis:`);
    console.log(`   🏆 Market Advantage: ${impactData.strategicValue.marketAdvantage}/100`);
    console.log(`   💡 Innovation Capacity: ${impactData.strategicValue.innovationCapacity}/100`);
    console.log(`   ⚔️  Competitive Edge: ${impactData.strategicValue.competitiveEdge}/100`);
    console.log(`   🌟 Brand Reputation: ${impactData.strategicValue.brandReputation}/100`);

    if (options.output || options.o) {
      const fs = require('fs');
      const outputData = {
        generatedAt: new Date().toISOString(),
        projectId,
        timeRange,
        compareWith,
        impactData,
        totalCostSavings: totalSavings,
        metadata: {
          analysisType: 'business-impact',
          timeframe: timeRange
        }
      };

      fs.writeFileSync(options.output, JSON.stringify(outputData, null, 2));
      console.log(`\n💾 Business impact analysis exported to: ${options.output}`);
    }

  } catch (error) {
    console.error('❌ Business impact analysis failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Predictive Analytics command
async function handlePredict() {
  const forecastPeriod = options['forecast-period'] || options.fp || '90d';
  const confidence = options.confidence ? parseFloat(options.confidence) : 0.8;
  const categories = options.categories ? options.categories.split(',') : ['testVolume', 'defectRate', 'resourceNeeds', 'costs'];

  console.log(`🔮 Generating Predictive Analytics...`);
  console.log(`📅 Forecast Period: ${forecastPeriod}`);
  console.log(`🎯 Confidence Level: ${(confidence * 100).toFixed(0)}%`);
  console.log(`📊 Categories: ${categories.join(', ')}`);
  console.log('');

  try {
    const predictions = await biService.getPredictiveAnalytics({
      forecastPeriod,
      confidence,
      categories
    });

    console.log(`✅ Predictive Analytics Generated\n`);

    // Display Test Volume Predictions
    if (predictions.predictions.testVolume) {
      console.log(`📈 Test Volume Predictions:`);
      predictions.predictions.testVolume.slice(0, 5).forEach(pred => {
        const confidenceIcon = pred.confidence > 0.8 ? '🟢' : pred.confidence > 0.6 ? '🟡' : '🔴';
        console.log(`   ${pred.date}: ${pred.predicted} tests ${confidenceIcon} (${(pred.confidence * 100).toFixed(1)}% confidence)`);
      });
    }

    // Display Defect Rate Predictions
    if (predictions.predictions.defectRate) {
      console.log(`\n🐛 Defect Rate Predictions:`);
      predictions.predictions.defectRate.slice(0, 5).forEach(pred => {
        const confidenceIcon = pred.confidence > 0.8 ? '🟢' : pred.confidence > 0.6 ? '🟡' : '🔴';
        console.log(`   ${pred.date}: ${pred.predicted}% ${confidenceIcon} (${(pred.confidence * 100).toFixed(1)}% confidence)`);
      });
    }

    // Display Resource Needs Predictions
    if (predictions.predictions.resourceNeeds) {
      console.log(`\n👥 Resource Needs Predictions:`);
      predictions.predictions.resourceNeeds.forEach(need => {
        console.log(`   ${need.role}: ${need.needed} needed in ${need.timeline}`);
      });
    }

    // Display Cost Predictions
    if (predictions.predictions.costs) {
      console.log(`\n💰 Cost Predictions:`);
      predictions.predictions.costs.forEach(cost => {
        const trendIcon = cost.trend === 'increasing' ? '📈' : cost.trend === 'decreasing' ? '📉' : '➡️';
        console.log(`   ${cost.category}: $${cost.predicted.toLocaleString()} ${trendIcon}`);
      });
    }

    // Display Recommendations
    if (predictions.recommendations.length > 0) {
      console.log(`\n💡 AI-Generated Recommendations:`);
      predictions.recommendations.forEach((rec, index) => {
        const priorityIcon = rec.priority === 'high' ? '🔥' : rec.priority === 'medium' ? '⚠️' : '💡';
        console.log(`   ${priorityIcon} [${rec.priority.toUpperCase()}] ${rec.action}`);
        console.log(`      Impact: ${rec.impact}`);
        console.log(`      Timeline: ${rec.timeline}`);
        console.log(`      Resources: ${rec.resources.join(', ')}`);
        if (index < predictions.recommendations.length - 1) console.log('');
      });
    }

    // Display Risk Factors
    if (predictions.riskFactors.length > 0) {
      console.log(`\n⚠️  Identified Risk Factors:`);
      predictions.riskFactors.forEach(risk => {
        const riskLevel = risk.probability * risk.impact;
        const riskIcon = riskLevel > 0.6 ? '🔴' : riskLevel > 0.3 ? '🟡' : '🟢';
        console.log(`   ${riskIcon} ${risk.factor} (Risk: ${(riskLevel * 100).toFixed(1)}%)`);
        console.log(`      Probability: ${(risk.probability * 100).toFixed(1)}%, Impact: ${(risk.impact * 100).toFixed(1)}%`);
        console.log(`      Mitigation: ${risk.mitigation}`);
      });
    }

    if (options.output || options.o) {
      const fs = require('fs');
      const outputData = {
        generatedAt: new Date().toISOString(),
        forecastPeriod,
        confidence,
        categories,
        predictions,
        metadata: {
          totalRecommendations: predictions.recommendations.length,
          totalRiskFactors: predictions.riskFactors.length,
          confidenceLevel: confidence
        }
      };

      fs.writeFileSync(options.output, JSON.stringify(outputData, null, 2));
      console.log(`\n💾 Predictive analytics exported to: ${options.output}`);
    }

  } catch (error) {
    console.error('❌ Predictive analytics generation failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Custom Report Generation command
async function handleReport() {
  const reportType = options.type || options.t || 'executive';
  const timeRange = options['time-range'] || options.tr || '30d';
  const outputFormat = options.format || options.f || 'json';

  console.log(`📋 Generating Custom Report...`);
  console.log(`📄 Report Type: ${reportType}`);
  console.log(`⏰ Time Range: ${timeRange}`);
  console.log(`📊 Format: ${outputFormat}`);
  console.log('');

  try {
    // Create report configuration based on type
    const reportConfig = {
      id: `custom-${reportType}-${Date.now()}`,
      name: `${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Report`,
      description: `Custom ${reportType} report generated via CLI`,
      type: reportType,
      timeRange,
      filters: {},
      metrics: [],
      visualizations: []
    };

    // Add specific configurations based on report type
    switch (reportType) {
      case 'executive':
        reportConfig.metrics = ['testingROI', 'costSavings', 'qualityScore', 'riskMitigation'];
        reportConfig.visualizations = [
          { type: 'metric', title: 'ROI & Savings', dataSource: 'financial' },
          { type: 'chart', title: 'Quality Trends', dataSource: 'quality' }
        ];
        break;
      case 'detailed':
        reportConfig.metrics = ['testExecutionRate', 'testSuccessRate', 'testCoverage', 'defectDetectionRate'];
        reportConfig.visualizations = [
          { type: 'chart', title: 'Test Execution', dataSource: 'performance' },
          { type: 'table', title: 'Detailed Metrics', dataSource: 'all' }
        ];
        break;
      case 'trend':
        reportConfig.metrics = ['testSuccessRate', 'testCoverage', 'testingROI'];
        reportConfig.visualizations = [
          { type: 'chart', title: 'Trend Analysis', dataSource: 'trends' }
        ];
        break;
    }

    const report = await biService.generateCustomReport(reportConfig);

    console.log(`✅ Custom Report Generated\n`);
    console.log(`📋 Report: ${report.name}`);
    console.log(`🆔 ID: ${report.id}`);
    console.log(`📅 Generated: ${report.generatedAt}`);
    console.log(`📊 Data Points: ${JSON.stringify(report.data).length} characters`);
    console.log(`📈 Visualizations: ${report.visualizations.length}`);
    console.log(`\n📄 Executive Summary:`);
    console.log(`   ${report.summary}`);

    if (options.output || options.o) {
      const fs = require('fs');

      if (outputFormat === 'json') {
        fs.writeFileSync(options.output, JSON.stringify(report, null, 2));
      } else if (outputFormat === 'markdown') {
        const markdown = convertReportToMarkdown(report);
        fs.writeFileSync(options.output, markdown);
      } else if (outputFormat === 'csv') {
        const csv = convertReportToCSV(report);
        fs.writeFileSync(options.output, csv);
      }

      console.log(`\n💾 Report exported to: ${options.output} (${outputFormat})`);
    }

  } catch (error) {
    console.error('❌ Custom report generation failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Data Export command
async function handleExport() {
  const format = options.format || options.f || 'json';
  const dataTypes = options['data-types'] || options.dt || 'testRuns,testCases,projects';
  const timeRange = options['time-range'] || options.tr || '30d';

  console.log(`📤 Exporting Data...`);
  console.log(`📊 Format: ${format}`);
  console.log(`📋 Data Types: ${dataTypes}`);
  console.log(`⏰ Time Range: ${timeRange}`);
  console.log('');

  try {
    const exportData = await biService.exportData({
      format: format as 'json' | 'csv' | 'excel',
      dataTypes: dataTypes.split(','),
      timeRange,
      filters: {}
    });

    console.log(`✅ Data Export Completed\n`);
    console.log(`📊 Format: ${exportData.format}`);
    console.log(`📅 Exported: ${exportData.exportedAt}`);
    console.log(`📈 Records: ${exportData.recordCount.toLocaleString()}`);
    console.log(`📦 Data Size: ${JSON.stringify(exportData.data).length} characters`);

    if (options.output || options.o) {
      const fs = require('fs');

      if (format === 'json') {
        fs.writeFileSync(options.output, JSON.stringify(exportData.data, null, 2));
      } else if (format === 'csv') {
        fs.writeFileSync(options.output, exportData.data);
      } else if (format === 'excel') {
        fs.writeFileSync(options.output, JSON.stringify(exportData.data, null, 2));
      }

      console.log(`\n💾 Data exported to: ${options.output}`);
    } else {
      console.log(`\n💡 Use --output flag to save to file`);
    }

  } catch (error) {
    console.error('❌ Data export failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Real-time metrics command
async function handleRealTime() {
  const projects = options.projects ? options.projects.split(',') : [];
  const types = options.types ? options.types.split(',') : [];

  console.log(`⚡ Fetching Real-time Metrics...`);
  console.log(`📁 Projects: ${projects.length > 0 ? projects.join(', ') : 'All'}`);
  console.log(`📋 Types: ${types.length > 0 ? types.join(', ') : 'All'}`);
  console.log('');

  try {
    const metrics = await biService.getRealTimeMetrics({
      projects,
      types
    });

    console.log(`✅ Real-time Metrics Retrieved\n`);
    console.log(`⏰ Timestamp: ${metrics.timestamp}`);
    console.log(`🔄 Active Tests: ${metrics.activeTests}`);
    console.log(`📈 Execution Rate: ${metrics.testExecutionRate.toLocaleString()}/hour`);
    console.log(`✅ Success Rate: ${metrics.successRate.toFixed(1)}%`);
    console.log(`⏱️  Average Duration: ${metrics.averageDuration.toFixed(1)}s`);

    console.log(`\n🖥️  Resource Usage:`);
    Object.entries(metrics.resourceUsage).forEach(([resource, usage]) => {
      const icon = getResourceIcon(resource);
      const usageLevel = usage > 80 ? '🔴' : usage > 60 ? '🟡' : '🟢';
      console.log(`   ${icon} ${resource.charAt(0).toUpperCase() + resource.slice(1)}: ${usage.toFixed(1)}% ${usageLevel}`);
    });

    if (metrics.recentActivity.length > 0) {
      console.log(`\n🕐 Recent Activity (last 10):`);
      metrics.recentActivity.forEach((activity, index) => {
        const timeAgo = getTimeAgo(new Date(activity.timestamp));
        const statusIcon = activity.status === 'passed' ? '✅' : activity.status === 'failed' ? '❌' : '🔄';
        console.log(`   ${index + 1}. ${statusIcon} ${activity.project} - ${activity.type} (${timeAgo})`);
      });
    }

  } catch (error) {
    console.error('❌ Real-time metrics retrieval failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Metrics monitoring command
async function handleMetrics() {
  const timeframe = options.timeframe || options.t || '7'; // days
  const watch = options.watch || options.w;

  console.log(`📊 Monitoring BI Metrics`);
  console.log(`========================`);
  console.log(`⏰ Timeframe: Last ${timeframe} days`);
  console.log(`🔄 Watch Mode: ${watch ? 'Enabled' : 'Disabled'}`);
  console.log('');

  if (watch) {
    console.log(`👀 Starting continuous monitoring... (Press Ctrl+C to stop)`);

    const monitor = async () => {
      try {
        // Clear console for better visibility
        console.clear();
        console.log(`📊 Questro BI Metrics - ${new Date().toLocaleString()}`);
        console.log('='.repeat(50));

        // Get KPIs
        const kpis = await biService.getKPIDashboard({
          timeRange: `${timeframe}d`,
          refresh: true
        });

        console.log(`\n📈 Key Metrics:`);
        console.log(`   Success Rate: ${kpis.summary.testSuccessRate.toFixed(1)}%`);
        console.log(`   Coverage: ${kpis.summary.testCoverage.toFixed(1)}%`);
        console.log(`   ROI: ${kpis.summary.testingROI.toFixed(0)}%`);
        console.log(`   Savings: $${kpis.summary.costSavings.toLocaleString()}`);

        // Get real-time metrics
        const realtime = await biService.getRealTimeMetrics();
        console.log(`\n⚡ Real-time:`);
        console.log(`   Active: ${realtime.activeTests}`);
        console.log(`   Success: ${realtime.successRate.toFixed(1)}%`);
        console.log(`   Duration: ${realtime.averageDuration.toFixed(1)}s`);

        // Check alerts
        if (kpis.alerts.length > 0) {
          console.log(`\n⚠️  Alerts: ${kpis.alerts.length}`);
          kpis.alerts.slice(0, 3).forEach(alert => {
            console.log(`   • ${alert.message}`);
          });
        } else {
          console.log(`\n✅ No alerts`);
        }

        console.log(`\n⏱️  Next update in 30 seconds...`);

      } catch (error) {
        console.error('❌ Monitoring error:', error instanceof Error ? error.message : error);
      }
    };

    // Initial run
    await monitor();

    // Set up interval
    const interval = setInterval(monitor, 30000);

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      clearInterval(interval);
      console.log('\n👋 Monitoring stopped');
      process.exit(0);
    });

  } else {
    // Single metrics snapshot
    try {
      const kpis = await biService.getKPIDashboard({
        timeRange: `${timeframe}d`
      });

      console.log(`📊 BI Metrics Summary:`);
      console.log(`   Success Rate: ${kpis.summary.testSuccessRate.toFixed(1)}%`);
      console.log(`   Test Coverage: ${kpis.summary.testCoverage.toFixed(1)}%`);
      console.log(`   Testing ROI: ${kpis.summary.testingROI.toFixed(0)}%`);
      console.log(`   Cost Savings: $${kpis.summary.costSavings.toLocaleString()}`);
      console.log(`   Automation Rate: ${kpis.summary.testAutomationRate.toFixed(1)}%`);
      console.log(`   User Satisfaction: ${kpis.summary.userSatisfaction.toFixed(1)}%`);
      console.log(`   Resource Utilization: ${kpis.summary.resourceUtilization.toFixed(1)}%`);

      console.log(`\n📈 Recent Trends (last ${timeframe} days):`);
      kpis.trends.slice(0, 5).forEach(trend => {
        const icon = trend.trend === 'up' ? '📈' : trend.trend === 'down' ? '📉' : '➡️';
        console.log(`   ${icon} ${trend.metric}: ${trend.change > 0 ? '+' : ''}${trend.change.toFixed(1)}%`);
      });

    } catch (error) {
      console.error('❌ Metrics retrieval failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  }
}

// Demo command
async function handleDemo() {
  console.log(`🎭 Questro Business Intelligence Demo`);
  console.log(`===================================`);
  console.log('');

  try {
    console.log(`📊 Demo: Comprehensive BI Analysis\n`);

    // Generate KPI Dashboard
    console.log(`1️⃣ Generating KPI Dashboard...`);
    const kpis = await biService.getKPIDashboard({
      timeRange: '30d',
      refresh: true
    });

    console.log(`   📈 Key Performance Indicators:`);
    console.log(`      • Test Success Rate: ${kpis.summary.testSuccessRate.toFixed(1)}%`);
    console.log(`      • Test Coverage: ${kpis.summary.testCoverage.toFixed(1)}%`);
    console.log(`      • Testing ROI: ${kpis.summary.testingROI.toFixed(0)}%`);
    console.log(`      • Cost Savings: $${kpis.summary.costSavings.toLocaleString()}`);
    console.log(`      • Automation Rate: ${kpis.summary.testAutomationRate.toFixed(1)}%`);

    // Generate Business Impact Analysis
    console.log(`\n2️⃣ Analyzing Business Impact...`);
    const impact = await biService.getBusinessImpactAnalysis({
      timeRange: '30d'
    });

    const totalSavings = Object.values(impact.costSavings).reduce((sum, value) => sum + value, 0);
    console.log(`   💰 Total Cost Savings: $${totalSavings.toLocaleString()}`);
    console.log(`   ⏱️  Time Reductions: ${impact.timeReduction.testCreation}% (test creation)`);
    console.log(`   📈 Quality Improvement: ${impact.qualityImprovement.defectReduction}% defect reduction`);
    console.log(`   🎯 Strategic Value: ${impact.strategicValue.competitiveEdge}/100 competitive edge`);

    // Generate Predictive Analytics
    console.log(`\n3️⃣ Running Predictive Analytics...`);
    const predictions = await biService.getPredictiveAnalytics({
      forecastPeriod: '90d',
      confidence: 0.8,
      categories: ['testVolume', 'defectRate', 'resourceNeeds']
    });

    console.log(`   📈 Test Volume Forecast: Growing trend predicted`);
    console.log(`   🐛 Defect Rate Forecast: Stable with slight improvement`);
    console.log(`   👥 Resource Needs: ${predictions.predictions.resourceNeeds.length} roles identified`);
    console.log(`   💡 AI Recommendations: ${predictions.recommendations.length} actionable insights`);

    // Generate Custom Report
    console.log(`\n4️⃣ Creating Executive Report...`);
    const report = await biService.generateCustomReport({
      id: 'demo-executive-report',
      name: 'Demo Executive Dashboard',
      description: 'Comprehensive BI overview for demonstration',
      type: 'executive',
      timeRange: '30d',
      filters: {},
      metrics: ['testingROI', 'costSavings', 'qualityScore'],
      visualizations: [
        { type: 'metric', title: 'Financial Impact', dataSource: 'financial' },
        { type: 'chart', title: 'Quality Trends', dataSource: 'quality' }
      ]
    });

    console.log(`   📋 Executive Report: "${report.name}"`);
    console.log(`   📊 Visualizations: ${report.visualizations.length}`);
    console.log(`   📄 Summary: ${report.summary.substring(0, 100)}...`);

    // Get Real-time Metrics
    console.log(`\n5️⃣ Checking Real-time Performance...`);
    const realtime = await biService.getRealTimeMetrics();

    console.log(`   ⚡ Active Tests: ${realtime.activeTests}`);
    console.log(`   📈 Success Rate: ${realtime.successRate.toFixed(1)}%`);
    console.log(`   ⏱️  Avg Duration: ${realtime.averageDuration.toFixed(1)}s`);
    console.log(`   🖥️  Resource Usage: ${(Object.values(realtime.resourceUsage).reduce((sum, val) => sum + val, 0) / 4).toFixed(1)}% average`);

    console.log(`\n🎉 Demo Summary:`);
    console.log(`   📊 Comprehensive BI capabilities demonstrated`);
    console.log(`   💰 Total business value: $${(totalSavings + kpis.summary.costSavings).toLocaleString()}`);
    console.log(`   🤖 AI-powered insights: ${predictions.recommendations.length} recommendations`);
    console.log(`   ⚡ Real-time monitoring: Active and operational`);
    console.log(`   📈 Trend analysis: ${kpis.trends.filter(t => t.trend === 'up').length} positive trends`);

    console.log(`\n💡 Try these commands next:`);
    console.log(`   npm run bi kpi --time-range 7d --output weekly-kpi.json`);
    console.log(`   npm run bi impact --project-id demo --compare-with 30d`);
    console.log(`   npm run bi predict --forecast-period 180d --confidence 0.9`);
    console.log(`   npm run bi report --type detailed --format markdown --output report.md`);
    console.log(`   npm run bi metrics --watch`);
    console.log(`   npm run bi dashboard`);

    console.log(`\n🚀 Questro BI provides comprehensive business intelligence capabilities that transform testing data into actionable business insights!`);

  } catch (error) {
    console.error('❌ Demo failed:', error instanceof Error ? error.message : error);
    console.log('\n💡 This might be due to missing dependencies or configuration.');
    console.log('The demo showcases the full capabilities of Questro BI.');
    process.exit(1);
  }
}

// Help command
function showHelp() {
  console.log(`
📊 Questro Business Intelligence CLI

USAGE:
  npm run bi <command> [options]

COMMANDS:
  dashboard        Open BI dashboard interface
  kpi              Generate KPI dashboard with metrics and trends
  impact           Analyze business impact and ROI
  predict          Generate AI-powered predictive analytics
  report           Create custom reports with visualizations
  export           Export data for external BI tools
  realtime         Fetch real-time metrics and activity
  metrics          Monitor BI metrics with optional watch mode
  demo             Run comprehensive BI capabilities demo
  help             Show this help message

KPI DASHBOARD OPTIONS:
  --time-range, -tr      Time period for analysis (default: 30d)
  --projects             Project IDs to include (comma-separated)
  --teams                Team names to include (comma-separated)
  --refresh              Force refresh of cached data
  --output, -o           Output file for KPI data

BUSINESS IMPACT OPTIONS:
  --project-id, --pid    Project ID to analyze (default: all projects)
  --time-range, -tr      Time period for analysis (default: 30d)
  --compare-with, -cw    Previous period to compare against
  --output, -o           Output file for impact analysis

PREDICTIVE ANALYTICS OPTIONS:
  --forecast-period, -fp Forecast period (default: 90d)
  --confidence           Confidence level 0-1 (default: 0.8)
  --categories           Categories to predict (comma-separated)
  --output, -o           Output file for predictions

CUSTOM REPORT OPTIONS:
  --type, -t             Report type: executive|detailed|trend|comparison
  --time-range, -tr      Time period for report (default: 30d)
  --format, -f           Output format: json|markdown|csv (default: json)
  --output, -o           Output file for report

DATA EXPORT OPTIONS:
  --format, -f           Export format: json|csv|excel (default: json)
  --data-types, -dt      Data types to export (comma-separated)
  --time-range, -tr      Time period for data (default: 30d)
  --output, -o           Output file for exported data

REAL-TIME METRICS OPTIONS:
  --projects             Project IDs to monitor (comma-separated)
  --types                Metric types to include (comma-separated)

METRICS MONITORING OPTIONS:
  --timeframe, -t        Timeframe in days (default: 7)
  --watch, -w            Enable continuous monitoring mode

EXAMPLES:
  # Generate comprehensive KPI dashboard
  npm run bi kpi --time-range 30d --projects proj1,proj2 --output kpi-report.json

  # Analyze business impact for specific project
  npm run bi impact --project-id my-project --compare-with 30d --output impact.json

  # Generate predictive analytics with high confidence
  npm run bi predict --forecast-period 180d --confidence 0.9 --categories testVolume,defectRate

  # Create executive summary report
  npm run bi report --type executive --format markdown --output exec-report.md

  # Export test data for external BI tools
  npm run bi export --format csv --data-types testRuns,testResults --time-range 90d --output data.csv

  # Monitor real-time metrics
  npm run bi realtime --projects critical-project --types performance

  # Continuous metrics monitoring
  npm run bi metrics --timeframe 7 --watch

  # Run comprehensive demo
  npm run bi demo

  # Open web dashboard
  npm run bi dashboard

ENVIRONMENT VARIABLES:
  DATABASE_URL           Database connection string
  ENABLE_AI_FEATURES     Enable AI-powered features (default: true)
  BI_CACHE_DURATION      Cache duration in milliseconds (default: 300000)

For more information, visit: https://docs.questro.io/business-intelligence
`);
}

// Utility functions
function getResourceIcon(resource: string): string {
  const icons: Record<string, string> = {
    cpu: '💻',
    memory: '🧠',
    disk: '💾',
    network: '🌐'
  };
  return icons[resource] || '📊';
}

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);

  if (seconds < 60) return seconds + 's ago';
  if (seconds < 3600) return Math.floor(seconds / 60) + 'm ago';
  if (seconds < 86400) return Math.floor(seconds / 3600) + 'h ago';
  return Math.floor(seconds / 86400) + 'd ago';
}

function convertReportToMarkdown(report: any): string {
  return `# ${report.name}

Generated: ${report.generatedAt}

## Executive Summary
${report.summary}

## Data Visualizations
${report.visualizations.map((viz: any) => `
### ${viz.title}
Type: ${viz.type}
Data Source: ${viz.dataSource}
`).join('')}

## Raw Data
\`\`\`json
${JSON.stringify(report.data, null, 2)}
\`\`\`
`;
}

function convertReportToCSV(report: any): string {
  // Simple CSV conversion - in reality this would be more sophisticated
  const headers = ['Metric', 'Value', 'Trend'];
  const rows = [
    ['Generated At', report.generatedAt, 'N/A'],
    ['Visualizations', report.visualizations.length.toString(), 'N/A']
  ];

  return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
}

// Run main function
main().catch(console.error);
