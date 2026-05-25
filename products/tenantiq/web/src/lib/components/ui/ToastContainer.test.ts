import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import ToastContainer from './ToastContainer.svelte';
import { toasts } from '$stores/toast';

describe('ToastContainer', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		const current = get(toasts);
		current.forEach((t) => toasts.remove(t.id));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('should not render when no toasts', () => {
		const { container } = render(ToastContainer);
		expect(container.querySelector('[role="status"]')).toBeNull();
	});

	it('should render success toast message', async () => {
		render(ToastContainer);
		toasts.success('Saved successfully');
		// Wait for reactivity
		await vi.advanceTimersByTimeAsync(0);
		expect(screen.getByText('Saved successfully')).toBeTruthy();
	});

	it('should render error toast message', async () => {
		render(ToastContainer);
		toasts.error('Something failed');
		await vi.advanceTimersByTimeAsync(0);
		expect(screen.getByText('Something failed')).toBeTruthy();
	});

	it('should render info toast message', async () => {
		render(ToastContainer);
		toasts.info('Just so you know');
		await vi.advanceTimersByTimeAsync(0);
		expect(screen.getByText('Just so you know')).toBeTruthy();
	});

	it('should have aria-live="polite" for screen readers', async () => {
		const { container } = render(ToastContainer);
		toasts.info('test');
		await vi.advanceTimersByTimeAsync(0);
		const region = container.querySelector('[aria-live="polite"]');
		expect(region).toBeTruthy();
	});

	it('should render dismiss button with accessible label', async () => {
		render(ToastContainer);
		toasts.info('Dismissable');
		await vi.advanceTimersByTimeAsync(0);
		const dismissBtn = screen.getByLabelText('Dismiss');
		expect(dismissBtn).toBeTruthy();
	});

	it('should render multiple toasts', async () => {
		render(ToastContainer);
		toasts.success('First');
		toasts.error('Second');
		await vi.advanceTimersByTimeAsync(0);
		expect(screen.getByText('First')).toBeTruthy();
		expect(screen.getByText('Second')).toBeTruthy();
	});
});
