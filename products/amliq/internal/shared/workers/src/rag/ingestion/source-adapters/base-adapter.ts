export interface SourceAdapter {
  fetchDocument(request: IngestionRequest): Promise<string>;
  extractMetadata(content: string, request: IngestionRequest): Promise<any>;
  validateRequest(request: IngestionRequest): Promise<boolean>;
}

export abstract class BaseAdapter implements SourceAdapter {
  abstract fetchDocument(request: IngestionRequest): Promise<string>;
  
  async extractMetadata(content: string, request: IngestionRequest): Promise<any> {
    return {
      source: request.source,
      contentType: this.detectContentType(content),
      size: content.length,
      extractedAt: new Date().toISOString()
    };
  }
  
  async validateRequest(request: IngestionRequest): Promise<boolean> {
    return true;
  }
  
  private detectContentType(content: string): string {
    if (content.includes("<html>") || content.includes("<!DOCTYPE")) {
      return "text/html";
    } else if (content.includes("{") || content.includes("[")) {
      return "application/json";
    } else {
      return "text/plain";
    }
  }
}
