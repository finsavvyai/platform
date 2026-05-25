import { app, Tray, Menu, nativeImage, BrowserWindow } from 'electron';
import { join } from 'path';

export function createTray(mainWindow: BrowserWindow | null): Tray {
    // Create an empty icon if the file doesn't exist (for dev mode)
    let icon: Electron.NativeImage;
    try {
        const iconPath = join(__dirname, '../../resources/tray-icon.png');
        icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
        if (icon.isEmpty()) {
            // Create a simple colored icon if the file doesn't exist
            icon = nativeImage.createEmpty();
        }
    } catch {
        icon = nativeImage.createEmpty();
    }

    const tray = new Tray(icon);

    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'Show QueryFlux',
            click: () => {
                mainWindow?.show();
                mainWindow?.focus();
            }
        },
        { type: 'separator' },
        {
            label: 'New Query',
            accelerator: 'CmdOrCtrl+N',
            click: () => {
                mainWindow?.show();
                mainWindow?.webContents.send('menu:new-query');
            }
        },
        {
            label: 'New Connection',
            click: () => {
                mainWindow?.show();
                mainWindow?.webContents.send('menu:new-connection');
            }
        },
        { type: 'separator' },
        {
            label: 'Preferences...',
            accelerator: 'CmdOrCtrl+,',
            click: () => {
                mainWindow?.show();
                mainWindow?.webContents.send('menu:preferences');
            }
        },
        { type: 'separator' },
        {
            label: 'Quit QueryFlux',
            accelerator: 'CmdOrCtrl+Q',
            click: () => {
                app.quit();
            }
        }
    ]);

    tray.setToolTip('QueryFlux - Database Management');
    tray.setContextMenu(contextMenu);

    // Double-click to show window
    tray.on('double-click', () => {
        mainWindow?.show();
        mainWindow?.focus();
    });

    console.log('System tray created');
    return tray;
}
