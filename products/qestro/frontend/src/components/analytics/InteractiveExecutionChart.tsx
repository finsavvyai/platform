/**
 * Interactive Test Execution Timeline
 * Built with Victory for zoom/brush/tooltip interactions
 *
 * Reference: https://github.com/FormidableLabs/victory
 */

import { useState } from 'react';
import {
  VictoryChart,
  VictoryArea,
  VictoryAxis,
  VictoryStack,
  VictoryTooltip,
  VictoryVoronoiContainer,
  VictoryLegend,
  VictoryTheme,
} from 'victory';

export interface ExecutionDataPoint {
  date: string;
  passed: number;
  failed: number;
  healed: number;
}

interface Props {
  data: ExecutionDataPoint[];
  title?: string;
}

const CHART_HEIGHT = 280;
const COLORS = {
  passed: '#10b981',
  failed: '#ef4444',
  healed: '#8b5cf6',
};

export function InteractiveExecutionChart({ data, title = 'Execution Timeline' }: Props) {
  const [focused, setFocused] = useState<string | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500">
        No execution data yet
      </div>
    );
  }

  const series = [
    { key: 'passed', label: 'Passed', color: COLORS.passed },
    { key: 'healed', label: 'Self-Healed', color: COLORS.healed },
    { key: 'failed', label: 'Failed', color: COLORS.failed },
  ];

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        <div className="flex gap-3 text-xs">
          {series.map((s) => (
            <button
              key={s.key}
              onClick={() => setFocused(focused === s.key ? null : s.key)}
              className={`flex items-center gap-1.5 transition-opacity ${
                focused && focused !== s.key ? 'opacity-40' : ''
              }`}
            >
              <span
                className="inline-block w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: s.color }}
              />
              <span className="text-slate-300">{s.label}</span>
            </button>
          ))}
        </div>
      </div>

      <VictoryChart
        theme={VictoryTheme.material}
        height={CHART_HEIGHT}
        padding={{ top: 20, right: 20, bottom: 40, left: 50 }}
        containerComponent={
          <VictoryVoronoiContainer
            labels={({ datum }) =>
              `${datum.date}\nPassed: ${datum.passed}\nHealed: ${datum.healed}\nFailed: ${datum.failed}`
            }
            labelComponent={
              <VictoryTooltip
                cornerRadius={6}
                flyoutStyle={{ fill: '#1e293b', stroke: '#475569' }}
                style={{ fill: '#e2e8f0', fontSize: 10 }}
              />
            }
          />
        }
      >
        <VictoryAxis
          tickFormat={(t) => String(t).split('T')[0].slice(5)}
          style={{
            axis: { stroke: '#475569' },
            tickLabels: { fill: '#94a3b8', fontSize: 9 },
          }}
        />
        <VictoryAxis
          dependentAxis
          style={{
            axis: { stroke: '#475569' },
            tickLabels: { fill: '#94a3b8', fontSize: 9 },
            grid: { stroke: '#334155', strokeDasharray: '2,4' },
          }}
        />
        <VictoryStack>
          {series.map((s) => (
            <VictoryArea
              key={s.key}
              data={data}
              x="date"
              y={s.key}
              style={{
                data: {
                  fill: s.color,
                  fillOpacity: focused && focused !== s.key ? 0.15 : 0.65,
                  stroke: s.color,
                  strokeWidth: 1.5,
                },
              }}
              animate={{ duration: 400, onLoad: { duration: 600 } }}
            />
          ))}
        </VictoryStack>
      </VictoryChart>
    </div>
  );
}
