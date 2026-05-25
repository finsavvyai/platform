/** Per-control evaluation logic extracted from scanner.ts to keep both files
 *  under the 200-line portfolio cap. Purely a pure function over Graph payloads. */

import type { CisControl } from './control-definitions';
import type { ControlResult, GraphData } from './scanner-types';

export function evaluateControl(
	control: CisControl,
	data: GraphData,
): { status: ControlResult['status']; currentValue: string } {
	const ca = data.conditionalAccessPolicies;
	const enabledCA = ca.filter((p: any) => p.state === 'enabled');

	switch (control.graphCheck) {
		case 'mfa_all_users': {
			const mfaCA = enabledCA.find((p: any) => JSON.stringify(p.grantControls?.builtInControls || []).includes('mfa'));
			return mfaCA ? { status: 'pass', currentValue: `CA policy "${mfaCA.displayName}" requires MFA` } : { status: 'fail', currentValue: 'No CA policy requiring MFA for all users' };
		}
		case 'mfa_admins': {
			const registered = data.mfaRegistrationDetails.filter((u: any) => u.isMfaRegistered);
			const pct = data.mfaRegistrationDetails.length > 0 ? Math.round((registered.length / data.mfaRegistrationDetails.length) * 100) : 0;
			return pct >= 90 ? { status: 'pass', currentValue: `${pct}% MFA registered` } : pct >= 50 ? { status: 'partial', currentValue: `${pct}% MFA registered` } : { status: 'fail', currentValue: `${pct}% MFA registered` };
		}
		case 'block_legacy_auth': {
			const blockCA = enabledCA.find((p: any) => JSON.stringify(p.conditions?.clientAppTypes || []).includes('exchangeActiveSync'));
			return blockCA ? { status: 'pass', currentValue: 'Legacy auth blocked via CA' } : { status: 'fail', currentValue: 'Legacy authentication not blocked' };
		}
		case 'security_defaults_or_ca': {
			if (data.securityDefaults?.isEnabled) return { status: 'pass', currentValue: 'Security defaults enabled' };
			return enabledCA.length > 0 ? { status: 'pass', currentValue: `${enabledCA.length} CA policies active` } : { status: 'fail', currentValue: 'No security defaults or CA policies' };
		}
		case 'global_admin_count': {
			const count = data.globalAdminCount;
			return count >= 2 && count <= 4 ? { status: 'pass', currentValue: `${count} Global Admins` } : count === 1 ? { status: 'partial', currentValue: `${count} Global Admin (need 2 for break-glass)` } : { status: 'fail', currentValue: `${count} Global Admins (max 4 recommended)` };
		}
		case 'user_consent_disabled': {
			const policy = data.authorizationPolicy?.defaultUserRolePermissions;
			const blocked = policy?.permissionGrantPoliciesAssigned?.length === 0;
			return blocked ? { status: 'pass', currentValue: 'User consent disabled' } : { status: 'fail', currentValue: 'Users can consent to apps' };
		}
		case 'guest_invite_restricted': {
			const allow = data.authorizationPolicy?.allowInvitesFrom;
			return allow === 'adminsAndGuestInviters' || allow === 'none' ? { status: 'pass', currentValue: `Guest invites: ${allow}` } : { status: 'fail', currentValue: `Guest invites: ${allow || 'everyone'}` };
		}
		case 'sensitivity_labels': {
			const count = data.sensitivityLabels.length;
			return count >= 3 ? { status: 'pass', currentValue: `${count} labels published` } : count > 0 ? { status: 'partial', currentValue: `${count} label(s) — need at least 3` } : { status: 'fail', currentValue: 'No sensitivity labels' };
		}
		case 'mfa_guests': {
			const guestCa = enabledCA.find((p: any) => {
				const includesGuests = JSON.stringify(p.conditions?.users?.includeGuestsOrExternalUsers ?? p.conditions?.users?.includeUsers ?? []).toLowerCase();
				const requiresMfa = JSON.stringify(p.grantControls?.builtInControls ?? []).toLowerCase().includes('mfa');
				return includesGuests.includes('guest') || (includesGuests.includes('all') && requiresMfa);
			});
			return guestCa ? { status: 'pass', currentValue: `Guest MFA enforced via "${guestCa.displayName}"` } : { status: 'fail', currentValue: 'No CA policy enforces MFA for guest accounts' };
		}
		case 'fido2_admins': {
			const pct = data.mfaRegistrationDetails.length > 0
				? Math.round(data.mfaRegistrationDetails.filter((u: any) => (u.methodsRegistered || []).some((m: string) => (m || '').toLowerCase().includes('fido'))).length / data.mfaRegistrationDetails.length * 100)
				: 0;
			return pct >= 80 ? { status: 'pass', currentValue: `${pct}% of users have FIDO2 registered` } : pct > 0 ? { status: 'partial', currentValue: `${pct}% FIDO2 adoption` } : { status: 'fail', currentValue: 'No FIDO2 security keys registered' };
		}
		case 'signin_risk_policy': {
			const riskCa = enabledCA.find((p: any) => {
				const levels = JSON.stringify(p.conditions?.signInRiskLevels ?? []).toLowerCase();
				return levels.includes('medium') || levels.includes('high');
			});
			return riskCa ? { status: 'pass', currentValue: `Sign-in risk policy "${riskCa.displayName}" active` } : { status: 'fail', currentValue: 'No CA policy targeting medium/high sign-in risk' };
		}
		case 'user_risk_policy': {
			const userRiskCa = enabledCA.find((p: any) => {
				const levels = JSON.stringify(p.conditions?.userRiskLevels ?? []).toLowerCase();
				return levels.includes('high');
			});
			return userRiskCa ? { status: 'pass', currentValue: `User risk policy "${userRiskCa.displayName}" active` } : { status: 'fail', currentValue: 'No CA policy targeting high user risk' };
		}
		case 'audit_logging': {
			const hasAuditableRole = (data.directoryRoles || []).some((r: any) => /compliance|audit/i.test(r.displayName || ''));
			return hasAuditableRole ? { status: 'pass', currentValue: 'Audit-capable roles present — verify unified audit log is On' } : { status: 'partial', currentValue: 'Check compliance.microsoft.com > Audit' };
		}
		case 'mfa_number_matching': {
			const cfg = data.microsoftAuthenticatorConfig as any;
			const state = cfg?.featureSettings?.numberMatchingRequiredState?.state;
			if (state === 'enabled') return { status: 'pass', currentValue: 'Number matching enforced for Microsoft Authenticator' };
			if (state === 'disabled') return { status: 'fail', currentValue: 'Number matching disabled (vulnerable to MFA fatigue attacks)' };
			return { status: 'partial', currentValue: state ? `Number matching state: ${state}` : 'Microsoft Authenticator policy not retrievable — verify in Entra → Authentication methods' };
		}
		case 'password_expiration': {
			const doms: any[] = data.domains ?? [];
			if (doms.length === 0) return { status: 'partial', currentValue: 'No domains returned by Graph — verify Domain.Read.All' };
			// Entra recommends no expiration (Int32.Max = 2147483647). Anything <2147483647 means expiration enforced.
			const enforced = doms.filter(d => typeof d.passwordValidityPeriodInDays === 'number' && d.passwordValidityPeriodInDays < 2147483647);
			if (enforced.length === 0) return { status: 'pass', currentValue: `${doms.length} domain(s) with non-expiring passwords (NIST 800-63B aligned)` };
			return { status: 'fail', currentValue: `${enforced.length}/${doms.length} domain(s) still enforce password expiration (max ${Math.max(...enforced.map(d => d.passwordValidityPeriodInDays))} days)` };
		}
		case 'sspr_enabled': {
			// SSPR readiness is exposed via /policies/authenticationMethodsPolicy
			// (registrationEnforcement.authenticationMethodsRegistrationCampaign) and the
			// per-method enabledForUsers state. We treat any enabled non-password method
			// targeting users as evidence that SSPR is wired up.
			const policy = data.authMethodsPolicy as any;
			const configs: any[] = policy?.authenticationMethodConfigurations ?? [];
			const enabled = configs.filter((c: any) => c?.state === 'enabled' && c?.id !== 'password');
			if (enabled.length >= 2) return { status: 'pass', currentValue: `${enabled.length} non-password methods enabled (SSPR-capable)` };
			if (enabled.length === 1) return { status: 'partial', currentValue: 'Only 1 non-password method enabled — SSPR requires 2+' };
			return { status: 'fail', currentValue: 'No SSPR-capable methods enabled in authenticationMethodsPolicy' };
		}
		case 'sharepoint_sharing': {
			const sp = data.sharepointAdminSettings as any;
			const cap = sp?.sharingCapability;
			if (!cap) return { status: 'partial', currentValue: 'SharePoint admin settings unavailable (need Sites.FullControl + beta endpoint)' };
			if (cap === 'disabled' || cap === 'existingExternalUserSharingOnly') {
				return { status: 'pass', currentValue: `SharePoint sharing: ${cap}` };
			}
			return { status: 'fail', currentValue: `SharePoint sharing: ${cap} (CIS expects existingExternalUserSharingOnly or stricter)` };
		}
		case 'dlp_policies_exist': {
			const dlp = data.dlpPolicies ?? [];
			if (dlp.length === 0) return { status: 'fail', currentValue: 'No DLP policies found in tenant' };
			return { status: 'pass', currentValue: `${dlp.length} DLP polic${dlp.length === 1 ? 'y' : 'ies'} configured` };
		}
		case 'anti_phishing': {
			// M365 Secure Score control names for anti-phishing have churned
			// (mip_search_apphishpolicy, AntiPhishing, AntiPhishingPolicy).
			// "phish" is the most reliable substring across naming variants.
			const ss = data.secureScore as any;
			const controls: any[] = ss?.controlScores ?? [];
			const phishCtl = controls.find((c: any) => /phish/i.test(String(c?.controlName ?? c?.controlCategory ?? '')));
			if (!phishCtl) return { status: 'partial', currentValue: ss ? 'No anti-phishing control surfaced in latest Secure Score' : 'Secure Score not retrievable — verify Defender > Policies > Anti-phishing' };
			const score = Number(phishCtl.score ?? 0);
			const rawMax = phishCtl.maxScore;
			const max = Number(rawMax != null ? rawMax : 0);
			if (max > 0 && score >= max) return { status: 'pass', currentValue: `Anti-phishing Secure Score: ${score}/${max}` };
			if (score > 0) return { status: 'partial', currentValue: `Anti-phishing Secure Score: ${score}/${max || '?'} — partial credit` };
			return { status: 'fail', currentValue: `Anti-phishing Secure Score: ${score}/${max || '?'}` };
		}
		case 'dmarc_configured': {
			const domains = data.dnsAuthByDomain ?? [];
			if (domains.length === 0) return { status: 'partial', currentValue: 'No verified domains found to check' };
			const passing = domains.filter(d => d.dmarc === 'pass' && (d.dmarcPolicy === 'quarantine' || d.dmarcPolicy === 'reject'));
			if (passing.length === domains.length) return { status: 'pass', currentValue: `All ${domains.length} domain(s) have DMARC at quarantine or reject` };
			if (passing.length > 0) return { status: 'partial', currentValue: `${passing.length}/${domains.length} domains at quarantine/reject; weakest policy: ${domains.map(d => d.dmarcPolicy).find(p => p !== 'quarantine' && p !== 'reject') ?? 'unknown'}` };
			return { status: 'fail', currentValue: `0/${domains.length} domains have DMARC at quarantine or reject` };
		}
		case 'spf_configured': {
			const domains = data.dnsAuthByDomain ?? [];
			if (domains.length === 0) return { status: 'partial', currentValue: 'No verified domains found to check' };
			const passing = domains.filter(d => d.spf === 'pass');
			if (passing.length === domains.length) return { status: 'pass', currentValue: `All ${domains.length} domain(s) publish SPF` };
			return { status: 'fail', currentValue: `${passing.length}/${domains.length} domain(s) publish SPF` };
		}
		case 'dkim_enabled': {
			const domains = data.dnsAuthByDomain ?? [];
			if (domains.length === 0) return { status: 'partial', currentValue: 'No verified domains found to check' };
			const passing = domains.filter(d => d.dkim === 'pass');
			if (passing.length === domains.length) return { status: 'pass', currentValue: `All ${domains.length} domain(s) have at least one passing DKIM selector` };
			if (passing.length > 0) return { status: 'partial', currentValue: `${passing.length}/${domains.length} domain(s) have passing DKIM` };
			return { status: 'fail', currentValue: `0/${domains.length} domain(s) publish DKIM (checked 6 common selectors)` };
		}
		case 'external_tagging': {
			// Best signal we have without Exchange Online PowerShell: SecureScore.
			// Microsoft tracks "external sender identification" via 'mip_search_apphishpolicy'
			// and 'external_tagging' / 'enhancedfilteringforconnectors' control names.
			const ss = data.secureScore as any;
			const controls: any[] = ss?.controlScores ?? [];
			const ctl = controls.find((c: any) => /external.?(tag|identif|sender)/i.test(String(c?.controlName ?? c?.controlCategory ?? '')));
			if (!ctl) return { status: 'partial', currentValue: 'No Graph endpoint for transport rules; no external-tagging control found in Secure Score either. Verify in Exchange Admin Center > Mail Flow > Rules.' };
			const score = Number(ctl.score ?? 0);
			const max = Number(ctl.maxScore ?? 0);
			if (max > 0 && score >= max) return { status: 'pass', currentValue: `External-tagging Secure Score: ${score}/${max}` };
			if (score > 0) return { status: 'partial', currentValue: `External-tagging Secure Score: ${score}/${max || '?'} — partial` };
			return { status: 'fail', currentValue: `External-tagging Secure Score: ${score}/${max || '?'}` };
		}
		case 'admin_alert_policies': {
			const ss = data.secureScore as any;
			const controls: any[] = ss?.controlScores ?? [];
			// SecureScore tracks admin-related alert policies under names like
			// 'AdminPrivilegedAccountAlertPolicy', 'admin_role_assigned_alert', etc.
			const ctls = controls.filter((c: any) => /admin.{0,3}(role|alert|privileg)|alert_admin|alert.{0,3}role/i.test(String(c?.controlName ?? c?.controlCategory ?? '')));
			if (ctls.length === 0) return { status: 'partial', currentValue: 'No admin-alert controls surfaced in Secure Score. Verify in Defender Portal > Policies & Rules > Alert Policy.' };
			const total = ctls.reduce((s, c) => s + Number(c.score ?? 0), 0);
			const totalMax = ctls.reduce((s, c) => s + Number(c.maxScore ?? 0), 0);
			if (totalMax > 0 && total >= totalMax) return { status: 'pass', currentValue: `${ctls.length} admin-alert control(s) at full Secure Score: ${total}/${totalMax}` };
			if (total > 0) return { status: 'partial', currentValue: `${ctls.length} admin-alert controls partial: ${total}/${totalMax}` };
			return { status: 'fail', currentValue: `${ctls.length} admin-alert controls scored zero` };
		}
		case 'federated_identity_scoped': {
			// Round 5: surface the aggregate federated-identity-auditor result.
			const score = data.federatedIdentityScore;
			const findings = data.federatedIdentityFindingCount;
			if (score === undefined) return { status: 'partial', currentValue: 'Federated identity audit unavailable — check Application.Read.All permission' };
			if (score >= 100) return { status: 'pass', currentValue: 'No federated-identity findings — all credentials properly scoped' };
			if (score >= 60) return { status: 'partial', currentValue: `Federated audit score ${score}/100 — ${findings} finding(s); review /api/federated-identity` };
			return { status: 'fail', currentValue: `Federated audit score ${score}/100 — ${findings} finding(s) including wildcard subjects or unknown issuers` };
		}
		case 'onedrive_sharing_org_only': {
			const sp = data.sharepointAdminSettings as any;
			const cap = sp?.oneDriveSharingCapability;
			if (!cap) return { status: 'partial', currentValue: 'SharePoint admin settings unavailable' };
			if (cap === 'disabled' || cap === 'existingExternalUserSharingOnly') {
				return { status: 'pass', currentValue: `OneDrive sharing: ${cap}` };
			}
			return { status: 'fail', currentValue: `OneDrive sharing: ${cap} (CIS expects existingExternalUserSharingOnly or stricter)` };
		}
		case 'anonymous_links_disabled': {
			const sp = data.sharepointAdminSettings as any;
			const def = sp?.defaultSharingLinkType;
			if (!def) return { status: 'partial', currentValue: 'SharePoint admin settings unavailable' };
			if (def === 'anonymousAccess') return { status: 'fail', currentValue: 'Default sharing link is "Anyone with the link" (anonymousAccess)' };
			return { status: 'pass', currentValue: `Default sharing link: ${def} (anonymous links not the default)` };
		}
		case 'sharing_link_default_org': {
			const sp = data.sharepointAdminSettings as any;
			const def = sp?.defaultSharingLinkType;
			if (!def) return { status: 'partial', currentValue: 'SharePoint admin settings unavailable' };
			if (def === 'internal' || def === 'direct') return { status: 'pass', currentValue: `Default sharing link: ${def} (org-scoped)` };
			return { status: 'fail', currentValue: `Default sharing link: ${def} (CIS expects internal or direct)` };
		}
		case 'dlp_teams_enabled': {
			const dlp = data.dlpPolicies ?? [];
			if (dlp.length === 0) return { status: 'fail', currentValue: 'No DLP policies — Teams location requires at least one active DLP policy' };
			const teamsCovered = dlp.some(p => {
				const locs = JSON.stringify(p.locations ?? p.scopes ?? p ?? '').toLowerCase();
				return locs.includes('teams') || locs.includes('teamschat') || locs.includes('teamschannel');
			});
			return teamsCovered
				? { status: 'pass', currentValue: 'At least one DLP policy covers Teams locations' }
				: { status: 'fail', currentValue: `${dlp.length} DLP polic${dlp.length === 1 ? 'y' : 'ies'} active but none target Teams` };
		}
		case 'dlp_notifications_on': {
			const dlp = data.dlpPolicies ?? [];
			if (dlp.length === 0) return { status: 'fail', currentValue: 'No DLP policies' };
			const withNotifications = dlp.filter(p => {
				const blob = JSON.stringify(p ?? '').toLowerCase();
				return blob.includes('notifyuser') || blob.includes('usernotifications') || blob.includes('policytip');
			});
			return withNotifications.length === dlp.length
				? { status: 'pass', currentValue: `All ${dlp.length} DLP policies have user notifications` }
				: withNotifications.length > 0
					? { status: 'partial', currentValue: `${withNotifications.length}/${dlp.length} policies have notifications` }
					: { status: 'fail', currentValue: 'No DLP policies have user notifications enabled' };
		}
		case 'dlp_endpoint_enforcement': {
			const dlp = data.dlpPolicies ?? [];
			const endpointCovered = dlp.some(p => {
				const blob = JSON.stringify(p.locations ?? p ?? '').toLowerCase();
				return blob.includes('endpoint') || blob.includes('endpointdevicesales') || blob.includes('devices');
			});
			return endpointCovered
				? { status: 'pass', currentValue: 'At least one DLP policy targets endpoint devices' }
				: { status: 'fail', currentValue: 'No DLP policy targets endpoint devices (Endpoint DLP not enforced)' };
		}
		case 'auto_labeling_policies': {
			const lp = data.labelPolicies as any;
			const labels: any[] = lp?.value ?? data.sensitivityLabels ?? [];
			const autoLabel = labels.filter(l => l.autoLabelByDefault === true || l.autoLabel || l.autoLabelingEnabled);
			if (autoLabel.length > 0) return { status: 'pass', currentValue: `${autoLabel.length} label(s) configured with auto-labeling` };
			return { status: 'fail', currentValue: `No labels have auto-labeling enabled (${labels.length} label(s) total)` };
		}
		case 'default_sensitivity_label': {
			const lp = data.labelPolicies as any;
			const labels: any[] = lp?.value ?? data.sensitivityLabels ?? [];
			const hasDefault = labels.some(l => l.isDefault === true || l.defaultLabel);
			return hasDefault
				? { status: 'pass', currentValue: 'A default sensitivity label is configured' }
				: { status: 'fail', currentValue: `No default sensitivity label configured (${labels.length} label(s) defined)` };
		}
		case 'retention_exchange':
		case 'retention_sharepoint':
		case 'retention_teams': {
			// Round 5: /beta/security/labels/retentionLabels exposes published
			// retention labels. We can detect coverage when at least one label
			// has the matching workload in its descriptiveText / behaviorDuringRetentionPeriod.
			const labels = data.retentionLabels ?? [];
			if (labels.length === 0) return { status: 'fail', currentValue: 'No retention labels published — Purview retention not configured' };
			const workload = control.graphCheck === 'retention_exchange' ? /exchange|email|mail/i
				: control.graphCheck === 'retention_sharepoint' ? /sharepoint|sites?|onedrive/i
				: /teams|chat|channel/i;
			const matching = labels.filter(l => workload.test(JSON.stringify(l ?? '')));
			if (matching.length > 0) return { status: 'pass', currentValue: `${matching.length} retention label(s) cover this workload` };
			return { status: 'partial', currentValue: `${labels.length} retention label(s) published but none explicitly target this workload — check label scope in Purview` };
		}
		case 'information_barriers': {
			const ibp = data.informationBarrierPolicies ?? [];
			if (ibp.length === 0) return { status: 'fail', currentValue: 'No information barrier policies configured' };
			const active = ibp.filter(p => p.state === 'active' || p.state === 'enabled');
			return active.length > 0
				? { status: 'pass', currentValue: `${active.length}/${ibp.length} information barrier polic${ibp.length === 1 ? 'y' : 'ies'} active` }
				: { status: 'partial', currentValue: `${ibp.length} barrier polic${ibp.length === 1 ? 'y' : 'ies'} defined but none active` };
		}
		case 'communication_compliance': return { status: 'partial', currentValue: 'No public Graph endpoint for Communication Compliance — verify via Purview > Communication Compliance.' };
		case 'ediscovery_available': {
			const cases = data.ediscoveryCases ?? [];
			return cases.length > 0
				? { status: 'pass', currentValue: `eDiscovery is operational (${cases.length} case(s) accessible via beta API)` }
				: { status: 'partial', currentValue: 'No eDiscovery cases found — assign eDiscovery Manager role to compliance team and create at least one case' };
		}
		case 'legal_hold_capable': {
			const cases = data.ediscoveryCases ?? [];
			const withHolds = cases.some(c => {
				const blob = JSON.stringify(c ?? '').toLowerCase();
				return blob.includes('hold') || blob.includes('preservation');
			});
			if (withHolds) return { status: 'pass', currentValue: 'Legal hold capability verified via existing eDiscovery cases' };
			if (cases.length > 0) return { status: 'partial', currentValue: 'eDiscovery cases exist but no holds detected — create a hold to confirm capability' };
			return { status: 'fail', currentValue: 'No eDiscovery cases or holds detected — eDiscovery Premium license + role assignment required' };
		}

		default: return { status: 'partial', currentValue: `Manual verification required — graphCheck: ${control.graphCheck ?? 'unknown'}` };
	}
}
