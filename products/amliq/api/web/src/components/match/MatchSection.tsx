import React from 'react';

export const Section: React.FC<{ title: string; children: React.ReactNode }> = ({
  title, children,
}) => (
  <div className="px-6 py-4">
    <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400
      uppercase tracking-wider mb-3">{title}</h3>
    {children}
  </div>
);

export const Field: React.FC<{ label: string; values: string[] }> = ({ label, values }) => (
  <div>
    <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
    {values.map((v, i) => (
      <p key={i} className="text-gray-800 dark:text-gray-200 mt-0.5">{v}</p>
    ))}
  </div>
);
