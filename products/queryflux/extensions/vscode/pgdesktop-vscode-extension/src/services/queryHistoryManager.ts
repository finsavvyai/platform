import * as vscode from 'vscode';
import { DatabaseConnectionManager } from './connectionManager';

export interface QueryHistoryEntry {
    id: string;
    connectionId: string;
    query: string;
    result?: {
        rowCount: number;
        executionTime: number;
        columns: string[];
        error?: string;
    };
    timestamp: Date;
    tags: string[];
    favorite: boolean;
    description?: string;
    category?: string;
    executionCount: number;
    lastExecuted: Date;
    averageExecutionTime: number;
    successRate: number;
}

export interface QueryCategory {
    id: string;
    name: string;
    color: string;
    description?: string;
    parentId?: string;
}

export interface QueryTemplate {
    id: string;
    name: string;
    description: string;
    query: string;
    parameters: Array<{
        name: string;
        type: 'string' | 'number' | 'boolean' | 'date';
        required: boolean;
        defaultValue?: any;
        description?: string;
    }>;
    category: string;
    tags: string[];
    databaseTypes: string[];
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
    usageCount: number;
}

export class QueryHistoryManager {
    private connectionManager: DatabaseConnectionManager;
    private history: QueryHistoryEntry[] = [];
    private categories: QueryCategory[] = [];
    private templates: QueryTemplate[] = [];
    private favorites: Set<string> = new Set();
    private searchIndex: Map<string, Set<string>> = new Map();

    constructor(connectionManager: DatabaseConnectionManager) {
        this.connectionManager = connectionManager;
        this.loadHistory();
        this.loadCategories();
        this.loadTemplates();
        this.buildSearchIndex();
    }

    /**
     * Add a query to history
     */
    async addToHistory(
        connectionId: string,
        query: string,
        result?: QueryHistoryEntry['result'],
        tags: string[] = [],
        description?: string,
        category?: string
    ): Promise<string> {
        const id = this.generateId();
        const timestamp = new Date();
        
        // Check if similar query exists
        const existingEntry = this.findSimilarQuery(connectionId, query);
        
        let entry: QueryHistoryEntry;
        
        if (existingEntry) {
            // Update existing entry
            entry = {
                ...existingEntry,
                executionCount: existingEntry.executionCount + 1,
                lastExecuted: timestamp,
                averageExecutionTime: this.calculateAverageExecutionTime(
                    existingEntry.averageExecutionTime,
                    existingEntry.executionCount,
                    result?.executionTime || 0
                ),
                successRate: this.calculateSuccessRate(
                    existingEntry.successRate,
                    existingEntry.executionCount,
                    !result?.error
                ),
                result: result || existingEntry.result,
                tags: [...new Set([...existingEntry.tags, ...tags])],
                description: description || existingEntry.description,
                category: category || existingEntry.category
            };
            
            // Update the entry in history
            const index = this.history.findIndex(h => h.id === existingEntry.id);
            if (index !== -1) {
                this.history[index] = entry;
            }
        } else {
            // Create new entry
            entry = {
                id,
                connectionId,
                query: this.normalizeQuery(query),
                result,
                timestamp,
                tags,
                favorite: false,
                description,
                category,
                executionCount: 1,
                lastExecuted: timestamp,
                averageExecutionTime: result?.executionTime || 0,
                successRate: result?.error ? 0 : 1
            };
            
            this.history.push(entry);
        }

        await this.saveHistory();
        this.updateSearchIndex(entry);
        
        return entry.id;
    }

    /**
     * Get query history with filters
     */
    getHistory(filters: {
        connectionId?: string;
        tags?: string[];
        category?: string;
        favorite?: boolean;
        dateRange?: { start: Date; end: Date };
        search?: string;
        limit?: number;
        offset?: number;
    } = {}): QueryHistoryEntry[] {
        let filtered = [...this.history];

        // Apply filters
        if (filters.connectionId) {
            filtered = filtered.filter(entry => entry.connectionId === filters.connectionId);
        }

        if (filters.tags && filters.tags.length > 0) {
            filtered = filtered.filter(entry => 
                filters.tags!.some(tag => entry.tags.includes(tag))
            );
        }

        if (filters.category) {
            filtered = filtered.filter(entry => entry.category === filters.category);
        }

        if (filters.favorite !== undefined) {
            filtered = filtered.filter(entry => entry.favorite === filters.favorite);
        }

        if (filters.dateRange) {
            filtered = filtered.filter(entry => 
                entry.timestamp >= filters.dateRange!.start && 
                entry.timestamp <= filters.dateRange!.end
            );
        }

        if (filters.search) {
            filtered = this.searchHistory(filtered, filters.search);
        }

        // Sort by last executed (most recent first)
        filtered.sort((a, b) => b.lastExecuted.getTime() - a.lastExecuted.getTime());

        // Apply pagination
        if (filters.offset) {
            filtered = filtered.slice(filters.offset);
        }
        if (filters.limit) {
            filtered = filtered.slice(0, filters.limit);
        }

        return filtered;
    }

    /**
     * Get frequently used queries
     */
    getFrequentQueries(connectionId?: string, limit: number = 10): QueryHistoryEntry[] {
        let filtered = this.history;

        if (connectionId) {
            filtered = filtered.filter(entry => entry.connectionId === connectionId);
        }

        return filtered
            .sort((a, b) => b.executionCount - a.executionCount)
            .slice(0, limit);
    }

    /**
     * Get recent queries
     */
    getRecentQueries(connectionId?: string, limit: number = 10): QueryHistoryEntry[] {
        let filtered = this.history;

        if (connectionId) {
            filtered = filtered.filter(entry => entry.connectionId === connectionId);
        }

        return filtered
            .sort((a, b) => b.lastExecuted.getTime() - a.lastExecuted.getTime())
            .slice(0, limit);
    }

    /**
     * Get favorite queries
     */
    getFavoriteQueries(connectionId?: string): QueryHistoryEntry[] {
        let filtered = this.history.filter(entry => entry.favorite);

        if (connectionId) {
            filtered = filtered.filter(entry => entry.connectionId === connectionId);
        }

        return filtered.sort((a, b) => b.lastExecuted.getTime() - a.lastExecuted.getTime());
    }

    /**
     * Toggle favorite status
     */
    async toggleFavorite(entryId: string): Promise<boolean> {
        const entry = this.history.find(h => h.id === entryId);
        if (!entry) {
            return false;
        }

        entry.favorite = !entry.favorite;
        await this.saveHistory();
        
        if (entry.favorite) {
            this.favorites.add(entryId);
            vscode.window.showInformationMessage('Query added to favorites');
        } else {
            this.favorites.delete(entryId);
            vscode.window.showInformationMessage('Query removed from favorites');
        }

        return entry.favorite;
    }

    /**
     * Update query entry
     */
    async updateEntry(
        entryId: string,
        updates: Partial<Pick<QueryHistoryEntry, 'tags' | 'description' | 'category'>>
    ): Promise<boolean> {
        const entry = this.history.find(h => h.id === entryId);
        if (!entry) {
            return false;
        }

        Object.assign(entry, updates);
        await this.saveHistory();
        this.updateSearchIndex(entry);
        
        return true;
    }

    /**
     * Delete query entry
     */
    async deleteEntry(entryId: string): Promise<boolean> {
        const index = this.history.findIndex(h => h.id === entryId);
        if (index === -1) {
            return false;
        }

        this.history.splice(index, 1);
        this.favorites.delete(entryId);
        await this.saveHistory();
        this.removeFromSearchIndex(entryId);
        
        return true;
    }

    /**
     * Clear history
     */
    async clearHistory(connectionId?: string): Promise<void> {
        if (connectionId) {
            this.history = this.history.filter(entry => entry.connectionId !== connectionId);
        } else {
            this.history = [];
            this.favorites.clear();
        }
        
        await this.saveHistory();
        this.buildSearchIndex();
    }

    /**
     * Create query template
     */
    async createTemplate(template: Omit<QueryTemplate, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>): Promise<string> {
        const id = this.generateId();
        const now = new Date();
        
        const newTemplate: QueryTemplate = {
            ...template,
            id,
            createdAt: now,
            updatedAt: now,
            usageCount: 0
        };

        this.templates.push(newTemplate);
        await this.saveTemplates();
        
        return id;
    }

    /**
     * Get query templates
     */
    getTemplates(filters: {
        category?: string;
        databaseTypes?: string[];
        search?: string;
    } = {}): QueryTemplate[] {
        let filtered = [...this.templates];

        if (filters.category) {
            filtered = filtered.filter(template => template.category === filters.category);
        }

        if (filters.databaseTypes && filters.databaseTypes.length > 0) {
            filtered = filtered.filter(template => 
                filters.databaseTypes!.some(type => template.databaseTypes.includes(type))
            );
        }

        if (filters.search) {
            const searchLower = filters.search.toLowerCase();
            filtered = filtered.filter(template => 
                template.name.toLowerCase().includes(searchLower) ||
                template.description.toLowerCase().includes(searchLower) ||
                template.query.toLowerCase().includes(searchLower)
            );
        }

        return filtered.sort((a, b) => b.usageCount - a.usageCount);
    }

    /**
     * Use template (increment usage count)
     */
    async useTemplate(templateId: string): Promise<QueryTemplate | null> {
        const template = this.templates.find(t => t.id === templateId);
        if (!template) {
            return null;
        }

        template.usageCount++;
        template.updatedAt = new Date();
        await this.saveTemplates();
        
        return template;
    }

    /**
     * Create category
     */
    async createCategory(category: Omit<QueryCategory, 'id'>): Promise<string> {
        const id = this.generateId();
        const newCategory: QueryCategory = { ...category, id };
        
        this.categories.push(newCategory);
        await this.saveCategories();
        
        return id;
    }

    /**
     * Get categories
     */
    getCategories(): QueryCategory[] {
        return [...this.categories];
    }

    /**
     * Get query statistics
     */
    getStatistics(connectionId?: string): {
        totalQueries: number;
        uniqueQueries: number;
        averageExecutionTime: number;
        successRate: number;
        mostUsedTags: Array<{ tag: string; count: number }>;
        queriesByCategory: Array<{ category: string; count: number }>;
        queriesByDay: Array<{ date: string; count: number }>;
    } {
        let filtered = this.history;
        
        if (connectionId) {
            filtered = filtered.filter(entry => entry.connectionId === connectionId);
        }

        const totalQueries = filtered.reduce((sum, entry) => sum + entry.executionCount, 0);
        const uniqueQueries = filtered.length;
        const averageExecutionTime = filtered.reduce((sum, entry) => sum + entry.averageExecutionTime, 0) / filtered.length || 0;
        const successRate = filtered.reduce((sum, entry) => sum + entry.successRate, 0) / filtered.length || 0;

        // Most used tags
        const tagCounts = new Map<string, number>();
        filtered.forEach(entry => {
            entry.tags.forEach(tag => {
                tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
            });
        });
        const mostUsedTags = Array.from(tagCounts.entries())
            .map(([tag, count]) => ({ tag, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        // Queries by category
        const categoryCounts = new Map<string, number>();
        filtered.forEach(entry => {
            const category = entry.category || 'Uncategorized';
            categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1);
        });
        const queriesByCategory = Array.from(categoryCounts.entries())
            .map(([category, count]) => ({ category, count }))
            .sort((a, b) => b.count - a.count);

        // Queries by day (last 30 days)
        const dayCounts = new Map<string, number>();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        filtered
            .filter(entry => entry.timestamp >= thirtyDaysAgo)
            .forEach(entry => {
                const date = entry.timestamp.toISOString().split('T')[0];
                dayCounts.set(date, (dayCounts.get(date) || 0) + 1);
            });
        
        const queriesByDay = Array.from(dayCounts.entries())
            .map(([date, count]) => ({ date, count }))
            .sort((a, b) => a.date.localeCompare(b.date));

        return {
            totalQueries,
            uniqueQueries,
            averageExecutionTime,
            successRate,
            mostUsedTags,
            queriesByCategory,
            queriesByDay
        };
    }

    /**
     * Export history
     */
    exportHistory(format: 'json' | 'csv', filters?: any): string {
        const filtered = this.getHistory(filters || {});

        if (format === 'json') {
            return JSON.stringify(filtered.map(entry => ({
                ...entry,
                timestamp: entry.timestamp.toISOString(),
                lastExecuted: entry.lastExecuted.toISOString()
            })), null, 2);
        } else {
            // CSV format
            const headers = [
                'ID', 'Connection ID', 'Query', 'Tags', 'Category', 'Description',
                'Execution Count', 'Last Executed', 'Average Execution Time',
                'Success Rate', 'Favorite', 'Timestamp'
            ];
            
            const rows = filtered.map(entry => [
                entry.id,
                entry.connectionId,
                `"${entry.query.replace(/"/g, '""')}"`,
                entry.tags.join(';'),
                entry.category || '',
                entry.description || '',
                entry.executionCount,
                entry.lastExecuted.toISOString(),
                entry.averageExecutionTime,
                entry.successRate,
                entry.favorite,
                entry.timestamp.toISOString()
            ]);

            return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
        }
    }

    // Private helper methods
    private generateId(): string {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    private normalizeQuery(query: string): string {
        return query.trim().replace(/\s+/g, ' ');
    }

    private findSimilarQuery(connectionId: string, query: string): QueryHistoryEntry | null {
        const normalizedQuery = this.normalizeQuery(query);
        
        return this.history.find(entry => 
            entry.connectionId === connectionId && 
            this.normalizeQuery(entry.query) === normalizedQuery
        ) || null;
    }

    private calculateAverageExecutionTime(
        currentAverage: number,
        currentCount: number,
        newExecutionTime: number
    ): number {
        return (currentAverage * currentCount + newExecutionTime) / (currentCount + 1);
    }

    private calculateSuccessRate(
        currentSuccessRate: number,
        currentCount: number,
        isSuccess: boolean
    ): number {
        const currentSuccesses = currentSuccessRate * currentCount;
        const newSuccesses = currentSuccesses + (isSuccess ? 1 : 0);
        return newSuccesses / (currentCount + 1);
    }

    private searchHistory(entries: QueryHistoryEntry[], searchTerm: string): QueryHistoryEntry[] {
        const searchLower = searchTerm.toLowerCase();
        
        return entries.filter(entry => 
            entry.query.toLowerCase().includes(searchLower) ||
            entry.description?.toLowerCase().includes(searchLower) ||
            entry.tags.some(tag => tag.toLowerCase().includes(searchLower)) ||
            entry.category?.toLowerCase().includes(searchLower)
        );
    }

    private buildSearchIndex(): void {
        this.searchIndex.clear();
        
        this.history.forEach(entry => {
            this.updateSearchIndex(entry);
        });
    }

    private updateSearchIndex(entry: QueryHistoryEntry): void {
        const words = [
            ...entry.query.toLowerCase().split(/\s+/),
            ...entry.tags.map(tag => tag.toLowerCase()),
            ...(entry.description ? entry.description.toLowerCase().split(/\s+/) : []),
            ...(entry.category ? [entry.category.toLowerCase()] : [])
        ];

        words.forEach(word => {
            if (word.length > 2) { // Ignore short words
                if (!this.searchIndex.has(word)) {
                    this.searchIndex.set(word, new Set());
                }
                this.searchIndex.get(word)!.add(entry.id);
            }
        });
    }

    private removeFromSearchIndex(entryId: string): void {
        for (const [word, entryIds] of this.searchIndex.entries()) {
            entryIds.delete(entryId);
            if (entryIds.size === 0) {
                this.searchIndex.delete(word);
            }
        }
    }

    private async loadHistory(): Promise<void> {
        try {
            const config = vscode.workspace.getConfiguration('ultimatedb.history');
            const historyData = config.get<any[]>('entries', []);
            
            this.history = historyData.map(entry => ({
                ...entry,
                timestamp: new Date(entry.timestamp),
                lastExecuted: new Date(entry.lastExecuted)
            }));

            // Load favorites
            const favorites = config.get<string[]>('favorites', []);
            this.favorites = new Set(favorites);
        } catch (error) {
            console.error('Failed to load query history:', error);
        }
    }

    private async saveHistory(): Promise<void> {
        try {
            const config = vscode.workspace.getConfiguration('ultimatedb.history');
            await config.update('entries', this.history, vscode.ConfigurationTarget.Global);
            await config.update('favorites', Array.from(this.favorites), vscode.ConfigurationTarget.Global);
        } catch (error) {
            console.error('Failed to save query history:', error);
        }
    }

    private async loadCategories(): Promise<void> {
        try {
            const config = vscode.workspace.getConfiguration('ultimatedb.history');
            this.categories = config.get<QueryCategory[]>('categories', [
                {
                    id: 'default',
                    name: 'General',
                    color: '#007ACC',
                    description: 'General purpose queries'
                },
                {
                    id: 'performance',
                    name: 'Performance',
                    color: '#FF6B6B',
                    description: 'Performance monitoring and optimization queries'
                },
                {
                    id: 'maintenance',
                    name: 'Maintenance',
                    color: '#4ECDC4',
                    description: 'Database maintenance and administration queries'
                },
                {
                    id: 'analysis',
                    name: 'Analysis',
                    color: '#45B7D1',
                    description: 'Data analysis and reporting queries'
                }
            ]);
        } catch (error) {
            console.error('Failed to load categories:', error);
        }
    }

    private async saveCategories(): Promise<void> {
        try {
            const config = vscode.workspace.getConfiguration('ultimatedb.history');
            await config.update('categories', this.categories, vscode.ConfigurationTarget.Global);
        } catch (error) {
            console.error('Failed to save categories:', error);
        }
    }

    private async loadTemplates(): Promise<void> {
        try {
            const config = vscode.workspace.getConfiguration('ultimatedb.history');
            const templatesData = config.get<any[]>('templates', []);
            
            this.templates = templatesData.map(template => ({
                ...template,
                createdAt: new Date(template.createdAt),
                updatedAt: new Date(template.updatedAt)
            }));
        } catch (error) {
            console.error('Failed to load templates:', error);
        }
    }

    private async saveTemplates(): Promise<void> {
        try {
            const config = vscode.workspace.getConfiguration('ultimatedb.history');
            await config.update('templates', this.templates, vscode.ConfigurationTarget.Global);
        } catch (error) {
            console.error('Failed to save templates:', error);
        }
    }
}
