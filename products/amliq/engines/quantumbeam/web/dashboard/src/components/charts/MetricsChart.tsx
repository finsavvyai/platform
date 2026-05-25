import React from 'react'
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { formatNumber, formatPercentage, getChartColors } from '@/lib/utils'
import { useTheme } from '@/store/useDashboardStore'

interface ChartData {
  timestamp: string
  value: number
  label?: string
}

interface MetricsChartProps {
  title: string
  data: ChartData[]
  type?: 'line' | 'area' | 'bar'
  valueFormat?: 'number' | 'percentage' | 'currency'
  color?: string
  height?: number
  showGrid?: boolean
  showLegend?: boolean
  showTooltip?: boolean
  curve?: 'monotone' | 'linear' | 'step'
  strokeWidth?: number
  fillOpacity?: number
}

export function MetricsChart({
  title,
  data,
  type = 'line',
  valueFormat = 'number',
  color,
  height = 300,
  showGrid = true,
  showLegend = false,
  showTooltip = true,
  curve = 'monotone',
  strokeWidth = 2,
  fillOpacity = 0.3,
}: MetricsChartProps) {
  const theme = useTheme()
  const colors = getChartColors(theme === 'dark' ? 'dark' : 'light')
  const chartColor = color || colors.primary

  const formatValue = (value: number) => {
    switch (valueFormat) {
      case 'percentage':
        return formatPercentage(value)
      case 'currency':
        return `$${formatNumber(value)}`
      default:
        return formatNumber(value)
    }
  }

  const formatTooltipValue = (value: number, name: string) => {
    return [formatValue(value), name]
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !showTooltip) return null

    return (
      <div className="rounded-lg border bg-background p-3 shadow-apple">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p
            key={index}
            className="text-sm font-semibold"
            style={{ color: entry.color }}
          >
            {formatValue(entry.value)}
          </p>
        ))}
      </div>
    )
  }

  const renderChart = () => {
    const commonProps = {
      data,
      margin: { top: 5, right: 5, left: 5, bottom: 5 },
    }

    const commonAxisProps = {
      tick: { fontSize: 12 },
      tickLine: { stroke: 'hsl(var(--border))' },
      axisLine: { stroke: 'hsl(var(--border))' },
    }

    switch (type) {
      case 'area':
        return (
          <AreaChart {...commonProps}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />}
            <XAxis
              dataKey="timestamp"
              {...commonAxisProps}
              tickFormatter={(value) => {
                const date = new Date(value)
                return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              }}
            />
            <YAxis {...commonAxisProps} tickFormatter={formatValue} />
            {showTooltip && <Tooltip content={<CustomTooltip />} />}
            {showLegend && <Legend />}
            <Area
              type={curve}
              dataKey="value"
              stroke={chartColor}
              fill={chartColor}
              fillOpacity={fillOpacity}
              strokeWidth={strokeWidth}
            />
          </AreaChart>
        )

      case 'bar':
        return (
          <BarChart {...commonProps}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />}
            <XAxis
              dataKey="timestamp"
              {...commonAxisProps}
              tickFormatter={(value) => {
                const date = new Date(value)
                return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              }}
            />
            <YAxis {...commonAxisProps} tickFormatter={formatValue} />
            {showTooltip && <Tooltip content={<CustomTooltip />} />}
            {showLegend && <Legend />}
            <Bar
              dataKey="value"
              fill={chartColor}
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        )

      default:
        return (
          <LineChart {...commonProps}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />}
            <XAxis
              dataKey="timestamp"
              {...commonAxisProps}
              tickFormatter={(value) => {
                const date = new Date(value)
                return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              }}
            />
            <YAxis {...commonAxisProps} tickFormatter={formatValue} />
            {showTooltip && <Tooltip content={<CustomTooltip />} />}
            {showLegend && <Legend />}
            <Line
              type={curve}
              dataKey="value"
              stroke={chartColor}
              strokeWidth={strokeWidth}
              dot={false}
              activeDot={{
                r: 4,
                style: { fill: chartColor },
              }}
            />
          </LineChart>
        )
    }
  }

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            {renderChart()}
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

// Specialized charts for specific metrics

export function FraudRateChart({ data }: { data: ChartData[] }) {
  return (
    <MetricsChart
      title="Fraud Rate"
      data={data}
      type="area"
      valueFormat="percentage"
      color="#ef4444"
      fillOpacity={0.2}
    />
  )
}

export function QuantumAdvantageChart({ data }: { data: ChartData[] }) {
  return (
    <MetricsChart
      title="Quantum Advantage"
      data={data}
      type="line"
      valueFormat="percentage"
      color="#0ea5e9"
      strokeWidth={3}
    />
  )
}

export function TransactionVolumeChart({ data }: { data: ChartData[] }) {
  return (
    <MetricsChart
      title="Transaction Volume"
      data={data}
      type="bar"
      valueFormat="number"
      color="#10b981"
    />
  )
}

export function ResponseTimeChart({ data }: { data: ChartData[] }) {
  return (
    <MetricsChart
      title="Response Time"
      data={data}
      type="line"
      valueFormat="number"
      color="#f59e0b"
      curve="step"
    />
  )
}