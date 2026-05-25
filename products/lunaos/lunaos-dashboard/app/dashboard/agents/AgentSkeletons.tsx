'use client';

export function AgentCardSkeleton() {
    return (
        <div className="neon-card agent-card h-full animate-pulse">
            <div className="agent-card-header">
                <div className="h-4 w-16 bg-neutral-800 rounded" />
                <div className="h-4 w-12 bg-neutral-800 rounded" />
            </div>
            <div className="h-5 w-3/4 bg-neutral-800 rounded mt-3" />
            <div className="h-4 w-full bg-neutral-800/60 rounded mt-2" />
            <div className="h-4 w-2/3 bg-neutral-800/60 rounded mt-1" />
            <div className="h-8 w-full bg-neutral-800 rounded-lg mt-4" />
        </div>
    );
}

export function AgentSkeletonGrid() {
    return (
        <div className="mb-8">
            <div className="flex items-center gap-2 mb-3 px-1">
                <div className="h-5 w-5 bg-neutral-800 rounded animate-pulse" />
                <div className="h-5 w-24 bg-neutral-800 rounded animate-pulse" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {Array.from({ length: 8 }).map((_, i) => (
                    <AgentCardSkeleton key={i} />
                ))}
            </div>
        </div>
    );
}
