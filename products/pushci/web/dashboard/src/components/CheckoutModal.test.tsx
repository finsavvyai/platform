import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import CheckoutModal from './CheckoutModal';

const proPlan = {
  id: 'pro',
  name: 'Pro',
  price: '$9',
  period: '/mo',
  features: ['Unlimited repositories', 'AI diagnosis (100/mo)'],
  highlight: true,
};

function renderModal(overrides: Partial<React.ComponentProps<typeof CheckoutModal>> = {}) {
  const onConfirm = vi.fn();
  const onClose = vi.fn();
  const onPromoChange = vi.fn();
  render(
    <CheckoutModal
      plan={proPlan}
      promoCode=""
      onPromoChange={onPromoChange}
      onConfirm={onConfirm}
      onClose={onClose}
      {...overrides}
    />,
  );
  return { onConfirm, onClose, onPromoChange };
}

describe('CheckoutModal', () => {
  it('renders an accessible dialog with title and description', () => {
    renderModal();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby');
    expect(dialog).toHaveAttribute('aria-describedby');
    expect(screen.getByRole('heading', { name: /PushCI Pro/ })).toBeInTheDocument();
  });

  it('the close button exposes an accessible label', () => {
    renderModal();
    expect(screen.getByRole('button', { name: /close checkout dialog/i })).toBeInTheDocument();
  });

  it('Escape closes the modal when not pending', () => {
    const { onClose } = renderModal();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('Escape is ignored while pending so users cannot bail mid-checkout', () => {
    const { onClose } = renderModal({ pending: true });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('clicking the backdrop closes the modal when not pending', () => {
    const { onClose } = renderModal();
    const dialog = screen.getByRole('dialog');
    const backdrop = dialog.parentElement as HTMLElement;
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalled();
  });

  it('clicking the backdrop does NOT close the modal while pending', () => {
    const { onClose } = renderModal({ pending: true });
    const dialog = screen.getByRole('dialog');
    const backdrop = dialog.parentElement as HTMLElement;
    fireEvent.click(backdrop);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('sanitizes promo input (uppercase, alphanum-and-dash, capped at 32)', () => {
    const { onPromoChange } = renderModal();
    fireEvent.click(screen.getByRole('button', { name: /add promo code/i }));
    const input = screen.getByLabelText(/promo code/i) as HTMLInputElement;
    const messy = '  am-israel<>2026!!! and a very long suffix here please ';
    fireEvent.change(input, { target: { value: messy } });
    expect(input.value).toMatch(/^[A-Z0-9-]+$/);
    expect(input.value.length).toBeLessThanOrEqual(32);
    expect(onPromoChange).toHaveBeenLastCalledWith(input.value);
  });

  it('confirm button is disabled and aria-busy while pending', () => {
    renderModal({ pending: true });
    const btn = screen.getByRole('button', { name: /opening checkout/i });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('aria-busy', 'true');
  });

  it('confirm calls onConfirm with the current promo code', () => {
    const { onConfirm } = renderModal({ promoCode: 'INITIAL' });
    fireEvent.click(screen.getByRole('button', { name: /continue to payment/i }));
    expect(onConfirm).toHaveBeenCalledWith('INITIAL');
  });
});
