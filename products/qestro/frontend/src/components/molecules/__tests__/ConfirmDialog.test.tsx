import { describe, it, expect, vi } from 'vitest';
import '../../../test/extend-expect';
import { render, screen, fireEvent } from '@testing-library/react';
import ConfirmDialog from '../ConfirmDialog';

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  onConfirm: vi.fn(),
  title: 'Delete Item',
  message: 'Are you sure you want to delete this?',
};

describe('ConfirmDialog', () => {
  it('renders title and message when open', () => {
    render(<ConfirmDialog {...defaultProps} />);
    expect(screen.getByText('Delete Item')).toBeTruthy();
    expect(screen.getByText('Are you sure you want to delete this?')).toBeTruthy();
  });

  it('does not render when closed', () => {
    render(<ConfirmDialog {...defaultProps} isOpen={false} />);
    expect(screen.queryByText('Delete Item')).toBeNull();
  });

  it('calls onConfirm and onClose on confirm click', () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    render(<ConfirmDialog {...defaultProps} onConfirm={onConfirm} onClose={onClose} />);
    fireEvent.click(screen.getByText('Confirm'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose on cancel click', () => {
    const onClose = vi.fn();
    render(<ConfirmDialog {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders custom button labels', () => {
    render(<ConfirmDialog {...defaultProps} confirmLabel="Yes, delete" cancelLabel="No, keep" />);
    expect(screen.getByText('Yes, delete')).toBeTruthy();
    expect(screen.getByText('No, keep')).toBeTruthy();
  });

  it('calls onClose when clicking backdrop', () => {
    const onClose = vi.fn();
    const { container } = render(<ConfirmDialog {...defaultProps} onClose={onClose} />);
    const backdrop = container.querySelector('[class*="bg-black"]') as HTMLElement;
    if (backdrop) fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalled();
  });

  it('has dialog role with aria attributes', () => {
    render(<ConfirmDialog {...defaultProps} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-labelledby')).toBe('confirm-title');
  });
});
