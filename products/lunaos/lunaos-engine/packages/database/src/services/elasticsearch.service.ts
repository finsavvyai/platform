import { Client as ElasticsearchClient } from '@elastic/elasticsearch';
import { logger } from '../utils/logger';
import { dbConnectionManager } from '../connection';

export interface ElasticsearchDocument {
  [key: string]: any;
}

export interface SearchQuery {
  query: any;
  sort?: Record<string, any>[];
  from?: number;
  size?: number;
  highlight?: any;
  aggregations?: Record<string, any>;
  _source?: string | string[];
}

export interface SearchResult<T = any> {
  hits: {
    total: {
      value: number;
      relation: 'eq' | 'gte';
    };
    max_score: number;
    hits: Array<{
      _index: string;
      _id: string;
      _score: number;
      _source: T;
      highlight?: Record<string, string[]>;
    }>;
  };
  aggregations?: Record<string, any>;
  timed_out?: boolean;
  took?: number;
}

export interface IndexTemplate {
  index_patterns: string[];
  template: {
    settings?: any;
    mappings?: any;
    aliases?: Record<string, any>;
  };
  priority?: number;
  version?: number;
}

export class ElasticsearchService {
  private client: ElasticsearchClient;

  constructor() {
    this.client = dbConnectionManager.getElasticsearchClient();
  }

  public async initialize(): Promise<void> {
    try {
      // Test connection
      await this.client.ping();
      logger.info('Elasticsearch service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Elasticsearch service:', error);
      throw error;
    }
  }

  public async createIndex(
    index: string,
    mappings?: any,
    settings?: any
  ): Promise<void> {
    try {
      const indexParams: any = {};

      if (mappings) {
        indexParams.mappings = mappings;
      }

      if (settings) {
        indexParams.settings = settings;
      }

      const exists = await this.indexExists(index);
      if (exists) {
        logger.info(`Index ${index} already exists`);
        return;
      }

      await this.client.indices.create({
        index,
        body: indexParams,
      });

      logger.info(`Created Elasticsearch index: ${index}`);
    } catch (error) {
      logger.error(`Failed to create index ${index}:`, error);
      throw error;
    }
  }

  public async deleteIndex(index: string): Promise<void> {
    try {
      await this.client.indices.delete({
        index,
      });

      logger.info(`Deleted Elasticsearch index: ${index}`);
    } catch (error) {
      logger.error(`Failed to delete index ${index}:`, error);
      throw error;
    }
  }

  public async indexExists(index: string): Promise<boolean> {
    try {
      const response = await this.client.indices.exists({
        index,
      });
      return response.statusCode === 200;
    } catch (error) {
      return false;
    }
  }

  public async getIndices(indexPattern = '*'): Promise<string[]> {
    try {
      const response = await this.client.cat.indices({
        index: indexPattern,
        format: 'json',
      });

      return response.map((item: any) => item.index);
    } catch (error) {
      logger.error(`Failed to get indices for pattern ${indexPattern}:`, error);
      return [];
    }
  }

  public async getIndexMapping(index: string): Promise<any> {
    try {
      const response = await this.client.indices.getMapping({
        index,
      });

      return response[index].mappings;
    } catch (error) {
      logger.error(`Failed to get mapping for index ${index}:`, error);
      throw error;
    }
  }

  public async getIndexSettings(index: string): Promise<any> {
    try {
      const response = await this.client.indices.getSettings({
        index,
      });

      return response[index].settings;
    } catch (error) {
      logger.error(`Failed to get settings for index ${index}:`, error);
      throw error;
    }
  }

  public async putIndexTemplate(template: IndexTemplate): Promise<void> {
    try {
      await this.client.indices.putIndexTemplate({
        name: template.index_patterns[0],
        body: template,
      });

      logger.info(`Created index template: ${template.index_patterns[0]}`);
    } catch (error) {
      logger.error(`Failed to create index template:`, error);
      throw error;
    }
  }

  public async indexDocument(
    index: string,
    id: string,
    document: ElasticsearchDocument,
    options: {
      refresh?: boolean | 'wait_for';
      routing?: string;
      timeout?: string;
    } = {}
  ): Promise<any> {
    try {
      const response = await this.client.index({
        index,
        id,
        body: document,
        refresh: options.refresh,
        routing: options.routing,
        timeout: options.timeout,
      });

      logger.debug(`Indexed document ${id} in ${index}`);
      return response;
    } catch (error) {
      logger.error(`Failed to index document ${id} in ${index}:`, error);
      throw error;
    }
  }

  public async updateDocument(
    index: string,
    id: string,
    document: Partial<ElasticsearchDocument>,
    options: {
      refresh?: boolean | 'wait_for';
      routing?: string;
      retryOnConflict?: number;
    } = {}
  ): Promise<any> {
    try {
      const response = await this.client.update({
        index,
        id,
        body: { doc: document },
        refresh: options.refresh,
        routing: options.routing,
        retry_on_conflict: options.retryOnConflict || 3,
      });

      logger.debug(`Updated document ${id} in ${index}`);
      return response;
    } catch (error) {
      logger.error(`Failed to update document ${id} in ${index}:`, error);
      throw error;
    }
  }

  public async deleteDocument(
    index: string,
    id: string,
    options: {
      refresh?: boolean | 'wait_for';
      routing?: string;
    } = {}
  ): Promise<any> {
    try {
      const response = await this.client.delete({
        index,
        id,
        refresh: options.refresh,
        routing: options.routing,
      });

      logger.debug(`Deleted document ${id} from ${index}`);
      return response;
    } catch (error) {
      logger.error(`Failed to delete document ${id} from ${index}:`, error);
      throw error;
    }
  }

  public async getDocument(
    index: string,
    id: string,
    options: {
      _source?: string | string[];
      routing?: string;
    } = {}
  ): Promise<any> {
    try {
      const response = await this.client.get({
        index,
        id,
        _source: options._source,
        routing: options.routing,
      });

      return response;
    } catch (error) {
      if (error.statusCode === 404) {
        return null;
      }
      logger.error(`Failed to get document ${id} from ${index}:`, error);
      throw error;
    }
  }

  public async search<T = any>(
    index: string,
    query: SearchQuery
  ): Promise<SearchResult<T>> {
    try {
      const searchParams: any = {
        index,
        body: {
          query: query.query,
        },
      };

      if (query.sort) {
        searchParams.body.sort = query.sort;
      }

      if (query.from !== undefined) {
        searchParams.body.from = query.from;
      }

      if (query.size !== undefined) {
        searchParams.body.size = query.size;
      }

      if (query.highlight) {
        searchParams.body.highlight = query.highlight;
      }

      if (query.aggregations) {
        searchParams.body.aggs = query.aggregations;
      }

      if (query._source !== undefined) {
        searchParams.body._source = query._source;
      }

      const response = await this.client.search(searchParams);

      logger.debug(`Search in ${index} returned ${response.body.hits.total.value} results`);
      return response.body;
    } catch (error) {
      logger.error(`Failed to search in ${index}:`, error);
      throw error;
    }
  }

  public async msearch<T = any>(
    searches: Array<{
      index: string;
      query: SearchQuery;
    }>
  ): Promise<SearchResult<T>[]> {
    try {
      const body: any[] = [];

      for (const search of searches) {
        body.push({ index: search.index });
        body.push({
          query: search.query.query,
          sort: search.query.sort,
          from: search.query.from,
          size: search.query.size,
          highlight: search.query.highlight,
          aggregations: search.query.aggregations,
          _source: search.query._source,
        });
      }

      const response = await this.client.msearch({ body });

      const results: SearchResult<T>[] = response.body.responses;
      logger.debug(`Multi-search returned ${results.length} result sets`);
      return results;
    } catch (error) {
      logger.error('Failed to perform multi-search:', error);
      throw error;
    }
  }

  public async count(
    index: string,
    query?: any
  ): Promise<number> {
    try {
      const countParams: any = { index };

      if (query) {
        countParams.body = { query };
      }

      const response = await this.client.count(countParams);
      return response.body.count;
    } catch (error) {
      logger.error(`Failed to count documents in ${index}:`, error);
      throw error;
    }
  }

  public async bulk(
    operations: Array<{
      index?: string;
      id?: string;
      document?: ElasticsearchDocument;
      action: 'index' | 'create' | 'update' | 'delete';
      routing?: string;
    }>,
    options: {
      refresh?: boolean | 'wait_for';
      timeout?: string;
    } = {}
  ): Promise<any> {
    try {
      const body: any[] = [];

      for (const operation of operations) {
        const header: any = { [operation.action]: {} };

        if (operation.index) {
          header[operation.action]._index = operation.index;
        }

        if (operation.id) {
          header[operation.action]._id = operation.id;
        }

        if (operation.routing) {
          header[operation.action]._routing = operation.routing;
        }

        body.push(header);

        if (operation.document) {
          if (operation.action === 'update') {
            body.push({ doc: operation.document });
          } else {
            body.push(operation.document);
          }
        }
      }

      const response = await this.client.bulk({
        body,
        refresh: options.refresh,
        timeout: options.timeout,
      });

      if (response.body.errors) {
        const errors = response.body.items.filter((item: any) => {
          const action = Object.keys(item)[0];
          return item[action].error;
        });

        logger.warn(`Bulk operation had ${errors.length} errors:`, errors);
      }

      logger.debug(`Bulk operation completed: ${operations.length} operations`);
      return response.body;
    } catch (error) {
      logger.error('Failed to perform bulk operation:', error);
      throw error;
    }
  }

  public async reindex(
    sourceIndex: string,
    targetIndex: string,
    options: {
      waitForCompletion?: boolean;
      maxDocs?: number;
      query?: any;
      script?: any;
    } = {}
  ): Promise<string> {
    try {
      const response = await this.client.reindex({
        body: {
          source: {
            index: sourceIndex,
            max_docs: options.maxDocs,
            query: options.query,
          },
          dest: {
            index: targetIndex,
          },
          script: options.script,
        },
        wait_for_completion: options.waitForCompletion ?? false,
      });

      const taskId = response.body.task;
      logger.info(`Started reindex task from ${sourceIndex} to ${targetIndex}: ${taskId}`);
      return taskId;
    } catch (error) {
      logger.error(`Failed to reindex from ${sourceIndex} to ${targetIndex}:`, error);
      throw error;
    }
  }

  public async getTask(taskId: string): Promise<any> {
    try {
      const response = await this.client.tasks.get({
        task_id: taskId,
      });

      return response.body.task;
    } catch (error) {
      logger.error(`Failed to get task ${taskId}:`, error);
      throw error;
    }
  }

  public async cancelTask(taskId: string): Promise<void> {
    try {
      await this.client.tasks.cancel({
        task_id: taskId,
      });

      logger.info(`Cancelled task: ${taskId}`);
    } catch (error) {
      logger.error(`Failed to cancel task ${taskId}:`, error);
      throw error;
    }
  }

  public async refresh(index: string): Promise<void> {
    try {
      await this.client.indices.refresh({
        index,
      });

      logger.debug(`Refreshed index: ${index}`);
    } catch (error) {
      logger.error(`Failed to refresh index ${index}:`, error);
      throw error;
    }
  }

  public async flush(index: string): Promise<void> {
    try {
      await this.client.indices.flush({
        index,
      });

      logger.debug(`Flushed index: ${index}`);
    } catch (error) {
      logger.error(`Failed to flush index ${index}:`, error);
      throw error;
    }
  }

  public async analyze(
    index: string,
    text: string,
    analyzer?: string,
    field?: string
  ): Promise<any> {
    try {
      const params: any = {
        index,
        body: {
          text,
        },
      };

      if (analyzer) {
        params.body.analyzer = analyzer;
      } else if (field) {
        params.body.field = field;
      }

      const response = await this.client.indices.analyze(params);
      return response.body;
    } catch (error) {
      logger.error(`Failed to analyze text for index ${index}:`, error);
      throw error;
    }
  }

  public async getClusterHealth(): Promise<{
    status: 'green' | 'yellow' | 'red';
    nodes: number;
    shards: {
      total: number;
      successful: number;
      failed: number;
    };
    active_primary_shards: number;
    active_shards: number;
  }> {
    try {
      const response = await this.client.cluster.health();

      return {
        status: response.body.status,
        nodes: response.body.number_of_nodes,
        shards: {
          total: response.body.active_shards,
          successful: response.body.active_shards,
          failed: response.body.unassigned_shards,
        },
        active_primary_shards: response.body.active_primary_shards,
        active_shards: response.body.active_shards,
      };
    } catch (error) {
      logger.error('Failed to get cluster health:', error);
      throw error;
    }
  }

  public async getClusterStats(): Promise<any> {
    try {
      const response = await this.client.cluster.stats();
      return response.body;
    } catch (error) {
      logger.error('Failed to get cluster stats:', error);
      throw error;
    }
  }

  public async getIndicesStats(indexPattern = '*'): Promise<any> {
    try {
      const response = await this.client.indices.stats({
        index: indexPattern,
      });

      return response.body;
    } catch (error) {
      logger.error(`Failed to get indices stats for pattern ${indexPattern}:`, error);
      throw error;
    }
  }

  // Helper methods for common operations

  public async ensureIndex(
    index: string,
    mappings: any,
    settings: any = {}
  ): Promise<void> {
    const exists = await this.indexExists(index);
    if (!exists) {
      await this.createIndex(index, mappings, settings);
    }
  }

  public async indexCodeSnippet(
    index: string,
    id: string,
    code: string,
    metadata: {
      file: string;
      language: string;
      repository?: string;
      commit?: string;
      author?: string;
      timestamp?: string;
    }
  ): Promise<void> {
    const document = {
      content: code,
      file: metadata.file,
      language: metadata.language,
      repository: metadata.repository,
      commit: metadata.commit,
      author: metadata.author,
      timestamp: metadata.timestamp || new Date().toISOString(),
      indexed_at: new Date().toISOString(),
    };

    await this.indexDocument(index, id, document);
  }

  public async searchCode(
    index: string,
    query: string,
    options: {
      languages?: string[];
      repositories?: string[];
      authors?: string[];
      limit?: number;
      highlight?: boolean;
    } = {}
  ): Promise<SearchResult> {
    const mustQueries: any[] = [
      {
        query_string: {
          query,
          fields: ['content^2', 'file', 'language'],
          minimum_should_match: '75%',
        },
      },
    ];

    if (options.languages && options.languages.length > 0) {
      mustQueries.push({
        terms: { language: options.languages },
      });
    }

    if (options.repositories && options.repositories.length > 0) {
      mustQueries.push({
        terms: { repository: options.repositories },
      });
    }

    if (options.authors && options.authors.length > 0) {
      mustQueries.push({
        terms: { author: options.authors },
      });
    }

    const searchQuery: SearchQuery = {
      query: {
        bool: {
          must: mustQueries,
        },
      },
      size: options.limit || 10,
      highlight: options.highlight ? {
        fields: {
          content: {
            fragment_size: 150,
            number_of_fragments: 3,
          },
        },
      } : undefined,
    };

    return this.search(index, searchQuery);
  }

  public async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    cluster: any;
    indices: number;
    totalDocuments: number;
  }> {
    try {
      const clusterHealth = await this.getClusterHealth();
      const indices = await this.getIndices();

      let totalDocuments = 0;
      try {
        const indicesStats = await this.getIndicesStats();
        totalDocuments = Object.values(indicesStats.indices).reduce(
          (total: number, indexStats: any) => total + (indexStats?.total?.docs?.count || 0),
          0
        );
      } catch (error) {
        logger.warn('Failed to get total document count:', error);
      }

      let status: 'healthy' | 'degraded' | 'unhealthy';
      if (clusterHealth.status === 'green') {
        status = 'healthy';
      } else if (clusterHealth.status === 'yellow') {
        status = 'degraded';
      } else {
        status = 'unhealthy';
      }

      return {
        status,
        cluster: clusterHealth,
        indices: indices.length,
        totalDocuments,
      };
    } catch (error) {
      logger.error('Elasticsearch health check failed:', error);
      return {
        status: 'unhealthy',
        cluster: null,
        indices: 0,
        totalDocuments: 0,
      };
    }
  }
}

// Export singleton instance
export const elasticsearchService = new ElasticsearchService();
