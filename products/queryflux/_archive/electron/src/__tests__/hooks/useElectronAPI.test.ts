import { renderHook, act } from '@testing-library/react-native';
import { useElectronAPI, useElectronDatabase, useElectronSecureStorage, useElectronMenu, useElectronSystem, useElectronIPC, useElectronUpdater } from '../../hooks/useElectronAPI';

// Mock the window.electronAPI
const mockElectronAPI = {
  invoke: jest.fn(),
  on: jest.fn(),
  removeAllListeners: jest.fn(),
};

// Mock window object
Object.defineProperty(window, 'electronAPI', {
  value: mockElectronAPI,
  writable: true,
});

describe('useElectron Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should detect Electron environment', () => {
    mockElectronAPI.invoke.mockResolvedValue({
      version: '13.0.0',
      platform: 'darwin',
    });

    const { result } = renderHook(() => useElectron());

    expect(result.current.isElectron).toBe(true);
    expect(result.current.electronVersion).toBe('13.0.0');
    expect(result.current.platform).toBe('darwin');
  });

  test('should handle missing Electron API', () => {
    // @ts-ignore
    delete window.electronAPI;

    const { result } = renderHook(() => useElectron());

    expect(result.current.isElectron).toBe(false);
    expect(result.current.electronVersion).toBeNull();
    expect(result.current.platform).toBeNull();

    // Restore window.electronAPI
    window.electronAPI = mockElectronAPI;
  });

  test('should handle API errors gracefully', () => {
    mockElectronAPI.invoke.mockRejectedValue(new Error('API Error'));

    const { result } = renderHook(() => useElectron());

    expect(result.current.isElectron).toBe(true);
    expect(result.current.electronVersion).toBeNull();
    expect(result.current.platform).toBeNull();
  });
});

describe('useElectronDatabase Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should create connection successfully', async () => {
    const mockConnection = {
      id: 'conn-123',
      name: 'Test Connection',
      type: 'postgresql',
    };

    mockElectronAPI.invoke.mockResolvedValue({
      success: true,
      data: mockConnection,
    });

    const { result } = renderHook(() => useElectronDatabase());

    let connectionResult;
    await act(async () => {
      connectionResult = await result.current.createConnection({
        name: 'Test Connection',
        type: 'postgresql',
        host: 'localhost',
        port: 5432,
        database: 'testdb',
        username: 'user',
        password: 'password',
      });
    });

    expect(connectionResult).toEqual(mockConnection);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  test('should handle connection creation failure', async () => {
    mockElectronAPI.invoke.mockResolvedValue({
      success: false,
      error: 'Connection already exists',
    });

    const { result } = renderHook(() => useElectronDatabase());

    await act(async () => {
      await result.current.createConnection({
        name: 'Test Connection',
        type: 'postgresql',
        host: 'localhost',
        port: 5432,
        database: 'testdb',
        username: 'user',
        password: 'password',
      });
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe('Connection already exists');
  });

  test('should test connection successfully', async () => {
    mockElectronAPI.invoke.mockResolvedValue({
      success: true,
      data: { success: true, message: 'Connected successfully' },
    });

    const { result } = renderHook(() => useElectronDatabase());

    let testResult;
    await act(async () => {
      testResult = await result.current.testConnection({
        type: 'postgresql',
        host: 'localhost',
        port: 5432,
        database: 'testdb',
        username: 'user',
        password: 'password',
      });
    });

    expect(testResult).toEqual({ success: true, message: 'Connected successfully' });
  });

  test('should execute query successfully', async () => {
    const mockQueryResult = {
      columns: ['id', 'name'],
      rows: [[1, 'John'], [2, 'Jane']],
      rowCount: 2,
    };

    mockElectronAPI.invoke.mockResolvedValue({
      success: true,
      data: mockQueryResult,
    });

    const { result } = renderHook(() => useElectronDatabase());

    let queryResult;
    await act(async () => {
      queryResult = await result.current.executeQuery('conn-123', 'SELECT * FROM users');
    });

    expect(queryResult).toEqual(mockQueryResult);
  });

  test('should handle non-Electron environment', async () => {
    // @ts-ignore
    delete window.electronAPI;

    const { result } = renderHook(() => useElectronDatabase());

    let connectionResult;
    await act(async () => {
      connectionResult = await result.current.createConnection({
        name: 'Test Connection',
        type: 'postgresql',
        host: 'localhost',
        port: 5432,
        database: 'testdb',
        username: 'user',
        password: 'password',
      });
    });

    expect(connectionResult).toBeNull();
    expect(result.current.error).toBe('Not running in Electron environment');

    // Restore window.electronAPI
    window.electronAPI = mockElectronAPI;
  });

  test('should clear error', () => {
    mockElectronAPI.invoke.mockRejectedValue(new Error('API Error'));

    const { result } = renderHook(() => useElectronDatabase());

    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBeNull();
  });
});

describe('useElectronSecureStorage Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should store data with encryption', async () => {
    mockElectronAPI.invoke.mockResolvedValue({
      success: true,
      data: true,
    });

    const { result } = renderHook(() => useElectronSecureStorage());

    let storeResult;
    await act(async () => {
      storeResult = await result.current.store('test-key', { secret: 'data' }, true);
    });

    expect(storeResult).toBe(true);
    expect(mockElectronAPI.invoke).toHaveBeenCalledWith('storage:store', {
      key: 'test-key',
      data: { secret: 'data' },
      encrypt: true,
    });
  });

  test('should retrieve encrypted data', async () => {
    const mockData = { secret: 'decrypted-data' };

    mockElectronAPI.invoke.mockResolvedValue({
      success: true,
      data: mockData,
    });

    const { result } = renderHook(() => useElectronSecureStorage());

    let retrieveResult;
    await act(async () => {
      retrieveResult = await result.current.retrieve('test-key');
    });

    expect(retrieveResult).toEqual(mockData);
  });

  test('should store API key securely', async () => {
    const apiKey = {
      service: 'openai',
      key: 'sk-1234567890',
      description: 'OpenAI API Key',
    };

    mockElectronAPI.invoke.mockResolvedValue({
      success: true,
      data: true,
    });

    const { result } = renderHook(() => useElectronSecureStorage());

    let storeResult;
    await act(async () => {
      storeResult = await result.current.storeApiKey(apiKey);
    });

    expect(storeResult).toBe(true);
    expect(mockElectronAPI.invoke).toHaveBeenCalledWith('storage:storeApiKey', apiKey);
  });
});

describe('useElectronMenu Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should get menu structure', async () => {
    const mockMenu = {
      items: [{ label: 'File', submenu: [{ label: 'New' }] }],
      template: [{ label: 'File', submenu: [{ label: 'New' }] }],
    };

    mockElectronAPI.invoke.mockResolvedValue({
      success: true,
      data: mockMenu,
    });

    const { result } = renderHook(() => useElectronMenu());

    let menuResult;
    await act(async () => {
      menuResult = await result.current.getMenu();
    });

    expect(menuResult).toEqual(mockMenu);
  });

  test('should set menu template', async () => {
    const template = [{ label: 'Test', submenu: [{ label: 'Test Item' }] }];

    mockElectronAPI.invoke.mockResolvedValue({
      success: true,
      data: true,
    });

    const { result } = renderHook(() => useElectronMenu());

    let setResult;
    await act(async () => {
      setResult = await result.current.setMenu(template);
    });

    expect(setResult).toBe(true);
    expect(mockElectronAPI.invoke).toHaveBeenCalledWith('menu:set', template);
  });

  test('should enable menu item', async () => {
    mockElectronAPI.invoke.mockResolvedValue({
      success: true,
      data: true,
    });

    const { result } = renderHook(() => useElectronMenu());

    let enableResult;
    await act(async () => {
      enableResult = await result.current.enableItem(['File', 'New'], true);
    });

    expect(enableResult).toBe(true);
    expect(mockElectronAPI.invoke).toHaveBeenCalledWith('menu:enableItem', {
      menuPath: ['File', 'New'],
      enabled: true,
    });
  });
});

describe('useElectronSystem Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should load system info on mount', async () => {
    const mockSystemInfo = {
      platform: 'darwin',
      version: '13.0.0',
      arch: 'x64',
    };

    mockElectronAPI.invoke.mockResolvedValue(mockSystemInfo);

    const { result } = renderHook(() => useElectronSystem());

    await act(async () => {
      // Wait for useEffect to complete
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(result.current.systemInfo).toEqual(mockSystemInfo);
    expect(mockElectronAPI.invoke).toHaveBeenCalledWith('system:getInfo');
  });

  test('should show notification', async () => {
    mockElectronAPI.invoke.mockResolvedValue({
      success: true,
      data: true,
    });

    const { result } = renderHook(() => useElectronSystem());

    let notificationResult;
    await act(async () => {
      notificationResult = await result.current.showNotification({
        title: 'Test Notification',
        body: 'This is a test',
      });
    });

    expect(notificationResult).toBe(true);
    expect(mockElectronAPI.invoke).toHaveBeenCalledWith('system:showNotification', {
      title: 'Test Notification',
      body: 'This is a test',
    });
  });

  test('should show message box', async () => {
    const mockResult = { response: 0, checkboxChecked: false };

    mockElectronAPI.invoke.mockResolvedValue({
      success: true,
      data: mockResult,
    });

    const { result } = renderHook(() => useElectronSystem());

    let messageBoxResult;
    await act(async () => {
      messageBoxResult = await result.current.showMessageBox({
        type: 'info',
        title: 'Test',
        message: 'Test message',
        buttons: ['OK'],
      });
    });

    expect(messageBoxResult).toEqual(mockResult);
  });

  test('should show open dialog', async () => {
    const mockResult = { filePaths: ['/path/to/file.txt'], canceled: false };

    mockElectronAPI.invoke.mockResolvedValue({
      success: true,
      data: mockResult,
    });

    const { result } = renderHook(() => useElectronSystem());

    let dialogResult;
    await act(async () => {
      dialogResult = await result.current.showOpenDialog({
        properties: ['openFile'],
      });
    });

    expect(dialogResult).toEqual(mockResult);
  });
});

describe('useElectronIPC Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should register and receive IPC messages', () => {
    const mockCallback = jest.fn();
    const mockData = ['test-data', { type: 'message' }];

    mockElectronAPI.on.mockImplementation((channel, callback) => {
      // Simulate receiving data
      setTimeout(() => callback(...mockData), 10);
    });

    const { result } = renderHook(() => useElectronIPC('test-channel', mockCallback));

    // Wait for async operation
    act(() => {
      expect(mockElectronAPI.on).toHaveBeenCalledWith('test-channel', expect.any(Function));
    });

    // Wait for callback to be called
    setTimeout(() => {
      expect(result.current.data).toEqual(mockData);
      expect(mockCallback).toHaveBeenCalledWith(...mockData);
    }, 20);
  });

  test('should send IPC messages', () => {
    const { result } = renderHook(() => useElectronIPC('test-channel'));

    act(() => {
      const sendResult = result.current.send('test-message', { data: 123 });
      expect(sendResult).toBe(true);
      expect(mockElectronAPI.invoke).toHaveBeenCalledWith('test-channel', 'test-message', { data: 123 });
    });
  });

  test('should cleanup listeners on unmount', () => {
    const { unmount } = renderHook(() => useElectronIPC('test-channel'));

    unmount();

    expect(mockElectronAPI.removeAllListeners).toHaveBeenCalledWith('test-channel');
  });
});

describe('useElectronUpdater Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should check for updates', async () => {
    const mockUpdateInfo = {
      version: '1.1.0',
      releaseDate: '2024-01-01',
      releaseNotes: 'Bug fixes and improvements',
    };

    mockElectronAPI.invoke.mockResolvedValue({
      success: true,
      updateAvailable: true,
      updateInfo: mockUpdateInfo,
    });

    const { result } = renderHook(() => useElectronUpdater());

    let checkResult;
    await act(async () => {
      checkResult = await result.current.checkForUpdates();
    });

    expect(checkResult).toBe(true);
    expect(result.current.updateAvailable).toBe(true);
    expect(result.current.updateInfo).toEqual(mockUpdateInfo);
  });

  test('should download update', async () => {
    mockElectronAPI.invoke.mockResolvedValue({
      success: true,
      data: true,
    });

    const { result } = renderHook(() => useElectronUpdater());

    // Simulate update available
    act(() => {
      result.current.updateAvailable = true;
    });

    let downloadResult;
    await act(async () => {
      downloadResult = await result.current.downloadUpdate();
    });

    expect(downloadResult).toBe(true);
    expect(mockElectronAPI.invoke).toHaveBeenCalledWith('updater:downloadUpdate');
  });

  test('should handle update events', async () => {
    const mockUpdateInfo = {
      version: '1.1.0',
      releaseDate: '2024-01-01',
    };

    mockElectronAPI.on.mockImplementation((channel, callback) => {
      if (channel === 'updater:update-available') {
        setTimeout(() => callback(mockUpdateInfo), 10);
      } else if (channel === 'updater:update-downloaded') {
        setTimeout(() => callback({}), 20);
      }
    });

    const { result } = renderHook(() => useElectronUpdater());

    // Wait for events to be processed
    setTimeout(() => {
      expect(result.current.updateAvailable).toBe(true);
      expect(result.current.updateInfo).toEqual(mockUpdateInfo);
    }, 30);
  });
});

describe('Error Handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should handle API errors in useElectronDatabase', async () => {
    mockElectronAPI.invoke.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useElectronDatabase());

    await act(async () => {
      await result.current.createConnection({
        name: 'Test Connection',
        type: 'postgresql',
        host: 'localhost',
        port: 5432,
        database: 'testdb',
        username: 'user',
        password: 'password',
      });
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe('Network error');
  });

  test('should handle malformed responses', async () => {
    mockElectronAPI.invoke.mockResolvedValue({
      // Missing success property
      data: { id: 'test' },
    });

    const { result } = renderHook(() => useElectronDatabase());

    let connectionResult;
    await act(async () => {
      connectionResult = await result.current.createConnection({
        name: 'Test Connection',
        type: 'postgresql',
        host: 'localhost',
        port: 5432,
        database: 'testdb',
        username: 'user',
        password: 'password',
      });
    });

    expect(connectionResult).toEqual({ id: 'test' });
  });

  test('should handle timeout errors', async () => {
    mockElectronAPI.invoke.mockImplementation(() => {
      return new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), 100);
      });
    });

    const { result } = renderHook(() => useElectronDatabase());

    await act(async () => {
      await result.current.createConnection({
        name: 'Test Connection',
        type: 'postgresql',
        host: 'localhost',
        port: 5432,
        database: 'testdb',
        username: 'user',
        password: 'password',
      });
    });

    expect(result.current.error).toBe('Request timeout');
  });
});