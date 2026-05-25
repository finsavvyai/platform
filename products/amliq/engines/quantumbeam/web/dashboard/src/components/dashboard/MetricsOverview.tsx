import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { FraudRateChart, QuantumAdvantageChart, TransactionVolumeChart, ResponseTimeChart } from '@/components/charts/MetricsChart'
import { Badge } from '@/components/ui/Badge'
import { useMetrics } from '@/store/useDashboardStore'
import { formatNumber, formatPercentage, formatDuration, getRiskLevelColor } from '@/lib/utils'
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Zap,
  Shield,
  Clock,
  AlertTriangle,
  CheckCircle
} from 'lucide-react'

export function MetricsOverview() {
  const metrics = useMetrics()

  if (!metrics) {
    return (
      <div className="grid gap-6">
        <div className="text-center py-12">
          <div className="animate-pulse">
            <Activity className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Loading metrics...</p>
          </div>
        </div>
      </div>
    )
  }

  const MetricCard = ({
    title,
    value,
    format,
    icon: Icon,
    trend,
    color = "default"
  }: {
    title: string
    value: number | string
    format?: 'number' | 'percentage' | 'currency' | 'duration'
    icon: React.ComponentType<{ className?: string }>
    trend?: number
    color?: 'default' | 'success' | 'warning' | 'error'
  }) => {
    const formatValue = (val: number | string) => {
      if (typeof val === 'string') return val

      switch (format) {
        case 'percentage':
          return formatPercentage(val)
        case 'currency':
          return `$${formatNumber(val)}`
        case 'duration':
          return formatDuration(val)
        default:
          return formatNumber(val)
      }
    }

    const getTrendIcon = () => {
      if (trend === undefined) return null
      if (trend > 0) return <TrendingUp className="h-4 w-4 text-green-600" />
      if (trend < 0) return <TrendingDown className="h-4 w-4 text-red-600" />
      return null
    }

    const colorClasses = {
      default: 'text-blue-600 bg-blue-50 border-blue-200',
      success: 'text-green-600 bg-green-50 border-green-200',
      warning: 'text-yellow-600 bg-yellow-50 border-yellow-200',
      error: 'text-red-600 bg-red-50 border-red-200',
    }

    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          <Icon className={`h-4 w-4 ${colorClasses[color].split(' ')[0]}`} />
        </CardHeader>
        <CardContent>
          <div className="flex items-baseline space-x-2">
            <div className="text-2xl font-bold">{formatValue(value)}</div>
            {getTrendIcon()}
            {trend !== undefined && (
              <span className="text-xs text-muted-foreground">
                {formatPercentage(Math.abs(trend))}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  // Generate sample time series data (in real app, this would come from API)
  const generateTimeSeries = (baseValue: number, variance: number, points: number = 24) => {
    const now = new Date()
    return Array.from({ length: points }, (_, i) => {
      const timestamp = new Date(now.getTime() - (points - i) * 60 * 60 * 1000)
      const varianceAmount = (Math.random() - 0.5) * variance * baseValue
      return {
        timestamp: timestamp.toISOString(),
        value: Math.max(0, baseValue + varianceAmount),
      }
    })
  }

  const fraudRateData = generateTimeSeries(metrics.fraud_rate, 0.2)
  const quantumAdvantageData = generateTimeSeries(
    metrics.quantum_vs_classical.quantum_accuracy - metrics.quantum_vs_classical.classical_accuracy,
    0.3,
    12
  )
  const volumeData = generateTimeSeries(metrics.total_transactions / 24, 0.4)
  const responseTimeData = generateTimeSeries(
    metrics.quantum_vs_classical.quantum_avg_time,
    0.2,
    12
  )

  return (
    <div className="space-y-6">
      {/* Key Metrics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Transactions"
          value={metrics.total_transactions}
          format="number"
          icon={Activity}
          trend={8.5} // Sample trend
          color="default"
        />

        <MetricCard
          title="Fraud Rate"
          value={metrics.fraud_rate}
          format="percentage"
          icon={Shield}
          trend={-2.3} // Sample trend (negative is good for fraud rate)
          color={metrics.fraud_rate > 5 ? 'error' : metrics.fraud_rate > 2 ? 'warning' : 'success'}
        />

        <MetricCard
          title="Avg Confidence"
          value={metrics.avg_confidence_score}
          format="percentage"
          icon={CheckCircle}
          trend={1.2}
          color="success"
        />

        <MetricCard
          title="Quantum Advantage"
          value={
            metrics.quantum_vs_classical.quantum_accuracy -
            metrics.quantum_vs_classical.classical_accuracy
          }
          format="percentage"
          icon={Zap}
          trend={5.8}
          color="default"
        />
      </div>

      {/* Risk Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Risk Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex items-center justify-between p-4 rounded-lg border">
              <div className="flex items-center space-x-3">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="font-medium">Low Risk</span>
              </div>
              <span className="text-2xl font-bold text-green-600">
                {formatNumber(metrics.risk_distribution.low)}
              </span>
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg border">
              <div className="flex items-center space-x-3">
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <span className="font-medium">Medium Risk</span>
              </div>
              <span className="text-2xl font-bold text-yellow-600">
                {formatNumber(metrics.risk_distribution.medium)}
              </span>
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg border">
              <div className="flex items-center space-x-3">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span className="font-medium">High Risk</span>
              </div>
              <span className="text-2xl font-bold text-red-600">
                {formatNumber(metrics.risk_distribution.high)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Processing Method Comparison */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Quantum vs Classical Processing</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <h4 className="font-semibold text-quantum-600">Quantum Processing</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Transactions Processed</span>
                  <span className="font-medium">
                    {formatNumber(metrics.quantum_vs_classical.quantum_processed)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Accuracy</span>
                  <span className="font-medium text-green-600">
                    {formatPercentage(metrics.quantum_vs_classical.quantum_accuracy)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Avg Response Time</span>
                  <span className="font-medium">
                    {formatDuration(metrics.quantum_vs_classical.quantum_avg_time)}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-semibold text-gray-600">Classical Processing</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Transactions Processed</span>
                  <span className="font-medium">
                    {formatNumber(metrics.quantum_vs_classical.classical_processed)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Accuracy</span>
                  <span className="font-medium text-blue-600">
                    {formatPercentage(metrics.quantum_vs_classical.classical_accuracy)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Avg Response Time</span>
                  <span className="font-medium">
                    {formatDuration(metrics.quantum_vs_classical.classical_avg_time)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <FraudRateChart data={fraudRateData} />
        <QuantumAdvantageChart data={quantumAdvantageData} />
        <TransactionVolumeChart data={volumeData} />
        <ResponseTimeChart data={responseTimeData} />
      </div>

      {/* Top Fraud Patterns */}
      {metrics.top_fraud_patterns.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Top Fraud Patterns</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {metrics.top_fraud_patterns.map((pattern, index) => (
                <div key={pattern.pattern_id} className="flex items-center justify-between p-4 rounded-lg border">
                  <div className="flex items-center space-x-3">
                    <span className="flex items-center justify-center w-8 h-8 rounded-full bg-quantum-100 text-quantum-600 text-sm font-medium">
                      {index + 1}
                    </span>
                    <div>
                      <h4 className="font-medium">{pattern.name}</h4>
                      <p className="text-sm text-muted-foreground">{pattern.description}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{formatNumber(pattern.frequency)} occurrences</div>
                    <div className="text-sm text-muted-foreground">
                      {formatPercentage(pattern.confidence)} confidence
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}