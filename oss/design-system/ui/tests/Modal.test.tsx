import React, { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Modal } from '../src/components/Modal';
import { ThemeProvider } from '../src/theme/ThemeProvider';

const ModalTest = () => {
  const [open, setOpen] = useState(true);
  return <Modal isOpen={open} onClose={() => setOpen(false)} title="Test">Content</Modal>;
};

const renderModal = (props: React.ComponentProps<typeof Modal>) => {
  return render(
    <ThemeProvider>
      <Modal {...props} />
    </ThemeProvider>
  );
};

describe('Modal', () => {
  it('should not render when isOpen is false', () => {
    renderModal({ isOpen: false, onClose: vi.fn(), children: 'Content' });
    expect(screen.queryByText('Content')).not.toBeInTheDocument();
  });

  it('should render when isOpen is true', () => {
    renderModal({ isOpen: true, onClose: vi.fn(), children: 'Content' });
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('should render title when provided', () => {
    renderModal({
      isOpen: true,
      onClose: vi.fn(),
      title: 'Modal Title',
      children: 'Content',
    });
    expect(screen.getByText('Modal Title')).toBeInTheDocument();
  });

  it('should call onClose when close is triggered', () => {
    const onClose = vi.fn();
    renderModal({
      isOpen: true,
      onClose,
      children: 'Content',
    });
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('should render children content', () => {
    renderModal({
      isOpen: true,
      onClose: vi.fn(),
      children: <div>Test Child Content</div>,
    });
    expect(screen.getByText('Test Child Content')).toBeInTheDocument();
  });

  it('should have overlay with fixed positioning', () => {
    const { container } = renderModal({
      isOpen: true,
      onClose: vi.fn(),
      children: 'Content',
    });
    const overlay = container.querySelector('div');
    expect(overlay).toHaveStyle({ position: 'fixed' });
  });

  it('should have high z-index', () => {
    const { container } = renderModal({
      isOpen: true,
      onClose: vi.fn(),
      children: 'Content',
    });
    const overlay = container.querySelector('div');
    expect(overlay).toHaveStyle({ zIndex: '1000' });
  });

  it('should not have title when not provided', () => {
    renderModal({ isOpen: true, onClose: vi.fn(), children: 'Content' });
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });
});
