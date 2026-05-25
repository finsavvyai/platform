import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import ExportMenu from './ExportMenu.svelte';

describe('ExportMenu', () => {
	it('should render the export button with default label', () => {
		render(ExportMenu, { props: {} });
		expect(screen.getByText('Export')).toBeTruthy();
	});

	it('should render custom label', () => {
		render(ExportMenu, { props: { label: 'Download' } });
		expect(screen.getByText('Download')).toBeTruthy();
	});

	it('should be disabled when disabled prop is true', () => {
		const { container } = render(ExportMenu, { props: { disabled: true } });
		const btn = container.querySelector('button');
		expect(btn?.disabled).toBe(true);
	});

	it('should toggle menu open on click', async () => {
		render(ExportMenu, {
			props: { onExportCsv: vi.fn(), onExportJson: vi.fn() }
		});
		const trigger = screen.getByText('Export');
		expect(screen.queryByRole('menu')).toBeNull();

		await fireEvent.click(trigger);
		expect(screen.getByRole('menu')).toBeTruthy();
	});

	it('should show CSV option when onExportCsv provided', async () => {
		render(ExportMenu, { props: { onExportCsv: vi.fn() } });
		await fireEvent.click(screen.getByText('Export'));
		expect(screen.getByText('Export CSV')).toBeTruthy();
	});

	it('should show JSON option when onExportJson provided', async () => {
		render(ExportMenu, { props: { onExportJson: vi.fn() } });
		await fireEvent.click(screen.getByText('Export'));
		expect(screen.getByText('Export JSON')).toBeTruthy();
	});

	it('should show PDF option when onExportPdf provided', async () => {
		render(ExportMenu, { props: { onExportPdf: vi.fn() } });
		await fireEvent.click(screen.getByText('Export'));
		expect(screen.getByText('Export PDF')).toBeTruthy();
	});

	it('should show Copy Link option when onCopyLink provided', async () => {
		render(ExportMenu, { props: { onCopyLink: vi.fn() } });
		await fireEvent.click(screen.getByText('Export'));
		expect(screen.getByText('Copy Link')).toBeTruthy();
	});

	it('should call onExportCsv and close menu on click', async () => {
		const onExportCsv = vi.fn();
		render(ExportMenu, { props: { onExportCsv } });

		await fireEvent.click(screen.getByText('Export'));
		await fireEvent.click(screen.getByText('Export CSV'));

		expect(onExportCsv).toHaveBeenCalledOnce();
		expect(screen.queryByRole('menu')).toBeNull();
	});

	it('should have aria-haspopup on trigger button', () => {
		const { container } = render(ExportMenu, { props: {} });
		const btn = container.querySelector('button[aria-haspopup="true"]');
		expect(btn).toBeTruthy();
	});

	it('should not show options that are not provided', async () => {
		render(ExportMenu, { props: { onExportCsv: vi.fn() } });
		await fireEvent.click(screen.getByText('Export'));
		expect(screen.queryByText('Export JSON')).toBeNull();
		expect(screen.queryByText('Export PDF')).toBeNull();
		expect(screen.queryByText('Copy Link')).toBeNull();
	});
});
