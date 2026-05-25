/**
 * WebSocket Manager Durable Object for Cloudflare Workers
 * Manages real-time WebSocket connections for live fraud detection updates
 */

export class WebSocketManager {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.connections = new Map();
    this.rooms = new Map();
  }

  async fetch(request) {
    const url = new URL(request.url);
    const clientId = url.searchParams.get('clientId');
    const action = url.searchParams.get('action');

    switch (action) {
      case 'broadcast':
        return this.handleBroadcast(request);
      case 'room':
        return this.handleRoomOperation(request);
      case 'stats':
        return this.handleGetStats();
      default:
        return new Response('Unknown action', { status: 400 });
    }
  }

  async addConnection(clientId, webSocket) {
    this.connections.set(clientId, {
      webSocket,
      connectedAt: Date.now(),
      rooms: new Set()
    });

    // Set up WebSocket message handling
    webSocket.addEventListener('message', (event) => {
      this.handleMessage(clientId, event.data);
    });

    webSocket.addEventListener('close', () => {
      this.removeConnection(clientId);
    });

    // Send welcome message
    webSocket.send(JSON.stringify({
      type: 'connected',
      clientId,
      timestamp: new Date().toISOString()
    }));

    // Notify others
    this.broadcast({
      type: 'user_connected',
      clientId,
      totalUsers: this.connections.size
    }, clientId);

    console.log(`WebSocket connected: ${clientId}`);
  }

  removeConnection(clientId) {
    const connection = this.connections.get(clientId);
    if (connection) {
      // Remove from all rooms
      connection.rooms.forEach(room => {
        this.leaveRoom(clientId, room);
      });

      this.connections.delete(clientId);

      // Notify others
      this.broadcast({
        type: 'user_disconnected',
        clientId,
        totalUsers: this.connections.size
      });

      console.log(`WebSocket disconnected: ${clientId}`);
    }
  }

  async handleMessage(clientId, data) {
    try {
      const message = JSON.parse(data);
      const connection = this.connections.get(clientId);

      if (!connection) return;

      switch (message.type) {
        case 'join_room':
          this.joinRoom(clientId, message.room);
          break;
        case 'leave_room':
          this.leaveRoom(clientId, message.room);
          break;
        case 'subscribe':
          this.subscribe(clientId, message.events);
          break;
        case 'ping':
          connection.webSocket.send(JSON.stringify({
            type: 'pong',
            timestamp: new Date().toISOString()
          }));
          break;
      }
    } catch (error) {
      console.error(`WebSocket message error for ${clientId}:`, error);
    }
  }

  joinRoom(clientId, room) {
    const connection = this.connections.get(clientId);
    if (!connection) return;

    // Remove from old room if exists
    connection.rooms.forEach(oldRoom => {
      if (oldRoom !== room) {
        this.leaveRoom(clientId, oldRoom);
      }
    });

    // Add to new room
    connection.rooms.add(room);

    if (!this.rooms.has(room)) {
      this.rooms.set(room, new Set());
    }
    this.rooms.get(room).add(clientId);

    // Notify room members
    this.broadcastToRoom(room, {
      type: 'user_joined_room',
      clientId,
      room,
      totalUsers: this.rooms.get(room).size
    }, clientId);

    connection.webSocket.send(JSON.stringify({
      type: 'joined_room',
      room,
      totalUsers: this.rooms.get(room).size
    }));
  }

  leaveRoom(clientId, room) {
    const connection = this.connections.get(clientId);
    if (!connection) return;

    connection.rooms.delete(room);

    if (this.rooms.has(room)) {
      this.rooms.get(room).delete(clientId);

      // Remove room if empty
      if (this.rooms.get(room).size === 0) {
        this.rooms.delete(room);
      }

      // Notify room members
      this.broadcastToRoom(room, {
        type: 'user_left_room',
        clientId,
        room,
        totalUsers: this.rooms.get(room)?.size || 0
      });
    }

    connection.webSocket.send(JSON.stringify({
      type: 'left_room',
      room
    }));
  }

  subscribe(clientId, events) {
    const connection = this.connections.get(clientId);
    if (!connection) return;

    // Store subscription events
    connection.subscribedEvents = new Set(events || []);

    connection.webSocket.send(JSON.stringify({
      type: 'subscribed',
      events: Array.from(connection.subscribedEvents)
    }));
  }

  broadcast(message, excludeClientId = null) {
    const messageStr = JSON.stringify({
      ...message,
      timestamp: new Date().toISOString()
    });

    this.connections.forEach((connection, clientId) => {
      if (clientId !== excludeClientId) {
        try {
          connection.webSocket.send(messageStr);
        } catch (error) {
          console.error(`Failed to send message to ${clientId}:`, error);
          // Remove broken connection
          this.removeConnection(clientId);
        }
      }
    });
  }

  broadcastToRoom(room, message, excludeClientId = null) {
    if (!this.rooms.has(room)) return;

    const messageStr = JSON.stringify({
      ...message,
      room,
      timestamp: new Date().toISOString()
    });

    this.rooms.get(room).forEach(clientId => {
      if (clientId !== excludeClientId) {
        const connection = this.connections.get(clientId);
        if (connection) {
          try {
            connection.webSocket.send(messageStr);
          } catch (error) {
            console.error(`Failed to send room message to ${clientId}:`, error);
            this.removeConnection(clientId);
          }
        }
      }
    });
  }

  broadcastToSubscribers(eventType, message) {
    const messageStr = JSON.stringify({
      ...message,
      eventType,
      timestamp: new Date().toISOString()
    });

    this.connections.forEach((connection, clientId) => {
      if (connection.subscribedEvents && connection.subscribedEvents.has(eventType)) {
        try {
          connection.webSocket.send(messageStr);
        } catch (error) {
          console.error(`Failed to send subscriber message to ${clientId}:`, error);
          this.removeConnection(clientId);
        }
      }
    });
  }

  async handleBroadcast(request) {
    try {
      const { message, room, eventType } = await request.json();

      if (room) {
        this.broadcastToRoom(room, message);
      } else if (eventType) {
        this.broadcastToSubscribers(eventType, message);
      } else {
        this.broadcast(message);
      }

      return new Response(JSON.stringify({
        success: true,
        sentTo: room ? this.rooms.get(room)?.size || 0 : this.connections.size
      }));
    } catch (error) {
      return new Response(JSON.stringify({
        error: 'Invalid JSON'
      }), { status: 400 });
    }
  }

  async handleRoomOperation(request) {
    const url = new URL(request.url);
    const operation = url.searchParams.get('operation');
    const room = url.searchParams.get('room');

    if (!operation || !room) {
      return new Response('Missing parameters', { status: 400 });
    }

    switch (operation) {
      case 'stats':
        return new Response(JSON.stringify({
          room,
          userCount: this.rooms.get(room)?.size || 0,
          timestamp: new Date().toISOString()
        }));
      default:
        return new Response('Unknown operation', { status: 400 });
    }
  }

  async handleGetStats() {
    const roomStats = {};
    this.rooms.forEach((users, room) => {
      roomStats[room] = users.size;
    });

    return new Response(JSON.stringify({
      totalConnections: this.connections.size,
      totalRooms: this.rooms.size,
      rooms: roomStats,
      timestamp: new Date().toISOString()
    }));
  }
}