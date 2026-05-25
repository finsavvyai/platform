import {
  VictoryChart, VictoryLine, VictoryScatter,
  VictoryAxis, VictoryTooltip, VictoryVoronoiContainer,
} from 'victory';
import { darkChartTheme, CHART_COLORS } from './charts/chartTheme';
import { useBuildTrendData } from './charts/useBuildTrendData';

export default function BuildTimeTrend() {
  const data = useBuildTrendData();

  if (data.length === 0) {
    return (
      <div className="bg-surface-card border border-surface-border rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-zinc-200 mb-3">
          Build Duration Trend
        </h3>
        <p className="text-sm text-zinc-500">
          Duration history will appear after completed runs are recorded.
        </p>
      </div>
    );
  }

  const passed = data.filter((d) => d.passed);
  const failed = data.filter((d) => !d.passed);

  return (
    <div
      className="bg-surface-card border border-surface-border rounded-2xl p-5"
      role="img"
      aria-label="Line chart showing build duration trend over recent runs"
    >
      <h3 className="text-sm font-semibold text-zinc-200 mb-1">
        Build Duration Trend
      </h3>
      <VictoryChart
        theme={darkChartTheme}
        height={220}
        containerComponent={
          <VictoryVoronoiContainer voronoiDimension="x" />
        }
      >
        <VictoryAxis label="Run #" />
        <VictoryAxis dependentAxis tickFormat={(t: number) => `${t}s`} />
        <VictoryLine
          data={passed}
          style={{ data: { stroke: CHART_COLORS.emerald } }}
          interpolation="monotoneX"
        />
        <VictoryScatter
          data={passed}
          size={3}
          style={{ data: { fill: CHART_COLORS.emerald } }}
          labelComponent={<VictoryTooltip />}
        />
        {failed.length > 0 && (
          <VictoryScatter
            data={failed}
            size={4}
            style={{ data: { fill: CHART_COLORS.red } }}
            labelComponent={<VictoryTooltip />}
          />
        )}
      </VictoryChart>
    </div>
  );
}
