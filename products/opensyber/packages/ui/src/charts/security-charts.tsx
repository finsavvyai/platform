/**
 * Victory chart components for security dashboards.
 * Threat trends, severity distribution, score history, and alert volume.
 */

import {
  VictoryChart,
  VictoryLine,
  VictoryArea,
  VictoryPie,
  VictoryBar,
  VictoryAxis,
  VictoryTooltip,
  VictoryGroup,
  VictoryLegend,
} from 'victory';
import { COLORS, SEVERITY_COLORS, darkTheme, CHART_PADDING, CHART_HEIGHT } from './theme.js';

/* ------------------------------------------------------------------ */
/*  Threat Trend — multi-line risk score over time                    */
/* ------------------------------------------------------------------ */

export interface ThreatTrendPoint {
  date: string;
  agentScore: number;
  cspmScore: number;
  combinedScore: number;
}

export function ThreatTrendChart({ data }: { data: ThreatTrendPoint[] }) {
  if (!Array.isArray(data) || data.length < 2) return null;
  return (
    <VictoryChart theme={darkTheme} height={CHART_HEIGHT} padding={CHART_PADDING}>
      <VictoryLegend
        x={200}
        y={0}
        orientation="horizontal"
        gutter={16}
        style={{ labels: { fill: COLORS.neutral400, fontSize: 9 } }}
        data={[
          { name: 'Combined', symbol: { fill: COLORS.blue } },
          { name: 'Agent', symbol: { fill: COLORS.green } },
          { name: 'CSPM', symbol: { fill: COLORS.amber } },
        ]}
      />
      <VictoryAxis tickFormat={(t: string) => t.slice(5)} />
      <VictoryAxis dependentAxis domain={[0, 100]} tickFormat={(t: number) => `${t}`} />
      <VictoryGroup>
        <VictoryLine
          data={data}
          x="date"
          y="combinedScore"
          style={{ data: { stroke: COLORS.blue, strokeWidth: 2.5 } }}
        />
        <VictoryLine
          data={data}
          x="date"
          y="agentScore"
          style={{ data: { stroke: COLORS.green, strokeWidth: 1.5 } }}
        />
        <VictoryLine
          data={data}
          x="date"
          y="cspmScore"
          style={{ data: { stroke: COLORS.amber, strokeWidth: 1.5 } }}
        />
      </VictoryGroup>
    </VictoryChart>
  );
}

/* ------------------------------------------------------------------ */
/*  Severity Donut — finding severity distribution                    */
/* ------------------------------------------------------------------ */

export interface SeverityData {
  severity: string;
  count: number;
}

export function SeverityDonutChart({ data }: { data: SeverityData[] }) {
  if (!Array.isArray(data) || data.length === 0) return null;
  const colorScale = data.map((d) => SEVERITY_COLORS[d.severity] ?? '#6B7280');
  return (
    <VictoryPie
      data={data}
      x="severity"
      y="count"
      height={CHART_HEIGHT}
      padding={40}
      innerRadius={55}
      colorScale={colorScale}
      labelComponent={<VictoryTooltip />}
      labels={({ datum }: { datum: SeverityData }) =>
        `${datum.severity}: ${datum.count}`
      }
      style={{ labels: { fill: COLORS.neutral400, fontSize: 10 } }}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Security Score — area chart with color-coded threshold            */
/* ------------------------------------------------------------------ */

export interface ScoreHistoryPoint {
  date: string;
  score: number;
}

function scoreColor(score: number): string {
  if (score >= 80) return COLORS.green;
  if (score >= 50) return COLORS.amber;
  return COLORS.rose;
}

export function SecurityScoreChart({ data }: { data: ScoreHistoryPoint[] }) {
  if (!Array.isArray(data) || data.length < 2) return null;
  const latest = data[data.length - 1]!.score;
  const color = scoreColor(latest);
  return (
    <VictoryChart theme={darkTheme} height={CHART_HEIGHT} padding={CHART_PADDING}>
      <VictoryAxis tickFormat={(t: string) => t.slice(5)} />
      <VictoryAxis dependentAxis domain={[0, 100]} />
      <VictoryArea
        data={data}
        x="date"
        y="score"
        style={{
          data: { fill: `${color}20`, stroke: color, strokeWidth: 2 },
        }}
        labelComponent={<VictoryTooltip />}
        labels={({ datum }: { datum: ScoreHistoryPoint }) => `${datum.score}`}
      />
    </VictoryChart>
  );
}

/* ------------------------------------------------------------------ */
/*  Alert Volume — bar chart of alerts per day                        */
/* ------------------------------------------------------------------ */

export interface AlertVolumePoint {
  date: string;
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export function AlertVolumeChart({ data }: { data: AlertVolumePoint[] }) {
  if (!Array.isArray(data) || data.length === 0) return null;
  return (
    <VictoryChart theme={darkTheme} height={CHART_HEIGHT} padding={CHART_PADDING}>
      <VictoryAxis tickFormat={(t: string) => t.slice(5)} />
      <VictoryAxis dependentAxis />
      <VictoryGroup offset={8}>
        <VictoryBar data={data} x="date" y="critical" style={{ data: { fill: SEVERITY_COLORS.critical, width: 6 } }} />
        <VictoryBar data={data} x="date" y="high" style={{ data: { fill: SEVERITY_COLORS.high, width: 6 } }} />
        <VictoryBar data={data} x="date" y="medium" style={{ data: { fill: SEVERITY_COLORS.medium, width: 6 } }} />
        <VictoryBar data={data} x="date" y="low" style={{ data: { fill: SEVERITY_COLORS.low, width: 6 } }} />
      </VictoryGroup>
    </VictoryChart>
  );
}
