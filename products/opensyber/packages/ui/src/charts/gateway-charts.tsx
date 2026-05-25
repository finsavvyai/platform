/**
 * Victory chart components for Claw Gateway metrics.
 * Agent usage, cost breakdown, latency, and credit balance.
 */

import {
  VictoryChart,
  VictoryLine,
  VictoryBar,
  VictoryPie,
  VictoryArea,
  VictoryAxis,
  VictoryTooltip,
} from 'victory';
import { COLORS, PIE_PALETTE, darkTheme, CHART_PADDING, CHART_HEIGHT } from './theme.js';

interface AgentUsageData {
  date: string;
  count: number;
}

export function AgentUsageChart({ data }: { data: AgentUsageData[] }) {
  return (
    <VictoryChart theme={darkTheme} height={CHART_HEIGHT} padding={CHART_PADDING}>
      <VictoryAxis tickFormat={(t: string) => t.slice(5)} />
      <VictoryAxis dependentAxis tickFormat={(t: number) => `${t}`} />
      <VictoryBar
        data={data}
        x="date"
        y="count"
        style={{ data: { fill: COLORS.blue, width: 14 } }}
        labelComponent={<VictoryTooltip />}
        labels={({ datum }: { datum: AgentUsageData }) => `${datum.count}`}
      />
    </VictoryChart>
  );
}

interface CostBreakdownData {
  provider: string;
  cost: number;
}

export function CostBreakdownChart({ data }: { data: CostBreakdownData[] }) {
  return (
    <VictoryPie
      data={data}
      x="provider"
      y="cost"
      height={CHART_HEIGHT}
      padding={40}
      colorScale={PIE_PALETTE}
      labelComponent={<VictoryTooltip />}
      labels={({ datum }: { datum: CostBreakdownData }) =>
        `${datum.provider}: $${datum.cost.toFixed(2)}`
      }
      style={{ labels: { fill: COLORS.neutral400, fontSize: 10 } }}
    />
  );
}

interface LatencyData {
  time: string;
  ms: number;
}

export function LatencyChart({ data }: { data: LatencyData[] }) {
  return (
    <VictoryChart theme={darkTheme} height={CHART_HEIGHT} padding={CHART_PADDING}>
      <VictoryAxis tickFormat={(t: string) => t.slice(5)} />
      <VictoryAxis dependentAxis tickFormat={(t: number) => `${t}ms`} />
      <VictoryLine
        data={data}
        x="time"
        y="ms"
        style={{ data: { stroke: COLORS.cyan, strokeWidth: 2 } }}
        labelComponent={<VictoryTooltip />}
        labels={({ datum }: { datum: LatencyData }) => `${datum.ms}ms`}
      />
    </VictoryChart>
  );
}

interface CreditBalanceData {
  date: string;
  balance: number;
}

export function CreditBalanceChart({ data }: { data: CreditBalanceData[] }) {
  return (
    <VictoryChart theme={darkTheme} height={CHART_HEIGHT} padding={{ ...CHART_PADDING, left: 60 }}>
      <VictoryAxis tickFormat={(t: string) => t.slice(5)} />
      <VictoryAxis dependentAxis tickFormat={(t: number) => `$${t}`} />
      <VictoryArea
        data={data}
        x="date"
        y="balance"
        style={{
          data: {
            fill: `${COLORS.green}20`,
            stroke: COLORS.green,
            strokeWidth: 2,
          },
        }}
        labelComponent={<VictoryTooltip />}
        labels={({ datum }: { datum: CreditBalanceData }) =>
          `$${datum.balance.toFixed(2)}`
        }
      />
    </VictoryChart>
  );
}
