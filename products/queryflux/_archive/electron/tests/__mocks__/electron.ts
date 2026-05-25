import { ipcRenderer } from 'electron';

// Mock the electron module
jest.mock('electron', () => ({
  ipcRenderer: {
    invoke: jest.fn(),
    on: jest.fn(),
    removeAllListeners: jest.fn(),
    send: jest.fn(),
    sendSync: jest.fn(),
  },
  app: {
    getVersion: jest.fn(() => '1.0.0'),
    getPath: jest.fn(),
    setPath: jest.fn(),
  },
  shell: {
    openExternal: jest.fn(),
    showItemInFolder: jest.fn(),
  },
  dialog: {
    showSaveDialog: jest.fn(),
    showOpenDialog: jest.fn(),
    showMessageBox: jest.fn(),
  },
}));

// Export the mocked ipcRenderer for use in tests
export const mockedIpcRenderer = ipcRenderer as jest.Mocked<typeof ipcRenderer>;