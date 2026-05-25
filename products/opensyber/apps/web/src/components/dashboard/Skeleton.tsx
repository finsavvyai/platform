interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

export function Skeleton({ className = '', ...props }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse motion-reduce:animate-none rounded-lg bg-surface ${className}`}
      role="presentation"
      aria-hidden="true"
      {...props}
    />
  );
}

interface SkeletonCardProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  children: React.ReactNode;
}

export function SkeletonCard({ className = '', children, ...props }: SkeletonCardProps) {
  return (
    <div
      className={`rounded border border-border bg-panel/30 p-6 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
