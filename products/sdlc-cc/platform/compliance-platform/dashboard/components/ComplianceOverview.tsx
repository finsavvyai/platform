import React from 'react';
import { Shield, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface ComplianceOverviewProps {
  data: unknown;
  loading: boolean;
}

export function ComplianceOverview({ data, loading }: ComplianceOverviewProps) {
  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-64 bg-gray-200 rounded"></div>
      </div>
    );
  }

  // Sample data - would come from API
  const complianceByFramework = [
    { name: 'HIPAA', score: 98, transactions: 1250 },
    { name: 'GDPR', score: 96, transactions: 890 },
    { name: 'FINRA', score: 99, transactions: 2100 },
    { name: 'SOX', score: 97, transactions: 450 }
  ];

  const riskDistribution = [
    { name: 'Low Risk', value: 65, color: '#10b981' },
    { name: 'Medium Risk', value: 25, color: '#f59e0b' },
    { name: 'High Risk', value: 8, color: '#ef4444' },
    { name: 'Critical', value: 2, color: '#dc2626' }
  ];

  const recentViolations = [
    {
      id: 1,
      type: 'HIPAA',
      description: 'Unauthorized PHI access attempt',
      severity: 'high',
      timestamp: '2025-11-07T14:30:00Z',
      status: 'blocked'
    },
    {
      id: 2,
      type: 'GDPR',
      description: 'Missing consent for data processing',
      severity: 'medium',
      timestamp: '2025-11-07T13:45:00Z',
      status: 'warning'
    },
    {
      id: 3,
      type: 'FINRA',
      description: 'Insufficient supervision flag',
      severity: 'low',
      timestamp: '2025-11-07T12:20:00Z',
      status: 'resolved'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Compliance Scores by Framework */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-3">Compliance by Framework</h4>
        <div className="grid grid-cols-2 gap-4">
          {complianceByFramework.map((framework) => (
            <div key={framework.name} className="bg-gray-50 rounded-lg p-3">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-900">{framework.name}</span>
                <span className={`text-sm font-bold ${
                  framework.score >= 95 ? 'text-green-600' :
                  framework.score >= 90 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {framework.score}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${
                    framework.score >= 95 ? 'bg-green-500' :
                    framework.score >= 90 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${framework.score}%` }}
                ></div>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {framework.transactions} transactions
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Risk Distribution */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-3">Risk Distribution</h4>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={riskDistribution}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={70}
                paddingAngle={2}
                dataKey="value"
              >
                {riskDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number) => [`${value}%`, 'Percentage']}
                contentStyle={{
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px'
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-3">
          {riskDistribution.map((risk) => (
            <div key={risk.name} className="flex items-center text-xs">
              <div
                className="w-3 h-3 rounded-full mr-2"
                style={{ backgroundColor: risk.color }}
              ></div>
              <span className="text-gray-600">{risk.name}: {risk.value}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Violations */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-3">Recent Policy Violations</h4>
        <div className="space-y-2">
          {recentViolations.map((violation) => (
            <div key={violation.id} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
              <div className="flex-shrink-0 mt-0.5">
                {violation.status === 'blocked' && (
                  <XCircle className="h-4 w-4 text-red-500" />
                )}
                {violation.status === 'warning' && (
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                )}
                {violation.status === 'resolved' && (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900 font-medium">
                  {violation.type} - {violation.description}
                </p>
                <p className="text-xs text-gray-500">
                  {new Date(violation.timestamp).toLocaleString()} • Severity: {violation.severity}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}