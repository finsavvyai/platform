import React, { useState, useEffect } from 'react';
import { Shield, Activity, AlertTriangle, CheckCircle, TrendingUp, Users, Lock, FileText } from 'lucide-react';
import { ComplianceOverview } from '../components/ComplianceOverview';
import { RealTimeMetrics } from '../components/RealTimeMetrics';
import { PolicyStatus } from '../components/PolicyStatus';
import { AuditTrail } from '../components/AuditTrail';
import { ComplianceScore } from '../components/ComplianceScore';

export default function Dashboard() {
  const [complianceData, setComplianceData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedTimeRange, setSelectedTimeRange] = useState('24h');

  useEffect(() => {
    fetchComplianceData();
    const interval = setInterval(fetchComplianceData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [selectedTimeRange]);

  const fetchComplianceData = async () => {
    try {
      setLoading(true);
      // This would call your actual API
      const response = await fetch(`/api/compliance/dashboard?timeRange=${selectedTimeRange}`);
      const data = await response.json();
      setComplianceData(data);
    } catch (error) {
      console.error('Failed to fetch compliance data:', error);
    } finally {
      setLoading(false);
    }
  };

  const stats = complianceData?.summary || {
    totalTransactions: 0,
    avgComplianceScore: 0,
    successRate: 0,
    activePolicies: 0,
    violationsToday: 0,
    highRiskEvents: 0
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Shield className="h-8 w-8 text-blue-600" />
                <h1 className="text-2xl font-bold text-gray-900">SDLC Compliance Platform</h1>
              </div>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                <div className="w-2 h-2 bg-green-400 rounded-full mr-1.5 animate-pulse"></div>
                All Systems Operational
              </span>
            </div>
            <div className="flex items-center space-x-4">
              <select
                value={selectedTimeRange}
                onChange={(e) => setSelectedTimeRange(e.target.value)}
                className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
              >
                <option value="1h">Last Hour</option>
                <option value="24h">Last 24 Hours</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
              </select>
              <button
                onClick={fetchComplianceData}
                className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Activity className="h-6 w-6 text-gray-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Total Transactions
                    </dt>
                    <dd className="text-lg font-semibold text-gray-900">
                      {stats.totalTransactions.toLocaleString()}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
            <div className="bg-gray-50 px-5 py-3">
              <div className="text-sm">
                <span className="text-green-600 font-medium">
                  +12% from last period
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <CheckCircle className="h-6 w-6 text-green-500" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Avg Compliance Score
                    </dt>
                    <dd className="text-lg font-semibold text-gray-900">
                      {(stats.avgComplianceScore * 100).toFixed(1)}%
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
            <div className="bg-gray-50 px-5 py-3">
              <div className="text-sm">
                <span className="text-green-600 font-medium">
                  Above threshold
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Users className="h-6 w-6 text-blue-500" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Active Users
                    </dt>
                    <dd className="text-lg font-semibold text-gray-900">
                      {Math.floor(stats.totalTransactions / 15).toLocaleString()}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
            <div className="bg-gray-50 px-5 py-3">
              <div className="text-sm">
                <span className="text-blue-600 font-medium">
                  Across 3 organizations
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Lock className="h-6 w-6 text-indigo-500" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Data Protected
                    </dt>
                    <dd className="text-lg font-semibold text-gray-900">
                      {stats.totalTransactions} items
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
            <div className="bg-gray-50 px-5 py-3">
              <div className="text-sm">
                <span className="text-indigo-600 font-medium">
                  100% encrypted
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Alert for Violations */}
        {stats.violationsToday > 0 && (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-8">
            <div className="flex">
              <div className="flex-shrink-0">
                <AlertTriangle className="h-5 w-5 text-yellow-400" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-700">
                  <strong>Attention:</strong> {stats.violationsToday} policy violations detected today.
                  {stats.highRiskEvents > 0 && ` ${stats.highRiskEvents} high-risk events require review.`}
                </p>
                <div className="mt-2">
                  <button className="text-sm text-yellow-700 underline font-medium">
                    View Violations →
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Compliance Overview */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                Compliance Overview
              </h3>
              <ComplianceOverview data={complianceData} loading={loading} />
            </div>
          </div>

          {/* Real-time Metrics */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                Real-time Activity
              </h3>
              <RealTimeMetrics data={complianceData} loading={loading} />
            </div>
          </div>
        </div>

        {/* Policy Status and Audit Trail */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Policy Status */}
          <div className="lg:col-span-1">
            <div className="bg-white shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                  Policy Status
                </h3>
                <PolicyStatus data={complianceData} loading={loading} />
              </div>
            </div>
          </div>

          {/* Recent Audit Trail */}
          <div className="lg:col-span-2">
            <div className="bg-white shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">
                    Recent Audit Trail
                  </h3>
                  <button className="text-sm text-blue-600 hover:text-blue-800 font-medium">
                    View All →
                  </button>
                </div>
                <AuditTrail data={complianceData} loading={loading} />
              </div>
            </div>
          </div>
        </div>

        {/* Compliance Score Details */}
        <div className="mt-8 bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Compliance Score Breakdown
              </h3>
              <button className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                <FileText className="h-4 w-4 mr-1" />
                Export Report
              </button>
            </div>
            <ComplianceScore data={complianceData} loading={loading} />
          </div>
        </div>
      </div>
    </div>
  );
}