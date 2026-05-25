import { AsyncStorage } from '@react-native-async-storage/async-storage';

interface ConflictRule {
  entityType: string;
  resolution: 'local_wins' | 'remote_wins' | 'merge' | 'manual';
  mergeStrategy?: (local: any, remote: any) => any;
}

interface Conflict {
  id: string;
  entityType: string;
  entityId: string;
  localData: any;
  remoteData: any;
  timestamp: string;
  status: 'pending' | 'resolved' | 'deferred';
  resolution?: string;
  resolvedData?: any;
}

export class ConflictResolutionService {
  private conflictRules: Map<string, ConflictRule> = new Map();
  private conflicts: Conflict[] = [];

  constructor() {
    this.initializeDefaultRules();
    this.loadPendingConflicts();
  }

  private initializeDefaultRules() {
    // Define conflict resolution rules for different entity types
    const rules: ConflictRule[] = [
      {
        entityType: 'user_preferences',
        resolution: 'merge',
        mergeStrategy: (local, remote) => ({
          ...remote,
          // Keep local preferences that don't exist remotely
          ...Object.keys(local).reduce((acc, key) => {
            if (remote[key] === undefined) {
              acc[key] = local[key];
            }
            return acc;
          }, {} as any)
        })
      },
      {
        entityType: 'connection',
        resolution: 'remote_wins' // Server connections are authoritative
      },
      {
        entityType: 'saved_query',
        resolution: 'manual' // User should resolve query conflicts
      },
      {
        entityType: 'query_result',
        resolution: 'remote_wins' // Fresh data from server wins
      },
      {
        entityType: 'alert',
        resolution: 'merge',
        mergeStrategy: (local, remote) => ({
          ...remote,
          // Keep local acknowledgment status
          acknowledged: local.acknowledged || remote.acknowledged,
          acknowledgedAt: local.acknowledgedAt || remote.acknowledgedAt,
          // Keep most recent resolution status
          resolved: local.resolved || remote.resolved,
          resolvedAt: local.resolvedAt || remote.resolvedAt
        })
      },
      {
        entityType: 'metric',
        resolution: 'remote_wins' // Server metrics are authoritative
      }
    ];

    rules.forEach(rule => {
      this.conflictRules.set(rule.entityType, rule);
    });
  }

  public async detectConflict(
    entityType: string,
    entityId: string,
    localData: any,
    remoteData: any
  ): Promise<Conflict | null> {
    try {
      // Simple conflict detection - compare data hashes
      const localHash = this.hashData(localData);
      const remoteHash = this.hashData(remoteData);

      if (localHash === remoteHash) {
        return null; // No conflict
      }

      const conflict: Conflict = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        entityType,
        entityId,
        localData,
        remoteData,
        timestamp: new Date().toISOString(),
        status: 'pending'
      };

      this.conflicts.push(conflict);
      await this.saveConflicts();

      console.log(`Conflict detected for ${entityType}:${entityId}`);
      return conflict;
    } catch (error) {
      console.error('Conflict detection failed:', error);
      return null;
    }
  }

  public async resolveConflict(conflictId: string, resolution: string, customData?: any): Promise<boolean> {
    try {
      const conflict = this.conflicts.find(c => c.id === conflictId);
      if (!conflict) {
        console.error(`Conflict not found: ${conflictId}`);
        return false;
      }

      const rule = this.conflictRules.get(conflict.entityType);
      if (!rule) {
        console.error(`No rule found for entity type: ${conflict.entityType}`);
        return false;
      }

      let resolvedData: any;

      switch (resolution) {
        case 'local_wins':
          resolvedData = conflict.localData;
          break;
        case 'remote_wins':
          resolvedData = conflict.remoteData;
          break;
        case 'merge':
          if (rule.mergeStrategy) {
            resolvedData = rule.mergeStrategy(conflict.localData, conflict.remoteData);
          } else {
            resolvedData = this.defaultMerge(conflict.localData, conflict.remoteData);
          }
          break;
        case 'manual':
          resolvedData = customData || conflict.remoteData;
          break;
        default:
          resolvedData = conflict.remoteData;
      }

      conflict.status = 'resolved';
      conflict.resolution = resolution;
      conflict.resolvedData = resolvedData;

      await this.saveConflicts();

      console.log(`Conflict resolved: ${conflict.entityType}:${conflict.entityId} (${resolution})`);
      return true;
    } catch (error) {
      console.error('Conflict resolution failed:', error);
      return false;
    }
  }

  public async autoResolveConflicts(): Promise<{ resolved: number; remaining: number }> {
    try {
      const pendingConflicts = this.conflicts.filter(c => c.status === 'pending');
      let resolved = 0;

      for (const conflict of pendingConflicts) {
        const rule = this.conflictRules.get(conflict.entityType);
        if (rule && rule.resolution !== 'manual') {
          const success = await this.resolveConflict(conflict.id, rule.resolution);
          if (success) {
            resolved++;
          }
        }
      }

      return { resolved, remaining: pendingConflicts.length - resolved };
    } catch (error) {
      console.error('Auto-resolution failed:', error);
      return { resolved: 0, remaining: this.conflicts.filter(c => c.status === 'pending').length };
    }
  }

  public getPendingConflicts(): Conflict[] {
    return this.conflicts.filter(c => c.status === 'pending');
  }

  public getConflictStats() {
    return {
      total: this.conflicts.length,
      pending: this.conflicts.filter(c => c.status === 'pending').length,
      resolved: this.conflicts.filter(c => c.status === 'resolved').length,
      byType: this.groupConflictsByType()
    };
  }

  private async loadPendingConflicts(): Promise<void> {
    try {
      const conflictsData = await AsyncStorage.getItem('conflict_history');
      if (conflictsData) {
        this.conflicts = JSON.parse(conflictsData);
        // Clean up old resolved conflicts
        this.cleanupOldConflicts();
      }
    } catch (error) {
      console.error('Failed to load conflicts:', error);
    }
  }

  private async saveConflicts(): Promise<void> {
    try {
      await AsyncStorage.setItem('conflict_history', JSON.stringify(this.conflicts));
    } catch (error) {
      console.error('Failed to save conflicts:', error);
    }
  }

  private cleanupOldConflicts(): void {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    this.conflicts = this.conflicts.filter(conflict => {
      if (conflict.status === 'resolved' && new Date(conflict.timestamp) < oneWeekAgo) {
        return false; // Remove old resolved conflicts
      }
      return true;
    });
  }

  private groupConflictsByType() {
    const grouped: Record<string, number> = {};
    this.conflicts.forEach(conflict => {
      grouped[conflict.entityType] = (grouped[conflict.entityType] || 0) + 1;
    });
    return grouped;
  }

  private hashData(data: any): string {
    // Simple hash function for conflict detection
    const str = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }

  private defaultMerge(local: any, remote: any): any {
    // Default merge strategy - prioritize remote but keep local-specific fields
    return {
      ...remote,
      ...Object.keys(local).reduce((acc, key) => {
        // Keep local values for fields that don't exist remotely
        if (remote[key] === undefined) {
          acc[key] = local[key];
        }
        return acc;
      }, {} as any)
    };
  }

  public addConflictRule(rule: ConflictRule): void {
    this.conflictRules.set(rule.entityType, rule);
  }

  public removeConflictRule(entityType: string): void {
    this.conflictRules.delete(entityType);
  }

  public clearAllConflicts(): void {
    this.conflicts = [];
    this.saveConflicts();
  }
}

// Global conflict resolution service instance
export const conflictResolutionService = new ConflictResolutionService();