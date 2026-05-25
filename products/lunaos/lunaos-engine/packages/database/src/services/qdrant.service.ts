import { QdrantClient, Schemas, models, vectors } from '@qdrant/js-client-rest';
import { logger } from '../utils/logger';
import { dbConnectionManager } from '../connection';

export interface VectorPoint {
  id: string | number;
  vector: number[];
  payload?: Record<string, any>;
}

export interface SearchParams {
  vector: number[];
  limit?: number;
  offset?: number;
  scoreThreshold?: number;
  filter?: Schemas.Filter;
  includePayload?: boolean;
  includeVector?: boolean;
  searchParams?: Schemas.SearchParams;
}

export interface SearchResult {
  id: string | number;
  score: number;
  payload?: Record<string, any>;
  vector?: number[];
}

export interface CreateCollectionParams {
  vectors: Schemas.VectorParams;
  shard_number?: number;
  replication_factor?: number;
  write_consistency_factor?: number;
  on_disk?: boolean;
  hnsw_config?: Schemas.HnswConfigDiff;
  wal_config?: Schemas.WalConfigDiff;
  optimizers_config?: Schemas.OptimizersConfigDiff;
  quantization_config?: Schemas.QuantizationConfigDiff;
  init_from?: Schemas.InitFrom;
}

export interface CollectionInfo {
  name: string;
  vectors: Schemas.VectorParams;
  pointsCount: number;
  segmentsCount: number;
  diskDataSize: number;
  ramDataSize: number;
  config: Schemas.CollectionConfig;
  status: 'green' | 'yellow' | 'red';
  optimizer_status: Schemas.OptimizerStatus;
  indexed_vectors_count: number;
}

export class QdrantService {
  private client: QdrantClient;

  constructor() {
    this.client = dbConnectionManager.getQdrantClient();
  }

  public async initialize(): Promise<void> {
    try {
      // Test connection
      await this.client.health();
      logger.info('Qdrant service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Qdrant service:', error);
      throw error;
    }
  }

  public async createCollection(
    name: string,
    params: CreateCollectionParams
  ): Promise<void> {
    try {
      await this.client.createCollection(name, params);
      logger.info(`Created Qdrant collection: ${name}`);
    } catch (error) {
      logger.error(`Failed to create collection ${name}:`, error);
      throw error;
    }
  }

  public async listCollections(): Promise<string[]> {
    try {
      const response = await this.client.getCollections();
      return response.collections.map(collection => collection.name);
    } catch (error) {
      logger.error('Failed to list collections:', error);
      throw error;
    }
  }

  public async getCollectionInfo(name: string): Promise<CollectionInfo> {
    try {
      const response = await this.client.getCollection(name);
      return {
        name: response.result.name,
        vectors: response.result.config.params.vectors,
        pointsCount: response.result.points_count,
        segmentsCount: response.result.segments_count,
        diskDataSize: response.result.disk_data_size,
        ramDataSize: response.result.ram_data_size,
        config: response.result.config,
        status: response.result.status,
        optimizer_status: response.result.optimizer_status,
        indexed_vectors_count: response.result.indexed_vectors_count || 0,
      };
    } catch (error) {
      logger.error(`Failed to get collection info for ${name}:`, error);
      throw error;
    }
  }

  public async deleteCollection(name: string): Promise<void> {
    try {
      await this.client.deleteCollection(name);
      logger.info(`Deleted Qdrant collection: ${name}`);
    } catch (error) {
      logger.error(`Failed to delete collection ${name}:`, error);
      throw error;
    }
  }

  public async updateCollection(
    name: string,
    params: Partial<CreateCollectionParams>
  ): Promise<void> {
    try {
      await this.client.updateCollection(name, {
        vectors: params.vectors,
        optimizers_config: params.optimizers_config,
        hnsw_config: params.hnsw_config,
        quantization_config: params.quantization_config,
      });
      logger.info(`Updated Qdrant collection: ${name}`);
    } catch (error) {
      logger.error(`Failed to update collection ${name}:`, error);
      throw error;
    }
  }

  public async upsertPoints(
    collectionName: string,
    points: VectorPoint[]
  ): Promise<models.UpdateResult> {
    try {
      const qdrantPoints: Schemas.PointStruct[] = points.map(point => ({
        id: point.id,
        vector: point.vector,
        payload: point.payload,
      }));

      const result = await this.client.upsert(collectionName, {
        wait: true,
        points: qdrantPoints,
      });

      logger.debug(`Upserted ${points.length} points to collection ${collectionName}`);
      return result.result;
    } catch (error) {
      logger.error(`Failed to upsert points to collection ${collectionName}:`, error);
      throw error;
    }
  }

  public async updatePoints(
    collectionName: string,
    points: VectorPoint[]
  ): Promise<models.UpdateResult> {
    try {
      const qdrantPoints: Schemas.PointStruct[] = points.map(point => ({
        id: point.id,
        vector: point.vector,
        payload: point.payload,
      }));

      const result = await this.client.update(collectionName, {
        wait: true,
        points: qdrantPoints,
      });

      logger.debug(`Updated ${points.length} points in collection ${collectionName}`);
      return result.result;
    } catch (error) {
      logger.error(`Failed to update points in collection ${collectionName}:`, error);
      throw error;
    }
  }

  public async deletePoints(
    collectionName: string,
    points: (string | number)[]
  ): Promise<models.UpdateResult> {
    try {
      const result = await this.client.delete(collectionName, {
        wait: true,
        points: points,
      });

      logger.debug(`Deleted ${points.length} points from collection ${collectionName}`);
      return result.result;
    } catch (error) {
      logger.error(`Failed to delete points from collection ${collectionName}:`, error);
      throw error;
    }
  }

  public async search(
    collectionName: string,
    params: SearchParams
  ): Promise<SearchResult[]> {
    try {
      const searchParams: Schemas.SearchParams = {
        vector: params.vector,
        limit: params.limit || 10,
        offset: params.offset || 0,
        score_threshold: params.scoreThreshold,
        filter: params.filter,
        with_payload: params.includePayload ?? true,
        with_vector: params.includeVector ?? false,
        search_params: params.searchParams,
      };

      const response = await this.client.search(collectionName, searchParams);

      const results: SearchResult[] = response.map(result => ({
        id: result.id,
        score: result.score,
        payload: result.payload || undefined,
        vector: result.vector || undefined,
      }));

      logger.debug(`Search in ${collectionName} returned ${results.length} results`);
      return results;
    } catch (error) {
      logger.error(`Failed to search in collection ${collectionName}:`, error);
      throw error;
    }
  }

  public async searchGroups(
    collectionName: string,
    params: SearchParams & {
      groupBy: string;
      groupSize?: number;
    }
  ): Promise<models.GroupsResult> {
    try {
      const searchParams: Schemas.SearchParams = {
        vector: params.vector,
        limit: params.limit || 10,
        offset: params.offset || 0,
        score_threshold: params.scoreThreshold,
        filter: params.filter,
        with_payload: params.includePayload ?? true,
        with_vector: params.includeVector ?? false,
        search_params: params.searchParams,
      };

      const response = await this.client.searchGroups(collectionName, {
        ...searchParams,
        group_by: params.groupBy,
        group_size: params.groupSize || 1,
      });

      logger.debug(`Group search in ${collectionName} returned ${response.groups.length} groups`);
      return response;
    } catch (error) {
      logger.error(`Failed to search groups in collection ${collectionName}:`, error);
      throw error;
    }
  }

  public async recommend(
    collectionName: string,
    positivePoints: (string | number)[],
    negativePoints?: (string | number)[],
    params: Partial<SearchParams> = {}
  ): Promise<SearchResult[]> {
    try {
      const recommendParams: Schemas.RecommendRequest = {
        positive: positivePoints,
        negative: negativePoints || [],
        limit: params.limit || 10,
        offset: params.offset || 0,
        score_threshold: params.scoreThreshold,
        filter: params.filter,
        with_payload: params.includePayload ?? true,
        with_vector: params.includeVector ?? false,
        search_params: params.searchParams,
        using: undefined, // Use default vector
        lookup_from: undefined, // Use current collection
      };

      const response = await this.client.recommend(collectionName, recommendParams);

      const results: SearchResult[] = response.map(result => ({
        id: result.id,
        score: result.score,
        payload: result.payload || undefined,
        vector: result.vector || undefined,
      }));

      logger.debug(`Recommendation in ${collectionName} returned ${results.length} results`);
      return results;
    } catch (error) {
      logger.error(`Failed to get recommendations from collection ${collectionName}:`, error);
      throw error;
    }
  }

  public async countPoints(
    collectionName: string,
    filter?: Schemas.Filter
  ): Promise<number> {
    try {
      const response = await this.client.count(collectionName, {
        filter,
        exact: true,
      });
      return response.result.count;
    } catch (error) {
      logger.error(`Failed to count points in collection ${collectionName}:`, error);
      throw error;
    }
  }

  public async getPoints(
    collectionName: string,
    ids: (string | number)[],
    withPayload = true,
    withVector = false
  ): Promise<models.RetrievedPoint[]> {
    try {
      const response = await this.client.retrieve(collectionName, {
        ids,
        with_payload: withPayload,
        with_vector: withVector,
      });

      logger.debug(`Retrieved ${response.length} points from collection ${collectionName}`);
      return response;
    } catch (error) {
      logger.error(`Failed to retrieve points from collection ${collectionName}:`, error);
      throw error;
    }
  }

  public async scroll(
    collectionName: string,
    filter?: Schemas.Filter,
    limit = 100,
    offset?: models.PointId,
    withPayload = true,
    withVector = false
  ): Promise<{
    points: models.RetrievedPoint[];
    nextPageOffset?: models.PointId;
  }> {
    try {
      const response = await this.client.scroll(collectionName, {
        filter,
        limit,
        offset,
        with_payload: withPayload,
        with_vector: withVector,
      });

      logger.debug(`Scrolled ${response.result.points.length} points from collection ${collectionName}`);
      return {
        points: response.result.points,
        nextPageOffset: response.result.next_page_offset,
      };
    } catch (error) {
      logger.error(`Failed to scroll collection ${collectionName}:`, error);
      throw error;
    }
  }

  public async clearCollection(collectionName: string): Promise<void> {
    try {
      // Alternative to deleting the collection, just remove all points
      const count = await this.countPoints(collectionName);
      if (count > 0) {
        // This is a workaround - we'll recreate the collection
        const info = await this.getCollectionInfo(collectionName);
        await this.deleteCollection(collectionName);
        await this.createCollection(collectionName, {
          vectors: info.vectors,
          shard_number: info.config.params.shard_number,
          replication_factor: info.config.params.replication_factor,
          write_consistency_factor: info.config.params.write_consistency_factor,
          on_disk: info.config.params.on_disk,
        });

        logger.info(`Cleared collection ${collectionName} (removed ${count} points)`);
      }
    } catch (error) {
      logger.error(`Failed to clear collection ${collectionName}:`, error);
      throw error;
    }
  }

  public async getCollectionStats(collectionName: string): Promise<{
    pointsCount: number;
    vectorsCount: number;
    indexedVectorsCount: number;
    segmentsCount: number;
    diskDataSize: number;
    ramDataSize: number;
    status: string;
  }> {
    try {
      const info = await this.getCollectionInfo(collectionName);
      return {
        pointsCount: info.pointsCount,
        vectorsCount: info.pointsCount, // Usually one vector per point
        indexedVectorsCount: info.indexed_vectors_count,
        segmentsCount: info.segmentsCount,
        diskDataSize: info.diskDataSize,
        ramDataSize: info.ramDataSize,
        status: info.status,
      };
    } catch (error) {
      logger.error(`Failed to get stats for collection ${collectionName}:`, error);
      throw error;
    }
  }

  public async getClusterInfo(): Promise<{
    status: string;
    committed_collections: number;
    uncommitted_collections: number;
    nodes: {
      id: string;
      uri: string;
      state: string;
      health: string;
    }[];
  }> {
    try {
      const response = await this.client.clusterInfo();

      return {
        status: response.result.status,
        committed_collections: response.result.commited_collections_count,
        uncommitted_collections: response.result.uncommited_collections_count,
        nodes: response.result.ring.map(node => ({
          id: node.node_id,
          uri: node.uri,
          state: node.state,
          health: node.health,
        })),
      };
    } catch (error) {
      logger.error('Failed to get cluster info:', error);
      throw error;
    }
  }

  public async createSnapshot(collectionName: string): Promise<string> {
    try {
      const response = await this.client.createSnapshot(collectionName);
      const snapshotPath = response.result.name;
      logger.info(`Created snapshot for collection ${collectionName}: ${snapshotPath}`);
      return snapshotPath;
    } catch (error) {
      logger.error(`Failed to create snapshot for collection ${collectionName}:`, error);
      throw error;
    }
  }

  public async listSnapshots(collectionName: string): Promise<string[]> {
    try {
      const response = await this.client.listSnapshots(collectionName);
      return response.result.snapshots.map(snapshot => snapshot.name);
    } catch (error) {
      logger.error(`Failed to list snapshots for collection ${collectionName}:`, error);
      throw error;
    }
  }

  public async deleteSnapshot(collectionName: string, snapshotName: string): Promise<void> {
    try {
      await this.client.deleteSnapshot(collectionName, snapshotName);
      logger.info(`Deleted snapshot ${snapshotName} for collection ${collectionName}`);
    } catch (error) {
      logger.error(`Failed to delete snapshot ${snapshotName} for collection ${collectionName}:`, error);
      throw error;
    }
  }

  // Helper methods for common operations

  public async ensureCollection(
    name: string,
    vectorConfig: Schemas.VectorParams
  ): Promise<void> {
    try {
      const collections = await this.listCollections();
      if (!collections.includes(name)) {
        await this.createCollection(name, {
          vectors: vectorConfig,
          shard_number: 1,
          replication_factor: 1,
        });
        logger.info(`Auto-created collection: ${name}`);
      }
    } catch (error) {
      logger.error(`Failed to ensure collection ${name}:`, error);
      throw error;
    }
  }

  public async addEmbedding(
    collectionName: string,
    id: string,
    embedding: number[],
    payload?: Record<string, any>
  ): Promise<void> {
    await this.upsertPoints(collectionName, [{
      id,
      vector: embedding,
      payload,
    }]);
  }

  public async searchByEmbedding(
    collectionName: string,
    embedding: number[],
    limit = 10,
    threshold = 0.7
  ): Promise<SearchResult[]> {
    return this.search(collectionName, {
      vector: embedding,
      limit,
      scoreThreshold: threshold,
      includePayload: true,
    });
  }

  public async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    collections: number;
    totalPoints: number;
    clusterInfo?: any;
  }> {
    try {
      const health = await this.client.health();
      const collections = await this.listCollections();

      let totalPoints = 0;
      for (const collection of collections) {
        try {
          const stats = await this.getCollectionStats(collection);
          totalPoints += stats.pointsCount;
        } catch (error) {
          logger.warn(`Failed to get stats for collection ${collection}:`, error);
        }
      }

      let clusterInfo;
      try {
        clusterInfo = await this.getClusterInfo();
      } catch (error) {
        // Cluster info might not be available in single-node setup
        logger.debug('Cluster info not available:', error);
      }

      return {
        status: health.status === 'ok' ? 'healthy' : 'unhealthy',
        collections: collections.length,
        totalPoints,
        clusterInfo,
      };
    } catch (error) {
      logger.error('Qdrant health check failed:', error);
      return {
        status: 'unhealthy',
        collections: 0,
        totalPoints: 0,
      };
    }
  }
}

// Export singleton instance
export const qdrantService = new QdrantService();
