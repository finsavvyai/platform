import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import Button from './Button.svelte';

describe('Button', () => {
	it('should render a button element', () => {
		const { container } = render(Button);
		expect(container.querySelector('button')).toBeTruthy();
	});

	it('should apply primary variant classes by default', () => {
		const { container } = render(Button);
		const btn = container.querySelector('button')!;
		expect(btn.className).toContain('text-white');
		expect(btn.className).toContain('bg-gradient-to-r');
	});

	it('should apply secondary variant classes', () => {
		const { container } = render(Button, { props: { variant: 'secondary' } });
		const btn = container.querySelector('button')!;
		expect(btn.className).toContain('bg-[var(--color-surface)]');
		expect(btn.className).toContain('border');
	});

	it('should apply destructive variant classes', () => {
		const { container } = render(Button, { props: { variant: 'destructive' } });
		const btn = container.querySelector('button')!;
		expect(btn.className).toContain('bg-gradient-to-r');
		expect(btn.className).toContain('text-white');
	});

	it('should apply ghost variant classes', () => {
		const { container } = render(Button, { props: { variant: 'ghost' } });
		const btn = container.querySelector('button')!;
		expect(btn.className).toContain('bg-transparent');
		expect(btn.className).toContain('text-[var(--color-text-secondary)]');
	});

	it('should apply size classes', () => {
		const { container } = render(Button, { props: { size: 'sm' } });
		expect(container.querySelector('button')!.className).toContain('h-9');
	});

	it('should apply large size classes', () => {
		const { container } = render(Button, { props: { size: 'lg' } });
		expect(container.querySelector('button')!.className).toContain('h-14');
	});

	it('should be disabled when disabled prop is true', () => {
		const { container } = render(Button, { props: { disabled: true } });
		expect(container.querySelector('button')!.disabled).toBe(true);
	});

	it('should be disabled when loading is true', () => {
		const { container } = render(Button, { props: { loading: true } });
		expect(container.querySelector('button')!.disabled).toBe(true);
	});

	it('should show spinner SVG when loading', () => {
		const { container } = render(Button, { props: { loading: true } });
		const spinner = container.querySelector('svg.animate-spin');
		expect(spinner).toBeTruthy();
	});

	it('should not show spinner when not loading', () => {
		const { container } = render(Button);
		const spinner = container.querySelector('svg.animate-spin');
		expect(spinner).toBeNull();
	});

	it('should apply fullWidth class', () => {
		const { container } = render(Button, { props: { fullWidth: true } });
		expect(container.querySelector('button')!.className).toContain('w-full');
	});

	it('should apply icon size classes when icon prop is true', () => {
		const { container } = render(Button, {
			props: { icon: true, size: 'md' }
		});
		const btn = container.querySelector('button')!;
		expect(btn.className).toContain('w-11');
	});
});
