<script lang="ts">
	/**
	 * Company Profile Step - Industry-based security profiler
	 *
	 * Collects industry, company size, and compliance requirements.
	 * Auto-checks relevant compliance when an industry is selected.
	 */
	import Button from '$components/ui/Button.svelte';

	interface Props {
		onSubmit: (profile: {
			industry: string;
			companySize: string;
			compliance: string[];
		}) => void;
	}

	let { onSubmit }: Props = $props();

	let industry = $state('');
	let companySize = $state('');
	let compliance = $state<string[]>([]);
	let saving = $state(false);

	const industries = [
		'Fintech / Banking',
		'Healthcare',
		'Legal',
		'Government',
		'Education',
		'Technology',
		'Retail',
		'Manufacturing',
		'Other',
	];

	const companySizes = ['1-50', '51-200', '201-1000', '1000+'];

	const complianceOptions = [
		'PCI-DSS', 'SOX', 'GDPR', 'HIPAA', 'SOC 2',
		'ISO 27001', 'NIST', 'FCA/MiFID II', 'FERPA', 'FedRAMP',
	];

	const industryCompliance: Record<string, string[]> = {
		'Fintech / Banking': ['PCI-DSS', 'SOX', 'GDPR', 'FCA/MiFID II'],
		Healthcare: ['HIPAA', 'SOC 2', 'GDPR'],
		Legal: ['SOC 2', 'GDPR'],
		Government: ['NIST', 'FedRAMP'],
		Education: ['FERPA', 'GDPR'],
		Technology: ['SOC 2', 'ISO 27001', 'GDPR'],
		Retail: ['PCI-DSS', 'GDPR'],
		Manufacturing: ['ISO 27001', 'NIST'],
	};

	function onIndustryChange() {
		const suggested = industryCompliance[industry] ?? [];
		compliance = [...suggested];
	}

	function toggleCompliance(item: string) {
		if (compliance.includes(item)) {
			compliance = compliance.filter((c) => c !== item);
		} else {
			compliance = [...compliance, item];
		}
	}

	async function handleSubmit() {
		if (!industry || !companySize) return;
		saving = true;
		onSubmit({ industry, companySize, compliance });
	}

	const canContinue = $derived(industry !== '' && companySize !== '');
</script>

<h2 class="mb-2 text-2xl font-bold tracking-tight text-[var(--color-text)]">
	Tell us about your company
</h2>
<p class="mb-7 max-w-sm text-[15px] leading-relaxed text-[var(--color-text-secondary)]">
	We'll tailor your security baseline and compliance checks to your industry.
</p>

<div class="w-full max-w-sm space-y-5 text-left">
	<label class="block">
		<span class="mb-1.5 block text-sm font-medium text-[var(--color-text)]">Industry</span>
		<select
			bind:value={industry}
			onchange={onIndustryChange}
			class="w-full appearance-none rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2.5 text-sm text-[var(--color-text)] outline-none transition-colors focus:border-[var(--color-primary)]"
		>
			<option value="">Select your industry</option>
			{#each industries as ind}
				<option value={ind}>{ind}</option>
			{/each}
		</select>
	</label>

	<label class="block">
		<span class="mb-1.5 block text-sm font-medium text-[var(--color-text)]">Company size</span>
		<select
			bind:value={companySize}
			class="w-full appearance-none rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2.5 text-sm text-[var(--color-text)] outline-none transition-colors focus:border-[var(--color-primary)]"
		>
			<option value="" disabled>Select company size</option>
			<option value="1-50">1-50 employees</option>
			<option value="51-200">51-200 employees</option>
			<option value="201-1000">201-1000 employees</option>
			<option value="1000+">1000+ employees</option>
		</select>
	</label>

	{#if industry}
		<fieldset>
			<legend class="mb-2 text-sm font-medium text-[var(--color-text)]">
				Compliance requirements
			</legend>
			<div class="grid grid-cols-2 gap-2">
				{#each complianceOptions as item}
					<label
						class="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors
							{compliance.includes(item)
								? 'border-[var(--color-primary)]/40 bg-[var(--color-primary)]/5 text-[var(--color-text)]'
								: 'border-[var(--color-border)] text-[var(--color-text-secondary)]'}"
					>
						<input
							type="checkbox"
							checked={compliance.includes(item)}
							onchange={() => toggleCompliance(item)}
							class="accent-[var(--color-primary)]"
						/>
						{item}
					</label>
				{/each}
			</div>
		</fieldset>
	{/if}
</div>

<div class="mt-7">
	<Button variant="primary" size="lg" onclick={handleSubmit} disabled={!canContinue || saving}>
		{saving ? 'Saving...' : 'Continue'}
	</Button>
</div>
