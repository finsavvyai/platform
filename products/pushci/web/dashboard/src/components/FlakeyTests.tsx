import {
  VictoryChart, VictoryBar, VictoryAxis, VictoryTooltip,
} from 'victory';
import { darkChartTheme, CHART_COLORS } from './charts/chartTheme';
import { useFlakeyTestData } from './charts/useFlakeyTestData';

export default function FlakeyTests() {
  const data = useFlakeyTestData();

  if (data.length === 0) {
    return (
      <div className="bg-surface-card border border-surface-border rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-zinc-200 mb-3">
          Flaky Tests
        </h3>
        <p className="text-sm text-zinc-500">
          Failure rate tracking will appear once multiple runs exist per
          branch.
        </p>
      </div>
    );
  }

  return (
    <div
      className="bg-surface-card border border-surface-border rounded-2xl p-5"
      role="img"
      aria-label="Bar chart showing failure rate by branch"
    >
      <h3 className="text-sm font-semibold text-zinc-200 mb-1">
        Failure Rate by Branch
      </h3>
      <VictoryChart
        theme={darkChartTheme}
        domainPadding={{ x: 20 }}
        height={240}
      >
        <VictoryAxis
          style={{
            tickLabels: { angle: -30, textAnchor: 'end', fontSize: 9 },
          }}
        />
        <VictoryAxis
          dependentAxis
          tickFormat={(t: number) => `${t}%`}
          domain={[0, 100]}
        />
        <VictoryBar
          data={data}
          labelComponent={<VictoryTooltip />}
          style={{
            data: {
              fill: (args: { datum?: { y?: number } }) =>
                (args.datum?.y ?? 0) > 50 ? CHART_COLORS.red
                : (args.datum?.y ?? 0) > 25 ? CHART_COLORS.amber
                : CHART_COLORS.emerald,
            },
          }}
          cornerRadius={{ top: 3 }}
        />
      </VictoryChart>
    </div>
  );
}
