import { BaseAdapter } from "./base-adapter";
import { IngestionRequest } from "../document-ingester";

export class ApiImportAdapter extends BaseAdapter {
  async fetchDocument(request: IngestionRequest): Promise<string> {
    if (!request.apiUrl) {
      throw new Error("API import requires apiUrl");
    }
    
    // Simulate API call to external data source
    await new Promise(resolve => setTimeout(resolve, 800));
    
    return `{
      "title": "Data imported from ${request.apiUrl}",
      "content": "Sample API imported content...",
      "importDate": "${new Date().toISOString()}",
      "sourceUrl": "${request.apiUrl}",
      "format": "json"
    }`;
  }
  
  async extractMetadata(content: string, request: IngestionRequest): Promise<any> {
    const baseMetadata = await super.extractMetadata(content, request);
    return {
      ...baseMetadata,
      sourceUrl: request.apiUrl,
      importFormat: "json",
      apiEndpoint: request.apiUrl
    };
  }
  
  async validateRequest(request: IngestionRequest): Promise<boolean> {
    return request.source === "api_import" && !!request.apiUrl;
  }
}
