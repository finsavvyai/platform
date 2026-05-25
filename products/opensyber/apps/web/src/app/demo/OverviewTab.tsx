import {
  ArrowRight, TrendingUp, Cpu, HardDrive, MemoryStick, Zap,
  ShieldAlert, Timer, Target,
} from 'lucide-react';
import { scoreColor, scoreLabel, strokeColor, SeverityIcon, SeverityBadge } from './demo-helpers';
import type { LiveEvent } from './demo-constants';
import { DETECTION_STATS } from './demo-constants';

interface OverviewTabProps {
  score: number;
  overallAvg: number;
  scanText: string;
  cpu: number;
  mem: number;
  disk: number;
  categories: Array<{ name: string; score: number }>;
  events: LiveEvent[];
  onViewAllEvents: () => void;
}

export function OverviewTab({
  score, overallAvg, scanText, cpu, mem, disk,
  categories, events, onViewAllEvents,
}: OverviewTabProps): React.ReactElement {
  return (
    <>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Security Score */}
        <div className="rounded border border-border bg-panel/30 p-6 group hover:border-wire transition-colors">
          <h2 className="text-sm font-medium text-text-secondary mb-4">Security Score</h2>
          <div className="flex items-center gap-4">
            <div className="relative h-24 w-24">
              <svg viewBox="0 0 100 100" className="h-24 w-24 -rotate-90">
                <circle cx="50" cy="50" r="40" fill="none" stroke="#262626" strokeWidth="8" />
                <circle
                  cx="50" cy="50" r="40" fill="none"
                  stroke={strokeColor(score)} strokeWidth="8"
                  strokeDasharray={`${score * 2.51} 251`}
                  strokeLinecap="round"
                  className="transition-all duration-700 ease-out"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-2xl font-bold tabular-nums">
                {score}
              </span>
            </div>
            <div>
              <p className={`text-sm font-medium ${scoreColor(score)}`}>{scoreLabel(score)}</p>
              <p className="text-xs text-text-dim mt-1 flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                Avg: {overallAvg}/100
              </p>
              <p className="text-xs text-text-dim mt-0.5">Updated {scanText}</p>
            </div>
          </div>
        </div>

        {/* Detection Metrics */}
        <div className="rounded border border-border bg-panel/30 p-6 hover:border-wire transition-colors">
          <h2 className="text-sm font-medium text-text-secondary mb-4">Detection Metrics</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-red-400" />
                <span className="text-xs text-text-secondary">Threats blocked (24h)</span>
              </div>
              <span className="text-sm font-semibold text-red-400 tabular-nums">{DETECTION_STATS.blocked}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-text-dim" />
                <span className="text-xs text-text-secondary">Events analyzed (24h)</span>
              </div>
              <span className="text-sm font-semibold tabular-nums">{DETECTION_STATS.eventsToday.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Timer className="h-4 w-4 text-text-dim" />
                <span className="text-xs text-text-secondary">Detection latency</span>
              </div>
              <span className="text-xs text-text-dim tabular-nums">p50: {DETECTION_STATS.latencyP50}ms · p95: {DETECTION_STATS.latencyP95}ms · p99: {DETECTION_STATS.latencyP99}ms</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-400" />
                <span className="text-xs text-text-secondary">False positive rate</span>
              </div>
              <span className="text-sm font-semibold text-green-400 tabular-nums">{DETECTION_STATS.fpRate}/agent/day</span>
            </div>
          </div>
        </div>

        {/* Health Metrics */}
        <div className="rounded border border-border bg-panel/30 p-6 hover:border-wire transition-colors">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-text-secondary">Health Metrics</h2>
            <Zap className="h-4 w-4 text-yellow-500" />
          </div>
          <div className="space-y-3">
            {[
              { label: 'CPU', value: cpu, icon: Cpu, color: 'bg-info' },
              { label: 'Memory', value: mem, icon: MemoryStick, color: 'bg-purple-500' },
              { label: 'Disk', value: disk, icon: HardDrive, color: 'bg-emerald-500' },
            ].map((metric) => {
              const Icon = metric.icon;
              const warn = metric.value > 80;
              return (
                <div key={metric.label} className="flex items-center gap-3">
                  <Icon className={`h-4 w-4 ${warn ? 'text-red-400' : 'text-text-dim'}`} />
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-text-secondary">{metric.label}</span>
                      <span className={`font-medium tabular-nums ${warn ? 'text-red-400' : 'text-text-primary'}`}>
                        {metric.value}%
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-surface overflow-hidden">
                      <div
                        className={`h-1.5 rounded-full ${warn ? 'bg-red-500' : metric.color} transition-all duration-700 ease-out`}
                        style={{ width: `${metric.value}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Score Categories */}
      <div className="mt-6 rounded border border-border bg-panel/30 p-6 hover:border-wire transition-colors">
        <h2 className="text-sm font-medium text-text-secondary mb-4">Score Breakdown</h2>
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
          {categories.map((cat) => (
            <div
              key={cat.name}
              className="flex items-center justify-between rounded-lg bg-surface/50 px-4 py-3 hover:bg-surface/80 transition-colors cursor-default group"
            >
              <span className="text-sm text-text-primary">{cat.name}</span>
              <span className={`text-sm font-semibold tabular-nums transition-colors duration-500 ${scoreColor(cat.score)}`}>
                {cat.score}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Events (compact, last 5) */}
      <div className="mt-6 rounded border border-border bg-panel/30 p-6 hover:border-wire transition-colors">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-text-secondary">Recent Security Events</h2>
          <button
            onClick={onViewAllEvents}
            className="text-xs text-signal hover:text-signal-hover flex items-center gap-1"
          >
            View all <ArrowRight className="h-3 w-3" />
          </button>
        </div>
        <div className="space-y-2">
          {events.slice(0, 5).map((event, idx) => (
            <div
              key={event.id}
              className={`flex items-center gap-3 rounded-lg px-4 py-2.5 transition-all duration-500 ${
                event.isNew
                  ? 'bg-signal/10 border border-info/20'
                  : 'bg-surface/30'
              }`}
              style={{ animationDelay: `${idx * 120}ms` }}
              title={event.detail}
            >
              <SeverityIcon severity={event.severity} />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-text-primary truncate">{event.message}</p>
                {event.detail && (
                  <p className="text-[10px] text-text-dim font-mono truncate mt-0.5">{event.detail}</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <SeverityBadge severity={event.severity} />
                <span className="text-xs text-text-dim tabular-nums w-16 text-right">{event.time}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
