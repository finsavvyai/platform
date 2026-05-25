import { BaseAdapter } from "./base-adapter";
import { IngestionRequest } from "../document-ingester";

export class UserUploadAdapter extends BaseAdapter {
  async fetchDocument(request: IngestionRequest): Promise<string> {
    if (!request.content) {
      throw new Error("User upload requires content");
    }
    
    // For user uploads, content is already provided
    return request.content;
  }
  
  async extractMetadata(content: string, request: IngestionRequest): Promise<any> {
    const baseMetadata = await super.extractMetadata(content, request);
    return {
      ...baseMetadata,
      uploadType: this.detectUploadType(content),
      filename: request.metadata?.filename || "uploaded-document",
      fileSize: content.length,
      mimeType: request.metadata?.mimeType || "text/plain"
    };
  }
  
  async validateRequest(request: IngestionRequest): Promise<boolean> {
    return request.source === "user_upload" && !!request.content;
  }
  
  private detectUploadType(content: string): string {
    if (content.includes("REGULATION") || content.includes("COMPLIANCE")) {
      return "regulatory_document";
    } else if (content.includes("POLICY") || content.includes("GUIDELINE")) {
      return "policy_document";
    } else {
      return "general_document";
    }
  }
}
