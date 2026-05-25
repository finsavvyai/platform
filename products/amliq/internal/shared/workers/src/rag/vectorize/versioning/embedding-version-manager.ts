/**
 * Embedding Versioning System
 *
 * Manages versioning of vector embeddings to support:
 * - Model updates and migrations
 * - Chunking strategy improvements
 * - A/B testing of embedding approaches
 * - Rollback capabilities
 */

export interface EmbeddingVersion {
  version: string;
  model: string;
  chunkingStrategy: string;
  embeddingDimensions: number;
  createdAt: string;
  isActive: boolean;
  migrationFrom?: string;
  metadata: Record<string, any>;
}

export interface VersionMetadata {
  documentId: string;
  version: string;
  previousVersion?: string;
  migrationReason: 'model_update' | 'chunking_improvement' | 'error_fix' | 'strategy_change';
  migratedAt: string;
  checksum: string;
}

export interface MigrationResult {
  success: boolean;
  documentsMigrated: number;
  errors: string[];
  migrationId: string;
}

export class EmbeddingVersionManager {
  private versions: Map<string, EmbeddingVersion> = new Map();
  private currentVersion: string | null = null;

  constructor(
    private vectorService: any,
    private logger: any
  ) {}

  /**
   * Register a new embedding version
   */
  registerVersion(version: EmbeddingVersion): void {
    this.versions.set(version.version, version);

    if (version.isActive) {
      // Deactivate all other versions
      for (const [v, ver] of this.versions.entries()) {
        if (v !== version.version) {
          ver.isActive = false;
        }
      }
      this.currentVersion = version.version;
    }

    this.logger?.info("Embedding version registered", {
      version: version.version,
      model: version.model,
      chunkingStrategy: version.chunkingStrategy,
      isActive: version.isActive
    });
  }

  /**
   * Get current active version
   */
  getCurrentVersion(): EmbeddingVersion | null {
    if (!this.currentVersion) {
      return null;
    }
    return this.versions.get(this.currentVersion) || null;
  }

  /**
   * Get version by version string
   */
  getVersion(version: string): EmbeddingVersion | null {
    return this.versions.get(version) || null;
  }

  /**
   * List all available versions
   */
  listVersions(): EmbeddingVersion[] {
    return Array.from(this.versions.values()).sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  /**
   * Create a new version (for model updates or strategy changes)
   */
  async createVersion(
    version: string,
    model: string,
    chunkingStrategy: string,
    embeddingDimensions: number,
    migrationFrom?: string
  ): Promise<void> {
    const newVersion: EmbeddingVersion = {
      version,
      model,
      chunkingStrategy,
      embeddingDimensions,
      createdAt: new Date().toISOString(),
      isActive: false, // Will be activated after migration
      migrationFrom,
      metadata: {}
    };

    this.registerVersion(newVersion);

    this.logger?.info("New embedding version created", {
      version,
      model,
      chunkingStrategy,
      embeddingDimensions,
      migrationFrom
    });
  }

  /**
   * Activate a version (deactivates current version)
   */
  async activateVersion(version: string): Promise<void> {
    const versionInfo = this.versions.get(version);
    if (!versionInfo) {
      throw new Error(`Version ${version} not found`);
    }

    // Deactivate current version
    if (this.currentVersion) {
      const currentVer = this.versions.get(this.currentVersion);
      if (currentVer) {
        currentVer.isActive = false;
      }
    }

    // Activate new version
    versionInfo.isActive = true;
    this.currentVersion = version;

    this.logger?.info("Embedding version activated", {
      version,
      model: versionInfo.model,
      chunkingStrategy: versionInfo.chunkingStrategy
    });
  }

  /**
   * Migrate documents from one version to another
   */
  async migrateDocuments(
    fromVersion: string,
    toVersion: string,
    documentIds?: string[] // If not provided, migrate all documents
  ): Promise<MigrationResult> {
    const migrationId = `migration_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const fromVer = this.versions.get(fromVersion);
    const toVer = this.versions.get(toVersion);

    if (!fromVer || !toVer) {
      throw new Error(`Invalid version migration: ${fromVersion} -> ${toVersion}`);
    }

    this.logger?.info("Starting document migration", {
      migrationId,
      fromVersion,
      toVersion,
      documentCount: documentIds?.length || 'all'
    });

    const result: MigrationResult = {
      success: true,
      documentsMigrated: 0,
      errors: [],
      migrationId
    };

    try {
      // Get documents to migrate
      const documentsToMigrate = documentIds ||
        await this.getDocumentsForVersion(fromVersion);

      // Process documents in batches
      const batchSize = 10;
      for (let i = 0; i < documentsToMigrate.length; i += batchSize) {
        const batch = documentsToMigrate.slice(i, i + batchSize);

        for (const documentId of batch) {
          try {
            await this.migrateDocument(documentId, fromVersion, toVersion);
            result.documentsMigrated++;
          } catch (error) {
            result.errors.push(`Failed to migrate ${documentId}: ${error.message}`);
          }
        }

        // Add delay to avoid rate limits
        if (i + batchSize < documentsToMigrate.length) {
          await this.sleep(100);
        }
      }

      result.success = result.errors.length === 0;

      this.logger?.info("Document migration completed", {
        migrationId,
        success: result.success,
        documentsMigrated: result.documentsMigrated,
        errorsCount: result.errors.length
      });

    } catch (error) {
      result.success = false;
      result.errors.push(`Migration failed: ${error.message}`);

      this.logger?.error("Document migration failed", {
        migrationId,
        error: error.message
      });
    }

    return result;
  }

  /**
   * Migrate a single document
   */
  private async migrateDocument(
    documentId: string,
    fromVersion: string,
    toVersion: string
  ): Promise<void> {
    // Get original content
    const originalContent = await this.getOriginalContent(documentId);
    if (!originalContent) {
      throw new Error(`Original content not found for document ${documentId}`);
    }

    // Generate new embeddings with target version
    // This would use the new embedding model/chunking strategy
    const newEmbeddings = await this.generateEmbeddingsForVersion(
      originalContent,
      toVersion
    );

    // Store new embeddings with version metadata
    await this.storeVersionedEmbeddings(
      documentId,
      newEmbeddings,
      toVersion,
      fromVersion
    );

    // Mark old embeddings as inactive (but keep for rollback)
    await this.deactivateEmbeddings(documentId, fromVersion);
  }

  /**
   * Get documents that have embeddings for a specific version
   */
  private async getDocumentsForVersion(version: string): Promise<string[]> {
    // Query Vectorize for documents with this version
    const results = await this.vectorService.queryByMetadata({
      version,
      isActive: true
    }, {
      topK: 10000, // Large number to get all documents
      includeValues: false
    });

    // Extract unique document IDs
    const documentIds = new Set<string>();
    for (const match of results.matches || []) {
      if (match.metadata?.documentId) {
        documentIds.add(match.metadata.documentId);
      }
    }

    return Array.from(documentIds);
  }

  /**
   * Get original content for re-processing
   */
  private async getOriginalContent(documentId: string): Promise<any> {
    // This would retrieve the original document content
    // Could be from R2, D1, or another storage system
    const results = await this.vectorService.queryByMetadata({
      documentId,
      isActive: true
    }, {
      topK: 1,
      includeValues: false
    });

    if (results.matches && results.matches.length > 0) {
      return results.matches[0].metadata?.originalContent;
    }

    return null;
  }

  /**
   * Generate embeddings for a specific version
   */
  private async generateEmbeddingsForVersion(
    content: any,
    version: string
  ): Promise<any[]> {
    const versionInfo = this.versions.get(version);
    if (!versionInfo) {
      throw new Error(`Version ${version} not found`);
    }

    // This would use the specific model and chunking strategy
    // for the target version
    // For now, return a placeholder
    return [];
  }

  /**
   * Store versioned embeddings
   */
  private async storeVersionedEmbeddings(
    documentId: string,
    embeddings: any[],
    version: string,
    previousVersion: string
  ): Promise<void> {
    const versionMetadata: VersionMetadata = {
      documentId,
      version,
      previousVersion,
      migrationReason: 'model_update',
      migratedAt: new Date().toISOString(),
      checksum: this.calculateChecksum(embeddings)
    };

    // Store embeddings with version metadata
    for (const embedding of embeddings) {
      await this.vectorService.upsert({
        id: `${documentId}_${version}_${embedding.id}`,
        values: embedding.values,
        metadata: {
          ...embedding.metadata,
          version,
          previousVersion,
          migrationMetadata: versionMetadata,
          isActive: true
        }
      });
    }
  }

  /**
   * Deactivate embeddings for a version
   */
  private async deactivateEmbeddings(
    documentId: string,
    version: string
  ): Promise<void> {
    // Mark embeddings as inactive for this version
    const results = await this.vectorService.queryByMetadata({
      documentId,
      version,
      isActive: true
    }, {
      topK: 1000,
      includeValues: false
    });

    for (const match of results.matches || []) {
      await this.vectorService.updateMetadata(match.id, {
        ...match.metadata,
        isActive: false,
        deactivatedAt: new Date().toISOString()
      });
    }
  }

  /**
   * Calculate checksum for embeddings
   */
  private calculateChecksum(embeddings: any[]): string {
    const content = JSON.stringify(embeddings);
    return this.simpleHash(content);
  }

  /**
   * Simple hash function
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Rollback to a previous version
   */
  async rollbackToVersion(version: string): Promise<MigrationResult> {
    const currentVer = this.getCurrentVersion();
    if (!currentVer) {
      throw new Error("No current version to rollback from");
    }

    return this.migrateDocuments(
      currentVer.version,
      version
    );
  }

  /**
   * Clean up old inactive embeddings to save storage
   */
  async cleanupOldVersions(
    keepVersions: number = 2,
    olderThanDays: number = 30
  ): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const versions = this.listVersions();
    const activeVersions = versions
      .filter(v => v.isActive || new Date(v.createdAt) > cutoffDate)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, keepVersions);

    const activeVersionSet = new Set(activeVersions.map(v => v.version));

    // Find and delete embeddings for versions to clean up
    for (const version of versions) {
      if (!activeVersionSet.has(version.version) && !version.isActive) {
        await this.cleanupVersion(version.version);
      }
    }

    this.logger?.info("Old embedding versions cleaned up", {
      totalVersions: versions.length,
      keptVersions: activeVersions.length,
      cutoffDate: cutoffDate.toISOString()
    });
  }

  /**
   * Clean up embeddings for a specific version
   */
  private async cleanupVersion(version: string): Promise<void> {
    const results = await this.vectorService.queryByMetadata({
      version,
      isActive: false
    }, {
      topK: 10000,
      includeValues: false
    });

    for (const match of results.matches || []) {
      await this.vectorService.delete(match.id);
    }

    this.logger?.info("Embedding version cleaned up", {
      version,
      deletedCount: results.matches?.length || 0
    });
  }

  /**
   * Sleep helper for rate limiting
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get version statistics
   */
  getVersionStats(): {
    totalVersions: number;
    activeVersion: string | null;
    versionCounts: Record<string, number>;
  } {
    const versionCounts: Record<string, number> = {};

    for (const version of this.versions.values()) {
      versionCounts[version.version] = 0; // Will be populated with actual counts
    }

    return {
      totalVersions: this.versions.size,
      activeVersion: this.currentVersion,
      versionCounts
    };
  }
}
