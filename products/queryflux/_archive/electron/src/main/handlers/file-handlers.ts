import { ipcMain, dialog, BrowserWindow } from 'electron';
import fs from 'fs/promises';
import path from 'path';

export function setupFileHandlers(): void {
  // Open SQL file
  ipcMain.handle('file:openSQL', async () => {
    try {
      const window = BrowserWindow.getFocusedWindow();
      if (!window) {
        return { success: false, error: 'No focused window' };
      }

      const result = await dialog.showOpenDialog(window, {
        properties: ['openFile'],
        filters: [
          { name: 'SQL Files', extensions: ['sql'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, error: 'No file selected' };
      }

      const filePath = result.filePaths[0];
      const content = await fs.readFile(filePath, 'utf-8');

      return {
        success: true,
        data: {
          filePath,
          fileName: path.basename(filePath),
          content
        }
      };

    } catch (error) {
      console.error('File open error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to open file'
      };
    }
  });

  // Save SQL file
  ipcMain.handle('file:saveSQL', async (_, { content, fileName, suggestedPath }) => {
    try {
      const window = BrowserWindow.getFocusedWindow();
      if (!window) {
        return { success: false, error: 'No focused window' };
      }

      const result = await dialog.showSaveDialog(window, {
        defaultPath: suggestedPath || fileName,
        filters: [
          { name: 'SQL Files', extensions: ['sql'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });

      if (result.canceled || !result.filePath) {
        return { success: false, error: 'Save cancelled' };
      }

      await fs.writeFile(result.filePath, content, 'utf-8');

      return {
        success: true,
        data: {
          filePath: result.filePath,
          fileName: path.basename(result.filePath)
        }
      };

    } catch (error) {
      console.error('File save error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save file'
      };
    }
  });

  // Export query results
  ipcMain.handle('file:exportResults', async (_, { results, format, fileName }) => {
    try {
      const window = BrowserWindow.getFocusedWindow();
      if (!window) {
        return { success: false, error: 'No focused window' };
      }

      const extension = format === 'csv' ? 'csv' : format === 'json' ? 'json' : 'txt';
      const defaultFileName = fileName || `query_results_${new Date().toISOString().slice(0, 10)}.${extension}`;

      const result = await dialog.showSaveDialog(window, {
        defaultPath: defaultFileName,
        filters: [
          { name: format.toUpperCase() + ' Files', extensions: [extension] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });

      if (result.canceled || !result.filePath) {
        return { success: false, error: 'Export cancelled' };
      }

      let content = '';

      switch (format) {
        case 'csv':
          content = exportToCSV(results);
          break;
        case 'json':
          content = exportToJSON(results);
          break;
        case 'txt':
        default:
          content = exportToText(results);
          break;
      }

      await fs.writeFile(result.filePath, content, 'utf-8');

      return {
        success: true,
        data: {
          filePath: result.filePath,
          fileName: path.basename(result.filePath),
          format,
          rowCount: results.data?.rowCount || 0
        }
      };

    } catch (error) {
      console.error('Export error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to export results'
      };
    }
  });

  // Import connections from file
  ipcMain.handle('file:importConnections', async () => {
    try {
      const window = BrowserWindow.getFocusedWindow();
      if (!window) {
        return { success: false, error: 'No focused window' };
      }

      const result = await dialog.showOpenDialog(window, {
        properties: ['openFile'],
        filters: [
          { name: 'JSON Files', extensions: ['json'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, error: 'No file selected' };
      }

      const filePath = result.filePaths[0];
      const content = await fs.readFile(filePath, 'utf-8');
      const connections = JSON.parse(content);

      // Validate connection format
      if (!Array.isArray(connections)) {
        return { success: false, error: 'Invalid file format' };
      }

      return {
        success: true,
        data: {
          connections,
          filePath,
          fileName: path.basename(filePath)
        }
      };

    } catch (error) {
      console.error('Import connections error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to import connections'
      };
    }
  });

  // Export connections to file
  ipcMain.handle('file:exportConnections', async (_, connections) => {
    try {
      const window = BrowserWindow.getFocusedWindow();
      if (!window) {
        return { success: false, error: 'No focused window' };
      }

      const result = await dialog.showSaveDialog(window, {
        defaultPath: `queryflux_connections_${new Date().toISOString().slice(0, 10)}.json`,
        filters: [
          { name: 'JSON Files', extensions: ['json'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });

      if (result.canceled || !result.filePath) {
        return { success: false, error: 'Export cancelled' };
      }

      const content = JSON.stringify(connections, null, 2);
      await fs.writeFile(result.filePath, content, 'utf-8');

      return {
        success: true,
        data: {
          filePath: result.filePath,
          fileName: path.basename(result.filePath),
          connectionCount: connections.length
        }
      };

    } catch (error) {
      console.error('Export connections error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to export connections'
      };
    }
  });

  // Open directory for backup
  ipcMain.handle('file:selectBackupDirectory', async () => {
    try {
      const window = BrowserWindow.getFocusedWindow();
      if (!window) {
        return { success: false, error: 'No focused window' };
      }

      const result = await dialog.showOpenDialog(window, {
        properties: ['openDirectory']
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, error: 'No directory selected' };
      }

      return {
        success: true,
        data: {
          directoryPath: result.filePaths[0]
        }
      };

    } catch (error) {
      console.error('Directory selection error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to select directory'
      };
    }
  });
}

// Export functions
function exportToCSV(results: any): string {
  if (!results.data || !results.data.columns || !results.data.rows) {
    return '';
  }

  const { columns, rows } = results.data;

  // Write headers
  let csv = columns.map(col => escapeCSV(col)).join(',') + '\\n';

  // Write rows
  for (const row of rows) {
    csv += row.map(cell => escapeCSV(String(cell))).join(',') + '\\n';
  }

  return csv;
}

function exportToJSON(results: any): string {
  if (!results.data || !results.data.columns || !results.data.rows) {
    return JSON.stringify(results, null, 2);
  }

  const { columns, rows } = results.data;
  const objects = rows.map(row => {
    const obj: any = {};
    columns.forEach((col, index) => {
      obj[col] = row[index];
    });
    return obj;
  });

  return JSON.stringify({
    metadata: {
      exportedAt: new Date().toISOString(),
      rowCount: results.data.rowCount,
      columnCount: columns.length,
      executionTime: results.executionTime
    },
    data: objects
  }, null, 2);
}

function exportToText(results: any): string {
  if (!results.data || !results.data.columns || !results.data.rows) {
    return 'No results to export';
  }

  const { columns, rows } = results.data;
  const columnWidths = columns.map(col => Math.max(col.length, 15));

  // Calculate column widths based on data
  for (const row of rows) {
    columns.forEach((col, index) => {
      const value = String(row[index] || '');
      columnWidths[index] = Math.max(columnWidths[index], value.length);
    });
  }

  let text = '';

  // Write headers
  const header = columns.map((col, index) => col.padEnd(columnWidths[index])).join(' | ');
  text += header + '\\n';

  // Write separator
  const separator = columnWidths.map(width => '-'.repeat(width)).join('-+-');
  text += separator + '\\n';

  // Write rows
  for (const row of rows) {
    const rowText = columns.map((col, index) => {
      const value = String(row[index] || '');
      return value.padEnd(columnWidths[index]);
    }).join(' | ');
    text += rowText + '\\n';
  }

  // Add metadata
  text += '\\n\\n';
  text += `Exported: ${new Date().toLocaleString()}\\n`;
  text += `Rows: ${results.data.rowCount}\\n`;
  text += `Execution Time: ${results.executionTime}ms\\n`;

  return text;
}

function escapeCSV(text: string): string {
  if (text.includes(',') || text.includes('"') || text.includes('\\n')) {
    return '"' + text.replace(/"/g, '""') + '"';
  }
  return text;
}