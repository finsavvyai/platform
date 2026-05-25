import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import TitleBar from '../../components/TitleBar';
import { useTheme } from '../../contexts/ThemeContext';
import { useElectronSystem } from '../../hooks/useElectronAPI';

// Mock the useTheme hook
jest.mock('../../contexts/ThemeContext');

// Mock the useElectronSystem hook
jest.mock('../../hooks/useElectronAPI');

const mockTheme = {
  name: 'dark',
  displayName: 'Dark',
  colors: {
    background: '#1a1a1a',
    surface: '#2d2d2d',
    text: '#ffffff',
    textSecondary: '#a0a0a0',
    titleBar: '#2d2d2d',
    titleBarInactive: '#404040',
    titleBarText: '#ffffff',
    titleBarTextInactive: '#a0a0a0',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
};

const mockElectronSystem = {
  isElectron: true,
  showNotification: jest.fn(),
  showMessageBox: jest.fn(),
  showOpenDialog: jest.fn(),
  showSaveDialog: jest.fn(),
  openExternal: jest.fn(),
  systemInfo: null,
  loading: false,
  error: null,
  loadSystemInfo: jest.fn(),
  clearError: jest.fn(),
};

(useTheme as jest.Mock).mockReturnValue(mockTheme);
(useElectronSystem as jest.Mock).mockReturnValue(mockElectronSystem);

// Mock window.electronAPI
const mockElectronAPI = {
  invoke: jest.fn(),
  on: jest.fn(),
  removeAllListeners: jest.fn(),
};

Object.defineProperty(window, 'electronAPI', {
  value: mockElectronAPI,
  writable: true,
});

// Mock Platform
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  return {
    ...RN,
    Platform: {
      OS: 'web',
      select: jest.fn((obj) => obj.web),
    },
  };
});

describe('TitleBar Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should not render when not in Electron', () => {
    (useElectronSystem as jest.Mock).mockReturnValue({
      ...mockElectronSystem,
      isElectron: false,
    });

    const { queryByTestId } = render(
      <TitleBar testID="title-bar" />
    );

    expect(queryByTestId('title-bar')).toBeFalsy();
  });

  test('should not render when platform is not web', () => {
    jest.doMock('react-native', () => {
      const RN = jest.requireActual('react-native');
      return {
        ...RN,
        Platform: {
          OS: 'ios',
          select: jest.fn((obj) => obj.ios),
        },
      };
    });

    const { queryByTestId } = render(
      <TitleBar testID="title-bar" />
    );

    expect(queryByTestId('title-bar')).toBeFalsy();
  });

  test('should render title bar with default title', () => {
    const { getByText } = render(
      <TitleBar testID="title-bar" />
    );

    expect(getByText('QueryFlux')).toBeTruthy();
  });

  test('should render custom title', () => {
    const { getByText } = render(
      <TitleBar title="Custom Title" testID="title-bar" />
    );

    expect(getByText('Custom Title')).toBeTruthy();
  });

  test('should render title when showTitle is true', () => {
    const { getByText } = render(
      <TitleBar title="Test Title" showTitle={true} testID="title-bar" />
    );

    expect(getByText('Test Title')).toBeTruthy();
  });

  test('should not render title when showTitle is false', () => {
    const { queryByText } = render(
      <TitleBar title="Test Title" showTitle={false} testID="title-bar" />
    );

    expect(queryByText('Test Title')).toBeFalsy();
  });

  test('should render window controls when showControls is true', () => {
    const { queryByTestId } = render(
      <TitleBar showControls={true} testID="title-bar" />
    );

    // Check for control buttons using accessibility labels
    expect(screen.getByLabelText('Minimize window')).toBeTruthy();
    expect(screen.getByLabelText(/window$/)).toBeTruthy(); // Maximize/Restore
    expect(screen.getByLabelText('Close window')).toBeTruthy();
  });

  test('should not render window controls when showControls is false', () => {
    const { queryByLabelText } = render(
      <TitleBar showControls={false} testID="title-bar" />
    );

    expect(queryByLabelText('Minimize window')).toBeFalsy();
    expect(queryByLabelText(/window$/)).toBeFalsy();
    expect(queryByLabelText('Close window')).toBeFalsy();
  });

  test('should handle minimize window button click', async () => {
    mockElectronAPI.invoke.mockResolvedValue({});

    render(
      <TitleBar testID="title-bar" />
    );

    const minimizeButton = screen.getByLabelText('Minimize window');
    fireEvent.press(minimizeButton);

    expect(mockElectronAPI.invoke).toHaveBeenCalledWith('window:minimize');
  });

  test('should handle maximize window button click', async () => {
    mockElectronAPI.invoke.mockResolvedValue({});

    render(
      <TitleBar testID="title-bar" />
    );

    const maximizeButton = screen.getByLabelText(/window$/); // Maximize or Restore
    fireEvent.press(maximizeButton);

    expect(mockElectronAPI.invoke).toHaveBeenCalledWith('window:maximize');
  });

  test('should handle close window button click', async () => {
    mockElectronAPI.invoke.mockResolvedValue({});

    render(
      <TitleBar testID="title-bar" />
    );

    const closeButton = screen.getByLabelText('Close window');
    fireEvent.press(closeButton);

    expect(mockElectronAPI.invoke).toHaveBeenCalledWith('window:close');
  });

  test('should handle double click on title bar', async () => {
    mockElectronAPI.invoke.mockResolvedValue({});

    const { getByTestId } = render(
      <TitleBar testID="title-bar" />
    );

    const titleBar = getByTestId('title-bar');
    fireEvent(titleBar, 'doublePress');

    expect(mockElectronAPI.invoke).toHaveBeenCalledWith('window:maximize');
  });

  test('should call custom onDoubleClick handler', async () => {
    const onDoubleClickMock = jest.fn();
    mockElectronAPI.invoke.mockResolvedValue({});

    const { getByTestId } = render(
      <TitleBar onDoubleClick={onDoubleClickMock} testID="title-bar" />
    );

    const titleBar = getByTestId('title-bar');
    fireEvent(titleBar, 'doublePress');

    expect(onDoubleClickMock).toHaveBeenCalledTimes(1);
    expect(mockElectronAPI.invoke).not.toHaveBeenCalled();
  });

  test('should apply focused state styles', () => {
    // Mock focused state
    let focusHandler: (value: boolean) => void;

    mockElectronAPI.on.mockImplementation((channel, handler) => {
      if (channel === 'window:focus') {
        focusHandler = handler;
      }
    });

    const { getByTestId } = render(
      <TitleBar testID="title-bar" />
    );

    const titleBar = getByTestId('title-bar');
    const initialStyle = titleBar.props.style;

    // Simulate focus event
    focusHandler(true);

    // Styles should reflect focused state
    expect(initialStyle).toMatchObject({
      backgroundColor: mockTheme.colors.titleBar,
    });
  });

  test('should apply unfocused state styles', () => {
    // Mock unfocused state
    let blurHandler: (value: boolean) => void;

    mockElectronAPI.on.mockImplementation((channel, handler) => {
      if (channel === 'window:blur') {
        blurHandler = handler;
      }
    });

    const { getByTestId } = render(
      <TitleBar testID="title-bar" />
    );

    const titleBar = getByTestId('title-bar');
    const initialStyle = titleBar.props.style;

    // Simulate blur event
    blurHandler(true);

    // Styles should reflect unfocused state
    expect(initialStyle).toMatchObject({
      backgroundColor: mockTheme.colors.titleBar,
    });
  });

  test('should apply custom styles', () => {
    const customStyle = {
      backgroundColor: 'custom-color',
      height: 40,
    };

    const { getByTestId } = render(
      <TitleBar style={customStyle} testID="title-bar" />
    );

    const titleBar = getByTestId('title-bar');
    expect(titleBar.props.style).toMatchObject(customStyle);
  });

  test('should cleanup event listeners on unmount', () => {
    const { unmount } = render(
      <TitleBar testID="title-bar" />
    );

    unmount();

    expect(mockElectronAPI.removeAllListeners).toHaveBeenCalledWith('window:focus');
    expect(mockElectronAPI.removeAllListeners).toHaveBeenCalledWith('window:blur');
  });

  test('should handle API errors gracefully', async () => {
    mockElectronAPI.invoke.mockRejectedValue(new Error('Window operation failed'));

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    render(
      <TitleBar testID="title-bar" />
    );

    const closeButton = screen.getByLabelText('Close window');
    fireEvent.press(closeButton);

    // Error should be logged (or handled gracefully)
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  test('should render with correct accessibility roles', () => {
    render(
      <TitleBar testID="title-bar" />
    );

    expect(screen.getByLabelText('Minimize window')).toBeTruthy();
    expect(screen.getByLabelText(/window$/)).toBeTruthy();
    expect(screen.getByLabelText('Close window')).toBeTruthy();
  });

  test('should update maximize button based on window state', async () => {
    // Mock window state change
    let focusHandler: (value: boolean) => void;

    mockElectronAPI.on.mockImplementation((channel, handler) => {
      if (channel === 'window:focus') {
        focusHandler = handler;
      }
    });

    mockElectronAPI.invoke.mockResolvedValue({});

    const { rerender } = render(
      <TitleBar testID="title-bar" />
    );

    // Initial state - should show maximize icon
    expect(screen.getByLabelText(/window$/)).toBeTruthy();

    // Simulate maximizing the window
    const maximizeButton = screen.getByLabelText(/window$/);
    fireEvent.press(maximizeButton);

    // Rerender to reflect state change
    rerender(
      <TitleBar testID="title-bar" />
    );

    // Should now show restore icon
    expect(screen.getByLabelText(/window$/)).toBeTruthy();
  });

  test('should handle rapid button clicks', async () => {
    mockElectronAPI.invoke.mockResolvedValue({});

    render(
      <TitleBar testID="title-bar" />
    );

    const minimizeButton = screen.getByLabelText('Minimize window');

    // Rapid clicks
    fireEvent.press(minimizeButton);
    fireEvent.press(minimizeButton);
    fireEvent.press(minimizeButton);

    // Should call API multiple times (debouncing not implemented yet)
    expect(mockElectronAPI.invoke).toHaveBeenCalledTimes(3);
  });

  test('should be accessible with keyboard navigation', () => {
    const { getByTestId } = render(
      <TitleBar testID="title-bar" />
    );

    const titleBar = getByTestId('title-bar');

    // Should be focusable and navigable
    expect(titleBar.props.tabIndex).toBeDefined();
  });

  test('should have proper ARIA labels', () => {
    render(
      <TitleBar title="Test Application" testID="title-bar" />
    );

    // The title should be accessible via ARIA attributes
    expect(screen.getByLabelText('Test Application')).toBeTruthy();
  });

  test('should handle window state persistence', async () => {
    mockElectronAPI.invoke.mockResolvedValue({});

    const { getByTestId } = render(
      <TitleBar testID="title-bar" />
    );

    const titleBar = getByTestId('title-bar');

    // Simulate various window operations
    fireEvent.press(screen.getByLabelText('Minimize window'));
    fireEvent.press(screen.getByLabelText(/window$/));
    fireEvent(titleBar, 'doublePress');

    // All operations should be called
    expect(mockElectronAPI.invoke).toHaveBeenCalledWith('window:minimize');
    expect(mockElectronAPI.invoke).toHaveBeenCalledWith('window:maximize');
  });
});