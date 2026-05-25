const FOCUSABLE = [
	'a[href]', 'button:not([disabled])', 'input:not([disabled])',
	'select:not([disabled])', 'textarea:not([disabled])',
	'[tabindex]:not([tabindex="-1"])'
].join(', ');

export function trapFocus(node: HTMLElement) {
	let previousFocus = document.activeElement as HTMLElement | null;

	function getFocusable(): HTMLElement[] {
		return Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE));
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key !== 'Tab') return;
		const items = getFocusable();
		if (items.length === 0) return;
		const first = items[0];
		const last = items[items.length - 1];
		if (e.shiftKey && document.activeElement === first) {
			e.preventDefault();
			last.focus();
		} else if (!e.shiftKey && document.activeElement === last) {
			e.preventDefault();
			first.focus();
		}
	}

	node.addEventListener('keydown', handleKeydown);
	const first = getFocusable()[0];
	if (first) first.focus();

	return {
		destroy() {
			node.removeEventListener('keydown', handleKeydown);
			previousFocus?.focus();
		}
	};
}
