import { VictoryChart, VictoryBar, VictoryAxis, VictoryTooltip } from 'victory';
import { darkChartTheme, CHART_COLORS } from './charts/chartTheme';
import { useCostData } from './charts/useCostData';
import ShareButton from './ShareButton';

export default function CostSavings() {
  const { monthlyRuns, avgDurationMin, observedDays, totalRuns, ghMonthlyCost, saved } = useCostData();

  const barData = [
    { x: 'GitHub Actions', y: ghMonthlyCost, label: `$${ghMonthlyCost.toFixed(2)}/mo` },
    { x: 'PushCI', y: 0.01, label: '$0.00/mo (free)' },
  ];

  return (
    <div
      className="bg-surface-card border border-surface-border rounded-2xl p-5"
      role="img"
      aria-label="Bar chart comparing monthly CI costs"
    >
      <h3 className="text-sm font-semibold text-zinc-200 mb-1">
        Projected Monthly Savings
      </h3>
      <p className="text-xs text-zinc-500 mb-2">
        Projected from {totalRuns} runs over {observedDays} day
        {observedDays !== 1 ? 's' : ''} vs GitHub Actions pricing
      </p>

      <div className="text-center mb-3">
        <span className="text-3xl font-bold text-emerald-400">
          ${saved.toFixed(2)}
        </span>
        <span className="text-sm text-zinc-400 ml-2">/month saved</span>
      </div>

      {ghMonthlyCost > 0 && (
        <VictoryChart
          theme={darkChartTheme}
          domainPadding={{ x: 60 }}
          height={160}
          padding={{ top: 10, bottom: 35, left: 55, right: 20 }}
        >
          <VictoryAxis />
          <VictoryAxis dependentAxis tickFormat={(t: number) => `$${t}`} />
          <VictoryBar
            data={barData}
            labelComponent={<VictoryTooltip />}
            cornerRadius={{ top: 4 }}
            style={{
              data: {
                fill: (args: { datum?: { x?: string } }) =>
                  args.datum?.x === 'PushCI'
                    ? CHART_COLORS.emerald
                    : CHART_COLORS.zinc,
                width: 40,
              },
            }}
          />
        </VictoryChart>
      )}

      <div className="mt-2 pt-3 border-t border-surface-border flex items-center justify-between">
        <span className="text-xs text-zinc-500">
          ~{monthlyRuns} runs/mo &times; {Math.max(avgDurationMin + 0.75, 1).toFixed(1)}min billable
          &times; $0.008/min
        </span>
        <ShareButton saved={saved} runs={monthlyRuns} />
      </div>
    </div>
  );
}
