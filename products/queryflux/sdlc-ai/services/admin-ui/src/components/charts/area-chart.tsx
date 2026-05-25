'use client'

import {
  ResponsiveContainer,
  AreaChart as RechartsAreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  type TooltipProps,
} from 'recharts'
import {
  type NameType,
  type ValueType,
} from 'recharts/types/component/DefaultTooltipContent'

interface ChartSeries {
  key: string
  color: string
  name: string
}

interface AreaChartProps {
  data: Record<string, unknown>[]
  xKey: string
  series: ChartSeries[]
  height?: number
  showGrid?: boolean
  showTooltip?: boolean
}

function CustomTooltip({
  active,
  payload,
  label,
}: TooltipProps<ValueType, NameType>) {
  if (!active || !payload?.length) {
    return null
  }

  return (
    <div className="bg-popover text-popover-foreground border shadow-md rounded-lg p-2">
      <p className="text-xs font-medium mb-1">{label}</p>
      {payload.map((entry) => (
        <div
          key={String(entry.name)}
          className="flex items-center gap-2 text-xs"
        >
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-medium">{entry.value}</span>
        </div>
      ))}
    </div>
  )
}

export function AreaChartComponent({
  data,
  xKey,
  series,
  height = 200,
  showGrid = true,
  showTooltip = true,
}: AreaChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsAreaChart
        data={data}
        margin={{ top: 4, right: 4, bottom: 0, left: -20 }}
      >
        <defs>
          {series.map((s) => (
            <linearGradient
              key={`gradient-${s.key}`}
              id={`gradient-${s.key}`}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop offset="0%" stopColor={s.color} stopOpacity={0.2} />
              <stop offset="100%" stopColor={s.color} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>

        {showGrid && (
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="hsl(var(--border))"
            vertical={false}
          />
        )}

        <XAxis
          dataKey={xKey}
          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
          tickLine={false}
          axisLine={false}
        />

        <YAxis
          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
          tickLine={false}
          axisLine={false}
        />

        {showTooltip && (
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ stroke: 'hsl(var(--border))' }}
          />
        )}

        {series.map((s) => (
          <Area
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.name}
            stroke={s.color}
            strokeWidth={2}
            fill={`url(#gradient-${s.key})`}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
        ))}
      </RechartsAreaChart>
    </ResponsiveContainer>
  )
}
