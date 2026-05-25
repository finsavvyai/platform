/**
 * Office Processor - Excel Document Processing
 */

import { Logger } from '../../utils/logger';
import { DocumentProcessingError } from '../../utils/error-handler';
import ExcelJS from 'exceljs';
import type {
  OfficeDocumentResult,
  Table,
  OfficeProcessingOptions,
} from './types';
import {
  extractExcelMetadata,
  extractExcelStructure,
  extractExcelContent,
  assessExcelQuality,
} from './excel-helpers';

export async function processExcelDocument(
  buffer: Buffer,
  _options: OfficeProcessingOptions,
  logger: Logger
): Promise<OfficeDocumentResult> {
  try {
    logger.debug('Processing Excel document');

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    let text = '';
    const tables: Table[] = [];
    let sheetCount = 0;

    workbook.worksheets.forEach((worksheet, index) => {
      const sheetName = worksheet.name;
      const tableData: string[][] = [];
      worksheet.eachRow({ includeEmpty: false }, (row) => {
        const rowValues = Array.isArray(row.values)
          ? row.values.slice(1)
          : [row.values];
        const normalizedRow = rowValues.map(normalizeCellValue);
        if (normalizedRow.some((cell) => cell.trim().length > 0)) {
          tableData.push(normalizedRow);
        }
      });

      if (tableData.length > 0) {
        sheetCount++;
        text += `=== Sheet: ${sheetName} ===\n\n`;

        tables.push({
          id: `sheet_${index}`,
          rows: tableData.length,
          columns: Math.max(0, ...tableData.map((row) => row.length)),
          data: tableData,
          title: sheetName,
        });

        tableData.forEach((row, rowIndex) => {
          const rowText = row.join(' | ');
          text += rowText + '\n';
          if (rowIndex === 0) {
            text += '-'.repeat(rowText.length) + '\n';
          }
        });

        text += '\n\n';
      }
    });

    return {
      text,
      documentType: 'excel',
      metadata: extractExcelMetadata(workbook, sheetCount, logger),
      structure: extractExcelStructure(tables),
      content: extractExcelContent(workbook, tables, logger),
      quality: assessExcelQuality(workbook, tables, logger),
    };
  } catch (error) {
    throw new DocumentProcessingError(
      'Failed to process Excel document',
      error
    );
  }
}

function normalizeCellValue(cell: unknown): string {
  if (cell === null || cell === undefined) {
    return '';
  }
  if (cell instanceof Date) {
    return cell.toISOString();
  }
  if (typeof cell === 'object') {
    const valueCell = cell as {
      text?: string;
      hyperlink?: string;
      formula?: string;
      result?: unknown;
      richText?: Array<{ text?: string }>;
    };
    if (typeof valueCell.text === 'string') {
      return valueCell.text;
    }
    if (typeof valueCell.hyperlink === 'string') {
      return valueCell.hyperlink;
    }
    if (typeof valueCell.formula === 'string') {
      return valueCell.result !== undefined
        ? String(valueCell.result)
        : `=${valueCell.formula}`;
    }
    if (Array.isArray(valueCell.richText)) {
      return valueCell.richText.map((part) => part.text || '').join('');
    }
    return JSON.stringify(cell);
  }
  return String(cell);
}
