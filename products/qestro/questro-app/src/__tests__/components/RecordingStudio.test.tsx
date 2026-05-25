import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, Mock } from 'vitest';
import { RecordingStudio } from '../../pages/RecordingStudio';
import { QueryClient, QueryClientProvider } from 'react-query';
import { BrowserRouter } from 'react-router-dom';
import { toast } from 'react-hot-toast';

// Mock dependencies
vi.mock('react-hot-toast', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
}));

// Mock fetch globally
global.fetch = vi.fn();

const renderWithProviders = (component: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: { 
      queries: { retry: false },
      mutations: { retry: false }
    }
  });
  
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {component}
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('RecordingStudio', () => {
  const mockFetch = fetch as Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockClear();
  });

  describe('Initial Render', () => {
    it('should render recording studio components', () => {
      renderWithProviders(<RecordingStudio />);
      
      expect(screen.getByText('🎬 Recording Studio')).toBeInTheDocument();
      expect(screen.getByText('Capture user interactions and generate automated tests with AI-powered recording')).toBeInTheDocument();
      expect(screen.getByText('Recording Setup')).toBeInTheDocument();
      expect(screen.getByText('Platform Type')).toBeInTheDocument();
    });

    it('should show platform selection buttons', () => {
      renderWithProviders(<RecordingStudio />);
      
      const mobileButton = screen.getByRole('button', { name: /mobile/i });
      const webButton = screen.getByRole('button', { name: /web/i });
      
      expect(mobileButton).toBeInTheDocument();
      expect(webButton).toBeInTheDocument();
    });

    it('should show start recording button by default', () => {
      renderWithProviders(<RecordingStudio />);
      
      expect(screen.getByRole('button', { name: /start recording/i })).toBeInTheDocument();
    });

    it('should show live preview section', () => {
      renderWithProviders(<RecordingStudio />);
      
      expect(screen.getByText('Live Preview')).toBeInTheDocument();
    });
  });

  describe('Platform Selection', () => {
    it('should default to mobile platform', () => {
      renderWithProviders(<RecordingStudio />);
      
      const mobileButton = screen.getByRole('button', { name: /mobile/i });
      expect(mobileButton).toHaveClass('border-blue-500');
    });

    it('should switch to web platform when clicked', () => {
      renderWithProviders(<RecordingStudio />);
      
      const webButton = screen.getByRole('button', { name: /web/i });
      fireEvent.click(webButton);
      
      expect(webButton).toHaveClass('border-blue-500');
    });

    it('should update preview when platform changes', () => {
      renderWithProviders(<RecordingStudio />);
      
      // Default mobile preview
      expect(screen.getByText('Connect your device to start recording')).toBeInTheDocument();
      
      // Switch to web
      const webButton = screen.getByRole('button', { name: /web/i });
      fireEvent.click(webButton);
      
      expect(screen.getByText('Open your browser to start recording')).toBeInTheDocument();
    });
  });

  describe('Recording Workflow', () => {
    it('should start recording when button is clicked', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          session: { 
            id: 'test-session-123',
            type: 'mobile',
            status: 'recording',
            startTime: new Date().toISOString(),
            metadata: {
              deviceName: 'iPhone 15 Pro'
            }
          }
        })
      } as Response);

      renderWithProviders(<RecordingStudio />);
      
      const startButton = screen.getByRole('button', { name: /start recording/i });
      fireEvent.click(startButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/recording/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'mobile',
            platform: 'ios',
            metadata: {
              deviceName: 'iPhone 15 Pro',
              appId: 'com.testapp.example'
            }
          })
        });
      });

      expect(toast.success).toHaveBeenCalledWith('🎬 Mobile recording started!');
    });

    it('should show stop recording button when recording is active', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          session: { 
            id: 'test-session-123',
            status: 'recording'
          }
        })
      } as Response);

      renderWithProviders(<RecordingStudio />);
      
      const startButton = screen.getByRole('button', { name: /start recording/i });
      fireEvent.click(startButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /stop recording/i })).toBeInTheDocument();
      });
    });

    it('should stop recording when stop button is clicked', async () => {
      // Start recording first
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          session: { 
            id: 'test-session-123',
            status: 'recording'
          }
        })
      } as Response);

      renderWithProviders(<RecordingStudio />);
      
      const startButton = screen.getByRole('button', { name: /start recording/i });
      fireEvent.click(startButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /stop recording/i })).toBeInTheDocument();
      });

      // Stop recording
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          session: { 
            id: 'test-session-123',
            status: 'completed',
            duration: 30,
            actions: [
              { id: '1', type: 'tap', timestamp: Date.now() }
            ]
          }
        })
      } as Response);

      const stopButton = screen.getByRole('button', { name: /stop recording/i });
      fireEvent.click(stopButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/recording/stop', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: 'test-session-123' })
        });
      });

      expect(toast.success).toHaveBeenCalledWith('🎉 Recording completed and saved!');
    });

    it('should show export button when recording is completed', async () => {
      // Start and complete recording
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            session: { id: 'test-session-123', status: 'recording' }
          })
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            session: { 
              id: 'test-session-123',
              status: 'completed',
              actions: [{ id: '1', type: 'tap', timestamp: Date.now() }]
            }
          })
        } as Response);

      renderWithProviders(<RecordingStudio />);
      
      // Start recording
      const startButton = screen.getByRole('button', { name: /start recording/i });
      fireEvent.click(startButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /stop recording/i })).toBeInTheDocument();
      });

      // Stop recording
      const stopButton = screen.getByRole('button', { name: /stop recording/i });
      fireEvent.click(stopButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /export test/i })).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should show error toast when recording start fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500
      } as Response);

      renderWithProviders(<RecordingStudio />);
      
      const startButton = screen.getByRole('button', { name: /start recording/i });
      fireEvent.click(startButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to start recording');
      });
    });

    it('should show error toast when recording stop fails', async () => {
      // Start recording successfully
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          session: { id: 'test-session-123', status: 'recording' }
        })
      } as Response);

      renderWithProviders(<RecordingStudio />);
      
      const startButton = screen.getByRole('button', { name: /start recording/i });
      fireEvent.click(startButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /stop recording/i })).toBeInTheDocument();
      });

      // Fail to stop recording
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500
      } as Response);

      const stopButton = screen.getByRole('button', { name: /stop recording/i });
      fireEvent.click(stopButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to stop recording');
      });
    });
  });

  describe('Recording Status Display', () => {
    it('should show ready status by default', () => {
      renderWithProviders(<RecordingStudio />);
      
      expect(screen.getByText('Ready')).toBeInTheDocument();
    });

    it('should show recording status with animation', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          session: { 
            id: 'test-session-123',
            status: 'recording'
          }
        })
      } as Response);

      renderWithProviders(<RecordingStudio />);
      
      const startButton = screen.getByRole('button', { name: /start recording/i });
      fireEvent.click(startButton);

      await waitFor(() => {
        expect(screen.getByText('recording')).toBeInTheDocument();
      });
    });

    it('should show processing status', async () => {
      // Start recording
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          session: { id: 'test-session-123', status: 'recording' }
        })
      } as Response);

      renderWithProviders(<RecordingStudio />);
      
      const startButton = screen.getByRole('button', { name: /start recording/i });
      fireEvent.click(startButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /stop recording/i })).toBeInTheDocument();
      });

      // Stop and show processing
      mockFetch.mockImplementationOnce(() => 
        new Promise(resolve => {
          setTimeout(() => {
            resolve({
              ok: true,
              json: async () => ({
                success: true,
                session: { status: 'completed' }
              })
            } as Response);
          }, 100);
        })
      );

      const stopButton = screen.getByRole('button', { name: /stop recording/i });
      fireEvent.click(stopButton);

      // Should show processing state
      expect(screen.getByText('processing')).toBeInTheDocument();
    });
  });

  describe('Session Statistics', () => {
    it('should display session stats when recording is active', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          session: { 
            id: 'test-session-123',
            status: 'recording',
            actions: [
              { id: '1', type: 'tap', timestamp: Date.now() },
              { id: '2', type: 'type', timestamp: Date.now() }
            ]
          }
        })
      } as Response);

      renderWithProviders(<RecordingStudio />);
      
      const startButton = screen.getByRole('button', { name: /start recording/i });
      fireEvent.click(startButton);

      await waitFor(() => {
        expect(screen.getByText('Session Stats')).toBeInTheDocument();
        expect(screen.getByText('2')).toBeInTheDocument(); // Actions count
        expect(screen.getByText('mobile')).toBeInTheDocument(); // Platform
      });
    });
  });

  describe('Web Recording Configuration', () => {
    it('should configure web recording with URL and viewport', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          session: { 
            id: 'test-session-123',
            type: 'web',
            status: 'recording'
          }
        })
      } as Response);

      renderWithProviders(<RecordingStudio />);
      
      // Switch to web platform
      const webButton = screen.getByRole('button', { name: /web/i });
      fireEvent.click(webButton);

      // Start recording
      const startButton = screen.getByRole('button', { name: /start recording/i });
      fireEvent.click(startButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/recording/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'web',
            platform: 'chrome',
            metadata: {
              deviceName: 'Chrome Desktop',
              url: 'https://example.com',
              viewport: { width: 1920, height: 1080 }
            }
          })
        });
      });

      expect(toast.success).toHaveBeenCalledWith('🎬 Web recording started!');
    });
  });

  describe('Action Timeline', () => {
    it('should display recorded actions timeline', async () => {
      // Start recording
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          session: { 
            id: 'test-session-123',
            status: 'recording',
            actions: []
          }
        })
      } as Response);

      renderWithProviders(<RecordingStudio />);
      
      const startButton = screen.getByRole('button', { name: /start recording/i });
      fireEvent.click(startButton);

      // Stop recording with actions
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          session: { 
            id: 'test-session-123',
            status: 'completed',
            actions: [
              {
                id: '1',
                type: 'tap',
                timestamp: Date.now(),
                coordinates: { x: 100, y: 200 },
                element: 'Login Button'
              },
              {
                id: '2',
                type: 'type',
                timestamp: Date.now(),
                text: 'username@example.com',
                element: 'Email Input'
              }
            ]
          }
        })
      } as Response);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /stop recording/i })).toBeInTheDocument();
      });

      const stopButton = screen.getByRole('button', { name: /stop recording/i });
      fireEvent.click(stopButton);

      await waitFor(() => {
        expect(screen.getByText('Recorded Actions')).toBeInTheDocument();
        expect(screen.getByText('Tap')).toBeInTheDocument();
        expect(screen.getByText('Type')).toBeInTheDocument();
        expect(screen.getByText('on Login Button')).toBeInTheDocument();
        expect(screen.getByText('"username@example.com"')).toBeInTheDocument();
      });
    });
  });
});