import React, { useState, useEffect } from 'react';
import { Activity, Zap, Shield, TrendingUp } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

interface RealTimeMetricsProps {
  data: any;
  loading: boolean;
}

export function RealTimeMetrics({ data, loading }: RealTimeMetricsProps) {
  const [liveData, setLiveData] = useState([]);
  const [currentMetrics, setCurrentMetrics] = useState({
    requestsPerSecond: 0,
    avgLatency: 0,
    activeConnections: 0,
    complianceScore: 0
  });

  useEffect(() => {
    // Simulate real-time data updates
    const interval = setInterval(() => {
      const newMetrics = {
        requestsPerSecond: Math.floor(Math.random() * 50) + 10,
        avgLatency: Math.floor(Math.random() * 100) + 50,
        activeConnections: Math.floor(Math.random() * 200) + 100,
        complianceScore: (Math.random() * 5 + 95).toFixed(1)
      };
      setCurrentMetrics(newMetrics);

      // Update chart data
      setLiveData(prev => {
        const newData = [
          ...prev,
          {
            time: new Date().toLocaleTimeString(),
            ...newMetrics
          }
        ];
        return newData.slice(-20); // Keep last 20 data points
      });
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-64 bg-gray-200 rounded"></div>
      </div>
    );
  }

  // Initialize with sample data
  useEffect(() => {
    const initialData = Array.from({ length: 10 }, (_, i) => ({
      time: new Date(Date.now() - (9 - i) * 60000).toLocaleTimeString(),
      requestsPerSecond: Math.floor(Math.random() * 30) + 15,
      avgLatency: Math.floor(Math.random() * 80) + 60,
      activeConnections: Math.floor(Math.random() * 150) + 120,
      complianceScore: (Math.random() * 3 + 96).toFixed(1)
    }));
    setLiveData(initialData);
  }, []);

  return (
    <div className="space-y-6">
      {/* Real-time Metrics Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-900">Requests/Second</p>
              <p className="text-2xl font-bold text-blue-600">{currentMetrics.requestsPerSecond}</p>
            </div>
            <Activity className="h-8 w-8 text-blue-500" />
          </div>
          <div className="mt-2 flex items-center text-xs text-blue-700">
            <TrendingUp className="h-3 w-3 mr-1" />
            +12% from last hour
          </div>
        </div>

        <div className="bg-green-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-900">Avg Latency</p>
              <p className="text-2xl font-bold text-green-600">{currentMetrics.avgLatency}ms</p>
            </div>
            <Zap className="h-8 w-8 text-green-500" />
          </div>
          <div className="mt-2 flex items-center text-xs text-green-700">
            <TrendingUp className="h-3 w-3 mr-1" />
            Optimal performance
          </div>
        </div>

        <div className="bg-purple-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-purple-900">Active Connections</p>
              <p className="text-2xl font-bold text-purple-600">{currentMetrics.activeConnections}</p>
            </div>
            <Activity className="h-8 w-8 text-purple-500" />
          </div>
          <div className="mt-2 flex items-center text-xs text-purple-700">
            Across 3 organizations
          </div>
        </div>

        <div className="bg-indigo-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-indigo-900">Compliance Score</p>
              <p className="text-2xl font-bold text-indigo-600">{currentMetrics.complianceScore}%</p>
            </div>
            <Shield className="h-8 w-8 text-indigo-500" />
          </div>
          <div className="mt-2 flex items-center text-xs text-indigo-700">
            All frameworks compliant
          </div>
        </div>
      </div>

      {/* Real-time Charts */}
      <div className="space-y-4">
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">Request Volume (Last 20 Minutes)</h4>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={liveData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 10 }}
                  interval="preserveStartEnd"
                />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    fontSize: '12px'
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="requestsPerSecond"
                  stroke="#3b82f6"
                  fill="#93bbfc"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">Latency Trends</h4>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={liveData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 10 }}
                  interval="preserveStartEnd"
                />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    fontSize: '12px'
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="avgLatency"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* System Health Indicators */}
      <div className="border-t pt-4">
        <h4 className="text-sm font-medium text-gray-700 mb-3">System Health</h4>
        <div className="grid grid-cols-1 gap-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">AI Gateway Status</span>
            <span className="flex items-center text-green-600">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
              Operational
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Policy Engine</span>
            <span className="flex items-center text-green-600">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
              Healthy
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Audit System</span>
            <span className="flex items-center text-green-600">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
              Recording
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Storage Utilization</span>
            <span className="text-yellow-600">23% used</span>
          </div>
        </div>
      </div>
    </div>
  );
}