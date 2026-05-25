import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConnectionDialog } from '../src/components/ConnectionDialog';
import { mockElectronAPI } from '../setup';

// Mock electron API
jest.mock('../preload', () => ({
  electronAPI: mockElectronAPI,
}));

describe('ConnectionDialog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockOnClose = jest.fn();
  const mockOnSave = jest.fn();

  const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
    onSave: mockOnSave,
  };

  test('renders connection dialog', () => {
    render(<ConnectionDialog {...defaultProps} />);

    expect(screen.getByText(/New Connection/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Connection Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Database Type/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Host/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Port/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Database/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Password/i)).toBeInTheDocument();
  });

  test('closes dialog when cancel button is clicked', async () => {
    const user = userEvent.setup();
    render(<ConnectionDialog {...defaultProps} />);

    const cancelButton = screen.getByText(/Cancel/i);
    await user.click(cancelButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  test('submits form with valid data', async () => {
    const user = userEvent.setup();
    mockElectronAPI.createConnection.mockResolvedValue('test-connection-id');

    render(<ConnectionDialog {...defaultProps} />);

    // Fill out the form
    await user.type(screen.getByLabelText(/Connection Name/i), 'Test Connection');
    await user.selectOptions(screen.getByLabelText(/Database Type/i), 'PostgreSQL');
    await user.type(screen.getByLabelText(/Host/i), 'localhost');
    await user.type(screen.getByLabelText(/Port/i), '5432');
    await user.type(screen.getByLabelText(/Database/i), 'test_db');
    await user.type(screen.getByLabelText(/Username/i), 'test_user');
    await user.type(screen.getByLabelText(/Password/i), 'test_password');

    // Submit the form
    const saveButton = screen.getByText(/Save Connection/i);
    await user.click(saveButton);

    await waitFor(() => {
      expect(mockElectronAPI.createConnection).toHaveBeenCalledWith({
        name: 'Test Connection',
        type: 'postgresql',
        host: 'localhost',
        port: 5432,
        database: 'test_db',
        username: 'test_user',
        password: 'test_password',
        sslMode: 'prefer',
        timeout: 30,
      });
    });

    expect(mockOnSave).toHaveBeenCalledWith('test-connection-id');
  });

  test('shows error message when connection creation fails', async () => {
    const user = userEvent.setup();
    const errorMessage = 'Connection failed';
    mockElectronAPI.createConnection.mockRejectedValue(new Error(errorMessage));

    render(<ConnectionDialog {...defaultProps} />);

    // Fill out form minimally
    await user.type(screen.getByLabelText(/Connection Name/i), 'Test Connection');
    await user.type(screen.getByLabelText(/Host/i), 'localhost');
    await user.type(screen.getByLabelText(/Port/i), '5432');

    // Submit the form
    const saveButton = screen.getByText(/Save Connection/i);
    await user.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });

  test('validates required fields', async () => {
    const user = userEvent.setup();
    render(<ConnectionDialog {...defaultProps} />);

    // Try to submit without filling required fields
    const saveButton = screen.getByText(/Save Connection/i);
    await user.click(saveButton);

    // Should show validation errors
    await waitFor(() => {
      expect(screen.getByText(/Connection name is required/i)).toBeInTheDocument();
      expect(screen.getByText(/Host is required/i)).toBeInTheDocument();
      expect(screen.getByText(/Port is required/i)).toBeInTheDocument();
    });
  });

  test('validates port number', async () => {
    const user = userEvent.setup();
    render(<ConnectionDialog {...defaultProps} />);

    // Fill form with invalid port
    await user.type(screen.getByLabelText(/Connection Name/i), 'Test Connection');
    await user.type(screen.getByLabelText(/Host/i), 'localhost');
    await user.type(screen.getByLabelText(/Port/i), 'invalid-port');

    // Submit the form
    const saveButton = screen.getByText(/Save Connection/i);
    await user.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText(/Port must be a valid number/i)).toBeInTheDocument();
    });
  });

  test('shows different fields based on database type', async () => {
    const user = userEvent.setup();
    render(<ConnectionDialog {...defaultProps} />);

    // Select MongoDB (NoSQL database)
    await user.selectOptions(screen.getByLabelText(/Database Type/i), 'MongoDB');

    // MongoDB-specific fields should appear
    expect(screen.getByLabelText(/Authentication Database/i)).toBeInTheDocument();

    // SQL-specific fields should disappear
    expect(screen.queryByLabelText(/Database/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/SSL Mode/i)).not.toBeInTheDocument();
  });

  test('supports editing existing connection', async () => {
    const existingConnection = {
      id: 'test-connection-id',
      name: 'Existing Connection',
      type: 'postgresql' as const,
      host: 'example.com',
      port: 5432,
      database: 'existing_db',
      username: 'existing_user',
      sslMode: 'require' as const,
      timeout: 60,
    };

    render(
      <ConnectionDialog
        {...defaultProps}
        connection={existingConnection}
      />
    );

    // Form should be pre-filled with existing data
    expect(screen.getByDisplayValue('Existing Connection')).toBeInTheDocument();
    expect(screen.getByDisplayValue('example.com')).toBeInTheDocument();
    expect(screen.getByDisplayValue('5432')).toBeInTheDocument();
    expect(screen.getByDisplayValue('existing_db')).toBeInTheDocument();
    expect(screen.getByDisplayValue('existing_user')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Require')).toBeInTheDocument();
  });

  test('test connection functionality works', async () => {
    const user = userEvent.setup();
    mockElectronAPI.testConnection.mockResolvedValue(true);

    render(<ConnectionDialog {...defaultProps} />);

    // Fill out form
    await user.type(screen.getByLabelText(/Connection Name/i), 'Test Connection');
    await user.type(screen.getByLabelText(/Host/i), 'localhost');
    await user.type(screen.getByLabelText(/Port/i), '5432');

    // Click test button
    const testButton = screen.getByText(/Test Connection/i);
    await user.click(testButton);

    await waitFor(() => {
      expect(mockElectronAPI.testConnection).toHaveBeenCalled();
    });

    // Should show success message
    expect(screen.getByText(/Connection successful/i)).toBeInTheDocument();
  });

  test('handles connection test failure', async () => {
    const user = userEvent.setup();
    mockElectronAPI.testConnection.mockRejectedValue(new Error('Connection failed'));

    render(<ConnectionDialog {...defaultProps} />);

    // Fill out form
    await user.type(screen.getByLabelText(/Connection Name/i), 'Test Connection');
    await user.type(screen.getByLabelText(/Host/i), 'localhost');
    await user.type(screen.getByLabelText(/Port/i), '5432');

    // Click test button
    const testButton = screen.getByText(/Test Connection/i);
    await user.click(testButton);

    await waitFor(() => {
      expect(screen.getByText(/Connection failed/i)).toBeInTheDocument();
    });
  });

  test('password field shows/hides password', async () => {
    render(<ConnectionDialog {...defaultProps} />);

    const passwordInput = screen.getByLabelText(/Password/i) as HTMLInputElement;
    const toggleButton = screen.getByRole('button', { name: /toggle password visibility/i });

    // Initially should be hidden
    expect(passwordInput.type).toBe('password');

    // Click toggle button
    fireEvent.click(toggleButton);
    expect(passwordInput.type).toBe('text');

    // Click again to hide
    fireEvent.click(toggleButton);
    expect(passwordInput.type).toBe('password');
  });

  test('form is disabled during submission', async () => {
    const user = userEvent.setup();
    // Mock a slow promise to simulate submission
    mockElectronAPI.createConnection.mockImplementation(() =>
      new Promise(resolve => setTimeout(resolve, 1000))
    );

    render(<ConnectionDialog {...defaultProps} />);

    // Fill out form
    await user.type(screen.getByLabelText(/Connection Name/i), 'Test Connection');
    await user.type(screen.getByLabelText(/Host/i), 'localhost');
    await user.type(screen.getByLabelText(/Port/i), '5432');

    // Submit form
    const saveButton = screen.getByText(/Save Connection/i);
    await user.click(saveButton);

    // Form should be disabled during submission
    expect(screen.getByLabelText(/Connection Name/i)).toBeDisabled();
    expect(screen.getByLabelText(/Host/i)).toBeDisabled();
    expect(screen.getByLabelText(/Port/i)).toBeDisabled();
    expect(saveButton).toBeDisabled();
  });
});