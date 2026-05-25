import { ServerRegistry, MCPServer } from '../services/registry';

export interface CreateServerRequest {
  name: string;
  description: string;
  author: string;
  version: string;
  repositoryUrl: string;
  tags: string[];
}

export interface UpdateServerRequest {
  description?: string;
  version?: string;
  repositoryUrl?: string;
  tags?: string[];
}

export class ServersAPI {
  constructor(private registry: ServerRegistry) {}

  public create(req: CreateServerRequest): MCPServer {
    return this.registry.register({
      name: req.name,
      description: req.description,
      author: req.author,
      version: req.version,
      repositoryUrl: req.repositoryUrl,
      tags: req.tags,
      downloads: 0,
      rating: 0,
    });
  }

  public get(id: string): MCPServer | undefined {
    return this.registry.get(id);
  }

  public search(query: {
    search?: string;
    tags?: string[];
    limit?: number;
    offset?: number;
  }) {
    return this.registry.search(query);
  }

  public update(id: string, req: UpdateServerRequest): MCPServer | undefined {
    return this.registry.update(id, req);
  }

  public delete(id: string): boolean {
    return this.registry.delete(id);
  }

  public list(limit = 20, offset = 0): MCPServer[] {
    const all = this.registry.getAll();
    return all.slice(offset, offset + limit);
  }

  public getByAuthor(author: string): MCPServer[] {
    return this.registry
      .getAll()
      .filter((s) => s.author === author);
  }

  public getByTag(tag: string): MCPServer[] {
    return this.registry
      .getAll()
      .filter((s) => s.tags.includes(tag));
  }
}
