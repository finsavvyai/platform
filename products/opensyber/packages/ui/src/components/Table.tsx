import type { ReactNode } from 'react';

export function Table({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className={`w-full text-sm ${className ?? ''}`}>{children}</table>
    </div>
  );
}

export function TableHead({ children }: { children: ReactNode }) {
  return (
    <thead>
      <tr className="border-b border-neutral-800 text-left text-xs text-neutral-500 uppercase tracking-wider">
        {children}
      </tr>
    </thead>
  );
}

export function TableRow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <tr
      className={`border-b border-neutral-800/50 hover:bg-neutral-800/20 ${className ?? ''}`}
    >
      {children}
    </tr>
  );
}

export function TableCell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <td className={`px-4 py-3 ${className ?? ''}`}>{children}</td>;
}
