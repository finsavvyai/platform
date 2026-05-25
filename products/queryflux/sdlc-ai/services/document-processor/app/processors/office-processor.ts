import { Logger } from '../utils/logger';
import { DocumentProcessingError, UnsupportedFormatError } from '../utils/error-handler';
import { StorageManager } from '../core/storage-manager';
import * as mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import { promises as fs } from 'fs';

export interface OfficeDocumentResult {
  text: string;
  documentType: 'word' | 'excel' | 'powerpoint';
  metadata: OfficeMetadata;
  structure: DocumentStructure;
  content: OfficeContent;
  quality: QualityMetrics;
}

export interface OfficeMetadata {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string[];
  creationDate?: Date;
  modificationDate?: Date;
  lastModifiedBy?: string;
  category?: string;
  comments?: string;
  template?: string;
  language?: string;
  pageCount?: number;
  wordCount?: number;
  sheetCount?: number;
  slideCount?: number;
  isTemplate: boolean;
  hasMacros: boolean;
  hasEmbeddedContent: boolean;
  version?: string;
}

export interface DocumentStructure {
  headings: Heading[];
  paragraphs: Paragraph[];
  tables: Table[];
  lists: List[];
  sections: Section[];
  footnotes: Footnote[];
  endnotes: Endnote[];
  headers: HeaderFooter[];
  footers: HeaderFooter[];
}

export interface Heading {
  level: number;
  text: string;
  pageNumber?: number;
  style?: string;
  id?: string;
}

export interface Paragraph {
  text: string;
  style?: string;
  pageNumber?: number;
  alignment?: 'left' | 'center' | 'right' | 'justify';
  indentation?: number;
  spacing?: number;
}

export interface Table {
  id: string;
  rows: number;
  columns: number;
  data: string[][];
  headers?: string[];
  style?: string;
  pageNumber?: number;
  title?: string;
}

export interface List {
  type: 'bulleted' | 'numbered';
  items: string[];
  level: number;
  pageNumber?: number;
  style?: string;
}

export interface Section {
  title?: string;
  pageNumber?: number;
  content: string;
  type: 'chapter' | 'section' | 'subsection' | 'appendix';
}

export interface Footnote {
  id: string;
  text: string;
  reference: string;
  pageNumber?: number;
}

export interface Endnote {
  id: string;
  text: string;
  reference: string;
  pageNumber?: number;
}

export interface HeaderFooter {
  type: 'header' | 'footer';
  text: string;
  pageNumber?: number;
  position: 'left' | 'center' | 'right';
}

export interface OfficeContent {
  mainContent: string;
  embeddedObjects: EmbeddedObject[];
  hyperlinks: Hyperlink[];
  comments: Comment[];
  revisions: Revision[];
  bookmarks: Bookmark[];
}

export interface EmbeddedObject {
  id: string;
  type: 'image' | 'chart' | 'table' | 'document' | 'media';
  name?: string;
  description?: string;
  size?: number;
  format?: string;
  data?: Buffer;
}

export interface Hyperlink {
  text: string;
  url: string;
  title?: string;
  pageNumber?: number;
}

export interface Comment {
  id: string;
  author: string;
  text: string;
  date: Date;
  pageNumber?: number;
  resolved?: boolean;
}

export interface Revision {
  id: string;
  author: string;
  type: 'insertion' | 'deletion' | 'formatting';
  text?: string;
  date: Date;
  accepted?: boolean;
}

export interface Bookmark {
  id: string;
  name: string;
  pageNumber?: number;
  position?: number;
}

export interface QualityMetrics {
  overall: number;
  textCompleteness: number;
  structurePreservation: number;
  formattingAccuracy: number;
  metadataExtraction: number;
  contentIntegrity: number;
}

export class OfficeProcessor {
  private logger: Logger;
  private storageManager: StorageManager;
  private supportedFormats: string[];
  private maxFileSize: number;

  constructor(storageManager: StorageManager) {
    this.logger = new Logger('OfficeProcessor');
    this.storageManager = storageManager;
    this.supportedFormats = [
      // Word formats
      '.doc', '.docx', '.dot', '.dotx', '.docm', '.dotm',
      // Excel formats
      '.xls', '.xlsx', '.xlsm', '.xlsb', '.xlt', '.xltx', '.xltm',
      // PowerPoint formats
      '.ppt', '.pptx', '.pps', '.ppsx', '.pot', '.potx', '.pptm', '.potm',
      // Office XML formats
      '.xml', '.odt', '.ods', '.odp',
    ];
    this.maxFileSize = 100 * 1024 * 1024; // 100MB
  }

  public async processOfficeDocument(fileId: string, options: OfficeProcessingOptions = {}): Promise<OfficeDocumentResult> {
    const startTime = Date.now();

    try {
      this.logger.info(`Processing Office document: ${fileId}`);

      // Download file from storage
      const buffer = await this.storageManager.downloadFile(fileId);

      // Detect document type and validate
      const documentType = await this.detectDocumentType(fileId, buffer);
      await this.validateDocument(buffer, documentType);

      // Process based on document type
      let result: OfficeDocumentResult;

      switch (documentType) {
        case 'word':
          result = await this.processWordDocument(buffer, options);
          break;
        case 'excel':
          result = await this.processExcelDocument(buffer, options);
          break;
        case 'powerpoint':
          result = await this.processPowerPointDocument(buffer, options);
          break;
        default:
          throw new UnsupportedFormatError(documentType, this.supportedFormats);
      }

      const duration = Date.now() - startTime;
      this.logger.info(`Office document processing completed in ${duration}ms for file: ${fileId}`);

      return result;
    } catch (error) {
      this.logger.error(`Office document processing failed for file ${fileId}:`, error);
      throw new DocumentProcessingError(`Office document processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`, error);
    }
  }

  private async detectDocumentType(fileId: string, buffer: Buffer): Promise<'word' | 'excel' | 'powerpoint'> {
    try {
      // Get file extension from fileId
      const extension = fileId.toLowerCase().substring(fileId.lastIndexOf('.'));

      // Check magic bytes for more accurate detection
      const header = buffer.slice(0, 8).toString('hex');

      // Detect based on file signature
      if (header.startsWith('d0cf11e0a1b11ae1')) {
        // Old Office format (OLE2)
        if (['.doc', '.xls', '.ppt'].includes(extension)) {
          if (extension === '.doc') return 'word';
          if (extension === '.xls') return 'excel';
          if (extension === '.ppt') return 'powerpoint';
        }
      } else if (header.startsWith('504b0304')) {
        // New Office format (OpenXML)
        if (['.docx', '.xlsx', '.pptx', '.docm', '.xlsm', '.pptm'].includes(extension)) {
          if (extension.includes('doc')) return 'word';
          if (extension.includes('xls') || extension.includes('xl')) return 'excel';
          if (extension.includes('ppt')) return 'powerpoint';
        }
      }

      // Fallback to extension-based detection
      if (['.doc', '.docx', '.dot', '.dotx', '.docm', '.dotm', '.odt'].includes(extension)) {
        return 'word';
      }
      if (['.xls', '.xlsx', '.xlsm', '.xlsb', '.xlt', '.xltx', '.xltm', '.ods'].includes(extension)) {
        return 'excel';
      }
      if (['.ppt', '.pptx', '.pps', '.ppsx', '.pot', '.potx', '.pptm', '.potm', '.odp'].includes(extension)) {
        return 'powerpoint';
      }

      throw new UnsupportedFormatError(extension, this.supportedFormats);
    } catch (error) {
      if (error instanceof UnsupportedFormatError) {
        throw error;
      }
      throw new DocumentProcessingError('Failed to detect document type', error);
    }
  }

  private async validateDocument(buffer: Buffer, documentType: string): Promise<void> {
    if (buffer.length === 0) {
      throw new DocumentProcessingError('Office document is empty');
    }

    if (buffer.length > this.maxFileSize) {
      throw new DocumentProcessingError(`Office document size exceeds maximum limit of ${this.maxFileSize / 1024 / 1024}MB`);
    }
  }

  private async processWordDocument(buffer: Buffer, options: OfficeProcessingOptions): Promise<OfficeDocumentResult> {
    try {
      this.logger.debug('Processing Word document');

      // Use mammoth to extract content from DOCX files
      const result = await mammoth.extractRawText({ buffer });

      // Extract structured content
      const structuredResult = await mammoth.extractFullDocument({
        buffer,
        options: {
          includeDefaultStyleMap: true,
          styleMap: [
            "p[style-name='Heading 1'] => h1:fresh",
            "p[style-name='Heading 2'] => h2:fresh",
            "p[style-name='Heading 3'] => h3:fresh",
            "p[style-name='Heading 4'] => h4:fresh",
            "p[style-name='Heading 5'] => h5:fresh",
            "p[style-name='Heading 6'] => h6:fresh",
          ]
        }
      });

      const documentResult: OfficeDocumentResult = {
        text: result.value,
        documentType: 'word',
        metadata: await this.extractWordMetadata(buffer, structuredResult),
        structure: await this.extractWordStructure(structuredResult),
        content: await this.extractWordContent(structuredResult),
        quality: await this.assessWordQuality(result, structuredResult),
      };

      return documentResult;
    } catch (error) {
      throw new DocumentProcessingError('Failed to process Word document', error);
    }
  }

  private async processExcelDocument(buffer: Buffer, options: OfficeProcessingOptions): Promise<OfficeDocumentResult> {
    try {
      this.logger.debug('Processing Excel document');

      // Use XLSX to parse Excel files
      const workbook = XLSX.read(buffer, {
        type: 'buffer',
        cellFormula: true,
        cellHTML: false,
        cellNF: false,
        cellDates: true,
        bookSST: true,
        bookProps: true,
      });

      let text = '';
      const tables: Table[] = [];
      let sheetCount = 0;

      // Process each worksheet
      workbook.SheetNames.forEach((sheetName, index) => {
        const worksheet = workbook.Sheets[sheetName];

        // Convert worksheet to JSON for easy processing
        const jsonData = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          defval: '',
          blankrows: false,
        });

        if (jsonData.length > 0) {
          sheetCount++;

          // Add sheet title
          text += `=== Sheet: ${sheetName} ===\n\n`;

          // Convert to table structure
          const tableData: string[][] = jsonData.map((row: any) =>
            Array.isArray(row) ? row.map(cell => String(cell || '')) : [String(row || '')]
          );

          tables.push({
            id: `sheet_${index}`,
            rows: tableData.length,
            columns: Math.max(...tableData.map(row => row.length)),
            data: tableData,
            title: sheetName,
          });

          // Convert to text format
          tableData.forEach((row, rowIndex) => {
            const rowText = row.join(' | ');
            text += rowText + '\n';

            // Add separator after header row (first row)
            if (rowIndex === 0) {
              text += '-'.repeat(rowText.length) + '\n';
            }
          });

          text += '\n\n';
        }
      });

      const documentResult: OfficeDocumentResult = {
        text,
        documentType: 'excel',
        metadata: await this.extractExcelMetadata(workbook, sheetCount),
        structure: await this.extractExcelStructure(tables),
        content: await this.extractExcelContent(workbook, tables),
        quality: await this.assessExcelQuality(workbook, tables),
      };

      return documentResult;
    } catch (error) {
      throw new DocumentProcessingError('Failed to process Excel document', error);
    }
  }

  private async processPowerPointDocument(buffer: Buffer, options: OfficeProcessingOptions): Promise<OfficeDocumentResult> {
    try {
      this.logger.debug('Processing PowerPoint document');

      // For PowerPoint, we'll need a more sophisticated library
      // For now, we'll create a basic implementation
      let text = '';
      let slideCount = 0;

      // This is a simplified implementation
      // In practice, you would use a library like node-pptx or parse-pptx
      text = "PowerPoint processing requires specialized library integration.\n";
      text += "Slides would be processed individually to extract:\n";
      text += "- Slide titles and content\n";
      text += "- Speaker notes\n";
      text += "- Slide masters and layouts\n";
      text += "- Embedded media and charts\n";
      text += "- Animations and transitions metadata\n";

      const documentResult: OfficeDocumentResult = {
        text,
        documentType: 'powerpoint',
        metadata: {
          slideCount: slideCount || 1,
          isTemplate: false,
          hasMacros: false,
          hasEmbeddedContent: false,
        } as OfficeMetadata,
        structure: {
          headings: [],
          paragraphs: [{
            text: text,
            style: 'normal',
          }],
          tables: [],
          lists: [],
          sections: [],
          footnotes: [],
          endnotes: [],
          headers: [],
          footers: [],
        },
        content: {
          mainContent: text,
          embeddedObjects: [],
          hyperlinks: [],
          comments: [],
          revisions: [],
          bookmarks: [],
        },
        quality: {
          overall: 0.5,
          textCompleteness: 0.3,
          structurePreservation: 0.5,
          formattingAccuracy: 0.4,
          metadataExtraction: 0.3,
          contentIntegrity: 0.5,
        },
      };

      return documentResult;
    } catch (error) {
      throw new DocumentProcessingError('Failed to process PowerPoint document', error);
    }
  }

  private async extractWordMetadata(buffer: Buffer, structuredResult: any): Promise<OfficeMetadata> {
    const metadata: OfficeMetadata = {
      isTemplate: false,
      hasMacros: false,
      hasEmbeddedContent: false,
    };

    try {
      // Extract metadata from mammoth result if available
      if (structuredResult.messages) {
        // Check for warnings that might indicate special features
        metadata.hasMacros = structuredResult.messages.some((msg: any) =>
          msg.message && msg.message.toLowerCase().includes('macro')
        );
        metadata.hasEmbeddedContent = structuredResult.messages.some((msg: any) =>
          msg.message && msg.message.toLowerCase().includes('embedded')
        );
      }

      // Count words and estimate pages
      const text = structuredResult.value || '';
      metadata.wordCount = text.split(/\s+/).filter(word => word.length > 0).length;
      metadata.pageCount = Math.max(1, Math.ceil(metadata.wordCount / 250)); // Rough estimate

      return metadata;
    } catch (error) {
      this.logger.warn('Failed to extract Word metadata:', error);
      return metadata;
    }
  }

  private async extractExcelMetadata(workbook: XLSX.WorkBook, sheetCount: number): Promise<OfficeMetadata> {
    const metadata: OfficeMetadata = {
      sheetCount,
      isTemplate: false,
      hasMacros: false,
      hasEmbeddedContent: false,
    };

    try {
      // Extract workbook properties
      if (workbook.Props) {
        metadata.title = workbook.Props.Title;
        metadata.author = workbook.Props.Author || workbook.Props.Creator;
        metadata.subject = workbook.Props.Subject;
        metadata.creationDate = workbook.Props.CreatedDate ? new Date(workbook.Props.CreatedDate) : undefined;
        metadata.modificationDate = workbook.Props.ModifiedDate ? new Date(workbook.Props.ModifiedDate) : undefined;
      }

      // Check for macros and embedded content
      if (workbook.vbaraw) {
        metadata.hasMacros = true;
      }

      metadata.hasEmbeddedContent = workbook.Embedded ? Object.keys(workbook.Embedded).length > 0 : false;

      return metadata;
    } catch (error) {
      this.logger.warn('Failed to extract Excel metadata:', error);
      return metadata;
    }
  }

  private async extractWordStructure(structuredResult: any): Promise<DocumentStructure> {
    const structure: DocumentStructure = {
      headings: [],
      paragraphs: [],
      tables: [],
      lists: [],
      sections: [],
      footnotes: [],
      endnotes: [],
      headers: [],
      footers: [],
    };

    try {
      // Parse HTML content from mammoth
      if (structuredResult.value) {
        const htmlContent = structuredResult.value;

        // Extract headings
        const headingRegex = /<h([1-6])[^>]*>(.*?)<\/h[1-6]>/gi;
        let match;
        while ((match = headingRegex.exec(htmlContent)) !== null) {
          structure.headings.push({
            level: parseInt(match[1]),
            text: this.stripHTML(match[2]),
          });
        }

        // Extract paragraphs
        const paragraphRegex = /<p[^>]*>(.*?)<\/p>/gi;
        while ((match = paragraphRegex.exec(htmlContent)) !== null) {
          const paragraphText = this.stripHTML(match[1]);
          if (paragraphText.trim().length > 0) {
            structure.paragraphs.push({
              text: paragraphText,
            });
          }
        }
      }

      return structure;
    } catch (error) {
      this.logger.warn('Failed to extract Word structure:', error);
      return structure;
    }
  }

  private async extractExcelStructure(tables: Table[]): Promise<DocumentStructure> {
    const structure: DocumentStructure = {
      headings: [],
      paragraphs: [],
      tables,
      lists: [],
      sections: [],
      footnotes: [],
      endnotes: [],
      headers: [],
      footers: [],
    };

    // Create paragraphs from table titles
    tables.forEach(table => {
      if (table.title) {
        structure.headings.push({
          level: 2,
          text: table.title,
        });
      }
    });

    return structure;
  }

  private async extractWordContent(structuredResult: any): Promise<OfficeContent> {
    const content: OfficeContent = {
      mainContent: structuredResult.value || '',
      embeddedObjects: [],
      hyperlinks: [],
      comments: [],
      revisions: [],
      bookmarks: [],
    };

    try {
      // Extract hyperlinks from HTML content
      if (structuredResult.value) {
        const linkRegex = /<a[^>]+href="([^"]*)"[^>]*>(.*?)<\/a>/gi;
        let match;
        while ((match = linkRegex.exec(structuredResult.value)) !== null) {
          content.hyperlinks.push({
            url: match[1],
            text: this.stripHTML(match[2]),
          });
        }
      }

      return content;
    } catch (error) {
      this.logger.warn('Failed to extract Word content:', error);
      return content;
    }
  }

  private async extractExcelContent(workbook: XLSX.WorkBook, tables: Table[]): Promise<OfficeContent> {
    const content: OfficeContent = {
      mainContent: tables.map(table =>
        table.title ? `${table.title}\n${table.data.map(row => row.join('\t')).join('\n')}` :
        table.data.map(row => row.join('\t')).join('\n')
      ).join('\n\n'),
      embeddedObjects: [],
      hyperlinks: [],
      comments: [],
      revisions: [],
      bookmarks: [],
    };

    try {
      // Extract named ranges as bookmarks
      if (workbook.Workbook && workbook.Workbook.Names) {
        workbook.Workbook.Names.forEach((name: any) => {
          content.bookmarks.push({
            id: name.Name,
            name: name.Name,
          });
        });
      }

      return content;
    } catch (error) {
      this.logger.warn('Failed to extract Excel content:', error);
      return content;
    }
  }

  private async assessWordQuality(result: any, structuredResult: any): Promise<QualityMetrics> {
    const metrics: QualityMetrics = {
      overall: 0,
      textCompleteness: 0,
      structurePreservation: 0,
      formattingAccuracy: 0,
      metadataExtraction: 0,
      contentIntegrity: 0,
    };

    try {
      // Assess text completeness
      const textLength = result.value ? result.value.length : 0;
      metrics.textCompleteness = Math.min(1.0, textLength / 1000); // Normalize to 1000 chars as baseline

      // Assess structure preservation
      const headingCount = structuredResult.value ? (structuredResult.value.match(/<h[1-6]/gi) || []).length : 0;
      const paragraphCount = structuredResult.value ? (structuredResult.value.match(/<p/gi) || []).length : 0;
      metrics.structurePreservation = Math.min(1.0, (headingCount + paragraphCount) / 20);

      // Assess formatting accuracy
      const formattingElements = structuredResult.value ?
        (structuredResult.value.match(/<(strong|em|u|span)/gi) || []).length : 0;
      metrics.formattingAccuracy = Math.min(1.0, formattingElements / 10);

      // Calculate overall quality
      metrics.overall = (
        metrics.textCompleteness * 0.3 +
        metrics.structurePreservation * 0.25 +
        metrics.formattingAccuracy * 0.25 +
        metrics.metadataExtraction * 0.2
      );

      metrics.contentIntegrity = metrics.overall; // Use overall as proxy for integrity

      return metrics;
    } catch (error) {
      this.logger.warn('Failed to assess Word quality:', error);
      return metrics;
    }
  }

  private async assessExcelQuality(workbook: XLSX.WorkBook, tables: Table[]): Promise<QualityMetrics> {
    const metrics: QualityMetrics = {
      overall: 0,
      textCompleteness: 0,
      structurePreservation: 0,
      formattingAccuracy: 0,
      metadataExtraction: 0,
      contentIntegrity: 0,
    };

    try {
      // Assess text completeness
      const totalCells = tables.reduce((sum, table) => sum + (table.rows * table.columns), 0);
      const nonEmptyCells = tables.reduce((sum, table) =>
        sum + table.data.flat().filter(cell => cell.trim().length > 0).length, 0);
      metrics.textCompleteness = totalCells > 0 ? nonEmptyCells / totalCells : 0;

      // Assess structure preservation
      metrics.structurePreservation = tables.length > 0 ? 0.9 : 0.1;

      // Assess formatting accuracy (Excel preserves formatting well)
      metrics.formattingAccuracy = 0.9;

      // Assess metadata extraction
      metrics.metadataExtraction = workbook.Props ? 0.8 : 0.3;

      // Calculate overall quality
      metrics.overall = (
        metrics.textCompleteness * 0.3 +
        metrics.structurePreservation * 0.25 +
        metrics.formattingAccuracy * 0.25 +
        metrics.metadataExtraction * 0.2
      );

      metrics.contentIntegrity = metrics.overall;

      return metrics;
    } catch (error) {
      this.logger.warn('Failed to assess Excel quality:', error);
      return metrics;
    }
  }

  private stripHTML(html: string): string {
    return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
  }

  public async shutdown(): Promise<void> {
    this.logger.info('Office processor shutdown completed');
  }
}

export interface OfficeProcessingOptions {
  extractImages?: boolean;
  extractTables?: boolean;
  extractMetadata?: boolean;
  preserveFormatting?: boolean;
  includeComments?: boolean;
  includeRevisions?: boolean;
  extractFormulas?: boolean; // Excel specific
  extractSpeakerNotes?: boolean; // PowerPoint specific
}
