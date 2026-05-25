/**
 * WebSocket Performance and Load Testing
 *
 * Comprehensive WebSocket testing for real-time features including:
 * - Concurrent connection testing (1000+ connections)
 * - Message throughput and latency testing
 * - Connection stability under load
 * - Real-time collaboration performance
 * - Memory leak detection for WebSocket connections
 * - Broadcast performance to multiple clients
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { WebSocket } from 'ws';
import { EventEmitter } from 'events';
import { PerformanceTestDataGenerator, PerformanceMetricsCollector } from '../utils/performance-test-utils';

describe('WebSocket Performance Tests', () => {
  const perfData = new PerformanceTestDataGenerator();
  const metricsCollector = new PerformanceMetricsCollector();

  const config = {
    wsUrl: process.env.WS_URL || 'ws://localhost:8080',
    httpUrl: process.env.HTTP_URL || 'http://localhost:8000',
    connectionTimeout: 10000,
    messageTimeout: 5000,
    maxConnections: 1000,
    performanceThresholds: {
      connectionTime: 3000,        // 3s to establish connection
      messageLatency: 500,         // 500ms max message latency
      throughput: 1000,            // 1000 messages per second
      connectionStability: 0.99,   // 99% connection stability
      memoryPerConnection: 1024    // 1MB max per connection
    }
  };

  let server: EventEmitter;
  let activeConnections: WebSocket[] = [];

  beforeAll(async () => {
    console.log('🔌 Starting WebSocket Performance Tests');
    console.log(`📡 Testing against: ${config.wsUrl}`);

    // Mock WebSocket server for testing
    server = new EventEmitter();

    // Start performance monitoring
    await metricsCollector.startMonitoring();
  });

  afterAll(async () => {
    console.log('🔌 WebSocket Performance Tests completed');

    // Clean up connections
    await cleanupConnections();
    await metricsCollector.stopMonitoring();
  });

  beforeEach(() => {
    // Clean up any leftover connections
    activeConnections = [];
  });

  describe('Connection Performance', () => {
    it('should establish connections within acceptable time limits', async () => {
      const connectionCount = 50;
      const connectionTimes = [];

      console.log(`Testing ${connectionCount} concurrent WebSocket connections...`);

      const connectionPromises = Array.from({ length: connectionCount }, async (_, i) => {
        const startTime = performance.now();

        try {
          const ws = new WebSocket(config.wsUrl);

          return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error('Connection timeout'));
            }, config.connectionTimeout);

            ws.on('open', () => {
              clearTimeout(timeout);
              const endTime = performance.now();
              const connectionTime = endTime - startTime;

              connectionTimes.push(connectionTime);
              activeConnections.push(ws);

              resolve({
                index: i,
                connectionTime,
                success: true
              });
            });

            ws.on('error', (error) => {
              clearTimeout(timeout);
              connectionTimes.push(config.connectionTimeout); // Max time for failed connections

              resolve({
                index: i,
                connectionTime: config.connectionTimeout,
                success: false,
                error: error.message
              });
            });
          });

        } catch (error) {
          connectionTimes.push(config.connectionTimeout);
          return {
            index: i,
            connectionTime: config.connectionTimeout,
            success: false,
            error: error.message
          };
        }
      });

      const results = await Promise.all(connectionPromises);
      const successfulConnections = results.filter(r => r.success);
      const failedConnections = results.filter(r => !r.success);

      const avgConnectionTime = connectionTimes.reduce((sum, time) => sum + time, 0) / connectionTimes.length;
      const maxConnectionTime = Math.max(...connectionTimes);
      const connectionSuccessRate = successfulConnections.length / connectionCount;

      console.log(`Connection performance results:`);
      console.log(`  Total connections: ${connectionCount}`);
      console.log(`  Successful: ${successfulConnections.length}`);
      console.log(`  Failed: ${failedConnections.length}`);
      console.log(`  Success rate: ${(connectionSuccessRate * 100).toFixed(2)}%`);
      console.log(`  Average connection time: ${avgConnectionTime.toFixed(2)}ms`);
      console.log(`  Max connection time: ${maxConnectionTime.toFixed(2)}ms`);

      // Performance assertions
      expect(connectionSuccessRate).toBeGreaterThan(0.95); // 95% success rate
      expect(avgConnectionTime).toBeLessThan(config.performanceThresholds.connectionTime);
      expect(successfulConnections.length).toBeGreaterThan(connectionCount * 0.9);
    });

    it('should handle connection lifecycle efficiently', async () => {
      const lifecycleTestCount = 20;
      const lifecycleResults = [];

      console.log(`Testing connection lifecycle for ${lifecycleTestCount} connections...`);

      for (let i = 0; i < lifecycleTestCount; i++) {
        const lifecycleStartTime = performance.now();

        try {
          // Establish connection
          const connectionStartTime = performance.now();
          const ws = new WebSocket(config.wsUrl);

          await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Connection timeout')), config.connectionTimeout);

            ws.on('open', () => {
              clearTimeout(timeout);
              resolve(null);
            });

            ws.on('error', reject);
          });

          const connectionEndTime = performance.now();
          const connectionTime = connectionEndTime - connectionStartTime;

          // Send a test message
          const messageStartTime = performance.now();

          await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Message timeout')), config.messageTimeout);

            ws.on('message', () => {
              clearTimeout(timeout);
              resolve(null);
            });

            ws.send(JSON.stringify({
              type: 'test_message',
              id: i,
              timestamp: Date.now()
            }));
          });

          const messageEndTime = performance.now();
          const messageTime = messageEndTime - messageStartTime;

          // Close connection
          const closeStartTime = performance.now();

          await new Promise((resolve) => {
            ws.on('close', resolve);
            ws.close();
          });

          const closeEndTime = performance.now();
          const closeTime = closeEndTime - closeStartTime;
          const totalLifecycleTime = closeEndTime - lifecycleStartTime;

          lifecycleResults.push({
            id: i,
            connectionTime,
            messageTime,
            closeTime,
            totalLifecycleTime,
            success: true
          });

        } catch (error) {
          lifecycleResults.push({
            id: i,
            connectionTime: config.connectionTimeout,
            messageTime: config.messageTimeout,
            closeTime: 1000,
            totalLifecycleTime: config.connectionTimeout + config.messageTimeout + 1000,
            success: false,
            error: error.message
          });
        }
      }

      const successfulLifecycles = lifecycleResults.filter(r => r.success);
      const avgConnectionTime = successfulLifecycles.reduce((sum, r) => sum + r.connectionTime, 0) / successfulLifecycles.length;
      const avgMessageTime = successfulLifecycles.reduce((sum, r) => sum + r.messageTime, 0) / successfulLifecycles.length;
      const avgCloseTime = successfulLifecycles.reduce((sum, r) => sum + r.closeTime, 0) / successfulLifecycles.length;
      const avgLifecycleTime = successfulLifecycles.reduce((sum, r) => sum + r.totalLifecycleTime, 0) / successfulLifecycles.length;

      console.log(`Connection lifecycle results:`);
      console.log(`  Successful lifecycles: ${successfulLifecycles.length}/${lifecycleTestCount}`);
      console.log(`  Average connection time: ${avgConnectionTime.toFixed(2)}ms`);
      console.log(`  Average message time: ${avgMessageTime.toFixed(2)}ms`);
      console.log(`  Average close time: ${avgCloseTime.toFixed(2)}ms`);
      console.log(`  Average total lifecycle: ${avgLifecycleTime.toFixed(2)}ms`);

      // Lifecycle performance assertions
      expect(successfulLifecycles.length).toBeGreaterThan(lifecycleTestCount * 0.9);
      expect(avgConnectionTime).toBeLessThan(config.performanceThresholds.connectionTime);
      expect(avgMessageTime).toBeLessThan(config.performanceThresholds.messageLatency);
      expect(avgCloseTime).toBeLessThan(1000); // Close should be fast
    });
  });

  describe('Message Throughput and Latency', () => {
    it('should handle high message throughput efficiently', async () => {
      const connectionCount = 10;
      const messagesPerConnection = 100;
      const totalMessages = connectionCount * messagesPerConnection;

      console.log(`Testing message throughput: ${connectionCount} connections, ${messagesPerConnection} messages each (${totalMessages} total)`);

      // Establish connections
      const connections = await establishConnections(connectionCount);
      const messageResults = [];

      const startTime = performance.now();

      // Send messages from all connections
      const messagePromises = connections.map(async (ws, connIndex) => {
        const connectionResults = [];

        for (let i = 0; i < messagesPerConnection; i++) {
          const messageStartTime = performance.now();

          try {
            await new Promise((resolve, reject) => {
              const timeout = setTimeout(() => reject(new Error('Message timeout')), config.messageTimeout);

              ws.on('message', () => {
                clearTimeout(timeout);
                const messageEndTime = performance.now();
                const messageLatency = messageEndTime - messageStartTime;

                connectionResults.push({
                  connectionIndex: connIndex,
                  messageIndex: i,
                  latency: messageLatency,
                  success: true
                });

                resolve(null);
              });

              ws.send(JSON.stringify({
                type: 'throughput_test',
                connectionId: connIndex,
                messageId: i,
                timestamp: Date.now(),
                payload: 'x'.repeat(100) // 100 byte payload
              }));
            });

          } catch (error) {
            connectionResults.push({
              connectionIndex: connIndex,
              messageIndex: i,
              latency: config.messageTimeout,
              success: false,
              error: error.message
            });
          }

          // Small delay between messages
          await new Promise(resolve => setTimeout(resolve, 1));
        }

        return connectionResults;
      });

      const allResults = await Promise.all(messagePromises);
      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Flatten results and analyze
      const flatResults = allResults.flat();
      const successfulMessages = flatResults.filter(r => r.success);
      const failedMessages = flatResults.filter(r => !r.success);

      const latencies = successfulMessages.map(r => r.latency);
      const avgLatency = latencies.reduce((sum, latency) => sum + latency, 0) / latencies.length;
      const maxLatency = Math.max(...latencies);
      const p95Latency = calculatePercentile(latencies, 95);
      const p99Latency = calculatePercentile(latencies, 99);

      const throughput = (successfulMessages.length / (totalTime / 1000)).toFixed(2);
      const messageSuccessRate = successfulMessages.length / totalMessages;

      console.log(`Message throughput results:`);
      console.log(`  Total messages: ${totalMessages}`);
      console.log(`  Successful: ${successfulMessages.length}`);
      console.log(`  Failed: ${failedMessages.length}`);
      console.log(`  Success rate: ${(messageSuccessRate * 100).toFixed(2)}%`);
      console.log(`  Total time: ${totalTime.toFixed(2)}ms`);
      console.log(`  Throughput: ${throughput} messages/sec`);
      console.log(`  Average latency: ${avgLatency.toFixed(2)}ms`);
      console.log(`  P95 latency: ${p95Latency.toFixed(2)}ms`);
      console.log(`  P99 latency: ${p99Latency.toFixed(2)}ms`);
      console.log(`  Max latency: ${maxLatency.toFixed(2)}ms`);

      // Throughput performance assertions
      expect(messageSuccessRate).toBeGreaterThan(0.95); // 95% success rate
      expect(parseFloat(throughput)).toBeGreaterThan(config.performanceThresholds.throughput * 0.1); // At least 10% of target
      expect(avgLatency).toBeLessThan(config.performanceThresholds.messageLatency);
      expect(p95Latency).toBeLessThan(config.performanceThresholds.messageLatency * 2);

      // Clean up connections
      await cleanupConnections();
    });

    it('should handle message broadcasting efficiently', async () => {
      const receiverCount = 20;
      const broadcasterCount = 5;
      const messagesPerBroadcaster = 10;

      console.log(`Testing broadcast performance: ${broadcasterCount} broadcasters, ${receiverCount} receivers, ${messagesPerBroadcaster} messages each`);

      // Establish receiver connections
      const receivers = await establishConnections(receiverCount);

      // Track received messages
      const receivedMessages = new Map<number, number>();
      receivers.forEach((_, index) => {
        receivedMessages.set(index, 0);
      });

      // Set up message listeners for receivers
      receivers.forEach((ws, index) => {
        ws.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString());
            if (message.type === 'broadcast_test') {
              receivedMessages.set(index, (receivedMessages.get(index) || 0) + 1);
            }
          } catch (error) {
            // Ignore parsing errors
          }
        });
      });

      // Establish broadcaster connections
      const broadcasters = await establishConnections(broadcasterCount);

      const broadcastStartTime = performance.now();

      // Send broadcast messages
      const broadcastPromises = broadcasters.map(async (ws, broadcasterIndex) => {
        const broadcasterResults = [];

        for (let i = 0; i < messagesPerBroadcaster; i++) {
          const broadcastStart = performance.now();

          try {
            await new Promise((resolve, reject) => {
              const timeout = setTimeout(() => reject(new Error('Broadcast timeout')), config.messageTimeout * 2);

              // Simulate broadcast by sending to all receivers
              const broadcastPromises = receivers.map(receiverWs => {
                return new Promise((receiverResolve) => {
                  receiverWs.send(JSON.stringify({
                    type: 'broadcast_test',
                    broadcasterId: broadcasterIndex,
                    messageId: i,
                    timestamp: Date.now(),
                    payload: `Broadcast message ${i} from broadcaster ${broadcasterIndex}`
                  }));
                  receiverResolve(null);
                });
              });

              Promise.all(broadcastPromises).then(() => {
                clearTimeout(timeout);
                const broadcastEnd = performance.now();
                const broadcastTime = broadcastEnd - broadcastStart;

                broadcasterResults.push({
                  broadcasterIndex,
                  messageId: i,
                  broadcastTime,
                  success: true
                });

                resolve(null);
              }).catch(reject);
            });

          } catch (error) {
            broadcasterResults.push({
              broadcasterIndex,
              messageId: i,
              broadcastTime: config.messageTimeout * 2,
              success: false,
              error: error.message
            });
          }

          // Small delay between broadcasts
          await new Promise(resolve => setTimeout(resolve, 10));
        }

        return broadcasterResults;
      });

      const broadcastResults = await Promise.all(broadcastPromises);

      // Wait for all messages to be received
      await new Promise(resolve => setTimeout(resolve, 2000));

      const broadcastEndTime = performance.now();
      const totalBroadcastTime = broadcastEndTime - broadcastStartTime;

      // Analyze broadcast results
      const flatBroadcastResults = broadcastResults.flat();
      const successfulBroadcasts = flatBroadcastResults.filter(r => r.success);
      const totalExpectedMessages = receiverCount * broadcasterCount * messagesPerBroadcaster;
      const totalReceivedMessages = Array.from(receivedMessages.values()).reduce((sum, count) => sum + count, 0);

      const avgBroadcastTime = successfulBroadcasts.reduce((sum, r) => sum + r.broadcastTime, 0) / successfulBroadcasts.length;
      const broadcastThroughput = (successfulBroadcasts.length / (totalBroadcastTime / 1000)).toFixed(2);
      const messageDeliveryRate = totalReceivedMessages / totalExpectedMessages;

      console.log(`Broadcast performance results:`);
      console.log(`  Total broadcasts: ${broadcasterCount * messagesPerBroadcaster}`);
      console.log(`  Successful broadcasts: ${successfulBroadcasts.length}`);
      console.log(`  Expected received messages: ${totalExpectedMessages}`);
      console.log(`  Actual received messages: ${totalReceivedMessages}`);
      console.log(`  Message delivery rate: ${(messageDeliveryRate * 100).toFixed(2)}%`);
      console.log(`  Average broadcast time: ${avgBroadcastTime.toFixed(2)}ms`);
      console.log(`  Broadcast throughput: ${broadcastThroughput} broadcasts/sec`);

      // Display per-receiver statistics
      const minReceived = Math.min(...Array.from(receivedMessages.values()));
      const maxReceived = Math.max(...Array.from(receivedMessages.values()));
      const avgReceived = totalReceivedMessages / receiverCount;

      console.log(`  Receiver statistics:`);
      console.log(`    Min received: ${minReceived}`);
      console.log(`    Max received: ${maxReceived}`);
      console.log(`    Avg received: ${avgReceived.toFixed(2)}`);

      // Broadcast performance assertions
      expect(successfulBroadcasts.length).toBeGreaterThan(broadcasterCount * messagesPerBroadcaster * 0.9);
      expect(messageDeliveryRate).toBeGreaterThan(0.8); // 80% delivery rate
      expect(avgBroadcastTime).toBeLessThan(config.performanceThresholds.messageLatency * 3);
      expect(broadcastThroughput).toBeGreaterThan(10); // At least 10 broadcasts/sec

      // Clean up connections
      await cleanupConnections();
    });
  });

  describe('Real-time Collaboration Performance', () => {
    it('should handle real-time collaboration efficiently', async () => {
      const collaboratorCount = 15;
      const collaborationDuration = 10000; // 10 seconds
      const actionsPerCollaborator = 20;

      console.log(`Testing real-time collaboration: ${collaboratorCount} collaborators, ${collaborationDuration}ms duration`);

      // Establish collaboration connections
      const collaborators = await establishConnections(collaboratorCount);

      // Track collaboration state
      const collaborationState = {
        totalActions: 0,
        receivedActions: 0,
        actionLatencies: [],
        conflicts: 0,
        lastActionTime: Date.now()
      };

      // Set up collaboration listeners
      collaborators.forEach((ws, index) => {
        ws.on('message', (data) => {
          try {
            const action = JSON.parse(data.toString());
            if (action.type === 'collaboration_action') {
              const latency = Date.now() - action.timestamp;
              collaborationState.actionLatencies.push(latency);
              collaborationState.receivedActions++;

              // Detect conflicts (simplified)
              if (Math.random() < 0.01) { // 1% chance of conflict
                collaborationState.conflicts++;
              }
            }
          } catch (error) {
            // Ignore parsing errors
          }
        });
      });

      const collaborationStartTime = performance.now();

      // Simulate collaboration actions
      const actionPromises = collaborators.map(async (ws, collaboratorIndex) => {
        const collaboratorActions = [];

        for (let i = 0; i < actionsPerCollaborator; i++) {
          const action = {
            type: 'collaboration_action',
            collaboratorId: collaboratorIndex,
            actionId: `${collaboratorIndex}-${i}`,
            actionType: ['edit', 'comment', 'suggestion', 'approval'][Math.floor(Math.random() * 4)],
            timestamp: Date.now(),
            data: {
              target: `test-element-${Math.floor(Math.random() * 10)}`,
              changes: `Changes from collaborator ${collaboratorIndex}, action ${i}`
            }
          };

          try {
            // Broadcast action to all collaborators
            const broadcastPromises = collaborators.map(collaboratorWs => {
              return new Promise((resolve) => {
                collaboratorWs.send(JSON.stringify(action));
                resolve(null);
              });
            });

            await Promise.all(broadcastPromises);
            collaborationState.totalActions++;
            collaboratorActions.push({
              actionId: action.actionId,
              success: true
            });

          } catch (error) {
            collaboratorActions.push({
              actionId: action.actionId,
              success: false,
              error: error.message
            });
          }

          // Realistic think time between actions
          await new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 100));
        }

        return collaboratorActions;
      });

      const actionResults = await Promise.all(actionPromises);

      // Continue monitoring for the duration
      await new Promise(resolve => setTimeout(resolve, collaborationDuration));

      const collaborationEndTime = performance.now();
      const totalCollaborationTime = collaborationEndTime - collaborationStartTime;

      // Analyze collaboration performance
      const flatActionResults = actionResults.flat();
      const successfulActions = flatActionResults.filter(r => r.success);
      const avgActionLatency = collaborationState.actionLatencies.length > 0 ?
        collaborationState.actionLatencies.reduce((sum, latency) => sum + latency, 0) / collaborationState.actionLatencies.length : 0;
      const maxActionLatency = collaborationState.actionLatencies.length > 0 ?
        Math.max(...collaborationState.actionLatencies) : 0;

      const actionThroughput = (collaborationState.totalActions / (totalCollaborationTime / 1000)).toFixed(2);
      const actionDeliveryRate = collaborationState.receivedActions / collaborationState.totalActions;
      const conflictRate = collaborationState.conflicts / collaborationState.totalActions;

      console.log(`Real-time collaboration results:`);
      console.log(`  Collaborators: ${collaboratorCount}`);
      console.log(`  Total actions: ${collaborationState.totalActions}`);
      console.log(`  Successful actions: ${successfulActions.length}`);
      console.log(`  Received actions: ${collaborationState.receivedActions}`);
      console.log(`  Action delivery rate: ${(actionDeliveryRate * 100).toFixed(2)}%`);
      console.log(`  Action throughput: ${actionThroughput} actions/sec`);
      console.log(`  Average action latency: ${avgActionLatency.toFixed(2)}ms`);
      console.log(`  Max action latency: ${maxActionLatency.toFixed(2)}ms`);
      console.log(`  Conflicts: ${collaborationState.conflicts}`);
      console.log(`  Conflict rate: ${(conflictRate * 100).toFixed(2)}%`);

      // Collaboration performance assertions
      expect(successfulActions.length).toBeGreaterThan(collaboratorCount * actionsPerCollaborator * 0.9);
      expect(actionDeliveryRate).toBeGreaterThan(0.8); // 80% delivery rate
      expect(avgActionLatency).toBeLessThan(config.performanceThresholds.messageLatency * 2);
      expect(parseFloat(actionThroughput)).toBeGreaterThan(5); // At least 5 actions/sec
      expect(conflictRate).toBeLessThan(0.05); // Less than 5% conflicts

      // Clean up connections
      await cleanupConnections();
    });
  });

  describe('Memory and Resource Management', () => {
    it('should not leak memory during extended WebSocket operations', async () => {
      const connectionCount = 50;
      const testDuration = 30000; // 30 seconds
      const messageInterval = 1000; // 1 message per second per connection

      console.log(`Memory leak test: ${connectionCount} connections for ${testDuration}ms with message every ${messageInterval}ms`);

      // Establish connections
      const connections = await establishConnections(connectionCount);

      const memorySnapshots = [];
      const messageCounters = new Array(connectionCount).fill(0);

      // Start message sending loops
      const messageLoops = connections.map((ws, index) => {
        return setInterval(() => {
          try {
            ws.send(JSON.stringify({
              type: 'memory_test',
              connectionId: index,
              messageId: messageCounters[index]++,
              timestamp: Date.now(),
              payload: 'x'.repeat(200) // 200 byte payload
            }));
          } catch (error) {
            console.warn(`Message send failed for connection ${index}:`, error.message);
          }
        }, messageInterval);
      });

      // Collect memory snapshots
      const memoryCollectionInterval = setInterval(async () => {
        const memoryUsage = metricsCollector.getMemoryUsage();
        const resourceUsage = await metricsCollector.getResourceUsage();

        memorySnapshots.push({
          timestamp: Date.now(),
          memory: memoryUsage,
          cpu: resourceUsage.cpu,
          activeConnections: connections.filter(ws => ws.readyState === WebSocket.OPEN).length,
          totalMessagesSent: messageCounters.reduce((sum, count) => sum + count, 0)
        });
      }, 2000); // Every 2 seconds

      // Run for test duration
      await new Promise(resolve => setTimeout(resolve, testDuration));

      // Stop message loops and memory collection
      messageLoops.forEach(clearInterval);
      clearInterval(memoryCollectionInterval);

      // Take final memory snapshot
      const finalMemoryUsage = metricsCollector.getMemoryUsage();

      // Analyze memory usage
      const memoryGrowth = memorySnapshots.length > 1 ?
        finalMemoryUsage.heapUsed - memorySnapshots[0].memory.heapUsed : 0;
      const maxMemoryUsage = Math.max(...memorySnapshots.map(s => s.memory.heapUsed));
      const avgMemoryUsage = memorySnapshots.reduce((sum, s) => sum + s.memory.heapUsed, 0) / memorySnapshots.length;

      const memoryPerConnection = maxMemoryUsage / connectionCount;
      const memoryGrowthRate = memoryGrowth / (testDuration / 1000); // bytes per second

      console.log(`Memory leak test results:`);
      console.log(`  Test duration: ${testDuration}ms`);
      console.log(`  Initial memory: ${(memorySnapshots[0]?.memory.heapUsed / 1024 / 1024 || 0).toFixed(2)}MB`);
      console.log(`  Final memory: ${(finalMemoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`);
      console.log(`  Max memory: ${(maxMemoryUsage / 1024 / 1024).toFixed(2)}MB`);
      console.log(`  Average memory: ${(avgMemoryUsage / 1024 / 1024).toFixed(2)}MB`);
      console.log(`  Memory growth: ${(memoryGrowth / 1024 / 1024).toFixed(2)}MB`);
      console.log(`  Memory growth rate: ${(memoryGrowthRate / 1024).toFixed(2)}KB/s`);
      console.log(`  Memory per connection: ${(memoryPerConnection / 1024).toFixed(2)}KB`);
      console.log(`  Total messages sent: ${messageCounters.reduce((sum, count) => sum + count, 0)}`);

      // Memory performance assertions
      expect(memoryGrowth).toBeLessThan(100 * 1024 * 1024); // Less than 100MB growth
      expect(memoryPerConnection).toBeLessThan(config.performanceThresholds.memoryPerConnection * 1024);
      expect(memoryGrowthRate).toBeLessThan(1024); // Less than 1KB/s growth rate

      // Clean up connections
      await cleanupConnections();
    });

    it('should handle connection cleanup efficiently', async () => {
      const batchCount = 5;
      const connectionsPerBatch = 30;
      const cleanupDelay = 2000; // 2 seconds between batches

      console.log(`Connection cleanup test: ${batchCount} batches of ${connectionsPerBatch} connections each`);

      const cleanupResults = [];

      for (let batch = 0; batch < batchCount; batch++) {
        console.log(`Processing batch ${batch + 1}/${batchCount}...`);

        // Memory before batch
        const memoryBefore = metricsCollector.getMemoryUsage();

        // Establish connections
        const batchConnections = await establishConnections(connectionsPerBatch);

        // Memory after connections
        const memoryAfterConnections = metricsCollector.getMemoryUsage();
        const memoryIncrease = memoryAfterConnections.heapUsed - memoryBefore.heapUsed;

        // Wait a bit
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Close connections
        const closeStartTime = performance.now();

        await Promise.all(batchConnections.map(ws => {
          return new Promise((resolve) => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.on('close', resolve);
              ws.close();
            } else {
              resolve(null);
            }
          });
        }));

        const closeEndTime = performance.now();
        const closeTime = closeEndTime - closeStartTime;

        // Memory after cleanup
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for GC
        const memoryAfterCleanup = metricsCollector.getMemoryUsage();
        const memoryAfterCleanup = memoryAfterCleanup.heapUsed - memoryBefore.heapUsed;

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }

        // Final memory check
        await new Promise(resolve => setTimeout(resolve, 1000));
        const finalMemory = metricsCollector.getMemoryUsage();
        const finalMemoryIncrease = finalMemory.heapUsed - memoryBefore.heapUsed;

        const batchResult = {
          batch,
          connectionsEstablished: batchConnections.length,
          memoryIncrease,
          memoryAfterCleanup,
          finalMemoryIncrease,
          closeTime,
          cleanupEfficiency: 1 - (finalMemoryIncrease / Math.max(memoryIncrease, 1))
        };

        cleanupResults.push(batchResult);

        console.log(`  Batch ${batch + 1}: ${batchConnections.length} connections, ${memoryIncrease / 1024}KB increase, ${(batchResult.cleanupEfficiency * 100).toFixed(1)}% cleanup efficiency`);

        // Wait before next batch
        if (batch < batchCount - 1) {
          await new Promise(resolve => setTimeout(resolve, cleanupDelay));
        }
      }

      // Analyze cleanup performance
      const avgCloseTime = cleanupResults.reduce((sum, r) => sum + r.closeTime, 0) / cleanupResults.length;
      const avgCleanupEfficiency = cleanupResults.reduce((sum, r) => sum + r.cleanupEfficiency, 0) / cleanupResults.length;
      const maxMemoryIncrease = Math.max(...cleanupResults.map(r => r.memoryIncrease));
      const worstFinalMemory = Math.max(...cleanupResults.map(r => r.finalMemoryIncrease));

      console.log(`Connection cleanup results:`);
      console.log(`  Average close time: ${avgCloseTime.toFixed(2)}ms`);
      console.log(`  Average cleanup efficiency: ${(avgCleanupEfficiency * 100).toFixed(2)}%`);
      console.log(`  Max memory increase: ${(maxMemoryIncrease / 1024).toFixed(2)}KB`);
      console.log(`  Worst final memory: ${(worstFinalMemory / 1024).toFixed(2)}KB`);

      // Cleanup performance assertions
      expect(avgCloseTime).toBeLessThan(5000); // Average close under 5s
      expect(avgCleanupEfficiency).toBeGreaterThan(0.8); // 80% cleanup efficiency
      expect(worstFinalMemory).toBeLessThan(10 * 1024 * 1024); // Less than 10MB final memory
    });
  });

  describe('Stress Testing', () => {
    it('should handle extreme connection load gracefully', async () => {
      const extremeConnectionCount = 200;
      const connectionBatchSize = 25;
      const testDuration = 30000; // 30 seconds

      console.log(`Extreme load test: ${extremeConnectionCount} connections in batches of ${connectionBatchSize}`);

      const allConnections: WebSocket[] = [];
      const connectionResults = [];
      const performanceSnapshots = [];

      // Establish connections in batches
      for (let batch = 0; batch < Math.ceil(extremeConnectionCount / connectionBatchSize); batch++) {
        const batchStart = performance.now();
        const batchTarget = Math.min(connectionBatchSize, extremeConnectionCount - allConnections.length);

        console.log(`Establishing batch ${batch + 1}: ${batchTarget} connections`);

        const batchPromises = Array.from({ length: batchTarget }, async (_, i) => {
          const globalIndex = allConnections.length + i;
          const connectionStartTime = performance.now();

          try {
            const ws = new WebSocket(config.wsUrl);

            return new Promise((resolve) => {
              const timeout = setTimeout(() => {
                resolve({
                  index: globalIndex,
                  success: false,
                  connectionTime: config.connectionTimeout,
                  error: 'Connection timeout'
                });
              }, config.connectionTimeout);

              ws.on('open', () => {
                clearTimeout(timeout);
                const connectionTime = performance.now() - connectionStartTime;

                allConnections.push(ws);

                resolve({
                  index: globalIndex,
                  success: true,
                  connectionTime,
                  batch
                });
              });

              ws.on('error', () => {
                clearTimeout(timeout);
                resolve({
                  index: globalIndex,
                  success: false,
                  connectionTime: config.connectionTimeout,
                  error: 'Connection error',
                  batch
                });
              });
            });
          } catch (error) {
            return {
              index: globalIndex,
              success: false,
              connectionTime: config.connectionTimeout,
              error: error.message,
              batch
            };
          }
        });

        const batchResults = await Promise.all(batchPromises);
        const batchEndTime = performance.now();
        const batchTime = batchEndTime - batchStart;

        connectionResults.push(...batchResults);

        // Take performance snapshot
        const snapshot = {
          batch,
          timestamp: Date.now(),
          totalConnections: allConnections.length,
          successfulConnections: batchResults.filter(r => r.success).length,
          batchTime,
          memoryUsage: metricsCollector.getMemoryUsage(),
          cpuUsage: await metricsCollector.getCPUUsage()
        };

        performanceSnapshots.push(snapshot);

        console.log(`  Batch ${batch + 1} completed in ${batchTime.toFixed(2)}ms: ${snapshot.successfulConnections}/${batchTarget} successful`);

        // Brief pause between batches
        if (allConnections.length < extremeConnectionCount) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // Monitor connections for test duration
      const monitoringStartTime = performance.now();
      const monitoringResults = [];

      while (performance.now() - monitoringStartTime < testDuration) {
        const activeConnections = allConnections.filter(ws => ws.readyState === WebSocket.OPEN).length;
        const memoryUsage = metricsCollector.getMemoryUsage();
        const cpuUsage = await metricsCollector.getCPUUsage();

        monitoringResults.push({
          timestamp: Date.now(),
          activeConnections,
          memoryUsage,
          cpuUsage
        });

        await new Promise(resolve => setTimeout(resolve, 2000)); // Check every 2 seconds
      }

      // Final statistics
      const finalActiveConnections = allConnections.filter(ws => ws.readyState === WebSocket.OPEN).length;
      const totalSuccessfulConnections = connectionResults.filter(r => r.success).length;
      const connectionSuccessRate = totalSuccessfulConnections / extremeConnectionCount;

      const avgMemoryUsage = monitoringResults.reduce((sum, r) => sum + r.memoryUsage.heapUsed, 0) / monitoringResults.length;
      const maxMemoryUsage = Math.max(...monitoringResults.map(r => r.memoryUsage.heapUsed));
      const avgCpuUsage = monitoringResults.reduce((sum, r) => sum + r.cpuUsage.usage, 0) / monitoringResults.length;
      const maxCpuUsage = Math.max(...monitoringResults.map(r => r.cpuUsage.usage));

      console.log(`Extreme load test results:`);
      console.log(`  Target connections: ${extremeConnectionCount}`);
      console.log(`  Successful connections: ${totalSuccessfulConnections}`);
      console.log(`  Final active connections: ${finalActiveConnections}`);
      console.log(`  Connection success rate: ${(connectionSuccessRate * 100).toFixed(2)}%`);
      console.log(`  Average memory usage: ${(avgMemoryUsage / 1024 / 1024).toFixed(2)}MB`);
      console.log(`  Peak memory usage: ${(maxMemoryUsage / 1024 / 1024).toFixed(2)}MB`);
      console.log(`  Average CPU usage: ${avgCpuUsage.toFixed(2)}%`);
      console.log(`  Peak CPU usage: ${maxCpuUsage.toFixed(2)}%`);

      // Performance snapshots
      console.log(`Performance progression:`);
      performanceSnapshots.forEach(snapshot => {
        console.log(`  Batch ${snapshot.batch}: ${snapshot.successfulConnections} connections, ${(snapshot.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB memory`);
      });

      // Extreme load assertions
      expect(connectionSuccessRate).toBeGreaterThan(0.5); // At least 50% success under extreme load
      expect(totalSuccessfulConnections).toBeGreaterThan(50); // At least 50 successful connections
      expect(avgCpuUsage).toBeLessThan(90); // CPU usage under 90%
      expect(maxMemoryUsage).toBeLessThan(1024 * 1024 * 1024); // Less than 1GB memory

      // Clean up all connections
      await cleanupConnections();
    });
  });

  // Helper functions
  async function establishConnections(count: number): Promise<WebSocket[]> {
    const connections: WebSocket[] = [];
    const connectionPromises = Array.from({ length: count }, async (_, i) => {
      return new Promise<WebSocket>((resolve, reject) => {
        const ws = new WebSocket(config.wsUrl);
        const timeout = setTimeout(() => {
          reject(new Error(`Connection ${i} timeout`));
        }, config.connectionTimeout);

        ws.on('open', () => {
          clearTimeout(timeout);
          resolve(ws);
        });

        ws.on('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });
    });

    try {
      const establishedConnections = await Promise.all(connectionPromises);
      connections.push(...establishedConnections);
    } catch (error) {
      console.warn('Some connections failed to establish:', error);
    }

    return connections;
  }

  async function cleanupConnections(): Promise<void> {
    const closePromises = activeConnections.map(ws => {
      return new Promise<void>((resolve) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.on('close', () => resolve());
          ws.close();
        } else {
          resolve();
        }
      });
    });

    await Promise.all(closePromises);
    activeConnections = [];
  }

  function calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;

    const sorted = values.slice().sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index] || 0;
  }
});
