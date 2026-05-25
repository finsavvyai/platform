import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import Card from './Card.svelte';

describe('Card', () => {
	it('should render a div element', () => {
		const { container } = render(Card);
		expect(container.querySelector('div')).toBeTruthy();
	});

	it('should apply default variant classes', () => {
		const { container } = render(Card);
		const el = container.querySelector('div')!;
		expect(el.className).toContain('bg-[var(--color-surface)]');
		expect(el.className).toContain('border');
	});

	it('should apply elevated variant classes', () => {
		const { container } = render(Card, { props: { variant: 'elevated' } });
		const el = container.querySelector('div')!;
		expect(el.className).toContain('bg-[var(--color-surface-elevated)]');
		expect(el.className).toContain('shadow');
	});

	it('should apply outlined variant classes', () => {
		const { container } = render(Card, { props: { variant: 'outlined' } });
		const el = container.querySelector('div')!;
		expect(el.className).toContain('border-[var(--color-border-strong)]');
	});

	it('should apply flat variant classes', () => {
		const { container } = render(Card, { props: { variant: 'flat' } });
		const el = container.querySelector('div')!;
		expect(el.className).toContain('bg-[var(--color-bg-secondary)]');
	});

	it('should apply padding sizes', () => {
		const cases = [
			{ padding: 'none' as const, expected: 'p-0' },
			{ padding: 'sm' as const, expected: 'p-4' },
			{ padding: 'md' as const, expected: 'p-6' },
			{ padding: 'lg' as const, expected: 'p-8' }
		];
		for (const { padding, expected } of cases) {
			const { container, unmount } = render(Card, { props: { padding } });
			expect(container.querySelector('div')!.className).toContain(expected);
			unmount();
		}
	});

	it('should add hover shadow when hoverable', () => {
		const { container } = render(Card, { props: { hoverable: true } });
		const el = container.querySelector('div')!;
		expect(el.className).toContain('hover:shadow');
	});

	it('should add cursor-pointer and role=button when clickable', () => {
		const { container } = render(Card, { props: { clickable: true } });
		const el = container.querySelector('div')!;
		expect(el.className).toContain('cursor-pointer');
		expect(el.getAttribute('role')).toBe('button');
		expect(el.getAttribute('tabindex')).toBe('0');
	});

	it('should not have role=button when not clickable', () => {
		const { container } = render(Card);
		const el = container.querySelector('div')!;
		expect(el.getAttribute('role')).toBeNull();
		expect(el.getAttribute('tabindex')).toBeNull();
	});

	it('should apply rounded-xl base class', () => {
		const { container } = render(Card);
		expect(container.querySelector('div')!.className).toContain('rounded-xl');
	});

	it('should merge custom className', () => {
		const { container } = render(Card, { props: { class: 'custom-class' } });
		expect(container.querySelector('div')!.className).toContain('custom-class');
	});
});
