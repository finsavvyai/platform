import { usePlan } from '../hooks/usePlan';

const PRO_PERKS = [
  '100 AI diagnoses/mo',
  '500 cloud minutes',
  '22 deploy targets',
  'Priority support',
  'Slack & Discord alerts',
];

const TEAM_EXTRAS = [
  '500 AI diagnoses/mo',
  '2000 cloud minutes',
  'Up to 25 members',
  'SSO / SAML',
  'Audit logs',
  'Governance workflows',
  'SLA guarantee',
];

export default function PlanPerks() {
  const { plan, loading } = usePlan();

  if (loading || plan === 'free') return null;

  const perks = plan === 'team' ? TEAM_EXTRAS : PRO_PERKS;

  return (
    <div className="px-4 py-3">
      <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2 font-semibold">
        Your plan includes
      </p>
      <ul className="space-y-1">
        {perks.map((perk) => (
          <li key={perk} className="flex items-center gap-1.5 text-[11px] text-zinc-400">
            <span className="text-emerald-400 text-[10px]">&#10003;</span>
            {perk}
          </li>
        ))}
      </ul>
    </div>
  );
}
