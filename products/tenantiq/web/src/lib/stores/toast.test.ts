import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { get } from 'svelte/store';
import { toasts } from './toast';

describe('Toast Store', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		// Clear any existing toasts
		const current = get(toasts);
		current.forEach((t) => toasts.remove(t.id));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('should start empty', () => {
		expect(get(toasts)).toEqual([]);
	});

	it('success should add a success toast', () => {
		toasts.success('Operation completed');
		const items = get(toasts);
		expect(items).toHaveLength(1);
		expect(items[0].type).toBe('success');
		expect(items[0].message).toBe('Operation completed');
	});

	it('error should add an error toast', () => {
		toasts.error('Something went wrong');
		const items = get(toasts);
		expect(items).toHaveLength(1);
		expect(items[0].type).toBe('error');
		expect(items[0].message).toBe('Something went wrong');
	});

	it('info should add an info toast', () => {
		toasts.info('FYI');
		const items = get(toasts);
		expect(items).toHaveLength(1);
		expect(items[0].type).toBe('info');
	});

	it('remove should remove a toast by id', () => {
		toasts.success('One');
		toasts.info('Two');
		const items = get(toasts);
		expect(items).toHaveLength(2);

		toasts.remove(items[0].id);
		expect(get(toasts)).toHaveLength(1);
		expect(get(toasts)[0].message).toBe('Two');
	});

	it('should auto-dismiss after duration', () => {
		toasts.success('Temporary');
		expect(get(toasts)).toHaveLength(1);

		vi.advanceTimersByTime(4000);
		expect(get(toasts)).toHaveLength(0);
	});

	it('error toasts should have longer duration (6s)', () => {
		toasts.error('Error msg');
		vi.advanceTimersByTime(4000);
		// Still visible at 4s
		expect(get(toasts)).toHaveLength(1);

		vi.advanceTimersByTime(2000);
		// Gone at 6s
		expect(get(toasts)).toHaveLength(0);
	});

	it('should limit to 3 visible toasts', () => {
		toasts.success('One');
		toasts.success('Two');
		toasts.success('Three');
		toasts.success('Four');
		const items = get(toasts);
		expect(items).toHaveLength(3);
		expect(items[0].message).toBe('Two');
		expect(items[2].message).toBe('Four');
	});

	it('each toast should have a unique id', () => {
		toasts.success('A');
		toasts.success('B');
		const items = get(toasts);
		expect(items[0].id).not.toBe(items[1].id);
	});

	it('remove on nonexistent id should be a no-op', () => {
		toasts.success('A');
		toasts.remove('nonexistent-id');
		expect(get(toasts)).toHaveLength(1);
	});
});
