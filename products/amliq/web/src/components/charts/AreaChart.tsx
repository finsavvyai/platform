import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card } from '../ui/Card';
import type { ChartDataPoint } from '../../types';

interface ChartProps {
  title: string;
  data: ChartDataPoint[];
}

export function AreaChartComponent({ title, data }: ChartProps) {
  return (
    <Card>
      <h3 className="sf-headline mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2563EB" stopOpacity={0.12} />
              <stop offset="100%" stopColor="#2563EB" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--separator)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="date" stroke="transparent"
            tick={{ fill: 'var(--dash-text-tertiary)', fontSize: 11 }} tickLine={false} />
          <YAxis stroke="transparent"
            tick={{ fill: 'var(--dash-text-tertiary)', fontSize: 11 }} tickLine={false} />
          <Tooltip contentStyle={{
            background: 'var(--dash-surface)', border: '1px solid var(--dash-border)',
            borderRadius: '8px', boxShadow: 'var(--shadow-md)', fontSize: '13px',
          }}
            labelStyle={{ color: 'var(--dash-text)', fontWeight: 600 }}
            itemStyle={{ color: '#2563EB' }} />
          <Area type="monotone" dataKey="value" stroke="#2563EB" fillOpacity={1}
            fill="url(#areaGrad)" strokeWidth={2} dot={false}
            activeDot={{ r: 4, fill: '#2563EB', stroke: '#fff', strokeWidth: 2 }} />
        </AreaChart>
      </ResponsiveContainer>
    </Card>
  );
}
