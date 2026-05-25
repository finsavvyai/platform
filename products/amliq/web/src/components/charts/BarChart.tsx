import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card } from '../ui/Card';

interface BarData {
  level: string;
  count: number;
  percentage: number;
}

interface ChartProps {
  title: string;
  data: BarData[];
}

export function BarChartComponent({ title, data }: ChartProps) {
  return (
    <Card>
      <h3 className="sf-headline mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} layout="vertical">
          <CartesianGrid stroke="var(--separator)" strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" stroke="transparent"
            tick={{ fill: 'var(--dash-text-tertiary)', fontSize: 11 }} tickLine={false} />
          <YAxis dataKey="level" type="category" stroke="transparent"
            tick={{ fill: 'var(--dash-text-secondary)', fontSize: 12 }}
            tickLine={false} width={80} />
          <Tooltip contentStyle={{
            background: 'var(--dash-surface)', border: '1px solid var(--dash-border)',
            borderRadius: '8px', boxShadow: 'var(--shadow-md)', fontSize: '13px',
          }}
            labelStyle={{ color: 'var(--dash-text)', fontWeight: 600 }}
            cursor={{ fill: 'var(--separator-subtle)' }} />
          <Bar dataKey="count" fill="#2563EB" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}
