<script lang="ts">
	import { browser } from '$app/environment';

	/**
	 * Global keyboard shortcuts for power users.
	 * - Cmd/Ctrl+K: Focus search or open command palette stub
	 * - Cmd/Ctrl+/: Toggle AI chat guide
	 * - Escape: Close any open modal/panel
	 */

	function isMod(e: KeyboardEvent): boolean {
		return e.metaKey || e.ctrlKey;
	}

	function focusSearch() {
		const search = document.querySelector<HTMLInputElement>(
			'input[type="text"][placeholder*="Search"], input[type="search"]'
		);
		if (search) {
			search.focus();
			search.select();
			return true;
		}
		return false;
	}

	function toggleChatGuide() {
		const chatBtn = document.querySelector<HTMLButtonElement>(
			'button[aria-label="Open chat guide"], button[aria-label="Close chat"]'
		);
		chatBtn?.click();
	}

	function closeOpenPanel() {
		// Close modals via Escape — try overlay backdrop, then close buttons
		const escTargets = document.querySelectorAll<HTMLButtonElement>(
			'[aria-label="Close"], [aria-label="Close chat"], [aria-label="Dismiss"], dialog[open]'
		);
		if (escTargets.length > 0) {
			const last = escTargets[escTargets.length - 1];
			if (last.tagName === 'DIALOG') {
				(last as unknown as HTMLDialogElement).close();
			} else {
				last.click();
			}
			return true;
		}
		return false;
	}

	function handleKeydown(e: KeyboardEvent) {
		// Ignore if user is typing in an input/textarea/contenteditable
		const tag = (e.target as HTMLElement)?.tagName;
		const isEditing = tag === 'INPUT' || tag === 'TEXTAREA' ||
			(e.target as HTMLElement)?.isContentEditable;

		if (e.key === 'k' && isMod(e)) {
			e.preventDefault();
			focusSearch();
			return;
		}

		if (e.key === '/' && isMod(e)) {
			e.preventDefault();
			toggleChatGuide();
			return;
		}

		if (e.key === 'Escape' && !isEditing) {
			closeOpenPanel();
		}
	}

	$effect(() => {
		if (!browser) return;
		document.addEventListener('keydown', handleKeydown);
		return () => document.removeEventListener('keydown', handleKeydown);
	});
</script>
