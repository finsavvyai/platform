export const TOTAL_STEPS = 4;

export default function StepDots({ current }: { current: number }) {
  return (
    <div
      className="flex items-center gap-2 justify-center"
      role="progressbar"
      aria-valuenow={current + 1}
      aria-valuemin={1}
      aria-valuemax={TOTAL_STEPS}
      aria-label={`Onboarding step ${current + 1} of ${TOTAL_STEPS}`}
    >
      {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
        <div
          key={i}
          aria-hidden="true"
          className={`h-2 rounded-full transition-all duration-300 ${
            i === current
              ? 'w-6 bg-emerald-400'
              : i < current
                ? 'w-2 bg-emerald-400/50'
                : 'w-2 bg-zinc-600'
          }`}
        />
      ))}
    </div>
  );
}
