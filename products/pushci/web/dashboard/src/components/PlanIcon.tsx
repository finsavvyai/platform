import type { Plan } from '../hooks/usePlan';

interface Props {
  plan: Plan;
  size?: number;
}

/** SVG icon per plan tier: dash (free), shield (pro), crown (team) */
export default function PlanIcon({ plan, size = 14 }: Props) {
  const s = `${size}`;

  if (plan === 'team') {
    return (
      <svg width={s} height={s} viewBox="0 0 16 16" fill="none" aria-hidden>
        <path
          d="M2 11l2-5 2 3 2-7 2 7 2-3 2 5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M3 12h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }

  if (plan === 'pro') {
    return (
      <svg width={s} height={s} viewBox="0 0 16 16" fill="none" aria-hidden>
        <path
          d="M8 1.5l1.76 3.57 3.94.57-2.85 2.78.67 3.93L8 10.57l-3.52 1.78.67-3.93L2.3 5.64l3.94-.57L8 1.5z"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinejoin="round"
          fill="currentColor"
          fillOpacity="0.2"
        />
      </svg>
    );
  }

  return (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M6 8h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}
