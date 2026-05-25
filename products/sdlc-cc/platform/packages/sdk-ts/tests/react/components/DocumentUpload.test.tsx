// Tests for DocumentUpload component

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DocumentUpload } from '../../src/react/components/DocumentUpload';
import { SDLCProvider } from '../../src/react/providers/SDLCProvider';
import { BaseClient } from '../../src/client/base';

// Mock dependencies
jest.mock('../../src/client/base');
jest.mock('../../src/react/hooks/useDocuments', () => ({
  useDocuments: () => ({
    uploadDocument: jest.fn()
  })
}));

const mockedBaseClient = BaseClient as jest.MockedClass<typeof BaseClient>;

describe('DocumentUpload', () => {
  let wrapper: React.FC<{ children: React.ReactNode }>;

  beforeEach(() => {
    wrapper = ({ children }) => (
      <SDLCProvider config={{ baseURL: 'https://api.test.com' }}>
        {children}
      </SDLCProvider>
    );
  });

  it('renders upload area', () => {
    render(
      <DocumentUpload />,
      { wrapper }
    );

    expect(screen.getByText(/Drop a file here, or click to select/)).toBeInTheDocument();
    expect(screen.getByText(/application\/pdf/)).toBeInTheDocument();
  });

  it('opens file dialog on click', () => {
    render(
      <DocumentUpload />,
      { wrapper }
    );

    const uploadArea = screen.getByText(/Drop a file here/);
    const fileInput = screen.getByRole('button').querySelector('input[type="file"]');

    fireEvent.click(uploadArea);

    expect(fileInput).toBeInTheDocument();
  });

  it('accepts custom children', () => {
    render(
      <DocumentUpload>
        <button>Custom Upload Button</button>
      </DocumentUpload>,
      { wrapper }
    );

    expect(screen.getByText('Custom Upload Button')).toBeInTheDocument();
  });

  it('shows drag state when dragging over', () => {
    render(
      <DocumentUpload />,
      { wrapper }
    );

    const uploadArea = screen.getByText(/Drop a file here/);

    fireEvent.dragEnter(uploadArea);
    expect(uploadArea.parentElement).toHaveClass('border-blue-500');

    fireEvent.dragLeave(uploadArea);
    expect(uploadArea.parentElement).not.toHaveClass('border-blue-500');
  });

  it('handles file drop', async () => {
    const onUploadComplete = jest.fn();
    const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' });

    render(
      <DocumentUpload onUploadComplete={onUploadComplete} />,
      { wrapper }
    );

    const uploadArea = screen.getByText(/Drop a file here/);

    fireEvent.drop(uploadArea, {
      dataTransfer: {
        files: [file]
      }
    });

    // Wait for async upload
    await waitFor(() => {
      expect(onUploadComplete).toHaveBeenCalled();
    });
  });

  it('validates file type', async () => {
    const onUploadError = jest.fn();
    const file = new File(['test'], 'test.exe', { type: 'application/octet-stream' });

    render(
      <DocumentUpload onUploadError={onUploadError} />,
      { wrapper }
    );

    const uploadArea = screen.getByText(/Drop a file here/);

    fireEvent.drop(uploadArea, {
      dataTransfer: {
        files: [file]
      }
    });

    await waitFor(() => {
      expect(onUploadError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('not supported')
        })
      );
    });
  });
});
