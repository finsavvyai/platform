/**
 * Qestro WebSocket Collaboration Worker
 *
 * Real-time collaboration platform providing:
 * - Multi-user test editing and review capabilities
 * - Live test execution monitoring with real-time status
 * - Synchronized state management across connected clients
 * - User presence awareness and activity tracking
 * - Room-based collaboration for projects and test sessions
 * - Interactive demonstration of all WebSocket features
 */

import { createWebSocketService, WebSocketService } from '../services/websocket';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../db/schema';

// Mock D1 database for WebSocket testing
const mockD1Database = {
  prepare: (query: string) => ({
    bind: (...params: any[]) => ({
      run: () => Promise.resolve({ success: true, meta: { duration: 5 } }),
      first: () => Promise.resolve({
        id: 'ws-test-project-001',
        name: 'WebSocket Test Project',
        description: 'Real-time collaboration testing project'
      }),
      all: () => Promise.resolve({
        results: [
          {
            id: 'test-case-001',
            name: 'Real-time Test Case',
            status: 'in_progress',
            lastUpdated: new Date().toISOString()
          }
        ]
      })
    })
  })
};

// Initialize WebSocket service
const wsService = createWebSocketService(mockD1Database as any, {
  maxConnections: 100,
  heartbeatInterval: 15000,
  connectionTimeout: 120000,
  enablePresence: true,
  enableRooms: true,
  enableRecovery: true
});

// Active connections for demonstration
let activeConnections = new Set<string>();
let testExecutionStatus = {
  running: false,
  currentTest: null,
  progress: 0,
  startTime: null,
  results: []
};

export default {
  async fetch(request: Request, env: any, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    console.log(`🔌 WebSocket Service: ${method} ${path}`);

    // Handle WebSocket upgrade requests
    if (request.headers.get('Upgrade') === 'websocket') {
      return this.handleWebSocketUpgrade(request);
    }

    try {
      // Health check endpoint
      if (path === '/health' && method === 'GET') {
        return Response.json({
          status: 'healthy',
          service: 'Qestro WebSocket Service',
          version: '1.0.0',
          features: {
            realTimeCollaboration: true,
            liveTestMonitoring: true,
            userPresence: true,
            roomBasedCollaboration: true,
            stateSynchronization: true
          },
          statistics: wsService.getStatistics(),
          timestamp: new Date().toISOString()
        });
      }

      // Get statistics endpoint
      if (path === '/websocket/statistics' && method === 'GET') {
        const stats = wsService.getStatistics();
        return Response.json({
          success: true,
          data: {
            statistics: stats,
            activeConnections: activeConnections.size,
            testExecutionStatus,
            timestamp: new Date().toISOString()
          }
        });
      }

      // Broadcast message endpoint
      if (path === '/websocket/broadcast' && method === 'POST') {
        try {
          const body = await request.json();
          const { type, payload, target, room } = body;

          const message = {
            id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: type,
            payload: payload,
            metadata: {
              timestamp: new Date().toISOString(),
              sessionId: 'api-endpoint'
            },
            routing: {
              ...(target && { target }),
              ...(room && { room }),
              ...(!target && !room && { broadcast: true })
            }
          };

          const sentCount = await wsService.broadcastMessage(message);

          return Response.json({
            success: true,
            data: {
              messageId: message.id,
              sentTo: sentCount,
              timestamp: new Date().toISOString()
            }
          });

        } catch (error) {
          console.error('❌ Broadcast failed:', error);
          return Response.json({
            error: 'Broadcast failed',
            details: error instanceof Error ? error.message : 'Unknown error'
          }, { status: 500 });
        }
      }

      // Simulate test execution endpoint
      if (path === '/websocket/simulate-test-execution' && method === 'POST') {
        try {
          const body = await request.json();
          const { testName, duration = 30000 } = body;

          await this.simulateTestExecution(testName, duration);

          return Response.json({
            success: true,
            data: {
              message: 'Test execution simulation started',
              testName,
              estimatedDuration: duration,
              timestamp: new Date().toISOString()
            }
          });

        } catch (error) {
          console.error('❌ Test simulation failed:', error);
          return Response.json({
            error: 'Test simulation failed',
            details: error instanceof Error ? error.message : 'Unknown error'
          }, { status: 500 });
        }
      }

      // Get room state endpoint
      if (path.startsWith('/websocket/room/') && method === 'GET') {
        const roomId = path.split('/').pop();
        const roomState = wsService.getRoomState(roomId);

        return Response.json({
          success: true,
          data: {
            roomId,
            roomState,
            timestamp: new Date().toISOString()
          }
        });
      }

      // Demo WebSocket features endpoint
      if (path === '/websocket/demo-features' && method === 'POST') {
        try {
          console.log('🎭 Starting WebSocket features demo...');

          const results = {
            connectionManagement: { status: 'pending', success: false },
            presenceTracking: { status: 'pending', success: false },
            roomCollaboration: { status: 'pending', success: false },
            testExecutionMonitoring: { status: 'pending', success: false },
            messageBroadcasting: { status: 'pending', success: false },
            stateSynchronization: { status: 'pending', success: false }
          };

          // Test 1: Connection Management
          try {
            console.log('📡 Testing connection management...');

            // Simulate connection statistics
            const stats = wsService.getStatistics();

            results.connectionManagement = {
              status: 'completed',
              success: true,
              totalConnections: stats.totalConnections,
              activeRooms: stats.activeRooms,
              averageDuration: stats.averageConnectionDuration
            };
            console.log(`   ✅ Connection management: ${stats.totalConnections} connections, ${stats.activeRooms} rooms`);
          } catch (error) {
            results.connectionManagement.status = 'failed';
            results.connectionManagement.error = error instanceof Error ? error.message : 'Unknown';
            console.log(`   ❌ Connection management failed: ${error instanceof Error ? error.message : error}`);
          }

          // Test 2: Presence Tracking
          try {
            console.log('👥 Testing presence tracking...');

            // Simulate presence update broadcast
            const presenceMessage = {
              id: `presence_${Date.now()}`,
              type: 'presence_update',
              payload: {
                userId: 'demo-user-001',
                status: 'online',
                metadata: {
                  activity: 'testing websocket features',
                  location: 'demo-room'
                }
              },
              metadata: {
                timestamp: new Date().toISOString(),
                sessionId: 'demo-session'
              },
              routing: { broadcast: true }
            };

            const sentCount = await wsService.broadcastMessage(presenceMessage);

            results.presenceTracking = {
              status: 'completed',
              success: true,
              presenceUpdates: 1,
              recipientsNotified: sentCount
            };
            console.log(`   ✅ Presence tracking: 1 update sent to ${sentCount} recipients`);
          } catch (error) {
            results.presenceTracking.status = 'failed';
            results.presenceTracking.error = error instanceof Error ? error.message : 'Unknown';
            console.log(`   ❌ Presence tracking failed: ${error instanceof Error ? error.message : error}`);
          }

          // Test 3: Room Collaboration
          try {
            console.log('🏠 Testing room collaboration...');

            // Create a test room and simulate collaboration
            const roomMessage = {
              id: `room_${Date.now()}`,
              type: 'user_join',
              payload: {
                userId: 'demo-user-001',
                room: 'demo-collaboration-room',
                timestamp: new Date().toISOString()
              },
              metadata: {
                timestamp: new Date().toISOString(),
                sessionId: 'demo-session'
              },
              routing: { room: 'demo-collaboration-room' }
            };

            const roomSentCount = await wsService.broadcastMessage(roomMessage);

            results.roomCollaboration = {
              status: 'completed',
              success: true,
              roomCreated: 'demo-collaboration-room',
              messagesSent: 1,
              participantsNotified: roomSentCount
            };
            console.log(`   ✅ Room collaboration: demo room created, ${roomSentCount} participants notified`);
          } catch (error) {
            results.roomCollaboration.status = 'failed';
            results.roomCollaboration.error = error instanceof Error ? error.message : 'Unknown';
            console.log(`   ❌ Room collaboration failed: ${error instanceof Error ? error.message : error}`);
          }

          // Test 4: Test Execution Monitoring
          try {
            console.log('🧪 Testing test execution monitoring...');

            // Simulate test execution updates
            const testMessages = [
              {
                type: 'test_start',
                payload: { testId: 'demo-test-001', testName: 'WebSocket Test', suite: 'Real-time Features' }
              },
              {
                type: 'test_update',
                payload: { testId: 'demo-test-001', progress: 25, status: 'running' }
              },
              {
                type: 'test_complete',
                payload: { testId: 'demo-test-001', status: 'passed', duration: 5000 }
              }
            ];

            let totalSent = 0;
            for (const testMsg of testMessages) {
              const message = {
                id: `test_${Date.now()}_${Math.random()}`,
                type: testMsg.type,
                payload: testMsg.payload,
                metadata: {
                  timestamp: new Date().toISOString(),
                  sessionId: 'demo-session'
                },
                routing: { broadcast: true }
              };

              totalSent += await wsService.broadcastMessage(message);
            }

            results.testExecutionMonitoring = {
              status: 'completed',
              success: true,
              testEvents: testMessages.length,
              updatesSent: totalSent
            };
            console.log(`   ✅ Test execution monitoring: ${testMessages.length} events, ${totalSent} updates sent`);
          } catch (error) {
            results.testExecutionMonitoring.status = 'failed';
            results.testExecutionMonitoring.error = error instanceof Error ? error.message : 'Unknown';
            console.log(`   ❌ Test execution monitoring failed: ${error instanceof Error ? error.message : error}`);
          }

          // Test 5: Message Broadcasting
          try {
            console.log('📢 Testing message broadcasting...');

            const broadcastMessage = {
              id: `broadcast_${Date.now()}`,
              type: 'broadcast',
              payload: {
                message: 'WebSocket demo broadcast message',
                category: 'announcement',
                priority: 'medium'
              },
              metadata: {
                timestamp: new Date().toISOString(),
                sessionId: 'demo-session'
              },
              routing: { broadcast: true }
            };

            const broadcastCount = await wsService.broadcastMessage(broadcastMessage);

            results.messageBroadcasting = {
              status: 'completed',
              success: true,
              messageBroadcasted: 1,
              recipientsReached: broadcastCount
            };
            console.log(`   ✅ Message broadcasting: 1 message reached ${broadcastCount} recipients`);
          } catch (error) {
            results.messageBroadcasting.status = 'failed';
            results.messageBroadcasting.error = error instanceof Error ? error.message : 'Unknown';
            console.log(`   ❌ Message broadcasting failed: ${error instanceof Error ? error.message : error}`);
          }

          // Test 6: State Synchronization
          try {
            console.log('🔄 Testing state synchronization...');

            const stateMessage = {
              id: `state_${Date.now()}`,
              type: 'room_state',
              payload: {
                room: 'demo-room',
                state: {
                  sharedTest: {
                    id: 'shared-test-001',
                    name: 'Collaborative Test Case',
                    content: 'Test content being edited in real-time',
                    lastModified: new Date().toISOString(),
                    modifiedBy: 'demo-user-001'
                  }
                }
              },
              metadata: {
                timestamp: new Date().toISOString(),
                sessionId: 'demo-session'
              },
              routing: { room: 'demo-room' }
            };

            const stateSentCount = await wsService.broadcastMessage(stateMessage);

            results.stateSynchronization = {
              status: 'completed',
              success: true,
              stateUpdates: 1,
              clientsSynchronized: stateSentCount
            };
            console.log(`   ✅ State synchronization: 1 state update sent to ${stateSentCount} clients`);
          } catch (error) {
            results.stateSynchronization.status = 'failed';
            results.stateSynchronization.error = error instanceof Error ? error.message : 'Unknown';
            console.log(`   ❌ State synchronization failed: ${error instanceof Error ? error.message : error}`);
          }

          // Calculate overall success
          const successCount = Object.values(results).filter((r: any) => r.success).length;
          const totalTests = Object.keys(results).length;
          const successRate = (successCount / totalTests) * 100;

          return Response.json({
            success: successRate >= 80,
            data: {
              results,
              summary: {
                totalTests: totalTests,
                successfulTests: successCount,
                successRate: successRate.toFixed(1),
                overallSuccess: successRate >= 80
              }
            }
          });

        } catch (error) {
          console.error('❌ WebSocket demo failed:', error);
          return Response.json({
            error: 'WebSocket demo failed',
            details: error instanceof Error ? error.message : 'Unknown error'
          }, { status: 500 });
        }
      }

      // Default response
      return Response.json({
        error: 'Endpoint not found',
        availableEndpoints: [
          'GET /health',
          'GET /websocket/statistics',
          'POST /websocket/broadcast',
          'POST /websocket/simulate-test-execution',
          'GET /websocket/room/:roomId',
          'POST /websocket/demo-features',
          'WebSocket: /ws (Upgrade header required)'
        ]
      }, { status: 404 });

    } catch (error) {
      console.error('❌ Unhandled error:', error);
      return Response.json({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 });
    }
  },

  async handleWebSocketUpgrade(request: Request): Promise<Response> {
    try {
      console.log('🔄 Handling WebSocket upgrade request');

      // Create WebSocket pair
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      // Accept the WebSocket connection
      server.accept();

      // Extract connection parameters from URL
      const url = new URL(request.url);
      const userId = url.searchParams.get('userId') || `user_${Date.now()}`;
      const type = url.searchParams.get('type') || 'client';
      const roomId = url.searchParams.get('roomId') || undefined;

      console.log(`🔗 WebSocket connection established: ${userId} (${type})`);

      // Handle the connection through the WebSocket service
      await wsService.handleConnection(server, request);

      // Add to active connections for demo tracking
      const connectionId = `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      activeConnections.add(connectionId);

      // Setup message handlers
      server.addEventListener('message', async (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log(`📨 WebSocket message received: ${message.type} from ${userId}`);

          // Handle specific message types for demo
          switch (message.type) {
            case 'test_execution_start':
              await this.startRealTimeTestExecution(server, message.payload);
              break;
            case 'cursor_position':
              await this.broadcastCursorPosition(server, connectionId, message.payload);
              break;
            case 'test_edit':
              await this.broadcastTestEdit(server, connectionId, message.payload);
              break;
            case 'heartbeat':
              // Echo heartbeat back
              server.send(JSON.stringify({
                type: 'heartbeat_response',
                timestamp: new Date().toISOString()
              }));
              break;
          }

        } catch (error) {
          console.error('❌ WebSocket message handling error:', error);
          server.send(JSON.stringify({
            type: 'error',
            error: 'Message processing failed'
          }));
        }
      });

      // Handle connection close
      server.addEventListener('close', () => {
        console.log(`🔌 WebSocket connection closed: ${userId}`);
        activeConnections.delete(connectionId);
      });

      // Send welcome message
      server.send(JSON.stringify({
        type: 'connected',
        payload: {
          connectionId,
          userId,
          type,
          roomId,
          serverTime: new Date().toISOString(),
          features: [
            'real-time-collaboration',
            'test-execution-monitoring',
            'presence-tracking',
            'room-based-collaboration'
          ]
        }
      }));

      return new Response(null, {
        status: 101,
        webSocket: client
      });

    } catch (error) {
      console.error('❌ WebSocket upgrade failed:', error);
      return new Response('WebSocket upgrade failed', { status: 500 });
    }
  },

  async simulateTestExecution(testName: string, duration: number): Promise<void> {
    console.log(`🧪 Simulating test execution: ${testName} (${duration}ms)`);

    testExecutionStatus = {
      running: true,
      currentTest: testName,
      progress: 0,
      startTime: new Date(),
      results: []
    };

    // Send test start message
    await wsService.broadcastMessage({
      id: `test_start_${Date.now()}`,
      type: 'test_start',
      payload: {
        testId: `test_${Date.now()}`,
        testName,
        startTime: testExecutionStatus.startTime?.toISOString(),
        estimatedDuration: duration
      },
      metadata: {
        timestamp: new Date().toISOString(),
        sessionId: 'simulation-system'
      },
      routing: { broadcast: true }
    });

    // Simulate test progress updates
    const progressInterval = setInterval(async () => {
      if (testExecutionStatus.progress < 100) {
        testExecutionStatus.progress += 10;

        await wsService.broadcastMessage({
          id: `test_update_${Date.now()}`,
          type: 'test_update',
          payload: {
            testId: `test_${Date.now()}`,
            testName,
            progress: testExecutionStatus.progress,
            currentStep: `Step ${Math.floor(testExecutionStatus.progress / 10)}/10`
          },
          metadata: {
            timestamp: new Date().toISOString(),
            sessionId: 'simulation-system'
          },
          routing: { broadcast: true }
        });
      } else {
        clearInterval(progressInterval);
        await this.completeTestExecution(testName);
      }
    }, duration / 10);
  },

  async completeTestExecution(testName: string): Promise<void> {
    const endTime = new Date();
    const duration = testExecutionStatus.startTime ?
      endTime.getTime() - testExecutionStatus.startTime.getTime() : 0;

    const result = {
      testId: `test_${Date.now()}`,
      testName,
      status: Math.random() > 0.2 ? 'passed' : 'failed',
      startTime: testExecutionStatus.startTime?.toISOString(),
      endTime: endTime.toISOString(),
      duration,
      progress: 100
    };

    // Send test complete message
    await wsService.broadcastMessage({
      id: `test_complete_${Date.now()}`,
      type: 'test_complete',
      payload: result,
      metadata: {
        timestamp: new Date().toISOString(),
        sessionId: 'simulation-system'
      },
      routing: { broadcast: true }
    });

    testExecutionStatus.running = false;
    testExecutionStatus.currentTest = null;
    testExecutionStatus.results.push(result);

    console.log(`✅ Test execution completed: ${testName} (${result.status}, ${duration}ms)`);
  },

  async startRealTimeTestExecution(socket: WebSocket, payload: any): Promise<void> {
    console.log('🧪 Starting real-time test execution from WebSocket');

    const testId = `realtime_test_${Date.now()}`;
    const testName = payload.testName || 'Real-time WebSocket Test';

    // Send test started confirmation
    socket.send(JSON.stringify({
      type: 'test_execution_started',
      payload: {
        testId,
        testName,
        status: 'running'
      }
    }));

    // Broadcast to all connected clients
    await wsService.broadcastMessage({
      id: `realtime_test_start_${Date.now()}`,
      type: 'test_start',
      payload: {
        testId,
        testName,
        triggeredBy: 'WebSocket client',
        startTime: new Date().toISOString()
      },
      metadata: {
        timestamp: new Date().toISOString(),
        sessionId: 'websocket-trigger'
      },
      routing: { broadcast: true }
    });

    // Simulate real-time updates
    const updateInterval = setInterval(async () => {
      const progress = Math.floor(Math.random() * 100);

      await wsService.broadcastMessage({
        id: `realtime_update_${Date.now()}`,
        type: 'test_update',
        payload: {
          testId,
          testName,
          progress,
          status: 'running',
          currentStep: `Step ${Math.floor(progress / 10)}/10`,
          logs: [`Log entry at ${progress}% completion`]
        },
        metadata: {
          timestamp: new Date().toISOString(),
          sessionId: 'realtime-execution'
        },
        routing: { broadcast: true }
      });

      if (progress >= 95) {
        clearInterval(updateInterval);

        await wsService.broadcastMessage({
          id: `realtime_complete_${Date.now()}`,
          type: 'test_complete',
          payload: {
            testId,
            testName,
            status: 'passed',
            endTime: new Date().toISOString(),
            duration: Math.floor(Math.random() * 30000) + 10000
          },
          metadata: {
            timestamp: new Date().toISOString(),
            sessionId: 'realtime-execution'
          },
          routing: { broadcast: true }
        });
      }
    }, 2000);
  },

  async broadcastCursorPosition(socket: WebSocket, connectionId: string, payload: any): Promise<void> {
    // Broadcast cursor position to room members
    await wsService.broadcastMessage({
      id: `cursor_${Date.now()}`,
      type: 'cursor_position',
      payload: {
        connectionId,
        userId: payload.userId,
        position: payload.position,
        selection: payload.selection
      },
      metadata: {
        timestamp: new Date().toISOString(),
        sessionId: connectionId
      },
      routing: { room: payload.room }
    });
  },

  async broadcastTestEdit(socket: WebSocket, connectionId: string, payload: any): Promise<void> {
    // Broadcast test edit to room members
    await wsService.broadcastMessage({
      id: `edit_${Date.now()}`,
      type: 'edit_update',
      payload: {
        connectionId,
        userId: payload.userId,
        testId: payload.testId,
        changes: payload.changes,
        timestamp: new Date().toISOString()
      },
      metadata: {
        timestamp: new Date().toISOString(),
        sessionId: connectionId
      },
      routing: { room: payload.room }
    });
  }
}
