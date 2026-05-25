import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import MetricCard from './MetricCard.svelte';

describe('MetricCard', () => {
	it('should render title and value', () => {
		render(MetricCard, { props: { title: 'Users', value: '1,234' } });
		expect(screen.getByText('Users')).toBeTruthy();
		expect(screen.getByText('1,234')).toBeTruthy();
	});

	it('should render subtitle when provided', () => {
		render(MetricCard, {
			props: { title: 'Score', value: '85', subtitle: 'Up from last month' }
		});
		expect(screen.getByText('Up from last month')).toBeTruthy();
	});

	it('should not render subtitle when not provided', () => {
		render(MetricCard, { props: { title: 'Score', value: '85' } });
		expect(screen.queryByText('Up from last month')).toBeNull();
	});

	it('should render upward trend indicator', () => {
		render(MetricCard, {
			props: {
				title: 'Score',
				value: '85',
				trend: { value: 12, direction: 'up' }
			}
		});
		expect(screen.getByText('+12%')).toBeTruthy();
	});

	it('should render downward trend indicator', () => {
		render(MetricCard, {
			props: {
				title: 'Score',
				value: '40',
				trend: { value: 5, direction: 'down' }
			}
		});
		expect(screen.getByText('5%')).toBeTruthy();
	});

	it('should render as a link when href is provided', () => {
		const { container } = render(MetricCard, {
			props: { title: 'Alerts', value: '7', href: '/alerts' }
		});
		const link = container.querySelector('a[href="/alerts"]');
		expect(link).toBeTruthy();
	});

	it('should render as a div when no href', () => {
		const { container } = render(MetricCard, {
			props: { title: 'Alerts', value: '7' }
		});
		expect(container.querySelector('a')).toBeNull();
		expect(container.querySelector('div')).toBeTruthy();
	});

	it('should render progress bar when progress is provided', () => {
		const { container } = render(MetricCard, {
			props: { title: 'Storage', value: '75%', progress: 75 }
		});
		const progressBar = container.querySelector('[style*="width: 75%"]');
		expect(progressBar).toBeTruthy();
	});

	it('should not render progress bar when not provided', () => {
		const { container } = render(MetricCard, {
			props: { title: 'Score', value: '42' }
		});
		const progressBar = container.querySelector('.animate-fill-bar');
		expect(progressBar).toBeNull();
	});

	it('should render icon when provided', () => {
		const { container } = render(MetricCard, {
			props: {
				title: 'Users',
				value: '100',
				icon: 'M12 4v16m8-8H4'
			}
		});
		const svg = container.querySelector('svg path[d="M12 4v16m8-8H4"]');
		expect(svg).toBeTruthy();
	});
});
