declare module 'pdf-parse' {
  interface PDFInfo {
    Title?: string;
    Author?: string;
    Subject?: string;
    Creator?: string;
    Producer?: string;
    CreationDate?: string;
    ModDate?: string;
    Keywords?: string;
    [key: string]: any;
  }

  interface PDFData {
    numpages: number;
    numrender: number;
    info: PDFInfo;
    metadata: any;
    version: string;
    text: string;
    pages?: any[];
  }

  interface PDFOptions {
    pagerender?: (pageData: any) => string;
    max?: number;
    version?: string;
  }

  function pdf(dataBuffer: Buffer, options?: PDFOptions): Promise<PDFData>;

  export = pdf;
}
