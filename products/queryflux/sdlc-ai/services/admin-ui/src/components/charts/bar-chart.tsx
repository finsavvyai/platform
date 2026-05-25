'use client'

import {
  ResponsiveContainer,
  BarChart as RechartsBarChart,
  Bar,
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

interface BarChartProps {
  data: Record<string, unknown>[]
  xKey: string
  series: ChartSeries[]
  height?: number
  layout?: 'horizontal' | 'vertical'
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

export function BarChartComponent({
  data,
  xKey,
  series,
  height = 200,
  layout = 'horizontal',
}: BarChartProps) {
  const isVertical = layout === 'vertical'

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsBarChart
        data={data}
        layout={layout}
        margin={{ top: 4, right: 4, bottom: 0, left: -20 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="hsl(var(--border))"
          vertical={!isVertical}
          horizontal={isVertical}
        />

        {isVertical ? (
          <>
            <XAxis
              type="number"
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              type="category"
              dataKey={xKey}
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
              tickLine={false}
              axisLine={false}
            />
          </>
        ) : (
          <>
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
          </>
        )}

        <Tooltip
          content={<CustomTooltip />}
          cursor={{ fill: 'hsl(var(--border))', opacity: 0.3 }}
        />

        {series.map((s) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.name}
            fill={s.color}
            radius={isVertical ? [0, 4, 4, 0] : [4, 4, 0, 0]}
          />
        ))}
      </RechartsBarChart>
    </ResponsiveContainer>
  )
}
