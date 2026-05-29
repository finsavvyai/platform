import { app, BrowserWindow, shell, Menu, Tray } from 'electron';
import { join } from 'path';
import { setupIpcHandlers } from './ipc/handlers';
import { createTray } from './tray';
import { initializeStore } from './store';

// Check if we're in development mode
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

function createWindow(): void {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1024,
        minHeight: 700,
        show: false,
        autoHideMenuBar: false,
        titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
        trafficLightPosition: { x: 15, y: 15 },
        backgroundColor: '#0f172a',
        webPreferences: {
            preload: join(__dirname, '../preload/index.js'),
            sandbox: true,
            contextIsolation: true,
            nodeIntegration: false,
            webSecurity: true
        }
    });

    mainWindow.on('ready-to-show', () => {
        mainWindow?.show();
        if (isDev) {
            mainWindow?.webContents.openDevTools();
        }
    });

    mainWindow.on('close', (event) => {
        // Minimize to tray instead of closing on macOS
        if (process.platform === 'darwin') {
            event.preventDefault();
            mainWindow?.hide();
        }
    });

    mainWindow.webContents.setWindowOpenHandler((details) => {
        shell.openExternal(details.url);
        return { action: 'deny' };
    });

    // Load the renderer
    if (isDev && process.env['ELECTRON_RENDERER_URL']) {
        mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
    } else {
        mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
    }
}

function createApplicationMenu(): void {
    const template: Electron.MenuItemConstructorOptions[] = [
        {
            label: app.name,
            submenu: [
                { role: 'about' },
                { type: 'separator' },
                { role: 'services' },
                { type: 'separator' },
                { role: 'hide' },
                { role: 'hideOthers' },
                { role: 'unhide' },
                { type: 'separator' },
                { role: 'quit' }
            ]
        },
        {
            label: 'File',
            submenu: [
                {
                    label: 'New Query',
                    accelerator: 'CmdOrCtrl+N',
                    click: () => mainWindow?.webContents.send('menu:new-query')
                },
                {
                    label: 'New Connection',
                    accelerator: 'CmdOrCtrl+Shift+N',
                    click: () => mainWindow?.webContents.send('menu:new-connection')
                },
                { type: 'separator' },
                {
                    label: 'Save Query',
                    accelerator: 'CmdOrCtrl+S',
                    click: () => mainWindow?.webContents.send('menu:save-query')
                },
                { type: 'separator' },
                process.platform === 'darwin' ? { role: 'close' } : { role: 'quit' }
            ]
        },
        {
            label: 'Edit',
            submenu: [
                { role: 'undo' },
                { role: 'redo' },
                { type: 'separator' },
                { role: 'cut' },
                { role: 'copy' },
                { role: 'paste' },
                { role: 'selectAll' }
            ]
        },
        {
            label: 'View',
            submenu: [
                { role: 'reload' },
                { role: 'forceReload' },
                { role: 'toggleDevTools' },
                { type: 'separator' },
                { role: 'resetZoom' },
                { role: 'zoomIn' },
                { role: 'zoomOut' },
                { type: 'separator' },
                { role: 'togglefullscreen' }
            ]
        },
        {
            label: 'Database',
            submenu: [
                {
                    label: 'Execute Query',
                    accelerator: 'CmdOrCtrl+Enter',
                    click: () => mainWindow?.webContents.send('menu:execute-query')
                },
                {
                    label: 'Format Query',
                    accelerator: 'CmdOrCtrl+Shift+F',
                    click: () => mainWindow?.webContents.send('menu:format-query')
                },
                { type: 'separator' },
                {
                    label: 'Refresh Schema',
                    accelerator: 'CmdOrCtrl+R',
                    click: () => mainWindow?.webContents.send('menu:refresh-schema')
                }
            ]
        },
        {
            label: 'Window',
            submenu: [
                { role: 'minimize' },
                { role: 'zoom' },
                { type: 'separator' },
                { role: 'front' }
            ]
        },
        {
            label: 'Help',
            submenu: [
                {
                    label: 'Documentation',
                    click: () => shell.openExternal('https://docs.queryflux.com')
                },
                {
                    label: 'Report Issue',
                    click: () => shell.openExternal('https://github.com/shacharsol/queryflux/issues')
                },
                { type: 'separator' },
                {
                    label: 'View License',
                    click: () => shell.openExternal('https://github.com/shacharsol/queryflux/blob/main/LICENSE')
                }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

// App lifecycle
app.whenReady().then(() => {
    // Set app user model id for Windows
    app.setAppUserModelId('com.finsavvy.queryflux');

    // Initialize store
    initializeStore();

    // Setup IPC handlers
    setupIpcHandlers();

    // Create window and menu
    createWindow();
    createApplicationMenu();

    // Create system tray
    tray = createTray(mainWindow);

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        } else {
            mainWindow?.show();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('before-quit', () => {
    tray?.destroy();
});

// Security: Prevent new window creation
app.on('web-contents-created', (_, contents) => {
    contents.on('will-navigate', (event, url) => {
        // Only allow navigation within the app
        if (!url.startsWith('file://') && !url.startsWith('http://localhost')) {
            event.preventDefault();
            shell.openExternal(url);
        }
    });
});
