interface FlakyTest {
  name: string;
  rate: number;
  history: boolean[]; // last 5: true=pass false=fail
}

// Placeholder data shown before API data loads.
const placeholderTests: FlakyTest[] = [];

function HistoryDots({ history }: { history: boolean[] }) {
  return (
    <div className="flex gap-1.5">
      {history.map((pass, i) => (
        <span key={i} className={`w-2.5 h-2.5 rounded-full ${
          pass ? 'bg-emerald-500' : 'bg-red-500'}`} />
      ))}
    </div>
  );
}

function RateBar({ rate }: { rate: number }) {
  const color = rate >= 50 ? 'bg-red-500' : rate >= 30 ? 'bg-yellow-500' : 'bg-emerald-500';
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${rate}%` }} />
      </div>
      <span className={`text-xs font-medium ${
        rate >= 50 ? 'text-red-400' : rate >= 30 ? 'text-yellow-400' : 'text-emerald-400'}`}>
        {rate}%
      </span>
    </div>
  );
}

export default function FlakeyTests() {
  const sorted = [...placeholderTests].sort((a, b) => b.rate - a.rate);

  return (
    <div className="bg-surface-card border border-surface-border rounded-2xl p-5">
      <h3 className="text-sm font-semibold text-zinc-200 mb-3">Flaky Tests</h3>
      <table className="w-full">
        <thead>
          <tr className="text-xs text-zinc-500 uppercase tracking-wider">
            <th className="text-left pb-2 font-medium">Test</th>
            <th className="text-left pb-2 font-medium">Flaky Rate</th>
            <th className="text-left pb-2 font-medium">Last 5</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(t => (
            <tr key={t.name} className="border-t border-surface-border">
              <td className="py-2.5 text-sm text-zinc-300 font-mono">{t.name}</td>
              <td className="py-2.5"><RateBar rate={t.rate} /></td>
              <td className="py-2.5"><HistoryDots history={t.history} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
