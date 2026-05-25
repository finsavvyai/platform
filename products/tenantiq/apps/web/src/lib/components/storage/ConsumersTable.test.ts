import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/svelte';
import ConsumersTable from './ConsumersTable.svelte';

function makeConsumers(count: number, overQuota = false) {
	return Array.from({ length: count }, (_, i) => ({
		id: `u${i}`, name: `User ${i}`, usedGB: 10 + i, allocatedGB: 100,
		utilizationPct: overQuota && i === 0 ? 92 : 50,
	}));
}

describe('ConsumersTable', () => {
	it('renders at most 20 rows when given 25 consumers', () => {
		const { container } = render(ConsumersTable, { props: { title: 'Top Users', consumers: makeConsumers(25), type: 'user' } });
		const rows = container.querySelectorAll('tbody tr');
		expect(rows.length).toBeLessThanOrEqual(20);
	});
	it('renders all rows when fewer than 20 consumers', () => {
		const { container } = render(ConsumersTable, { props: { title: 'Top Users', consumers: makeConsumers(5), type: 'user' } });
		const rows = container.querySelectorAll('tbody tr');
		expect(rows.length).toBe(5);
	});
	it('shows quota warning badge when utilizationPct >= 90', () => {
		const { container } = render(ConsumersTable, { props: { title: 'Top Users', consumers: makeConsumers(3, true), type: 'user' } });
		const badge = container.querySelector('[data-quota-warning]') ?? container.querySelector('.quota-warning');
		expect(badge).toBeTruthy();
	});
	it('does NOT show quota warning badge when utilizationPct < 90', () => {
		const { container } = render(ConsumersTable, { props: { title: 'Top Users', consumers: makeConsumers(3, false), type: 'user' } });
		const badge = container.querySelector('[data-quota-warning]') ?? container.querySelector('.quota-warning');
		expect(badge).toBeFalsy();
	});
});
