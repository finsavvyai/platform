import { writable } from 'svelte/store';

export interface Toast {
	id: string;
	message: string;
	type: 'success' | 'error' | 'info' | 'warning';
	duration: number;
}

function createToastStore() {
	const { subscribe, update } = writable<Toast[]>([]);
	let counter = 0;

	function add(message: string, type: Toast['type'] = 'info', duration = 4000) {
		const id = `toast-${++counter}`;
		update(toasts => {
			const next = [...toasts, { id, message, type, duration }];
			// Keep at most 3 visible toasts — remove oldest if over limit
			return next.length > 3 ? next.slice(next.length - 3) : next;
		});
		setTimeout(() => remove(id), duration);
	}

	function remove(id: string) {
		update(toasts => toasts.filter(t => t.id !== id));
	}

	return {
		subscribe,
		success: (msg: string) => add(msg, 'success'),
		error: (msg: string) => add(msg, 'error', 6000),
		warning: (msg: string) => add(msg, 'warning', 5000),
		info: (msg: string) => add(msg, 'info'),
		remove
	};
}

export const toasts = createToastStore();
