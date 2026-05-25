import { BaseAdapter } from "./base-adapter";
import { IngestionRequest } from "../document-ingester";

export class WebCrawlAdapter extends BaseAdapter {
  async fetchDocument(request: IngestionRequest): Promise<string> {
    if (!request.url) {
      throw new Error("Web crawl requires url");
    }
    
    // Simulate web crawling and content extraction
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    return `{
      "title": "Content crawled from ${request.url}",
      "content": "Sample crawled content from the web page...",
      "crawlDate": "${new Date().toISOString()}",
      "sourceUrl": "${request.url}",
      "contentType": "text/html"
    }`;
  }
  
  async extractMetadata(content: string, request: IngestionRequest): Promise<any> {
    const baseMetadata = await super.extractMetadata(content, request);
    return {
      ...baseMetadata,
      sourceUrl: request.url,
      crawlMethod: "automated",
      contentType: "text/html",
      crawledAt: new Date().toISOString()
    };
  }
  
  async validateRequest(request: IngestionRequest): Promise<boolean> {
    return request.source === "web_crawl" && !!request.url;
  }
}
