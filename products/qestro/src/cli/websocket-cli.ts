#!/usr/bin/env node

/**
 * Qestro WebSocket CLI Tool
 *
 * Command-line interface for WebSocket real-time collaboration features.
 * Provides testing, monitoring, and management capabilities for the
 * WebSocket service including connection management, room collaboration,
 * test execution monitoring, and message broadcasting.
 */

import { WebSocket } from 'ws';

// CLI configuration
const config = {
  apiBaseUrl: 'http://localhost:8787',
  wsUrl: 'ws://localhost:8787/ws',
  timeout: 10000
};

// CLI argument parsing
const args = process.argv.slice(2);
const command = args[0];
const options = parseOptions(args.slice(1));

function parseOptions(argsArray: string[]): Record<string, any> {
  const options: Record<string, any> = {};

  for (let i = 0; i < argsArray.length; i++) {
    const arg = argsArray[i];

    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const nextArg = argsArray[i + 1];

      if (nextArg && !nextArg.startsWith('--')) {
        options[key] = nextArg;
        i++;
      } else {
        options[key] = true;
      }
    }
  }

  return options;
}

// Main CLI handler
async function main() {
  console.log('🔌 Qestro WebSocket CLI');
  console.log('========================');

  try {
    switch (command) {
      case 'connect':
        await handleConnect();
        break;

      case 'broadcast':
        await handleBroadcast();
        break;

      case 'monitor':
        await handleMonitor();
        break;

      case 'simulate-test':
        await handleSimulateTest();
        break;

      case 'demo':
        await handleDemo();
        break;

      case 'test-execution':
        await handleTestExecution();
        break;

      case 'room-status':
        await handleRoomStatus();
        break;

      case 'statistics':
        await handleStatistics();
        break;

      case 'help':
      case '--help':
      case '-h':
        showHelp();
        break;

      default:
        console.error(`❌ Unknown command: ${command}`);
        showHelp();
        process.exit(1);
    }
  } catch (error) {
    console.error('❌ CLI Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Connect to WebSocket
async function handleConnect() {
  const userId = options.user || options.u || `cli-user-${Date.now()}`;
  const type = options.type || 'client';
  const roomId = options.room || options.r;
  const monitor = options.monitor || options.m;

  console.log(`🔗 Connecting to WebSocket server...`);
  console.log(`👤 User ID: ${userId}`);
  console.log(`🏷️  Type: ${type}`);
  if (roomId) console.log(`🏠 Room: ${roomId}`);
  console.log('');

  try {
    // Build WebSocket URL with parameters
    let wsUrl = `${config.wsUrl}?userId=${encodeURIComponent(userId)}&type=${type}`;
    if (roomId) {
      wsUrl += `&roomId=${encodeURIComponent(roomId)}`;
    }

    const ws = new WebSocket(wsUrl);

    ws.on('open', () => {
      console.log('✅ WebSocket connection established');

      if (monitor) {
        startMonitoring(ws);
      } else {
        // Send initial message
        ws.send(JSON.stringify({
          type: 'user_activity',
          payload: {
            activity: 'Connected via CLI',
            timestamp: new Date().toISOString()
          }
        }));

        console.log('💬 Type messages and press Enter to send (Ctrl+C to exit):');

        // Setup interactive mode
        process.stdin.setRawMode(true);
        process.stdin.resume();
        process.stdin.setEncoding('utf8');

        let inputBuffer = '';

        process.stdin.on('data', (key) => {
          if (key === '\u0003') { // Ctrl+C
            console.log('\n🔌 Disconnecting...');
            ws.close();
            process.exit(0);
          } else if (key === '\r' || key === '\n') {
            if (inputBuffer.trim()) {
              ws.send(JSON.stringify({
                type: 'message',
                payload: {
                  message: inputBuffer.trim(),
                  timestamp: new Date().toISOString()
                }
              }));
              inputBuffer = '';
            }
          } else if (key === '\u007f') { // Backspace
            inputBuffer = inputBuffer.slice(0, -1);
            process.stdout.write('\b \b');
          } else {
            inputBuffer += key;
            process.stdout.write(key);
          }
        });
      }
    });

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        handleIncomingMessage(message);
      } catch (error) {
        console.log('📨 Received:', data.toString());
      }
    });

    ws.on('close', (code, reason) => {
      console.log(`🔌 Connection closed: ${code} - ${reason}`);
      process.exit(0);
    });

    ws.on('error', (error) => {
      console.error('❌ WebSocket error:', error.message);
      process.exit(1);
    });

    // Handle process termination
    process.on('SIGINT', () => {
      console.log('\n🔌 Disconnecting...');
      ws.close();
    });

  } catch (error) {
    console.error('❌ Connection failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Broadcast message
async function handleBroadcast() {
  const type = options.type || 'broadcast';
  const target = options.target || options.t;
  const room = options.room || options.r;
  const message = options.message || options.m || 'Hello from CLI!';

  console.log(`📢 Broadcasting message...`);
  console.log(`📨 Type: ${type}`);
  if (target) console.log(`🎯 Target: ${target}`);
  if (room) console.log(`🏠 Room: ${room}`);
  console.log(`💬 Message: ${message}`);
  console.log('');

  try {
    const response = await fetch(`${config.apiBaseUrl}/websocket/broadcast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        type,
        payload: { message, timestamp: new Date().toISOString() },
        target,
        room
      })
    });

    const result = await response.json();

    if (result.success) {
      console.log('✅ Message broadcast successfully');
      console.log(`📊 Sent to: ${result.data.sentTo} connections`);
      console.log(`🆔 Message ID: ${result.data.messageId}`);
    } else {
      console.error('❌ Broadcast failed:', result.error);
    }

  } catch (error) {
    console.error('❌ Broadcast request failed:', error instanceof Error ? error.message : error);
  }
}

// Monitor statistics
async function handleMonitor() {
  const interval = options.interval || options.i || 5;
  const continuous = options.continuous || options.c;

  console.log(`📊 Monitoring WebSocket statistics...`);
  console.log(`⏱️  Interval: ${interval} seconds`);
  if (continuous) console.log(`🔄 Continuous mode enabled`);
  console.log('');

  const displayStats = async () => {
    try {
      const response = await fetch(`${config.apiBaseUrl}/websocket/statistics`);
      const result = await response.json();

      if (result.success) {
        const stats = result.data.statistics;
        const active = result.data.activeConnections;
        const testStatus = result.data.testExecutionStatus;

        console.clear();
        console.log('📊 Qestro WebSocket Statistics');
        console.log('=============================');
        console.log(`📡 Total Connections: ${stats.totalConnections}`);
        console.log(`🏠 Active Rooms: ${stats.activeRooms}`);
        console.log(`👥 Active Users: ${stats.totalUsers}`);
        console.log(`⏱️  Avg Duration: ${Math.round(stats.averageConnectionDuration / 1000)}s`);
        console.log(`📨 Messages Queued: ${stats.messagesQueued}`);
        console.log(`🔄 CLI Active Connections: ${active}`);
        console.log('');

        console.log('📈 Connections by Type:');
        Object.entries(stats.connectionsByType).forEach(([type, count]) => {
          console.log(`   ${type}: ${count}`);
        });
        console.log('');

        if (testStatus.running) {
          console.log('🧪 Test Execution Status:');
          console.log(`   Running: ${testStatus.running}`);
          console.log(`   Current Test: ${testStatus.currentTest}`);
          console.log(`   Progress: ${testStatus.progress}%`);
          console.log(`   Started: ${testStatus.startTime}`);
        } else {
          console.log('🧪 Test Execution: Idle');
        }

        console.log('');
        console.log(`🕐 Last updated: ${new Date().toLocaleTimeString()}`);

        if (!continuous) {
          console.log('');
          console.log('💡 Use --continuous for live monitoring');
        }
      } else {
        console.error('❌ Failed to fetch statistics:', result.error);
      }
    } catch (error) {
      console.error('❌ Statistics request failed:', error instanceof Error ? error.message : error);
    }
  };

  if (continuous) {
    // Continuous monitoring
    displayStats();
    setInterval(displayStats, interval * 1000);

    // Handle graceful exit
    process.on('SIGINT', () => {
      console.log('\n🛑 Stopping monitoring...');
      process.exit(0);
    });
  } else {
    // Single snapshot
    await displayStats();
  }
}

// Simulate test execution
async function handleSimulateTest() {
  const testName = options.name || options.n || 'WebSocket CLI Test';
  const duration = parseInt(options.duration || options.d || '30000');

  console.log(`🧪 Simulating test execution...`);
  console.log(`📝 Test Name: ${testName}`);
  console.log(`⏱️  Duration: ${duration}ms`);
  console.log('');

  try {
    const response = await fetch(`${config.apiBaseUrl}/websocket/simulate-test-execution`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        testName,
        duration
      })
    });

    const result = await response.json();

    if (result.success) {
      console.log('✅ Test execution simulation started');
      console.log(`📝 Test: ${result.data.testName}`);
      console.log(`⏱️  Estimated duration: ${result.data.estimatedDuration}ms`);
      console.log('');
      console.log('💡 Connect with WebSocket CLI to monitor real-time updates:');
      console.log(`   npm run ws-cli connect --user test-monitor --monitor`);

      if (options.wait || options.w) {
        console.log('');
        console.log('⏳ Waiting for test completion...');
        console.log('💡 Press Ctrl+C to stop waiting');

        // Wait for specified duration
        await new Promise(resolve => setTimeout(resolve, duration + 5000));
        console.log('✅ Test execution should be completed');
      }
    } else {
      console.error('❌ Test simulation failed:', result.error);
    }

  } catch (error) {
    console.error('❌ Test simulation request failed:', error instanceof Error ? error.message : error);
  }
}

// Run WebSocket demo
async function handleDemo() {
  console.log(`🎭 Running WebSocket feature demo...`);
  console.log('');

  try {
    const response = await fetch(`${config.apiBaseUrl}/websocket/demo-features`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const result = await response.json();

    if (result.success) {
      console.log('✅ WebSocket feature demo completed successfully');

      console.log('');
      console.log('📊 Demo Results:');
      console.log(`   Total Tests: ${result.data.summary.totalTests}`);
      console.log(`   Successful: ${result.data.summary.successfulTests}`);
      console.log(`   Success Rate: ${result.data.summary.successRate}%`);
      console.log(`   Overall: ${result.data.summary.overallSuccess ? '✅ PASSED' : '❌ FAILED'}`);

      console.log('');
      console.log('📋 Detailed Results:');
      Object.entries(result.data.results).forEach(([test, result]: [string, any]) => {
        const status = result.success ? '✅' : '❌';
        console.log(`   ${status} ${test.replace(/([A-Z])/g, ' $1').toLowerCase()}: ${result.status}`);

        if (result.error) {
          console.log(`      Error: ${result.error}`);
        }
      });

      if (result.data.summary.overallSuccess) {
        console.log('');
        console.log('🎉 All WebSocket features are working correctly!');
        console.log('');
        console.log('💡 Try these commands next:');
        console.log('   npm run ws-cli connect --user demo-user --monitor');
        console.log('   npm run ws-cli simulate-test --name "Demo Test"');
        console.log('   npm run ws-cli broadcast --message "Hello WebSocket!"');
      } else {
        console.log('');
        console.log('⚠️  Some WebSocket features may need attention');
      }
    } else {
      console.error('❌ WebSocket demo failed:', result.error);
    }

  } catch (error) {
    console.error('❌ Demo request failed:', error instanceof Error ? error.message : error);
  }
}

// Test real-time execution
async function handleTestExecution() {
  const testName = options.name || options.n || 'Real-time WebSocket Test';
  const roomId = options.room || options.r || `test-room-${Date.now()}`;
  const monitor = options.monitor || options.m;

  console.log(`🧪 Starting real-time test execution...`);
  console.log(`📝 Test Name: ${testName}`);
  console.log(`🏠 Room: ${roomId}`);
  console.log('');

  try {
    // First connect to WebSocket for monitoring
    let ws: WebSocket | null = null;

    if (monitor) {
      console.log('🔗 Connecting to WebSocket for monitoring...');

      ws = new WebSocket(`${config.wsUrl}?userId=test-runner&type=client&roomId=${roomId}`);

      ws.on('open', () => {
        console.log('✅ Connected for real-time monitoring');

        // Start the test execution
        ws.send(JSON.stringify({
          type: 'test_execution_start',
          payload: {
            testName,
            suite: 'WebSocket CLI Suite',
            tags: ['real-time', 'websocket', 'cli']
          }
        }));
      });

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          handleTestExecutionMessage(message);
        } catch (error) {
          console.log('📨 Received:', data.toString());
        }
      });

      ws.on('error', (error) => {
        console.error('❌ WebSocket error:', error.message);
      });

      // Wait a moment for connection to establish
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('✅ Real-time test execution initiated');

    if (monitor && ws) {
      console.log('');
      console.log('💡 Real-time monitoring active. Press Ctrl+C to stop.');

      // Handle graceful exit
      process.on('SIGINT', () => {
        console.log('\n🛑 Stopping test execution monitoring...');
        if (ws) ws.close();
        process.exit(0);
      });

      // Keep process alive
      await new Promise(() => {});
    } else {
      console.log('💡 Use --monitor to see real-time updates');
    }

  } catch (error) {
    console.error('❌ Test execution failed:', error instanceof Error ? error.message : error);
  }
}

// Get room status
async function handleRoomStatus() {
  const roomId = options.room || options.r;

  if (!roomId) {
    console.error('❌ Room ID is required. Use --room <room-id>');
    process.exit(1);
  }

  console.log(`🏠 Getting room status: ${roomId}`);
  console.log('');

  try {
    const response = await fetch(`${config.apiBaseUrl}/websocket/room/${roomId}`);
    const result = await response.json();

    if (result.success) {
      const roomState = result.data.roomState;

      if (roomState) {
        console.log('✅ Room status retrieved');
        console.log(`🆔 Room ID: ${roomState.id}`);
        console.log(`📝 Name: ${roomState.name}`);
        console.log(`🏷️  Type: ${roomState.type}`);
        console.log(`👥 Members: ${roomState.members.length}`);
        console.log(`📅 Created: ${new Date(roomState.createdAt).toLocaleString()}`);

        if (roomState.members.length > 0) {
          console.log('');
          console.log('👥 Active Members:');
          roomState.members.forEach((member: any) => {
            console.log(`   📡 ${member.connectionId} (${member.type})`);
            if (member.userId) {
              console.log(`      👤 User: ${member.userId}`);
            }
            console.log(`      📊 Status: ${member.presence?.status}`);
            console.log(`      ⏱️  Connected: ${new Date(member.connectedAt).toLocaleTimeString()}`);
          });
        }

        if (Object.keys(roomState.state).length > 0) {
          console.log('');
          console.log('🗄️  Room State:');
          Object.entries(roomState.state).forEach(([key, value]) => {
            console.log(`   ${key}: ${JSON.stringify(value)}`);
          });
        }
      } else {
        console.log('❌ Room not found');
      }
    } else {
      console.error('❌ Failed to get room status:', result.error);
    }

  } catch (error) {
    console.error('❌ Room status request failed:', error instanceof Error ? error.message : error);
  }
}

// Get current statistics
async function handleStatistics() {
  console.log(`📊 Fetching current WebSocket statistics...`);
  console.log('');

  try {
    const response = await fetch(`${config.apiBaseUrl}/websocket/statistics`);
    const result = await response.json();

    if (result.success) {
      const stats = result.data.statistics;
      const active = result.data.activeConnections;
      const testStatus = result.data.testExecutionStatus;

      console.log('📊 Qestro WebSocket Statistics');
      console.log('=============================');
      console.log(`📡 Total Connections: ${stats.totalConnections}`);
      console.log(`🏠 Active Rooms: ${stats.activeRooms}`);
      console.log(`👥 Active Users: ${stats.totalUsers}`);
      console.log(`⏱️  Avg Duration: ${Math.round(stats.averageConnectionDuration / 1000)}s`);
      console.log(`📨 Messages Queued: ${stats.messagesQueued}`);
      console.log(`🔄 CLI Active: ${active}`);
      console.log('');

      console.log('📈 Connections by Type:');
      Object.entries(stats.connectionsByType).forEach(([type, count]) => {
        console.log(`   ${type}: ${count}`);
      });
      console.log('');

      console.log(`🕐 Updated: ${result.data.timestamp}`);
    } else {
      console.error('❌ Failed to fetch statistics:', result.error);
    }

  } catch (error) {
    console.error('❌ Statistics request failed:', error instanceof Error ? error.message : error);
  }
}

// Handle incoming WebSocket messages
function handleIncomingMessage(message: any): void {
  switch (message.type) {
    case 'connected':
      console.log('✅ Connection confirmed');
      console.log(`🆔 Connection ID: ${message.payload.connectionId}`);
      console.log(`⏰ Server Time: ${message.payload.serverTime}`);
      console.log(`🚀 Features: ${message.payload.features.join(', ')}`);
      break;

    case 'presence_update':
      console.log(`👥 Presence update: ${message.payload.userId} is ${message.payload.status}`);
      break;

    case 'user_join':
      console.log(`👋 User joined: ${message.payload.userId} in room ${message.payload.room}`);
      break;

    case 'user_leave':
      console.log(`👋 User left: ${message.payload.userId} from room ${message.payload.room}`);
      break;

    case 'test_start':
      console.log(`🧪 Test started: ${message.payload.testName}`);
      break;

    case 'test_update':
      console.log(`📊 Test update: ${message.payload.progress}% - ${message.payload.currentStep}`);
      break;

    case 'test_complete':
      console.log(`✅ Test completed: ${message.payload.testName} (${message.payload.status})`);
      break;

    case 'cursor_position':
      console.log(`👆 Cursor: ${message.payload.userId} at position ${message.payload.position}`);
      break;

    case 'edit_update':
      console.log(`✏️  Edit: ${message.payload.userId} modified test ${message.payload.testId}`);
      break;

    case 'broadcast':
      console.log(`📢 Broadcast: ${message.payload.message}`);
      break;

    case 'error':
      console.error(`❌ Error: ${message.payload.error}`);
      break;

    default:
      console.log(`📨 ${message.type}: ${JSON.stringify(message.payload, null, 2)}`);
  }
}

// Handle test execution messages
function handleTestExecutionMessage(message: any): void {
  switch (message.type) {
    case 'test_execution_started':
      console.log(`🧪 Real-time test started: ${message.payload.testName}`);
      console.log(`🆔 Test ID: ${message.payload.testId}`);
      break;

    case 'test_start':
      console.log(`📊 Test execution started: ${message.payload.testName}`);
      break;

    case 'test_update':
      console.log(`📈 Test progress: ${message.payload.progress}% - ${message.payload.currentStep}`);
      if (message.payload.logs && message.payload.logs.length > 0) {
        message.payload.logs.forEach((log: string) => {
          console.log(`   📝 ${log}`);
        });
      }
      break;

    case 'test_complete':
      console.log(`✅ Test completed: ${message.payload.testName}`);
      console.log(`📊 Status: ${message.payload.status}`);
      console.log(`⏱️  Duration: ${message.payload.duration}ms`);
      break;

    default:
      console.log(`📨 ${message.type}: ${JSON.stringify(message.payload, null, 2)}`);
  }
}

// Start monitoring mode
function startMonitoring(ws: WebSocket): void {
  console.log('📊 Monitoring mode active. Press Ctrl+C to exit.');

  // Send periodic heartbeat
  const heartbeatInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'heartbeat',
        payload: { timestamp: new Date().toISOString() }
      }));
    } else {
      clearInterval(heartbeatInterval);
    }
  }, 30000);

  // Handle process termination
  process.on('SIGINT', () => {
    console.log('\n🛑 Stopping monitoring...');
    clearInterval(heartbeatInterval);
    ws.close();
    process.exit(0);
  });
}

// Help command
function showHelp() {
  console.log(`
🔌 Qestro WebSocket CLI

USAGE:
  npm run ws-cli <command> [options]

COMMANDS:
  connect          Connect to WebSocket server for real-time interaction
  broadcast         Broadcast messages to connected clients
  monitor           Monitor WebSocket statistics and activity
  simulate-test    Simulate test execution with real-time updates
  demo             Run comprehensive WebSocket feature demo
  test-execution   Start real-time test execution with monitoring
  room-status      Get status of a specific collaboration room
  statistics        Display current WebSocket statistics
  help              Show this help message

CONNECT OPTIONS:
  --user, -u        User ID for the connection (default: auto-generated)
  --type, -t        Connection type: client|service|monitor|automation (default: client)
  --room, -r        Room ID to join for collaboration
  --monitor, -m     Enable monitoring mode (read-only)

BROADCAST OPTIONS:
  --type, -t        Message type (default: broadcast)
  --target, -t      Target user ID for direct message
  --room, -r        Room ID for room-specific broadcast
  --message, -m     Message content (default: "Hello from CLI!")

MONITOR OPTIONS:
  --interval, -i    Update interval in seconds (default: 5)
  --continuous, -c  Enable continuous monitoring

SIMULATE-TEST OPTIONS:
  --name, -n        Test name (default: "WebSocket CLI Test")
  --duration, -d    Test duration in milliseconds (default: 30000)
  --wait, -w        Wait for test completion

DEMO OPTIONS:
  No additional options required

TEST-EXECUTION OPTIONS:
  --name, -n        Test name (default: "Real-time WebSocket Test")
  --room, -r        Room ID for collaboration (default: auto-generated)
  --monitor, -m     Enable real-time monitoring

ROOM-STATUS OPTIONS:
  --room, -r        Room ID to query (required)

EXAMPLES:
  # Connect to WebSocket with monitoring
  npm run ws-cli connect --user alice --monitor

  # Join collaboration room
  npm run ws-cli connect --user alice --room project-123

  # Broadcast message to all users
  npm run ws-cli broadcast --message "System maintenance at 10 PM"

  # Send message to specific room
  npm run ws-cli broadcast --room project-123 --message "Test deployment ready"

  # Monitor statistics continuously
  npm run ws-cli monitor --continuous --interval 10

  # Simulate long-running test
  npm run ws-cli simulate-test --name "E2E Test Suite" --duration 60000 --wait

  # Run comprehensive demo
  npm run ws-cli demo

  # Start real-time test execution
  npm run ws-cli test-execution --name "API Test Suite" --monitor

  # Check room status
  npm run ws-cli room-status --room project-123

  # Get current statistics
  npm run ws-cli statistics

For more information, visit: https://docs.qestro.io/websocket
`);
}

// Run main function
main().catch(console.error);
