import React from 'react';
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from 'recharts';
import { Card } from '../ui/Card';

interface DonutData {
  name: string;
  value: number;
  color: string;
}

interface ChartProps {
  title: string;
  data: DonutData[];
}

export function DonutChart({ title, data }: ChartProps) {
  return (
    <Card>
      <h3 className="sf-headline mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={55} outerRadius={80}
            paddingAngle={2} dataKey="value" strokeWidth={0}>
            {data.map((entry) => (
              <Cell key={`cell-${entry.name}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip contentStyle={{
            background: 'var(--dash-surface)', border: '1px solid var(--dash-border)',
            borderRadius: '8px', boxShadow: 'var(--shadow-md)', fontSize: '13px',
          }} />
          <Legend wrapperStyle={{ paddingTop: '12px' }} iconType="circle" iconSize={8}
            formatter={(value) => (
              <span style={{ color: 'var(--dash-text-secondary)', fontSize: '12px' }}>{value}</span>
            )} />
        </PieChart>
      </ResponsiveContainer>
    </Card>
  );
}
