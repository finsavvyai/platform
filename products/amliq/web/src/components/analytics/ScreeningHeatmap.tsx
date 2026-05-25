import React, { useState } from 'react';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const GOLD = '#C9A96E';

interface Cell {
  day: number;
  hour: number;
  count: number;
}

function generateMockData(): Cell[] {
  return Array.from({ length: 7 * 24 }, (_, idx) => {
    const day = Math.floor(idx / 24);
    const hour = idx % 24;
    const isWeekday = day < 5;
    const isBusinessHour = hour >= 9 && hour <= 17;
    let base = 0;
    if (isWeekday && isBusinessHour) {
      base = Math.floor(Math.random() * 60) + 40;
    } else if (isWeekday) {
      base = Math.floor(Math.random() * 15);
    } else {
      base = Math.floor(Math.random() * 8);
    }
    return { day, hour, count: base };
  });
}

const MOCK_DATA = generateMockData();
const MAX_COUNT = Math.max(...MOCK_DATA.map((c) => c.count), 1);

export function ScreeningHeatmap() {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; cell: Cell } | null>(null);

  function getColor(count: number): string {
    if (count === 0) return 'transparent';
    const opacity = 0.15 + (count / MAX_COUNT) * 0.85;
    return `${GOLD}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`;
  }

  function handleMouseEnter(e: React.MouseEvent<SVGRectElement>, cell: Cell) {
    const rect = (e.currentTarget as SVGRectElement).getBoundingClientRect();
    setTooltip({ x: rect.left + rect.width / 2, y: rect.top - 8, cell });
  }

  function handleMouseLeave() {
    setTooltip(null);
  }

  const CELL = 20;
  const GAP = 2;
  const LEFT_MARGIN = 36;
  const TOP_MARGIN = 24;
  const svgW = LEFT_MARGIN + 24 * (CELL + GAP);
  const svgH = TOP_MARGIN + 7 * (CELL + GAP) + 20;

  return (
    <div className="glass-panel rounded-apple-lg p-md relative">
      <h3
        className="text-sm font-semibold mb-4"
        style={{ color: 'var(--dash-text)' }}
      >
        Screening Activity — Last 7 Days
      </h3>

      <div className="overflow-x-auto">
        <svg
          width={svgW}
          height={svgH}
          aria-label="Screening activity heatmap"
          role="img"
        >
          {/* Hour labels */}
          {HOURS.filter((h) => h % 3 === 0).map((h) => (
            <text
              key={h}
              x={LEFT_MARGIN + h * (CELL + GAP) + CELL / 2}
              y={TOP_MARGIN - 6}
              textAnchor="middle"
              fontSize="9"
              fill="var(--dash-text-tertiary)"
              fontFamily="system-ui, -apple-system, sans-serif"
            >
              {h}
            </text>
          ))}

          {/* Day labels */}
          {DAYS.map((day, di) => (
            <text
              key={day}
              x={LEFT_MARGIN - 4}
              y={TOP_MARGIN + di * (CELL + GAP) + CELL / 2 + 1}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize="9"
              fill="var(--dash-text-tertiary)"
              fontFamily="system-ui, -apple-system, sans-serif"
            >
              {day}
            </text>
          ))}

          {/* Cells */}
          {MOCK_DATA.map((cell) => (
            <rect
              key={`${cell.day}-${cell.hour}`}
              x={LEFT_MARGIN + cell.hour * (CELL + GAP)}
              y={TOP_MARGIN + cell.day * (CELL + GAP)}
              width={CELL}
              height={CELL}
              rx={3}
              fill={getColor(cell.count)}
              stroke="rgba(255,255,255,0.06)"
              strokeWidth={1}
              style={{ cursor: 'pointer' }}
              onMouseEnter={(e) => handleMouseEnter(e, cell)}
              onMouseLeave={handleMouseLeave}
            />
          ))}
        </svg>
      </div>

      {tooltip && (
        <div
          className="fixed z-50 px-2 py-1 rounded text-xs pointer-events-none"
          style={{
            left: tooltip.x,
            top: tooltip.y,
            transform: 'translate(-50%, -100%)',
            background: 'var(--dash-bg, #1a1a2e)',
            color: 'var(--dash-text)',
            border: '1px solid rgba(201,169,110,0.3)',
            whiteSpace: 'nowrap',
          }}
        >
          {tooltip.cell.count} screenings on {DAYS[tooltip.cell.day]} at {tooltip.cell.hour}:00
        </div>
      )}
    </div>
  );
}
