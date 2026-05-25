import { v4 as uuidv4 } from 'uuid';

export interface MCPServer {
  id: string;
  name: string;
  description: string;
  author: string;
  version: string;
  repositoryUrl: string;
  downloads: number;
  rating: number;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

export interface RegistryQuery {
  search?: string;
  tags?: string[];
  limit?: number;
  offset?: number;
}

export class ServerRegistry {
  private servers: Map<string, MCPServer> = new Map();

  public register(server: Omit<MCPServer, 'id' | 'createdAt' | 'updatedAt'>): MCPServer {
    if (!server.name || !server.author) {
      throw new Error('Server name and author are required');
    }
    const registered: MCPServer = {
      ...server,
      id: uuidv4(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.servers.set(registered.id, registered);
    return registered;
  }

  public get(id: string): MCPServer | undefined {
    return this.servers.get(id);
  }

  public search(query: RegistryQuery): MCPServer[] {
    let results = Array.from(this.servers.values());

    if (query.search) {
      const term = query.search.toLowerCase();
      results = results.filter(
        (s) =>
          s.name.toLowerCase().includes(term) ||
          s.description.toLowerCase().includes(term)
      );
    }

    if (query.tags && query.tags.length > 0) {
      results = results.filter((s) =>
        query.tags!.some((tag) => s.tags.includes(tag))
      );
    }

    results.sort((a, b) => b.downloads - a.downloads);

    const offset = query.offset || 0;
    const limit = query.limit || 20;
    return results.slice(offset, offset + limit);
  }

  public getVersions(id: string): string[] {
    const server = this.servers.get(id);
    return server ? [server.version] : [];
  }

  public update(id: string, changes: Partial<MCPServer>): MCPServer | undefined {
    const server = this.servers.get(id);
    if (!server) return undefined;

    const updated: MCPServer = {
      ...server,
      ...changes,
      id: server.id,
      createdAt: server.createdAt,
      updatedAt: Date.now(),
    };
    this.servers.set(id, updated);
    return updated;
  }

  public incrementDownloads(id: string): boolean {
    const server = this.servers.get(id);
    if (!server) return false;
    server.downloads++;
    server.updatedAt = Date.now();
    return true;
  }

  public delete(id: string): boolean {
    return this.servers.delete(id);
  }

  public getAll(): MCPServer[] {
    return Array.from(this.servers.values());
  }
}
