import type { Project, ProjectAccess, ProjectMembership } from '../../hooks/useApi';
import { SkeletonCard } from '../Skeleton';
import PolicyCard from './PolicyCard';
import RoleBadge from './RoleBadge';
import { cardClassName, formatDate, formatEnvironmentScope, webhookUrl } from './utils';

interface Props {
  selectedProject: Project | null;
  pageLoading: boolean;
  detailsLoading: boolean;
  detailsError: string | null;
  access: ProjectAccess | null;
  memberships: ProjectMembership[] | null;
}

export default function ProjectAccessPanel({
  selectedProject,
  pageLoading,
  detailsLoading,
  detailsError,
  access,
  memberships,
}: Props) {
  return (
    <section className={cardClassName()}>
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-zinc-100">Access & Governance</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Current role, webhook credentials, and deployment policy for the selected project.
        </p>
      </div>

      {!selectedProject && !pageLoading && (
        <p className="py-8 text-sm text-zinc-500">
          Select a project to inspect its access model and webhook details.
        </p>
      )}

      {detailsLoading && <SkeletonCard height="h-40" />}

      {detailsError && (
        <div role="alert" className="rounded-lg border border-red-800 bg-red-900/20 px-4 py-3 text-sm text-red-300">
          {detailsError}
        </div>
      )}

      {access && !detailsLoading && (
        <div className="space-y-5">
          <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-4">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <div className="text-sm font-semibold text-zinc-100">{access.project.repo}</div>
                <div className="mt-1 text-xs text-zinc-500">
                  Created {formatDate(access.project.created_at)}
                </div>
              </div>
              <RoleBadge role={access.membership.role} />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-1.5">
                  Webhook URL
                </div>
                <div className="break-all rounded-xl border border-zinc-800 bg-black/40 px-3 py-2.5 font-mono text-xs text-zinc-300 leading-relaxed select-all">
                  {webhookUrl(access.project)}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-1.5">
                  Webhook Secret
                </div>
                <div className="break-all rounded-xl border border-zinc-800 bg-black/40 px-3 py-2.5 font-mono text-xs text-zinc-300 leading-relaxed select-all">
                  {access.project.webhook_secret}
                </div>
              </div>
            </div>
            <div className="mt-3 text-xs text-zinc-500">
              Your scope: {formatEnvironmentScope(access.membership.environments)}
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-500">
              Deployment Policies
            </h3>
            <div className="grid gap-3">
              {access.policies.map((policy) => (
                <PolicyCard key={policy.environment} policy={policy} />
              ))}
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-500">
              Memberships
            </h3>
            {memberships ? (
              <div className="grid gap-3">
                {memberships.map((membership) => (
                  <div key={membership.user_sub} className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-3.5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium text-zinc-100">{membership.login}</div>
                        <div className="mt-1 text-xs text-zinc-500">
                          {membership.provider} · {formatEnvironmentScope(membership.environments)}
                        </div>
                      </div>
                      <RoleBadge role={membership.role} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-zinc-500">
                Full membership listing is only visible to maintainers and admins.
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
