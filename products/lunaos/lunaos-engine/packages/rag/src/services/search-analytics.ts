import {
  SearchAnalyticsEntry,
  SearchPerformanceStats,
  TopQueryEntry,
} from '../interfaces';
import { D1MetadataStore } from './metadata-store';

export class SearchAnalyticsService {
  private metadataStore: D1MetadataStore;

  constructor(metadataStore: D1MetadataStore) {
    this.metadataStore = metadataStore;
  }

  async recordSearch(entry: SearchAnalyticsEntry): Promise<void> {
    await this.metadataStore.recordSearchAnalytics(entry);
  }

  async getPerformanceStats(): Promise<SearchPerformanceStats> {
    return this.metadataStore.getSearchPerformanceStats();
  }

  async getTopQueries(limit = 10): Promise<TopQueryEntry[]> {
    return this.metadataStore.getTopQueries(limit);
  }

  async getAnalytics(
    options?: { startDate?: number; endDate?: number; limit?: number }
  ): Promise<SearchAnalyticsEntry[]> {
    return this.metadataStore.getSearchAnalytics(options);
  }
}
