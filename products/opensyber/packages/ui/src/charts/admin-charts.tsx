/**
 * Victory chart components for admin analytics and Series A data room.
 * Plan distribution, revenue trend, and conversion funnel.
 */

import {
  VictoryChart,
  VictoryLine,
  VictoryBar,
  VictoryPie,
  VictoryArea,
  VictoryAxis,
  VictoryTooltip,
  VictoryGroup,
  VictoryLegend,
} from 'victory';
import { COLORS, PIE_PALETTE, darkTheme, CHART_PADDING, CHART_HEIGHT } from './theme.js';

/* ------------------------------------------------------------------ */
/*  Plan Distribution — pie chart of users per plan                   */
/* ------------------------------------------------------------------ */

export interface PlanDistributionData {
  plan: string;
  count: number;
}

export function PlanDistributionChart({ data }: { data: PlanDistributionData[] }) {
  return (
    <VictoryPie
      data={data}
      x="plan"
      y="count"
      height={CHART_HEIGHT}
      padding={40}
      colorScale={PIE_PALETTE}
      labelComponent={<VictoryTooltip />}
      labels={({ datum }: { datum: PlanDistributionData }) =>
        `${datum.plan}: ${datum.count}`
      }
      style={{ labels: { fill: COLORS.neutral400, fontSize: 10 } }}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Revenue Trend — MRR + ARR dual area chart                        */
/* ------------------------------------------------------------------ */

export interface RevenuePoint {
  date: string;
  mrr: number;
  arr: number;
}

export function RevenueTrendChart({ data }: { data: RevenuePoint[] }) {
  if (!Array.isArray(data) || data.length < 2) return null;
  return (
    <VictoryChart theme={darkTheme} height={CHART_HEIGHT} padding={{ ...CHART_PADDING, left: 60 }}>
      <VictoryLegend
        x={200}
        y={0}
        orientation="horizontal"
        gutter={16}
        style={{ labels: { fill: COLORS.neutral400, fontSize: 9 } }}
        data={[
          { name: 'MRR', symbol: { fill: COLORS.green } },
          { name: 'ARR', symbol: { fill: COLORS.teal } },
        ]}
      />
      <VictoryAxis tickFormat={(t: string) => t.slice(5)} />
      <VictoryAxis dependentAxis tickFormat={(t: number) => `$${t >= 1000 ? `${(t / 1000).toFixed(0)}k` : t}`} />
      <VictoryGroup>
        <VictoryArea
          data={data}
          x="date"
          y="mrr"
          style={{ data: { fill: `${COLORS.green}15`, stroke: COLORS.green, strokeWidth: 2 } }}
        />
        <VictoryLine
          data={data}
          x="date"
          y="arr"
          style={{ data: { stroke: COLORS.teal, strokeWidth: 2, strokeDasharray: '6,3' } }}
        />
      </VictoryGroup>
    </VictoryChart>
  );
}

/* ------------------------------------------------------------------ */
/*  Conversion Funnel — horizontal bar chart                          */
/* ------------------------------------------------------------------ */

export interface ConversionStep {
  stage: string;
  count: number;
}

export function ConversionFunnelChart({ data }: { data: ConversionStep[] }) {
  return (
    <VictoryChart
      theme={darkTheme}
      height={CHART_HEIGHT}
      horizontal
      padding={{ top: 20, bottom: 40, left: 100, right: 30 }}
    >
      <VictoryAxis style={{ tickLabels: { fill: COLORS.neutral400, fontSize: 10 } }} />
      <VictoryAxis dependentAxis />
      <VictoryBar
        data={data}
        x="stage"
        y="count"
        style={{
          data: {
            fill: ({ index }: { index?: number | string }) =>
              PIE_PALETTE[Number(index ?? 0) % PIE_PALETTE.length],
            width: 16,
          },
        }}
        labelComponent={<VictoryTooltip />}
        labels={({ datum }: { datum: ConversionStep }) => `${datum.count}`}
      />
    </VictoryChart>
  );
}

/* ------------------------------------------------------------------ */
/*  Skill Popularity — top skills by install count                    */
/* ------------------------------------------------------------------ */

export interface SkillPopularityData {
  name: string;
  installs: number;
}

export function SkillPopularityChart({ data }: { data: SkillPopularityData[] }) {
  return (
    <VictoryChart
      theme={darkTheme}
      height={CHART_HEIGHT}
      horizontal
      padding={{ top: 20, bottom: 40, left: 120, right: 30 }}
    >
      <VictoryAxis style={{ tickLabels: { fill: COLORS.neutral400, fontSize: 9 } }} />
      <VictoryAxis dependentAxis />
      <VictoryBar
        data={data}
        x="name"
        y="installs"
        style={{ data: { fill: COLORS.cyan, width: 14 } }}
        labelComponent={<VictoryTooltip />}
        labels={({ datum }: { datum: SkillPopularityData }) => `${datum.installs}`}
      />
    </VictoryChart>
  );
}
