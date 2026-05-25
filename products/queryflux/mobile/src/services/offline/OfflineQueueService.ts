import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-netinfo/netinfo';

interface QueueItem {
  id: string;
  type: 'query' | 'alert_acknowledgment' | 'alert_resolution' | 'connection_update';
  data: any;
  priority: 'low' | 'normal' | 'high' | 'critical';
  createdAt: string;
  scheduledAt?: string;
  retryCount: number;
  maxRetries: number;
  lastAttempt?: string;
  error?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

interface QueueConfig {
  maxQueueSize: number;
  retryDelay: number;
  batchSize: number;
  processInterval: number;
  maxRetries: number;
}

const DEFAULT_CONFIG: QueueConfig = {
  maxQueueSize: 1000,
  retryDelay: 5000, // 5 seconds
  batchSize: 10,
  processInterval: 10000, // 10 seconds
  maxRetries: 3,
};

export class OfflineQueueService {
  private config: QueueConfig;
  private processing: boolean = false;
  private processInterval: NodeJS.Timeout | null = null;
  private listeners: Set<(items: QueueItem[]) => void> = new Set();

  constructor(config: Partial<QueueConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.initialize();
  }

  private initialize = async () => {
    // Start processing queue
    this.startProcessing();

    // Listen for network changes
    NetInfo.addEventListener(this.handleNetworkChange);

    // Process any pending items from previous session
    setTimeout(() => this.processQueue(), 1000);
  };

  private handleNetworkChange = (state: any) => {
    if (state.isConnected && state.isInternetReachable) {
      // Network restored, try to process queue immediately
      setTimeout(() => this.processQueue(), 2000);
    }
  };

  private startProcessing = () => {
    if (this.processInterval) {
      clearInterval(this.processInterval);
    }

    this.processInterval = setInterval(() => {
      if (!this.processing) {
        this.processQueue();
      }
    }, this.config.processInterval);
  };

  public enqueue = async (
    type: QueueItem['type'],
    data: any,
    priority: QueueItem['priority'] = 'normal',
    scheduledAt?: string
  ): Promise<string> => {
    try {
      // Check queue size limit
      const queue = await this.getQueue();
      if (queue.length >= this.config.maxQueueSize) {
        throw new Error('Queue is full');
      }

      const item: QueueItem = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        type,
        data,
        priority,
        createdAt: new Date().toISOString(),
        scheduledAt: scheduledAt || new Date().toISOString(),
        retryCount: 0,
        maxRetries: this.config.maxRetries,
        status: 'pending',
      };

      // Add to queue
      const updatedQueue = [...queue, item];
      await this.saveQueue(updatedQueue);

      // Sort by priority and creation time
      await this.sortQueue();

      this.notifyListeners();

      // Try to process immediately if online
      const networkState = await NetInfo.fetch();
      if (networkState.isConnected && networkState.isInternetReachable) {
        setTimeout(() => this.processQueue(), 100);
      }

      return item.id;
    } catch (error) {
      console.error('Failed to enqueue item:', error);
      throw error;
    }
  };

  public getQueue = async (): Promise<QueueItem[]> => {
    try {
      const queueData = await AsyncStorage.getItem('offline_queue');
      return queueData ? JSON.parse(queueData) : [];
    } catch (error) {
      console.error('Failed to get queue:', error);
      return [];
    }
  };

  public getQueueItem = async (id: string): Promise<QueueItem | null> => {
    try {
      const queue = await this.getQueue();
      return queue.find(item => item.id === id) || null;
    } catch (error) {
      console.error('Failed to get queue item:', error);
      return null;
    }
  };

  public removeItem = async (id: string): Promise<void> => {
    try {
      const queue = await this.getQueue();
      const updatedQueue = queue.filter(item => item.id !== id);
      await this.saveQueue(updatedQueue);
      this.notifyListeners();
    } catch (error) {
      console.error('Failed to remove queue item:', error);
    }
  };

  public clearQueue = async (): Promise<void> => {
    try {
      await AsyncStorage.removeItem('offline_queue');
      this.notifyListeners();
    } catch (error) {
      console.error('Failed to clear queue:', error);
    }
  };

  private processQueue = async (): Promise<void> => {
    if (this.processing) {
      return;
    }

    const networkState = await NetInfo.fetch();
    if (!networkState.isConnected || !networkState.isInternetReachable) {
      return;
    }

    this.processing = true;

    try {
      const queue = await this.getQueue();
      const pendingItems = queue.filter(item =>
        item.status === 'pending' &&
        new Date(item.scheduledAt!) <= new Date()
      );

      if (pendingItems.length === 0) {
        return;
      }

      // Process items in batches
      const batches = this.chunkArray(pendingItems, this.config.batchSize);

      for (const batch of batches) {
        await this.processBatch(batch);
      }

      // Clean up completed items
      await this.cleanupCompletedItems();

      this.notifyListeners();
    } catch (error) {
      console.error('Queue processing failed:', error);
    } finally {
      this.processing = false;
    }
  };

  private processBatch = async (batch: QueueItem[]): Promise<void> => {
    for (const item of batch) {
      try {
        // Mark as processing
        await this.updateItemStatus(item.id, 'processing');

        // Execute the operation
        const result = await this.executeItem(item);

        if (result.success) {
          await this.updateItemStatus(item.id, 'completed');
          console.log(`Successfully processed queue item: ${item.id}`);
        } else {
          await this.handleFailedItem(item, result.error);
        }
      } catch (error) {
        await this.handleFailedItem(item, error instanceof Error ? error.message : 'Unknown error');
      }
    }
  };

  private executeItem = async (item: QueueItem): Promise<{ success: boolean; error?: string }> => {
    try {
      switch (item.type) {
        case 'query':
          return await this.executeQuery(item.data);
        case 'alert_acknowledgment':
          return await this.executeAlertAcknowledgment(item.data);
        case 'alert_resolution':
          return await this.executeAlertResolution(item.data);
        case 'connection_update':
          return await this.executeConnectionUpdate(item.data);
        default:
          return { success: false, error: `Unknown item type: ${item.type}` };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  };

  private executeQuery = async (data: any): Promise<{ success: boolean; error?: string }> => {
    // Simulate API call to execute query
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

    // Simulate occasional failures
    if (Math.random() < 0.2) {
      throw new Error('Query execution failed');
    }

    console.log('Executing offline query:', data.query);
    return { success: true };
  };

  private executeAlertAcknowledgment = async (data: any): Promise<{ success: boolean; error?: string }> => {
    // Simulate API call to acknowledge alert
    await new Promise(resolve => setTimeout(resolve, 500));

    console.log('Acknowledging alert:', data.alertId);
    return { success: true };
  };

  private executeAlertResolution = async (data: any): Promise<{ success: boolean; error?: string }> => {
    // Simulate API call to resolve alert
    await new Promise(resolve => setTimeout(resolve, 500));

    console.log('Resolving alert:', data.alertId);
    return { success: true };
  };

  private executeConnectionUpdate = async (data: any): Promise<{ success: boolean; error?: string }> => {
    // Simulate API call to update connection
    await new Promise(resolve => setTimeout(resolve, 500));

    console.log('Updating connection:', data.connectionId);
    return { success: true };
  };

  private handleFailedItem = async (item: QueueItem, error?: string): Promise<void> => {
    const updatedItem = {
      ...item,
      retryCount: item.retryCount + 1,
      lastAttempt: new Date().toISOString(),
      error,
    };

    if (updatedItem.retryCount >= updatedItem.maxRetries) {
      // Mark as failed
      updatedItem.status = 'failed';
      await this.updateItemInQueue(updatedItem);
      console.error(`Queue item failed permanently: ${item.id}`, error);
    } else {
      // Schedule for retry with exponential backoff
      const delay = this.config.retryDelay * Math.pow(2, updatedItem.retryCount - 1);
      updatedItem.scheduledAt = new Date(Date.now() + delay).toISOString();
      updatedItem.status = 'pending';
      await this.updateItemInQueue(updatedItem);
      console.log(`Queue item scheduled for retry: ${item.id} (attempt ${updatedItem.retryCount})`);
    }
  };

  private updateItemStatus = async (id: string, status: QueueItem['status']): Promise<void> => {
    try {
      const queue = await this.getQueue();
      const itemIndex = queue.findIndex(item => item.id === id);
      if (itemIndex !== -1) {
        queue[itemIndex].status = status;
        await this.saveQueue(queue);
      }
    } catch (error) {
      console.error('Failed to update item status:', error);
    }
  };

  private updateItemInQueue = async (updatedItem: QueueItem): Promise<void> => {
    try {
      const queue = await this.getQueue();
      const itemIndex = queue.findIndex(item => item.id === updatedItem.id);
      if (itemIndex !== -1) {
        queue[itemIndex] = updatedItem;
        await this.saveQueue(queue);
      }
    } catch (error) {
      console.error('Failed to update queue item:', error);
    }
  };

  private sortQueue = async (): Promise<void> => {
    try {
      const queue = await this.getQueue();

      // Sort by priority first, then by creation time
      const priorityOrder = { critical: 0, high: 1, normal: 2, low: 3 };

      queue.sort((a, b) => {
        const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
        if (priorityDiff !== 0) return priorityDiff;

        // Same priority, sort by scheduled time
        return new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime();
      });

      await this.saveQueue(queue);
    } catch (error) {
      console.error('Failed to sort queue:', error);
    }
  };

  private cleanupCompletedItems = async (): Promise<void> => {
    try {
      const queue = await this.getQueue();
      const activeItems = queue.filter(item => item.status !== 'completed');

      // Keep only failed items for a limited time (24 hours)
      const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recentFailedItems = activeItems.filter(item =>
        item.status !== 'failed' || new Date(item.createdAt) > cutoffTime
      );

      await this.saveQueue(recentFailedItems);
    } catch (error) {
      console.error('Failed to cleanup completed items:', error);
    }
  };

  private saveQueue = async (queue: QueueItem[]): Promise<void> => {
    try {
      await AsyncStorage.setItem('offline_queue', JSON.stringify(queue));
    } catch (error) {
      console.error('Failed to save queue:', error);
    }
  };

  private chunkArray = <T,>(array: T[], size: number): T[][] => {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  };

  public getQueueStats = async () => {
    const queue = await this.getQueue();
    const pending = queue.filter(item => item.status === 'pending').length;
    const processing = queue.filter(item => item.status === 'processing').length;
    const completed = queue.filter(item => item.status === 'completed').length;
    const failed = queue.filter(item => item.status === 'failed').length;

    return {
      total: queue.length,
      pending,
      processing,
      completed,
      failed,
      isProcessing: this.processing,
      config: this.config,
    };
  };

  public subscribe = (listener: (items: QueueItem[]) => void) => {
    this.listeners.add(listener);

    // Send initial queue state
    this.getQueue().then(listener);

    return () => {
      this.listeners.delete(listener);
    };
  };

  private notifyListeners = async () => {
    const queue = await this.getQueue();
    this.listeners.forEach(listener => listener(queue));
  };

  public cleanup = (): void => {
    if (this.processInterval) {
      clearInterval(this.processInterval);
    }
    this.listeners.clear();
  };
}

// Global queue service instance
export const offlineQueueService = new OfflineQueueService();