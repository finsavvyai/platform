/**
 * DeleteConfirmModal — confirm-by-name guard, focus trap, Esc key, accessibility.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DeleteConfirmModal } from '../../components/sso/DeleteConfirmModal';

// ─── Mock lucide-react icons ──────────────────────────────────────────────────

jest.mock('lucide-react', () => ({
    AlertTriangle: () => <span data-testid="alert-icon" aria-hidden="true" />,
    X: () => <span data-testid="close-icon" aria-hidden="true" />,
}));

jest.mock('../../lib/utils', () => ({
    cn: (...args: string[]) => args.filter(Boolean).join(' '),
}));

jest.mock('../../components/ui/button', () => ({
    Button: ({ children, onClick, disabled, isLoading, variant, ...props }: any) => (
        <button onClick={onClick} disabled={disabled} data-variant={variant} {...props}>
            {isLoading ? 'Loading...' : children}
        </button>
    ),
}));

// ─── Factory ──────────────────────────────────────────────────────────────────

function renderModal(overrides: {
    providerName?: string;
    isLoading?: boolean;
    onConfirm?: jest.Mock;
    onClose?: jest.Mock;
} = {}) {
    const onConfirm = overrides.onConfirm ?? jest.fn();
    const onClose = overrides.onClose ?? jest.fn();
    const utils = render(
        <DeleteConfirmModal
            providerName={overrides.providerName ?? 'My IdP Provider'}
            isLoading={overrides.isLoading ?? false}
            onConfirm={onConfirm}
            onClose={onClose}
        />,
    );
    return { ...utils, onConfirm, onClose };
}

// ─── Accessibility attributes ─────────────────────────────────────────────────

describe('DeleteConfirmModal — accessibility', () => {
    it('has role=alertdialog', () => {
        renderModal();
        expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    });

    it('has aria-modal="true"', () => {
        renderModal();
        expect(screen.getByRole('alertdialog')).toHaveAttribute('aria-modal', 'true');
    });

    it('has aria-labelledby pointing to title element', () => {
        renderModal();
        const dialog = screen.getByRole('alertdialog');
        const labelId = dialog.getAttribute('aria-labelledby');
        expect(labelId).toBeTruthy();
        const titleEl = document.getElementById(labelId!);
        expect(titleEl).toBeInTheDocument();
        expect(titleEl?.textContent).toContain('Delete identity provider');
    });

    it('has aria-describedby pointing to description element', () => {
        renderModal();
        const dialog = screen.getByRole('alertdialog');
        const descId = dialog.getAttribute('aria-describedby');
        expect(descId).toBeTruthy();
        const descEl = document.getElementById(descId!);
        expect(descEl).toBeInTheDocument();
    });
});

// ─── Button disabled until name matches ───────────────────────────────────────

describe('DeleteConfirmModal — confirm button gating', () => {
    it('delete button is disabled initially (no text typed)', () => {
        renderModal({ providerName: 'My Provider' });
        const deleteBtn = screen.getByRole('button', { name: /delete provider/i });
        expect(deleteBtn).toBeDisabled();
    });

    it('delete button is disabled when typed text does not match', async () => {
        renderModal({ providerName: 'My Provider' });
        const input = screen.getByRole('textbox');
        fireEvent.change(input, { target: { value: 'Wrong Name' } });
        expect(screen.getByRole('button', { name: /delete provider/i })).toBeDisabled();
    });

    it('delete button is enabled when typed text exactly matches providerName', async () => {
        renderModal({ providerName: 'My Provider' });
        const input = screen.getByRole('textbox');
        fireEvent.change(input, { target: { value: 'My Provider' } });
        await waitFor(() => {
            expect(screen.getByRole('button', { name: /delete provider/i })).not.toBeDisabled();
        });
    });

    it('match is case-sensitive (wrong case keeps button disabled)', async () => {
        renderModal({ providerName: 'My Provider' });
        const input = screen.getByRole('textbox');
        fireEvent.change(input, { target: { value: 'my provider' } });
        expect(screen.getByRole('button', { name: /delete provider/i })).toBeDisabled();
    });

    it('calls onConfirm when confirmed and delete clicked', async () => {
        const { onConfirm } = renderModal({ providerName: 'Test' });
        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Test' } });
        fireEvent.click(screen.getByRole('button', { name: /delete provider/i }));
        expect(onConfirm).toHaveBeenCalledTimes(1);
    });
});

// ─── Error message when mismatch ──────────────────────────────────────────────

describe('DeleteConfirmModal — mismatch error message', () => {
    it('shows mismatch error message when text typed but wrong', async () => {
        renderModal({ providerName: 'My Provider' });
        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Wrong' } });
        await waitFor(() => {
            expect(screen.getByRole('alert')).toHaveTextContent(/name does not match/i);
        });
    });

    it('does NOT show error message before any typing', () => {
        renderModal({ providerName: 'My Provider' });
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('marks input as aria-invalid=true when mismatch', async () => {
        renderModal({ providerName: 'My Provider' });
        const input = screen.getByRole('textbox');
        fireEvent.change(input, { target: { value: 'Wrong' } });
        await waitFor(() => {
            expect(input).toHaveAttribute('aria-invalid', 'true');
        });
    });
});

// ─── Esc closes modal ─────────────────────────────────────────────────────────

describe('DeleteConfirmModal — Esc key closes', () => {
    it('calls onClose when Escape key pressed', () => {
        const { onClose } = renderModal();
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(onClose).toHaveBeenCalledTimes(1);
    });
});

// ─── Cancel button ────────────────────────────────────────────────────────────

describe('DeleteConfirmModal — Cancel button', () => {
    it('calls onClose when Cancel button clicked', () => {
        const { onClose } = renderModal();
        fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('close (X) button calls onClose', () => {
        const { onClose } = renderModal();
        fireEvent.click(screen.getByLabelText(/close dialog/i));
        expect(onClose).toHaveBeenCalledTimes(1);
    });
});

// ─── Loading state ────────────────────────────────────────────────────────────

describe('DeleteConfirmModal — loading state', () => {
    it('delete button is disabled when isLoading=true even with matching name', async () => {
        renderModal({ providerName: 'Test', isLoading: true });
        const input = screen.getByRole('textbox');
        fireEvent.change(input, { target: { value: 'Test' } });
        await waitFor(() => {
            // With matching name but isLoading, button should be disabled
            expect(screen.getByRole('button', { name: /loading|delete/i })).toBeDisabled();
        });
    });

    it('cancel button is disabled when isLoading=true', () => {
        renderModal({ isLoading: true });
        const cancelBtn = screen.getByRole('button', { name: /cancel/i });
        expect(cancelBtn).toBeDisabled();
    });
});

// ─── Provider name displayed ──────────────────────────────────────────────────

describe('DeleteConfirmModal — provider name display', () => {
    it('shows provider name in description text', () => {
        renderModal({ providerName: 'Okta Production SAML' });
        expect(screen.getAllByText(/Okta Production SAML/).length).toBeGreaterThanOrEqual(1);
    });

    it('input placeholder shows provider name', () => {
        renderModal({ providerName: 'Okta SSO' });
        const input = screen.getByRole('textbox');
        expect(input).toHaveAttribute('placeholder', 'Okta SSO');
    });
});
