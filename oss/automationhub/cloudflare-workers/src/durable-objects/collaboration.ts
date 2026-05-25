/**
 * Collaboration Durable Object
 * Provides real-time collaboration capabilities
 */

export class CollaborationRoom {
  private state: DurableObjectState;
  private env: Env;
  private sessions: Map<string, WebSocket>;
  private roomData: any;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    this.sessions = new Map();
    this.roomData = {
      id: '',
      name: '',
      created_at: new Date().toISOString(),
      participants: [],
      messages: [],
      shared_state: {},
      last_activity: new Date().toISOString()
    };

    // Load persisted data
    this.loadRoomData();
  }

  // Handle WebSocket connections
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // Handle WebSocket upgrade
    if (request.headers.get('Upgrade') === 'websocket') {
      return this.handleWebSocket(request);
    }

    // Handle HTTP requests
    switch (pathname) {
      case '/':
        return this.getRoomInfo();
      case '/join':
        return this.joinRoom(request);
      case '/leave':
        return this.leaveRoom(request);
      case '/message':
        return this.sendMessage(request);
      case '/state':
        return this.updateState(request);
      default:
        return new Response('Not Found', { status: 404 });
    }
  }

  // Handle WebSocket connections
  private async handleWebSocket(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const userId = url.searchParams.get('user_id');
    const userName = url.searchParams.get('user_name') || 'Anonymous';

    if (!userId) {
      return new Response('User ID required', { status: 400 });
    }

    // Create WebSocket pair
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    // Accept the WebSocket
    server.accept();

    // Add to sessions
    this.sessions.set(userId, server);

    // Add participant to room
    const participant = {
      id: userId,
      name: userName,
      joined_at: new Date().toISOString(),
      cursor: { x: 0, y: 0 },
      selection: null,
      status: 'active'
    };

    if (!this.roomData.participants.find((p: any) => p.id === userId)) {
      this.roomData.participants.push(participant);
    }

    // Send welcome message
    server.send(JSON.stringify({
      type: 'welcome',
      data: {
        room_id: this.roomData.id,
        user_id: userId,
        participants: this.roomData.participants,
        messages: this.roomData.messages.slice(-50), // Last 50 messages
        shared_state: this.roomData.shared_state
      }
    }));

    // Notify other participants
    this.broadcast({
      type: 'user_joined',
      data: participant
    }, userId);

    // Handle WebSocket messages
    server.addEventListener('message', async (event) => {
      try {
        const message = JSON.parse(event.data as string);
        await this.handleWebSocketMessage(userId, message, server);
      } catch (error) {
        console.error('Error handling WebSocket message:', error);
        server.send(JSON.stringify({
          type: 'error',
          data: { message: 'Invalid message format' }
        }));
      }
    });

    // Handle WebSocket close
    server.addEventListener('close', () => {
      this.handleDisconnect(userId);
    });

    // Handle WebSocket error
    server.addEventListener('error', (error) => {
      console.error('WebSocket error:', error);
      this.handleDisconnect(userId);
    });

    // Persist room data
    await this.saveRoomData();

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  // Handle WebSocket messages
  private async handleWebSocketMessage(userId: string, message: any, ws: WebSocket): Promise<void> {
    this.roomData.last_activity = new Date().toISOString();

    switch (message.type) {
      case 'cursor_move':
        await this.handleCursorMove(userId, message.data);
        break;
      case 'selection_change':
        await this.handleSelectionChange(userId, message.data);
        break;
      case 'text_change':
        await this.handleTextChange(userId, message.data);
        break;
      case 'typing':
        await this.handleTyping(userId, message.data);
        break;
      case 'chat_message':
        await this.handleChatMessage(userId, message.data);
        break;
      case 'state_update':
        await this.handleStateUpdate(userId, message.data);
        break;
      default:
        console.warn('Unknown message type:', message.type);
    }
  }

  // Handle cursor movement
  private async handleCursorMove(userId: string, data: any): Promise<void> {
    const participant = this.roomData.participants.find((p: any) => p.id === userId);
    if (participant) {
      participant.cursor = data.cursor;
      participant.last_activity = new Date().toISOString();
    }

    this.broadcast({
      type: 'cursor_moved',
      data: {
        user_id: userId,
        cursor: data.cursor
      }
    }, userId);
  }

  // Handle selection change
  private async handleSelectionChange(userId: string, data: any): Promise<void> {
    const participant = this.roomData.participants.find((p: any) => p.id === userId);
    if (participant) {
      participant.selection = data.selection;
      participant.last_activity = new Date().toISOString();
    }

    this.broadcast({
      type: 'selection_changed',
      data: {
        user_id: userId,
        selection: data.selection
      }
    }, userId);
  }

  // Handle text change
  private async handleTextChange(userId: string, data: any): Promise<void> {
    // Validate and apply text change
    if (data.operation && data.content !== undefined) {
      // Apply operation to shared state
      if (!this.roomData.shared_state.content) {
        this.roomData.shared_state.content = '';
      }

      // Simple text operation (in production, use Operational Transform or CRDT)
      switch (data.operation) {
        case 'insert':
          this.roomData.shared_state.content =
            this.roomData.shared_state.content.slice(0, data.position) +
            data.content +
            this.roomData.shared_state.content.slice(data.position);
          break;
        case 'delete':
          this.roomData.shared_state.content =
            this.roomData.shared_state.content.slice(0, data.position) +
            this.roomData.shared_state.content.slice(data.position + data.length);
          break;
        case 'replace':
          this.roomData.shared_state.content =
            this.roomData.shared_state.content.slice(0, data.position) +
            data.content +
            this.roomData.shared_state.content.slice(data.position + data.length);
          break;
      }

      // Broadcast to all participants including sender for confirmation
      this.broadcast({
        type: 'text_changed',
        data: {
          user_id: userId,
          operation: data.operation,
          position: data.position,
          content: data.content,
          timestamp: new Date().toISOString(),
          version: (this.roomData.shared_state.version || 0) + 1
        }
      });

      // Persist state
      await this.saveRoomData();
    }
  }

  // Handle typing indicator
  private async handleTyping(userId: string, data: any): Promise<void> {
    const participant = this.roomData.participants.find((p: any) => p.id === userId);
    if (participant) {
      participant.typing = data.is_typing;
      participant.last_activity = new Date().toISOString();
    }

    this.broadcast({
      type: 'typing_changed',
      data: {
        user_id: userId,
        is_typing: data.is_typing
      }
    }, userId);
  }

  // Handle chat message
  private async handleChatMessage(userId: string, data: any): Promise<void> {
    const participant = this.roomData.participants.find((p: any) => p.id === userId);
    if (!participant) return;

    const message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      user_id: userId,
      user_name: participant.name,
      content: data.content,
      timestamp: new Date().toISOString(),
      type: 'chat'
    };

    this.roomData.messages.push(message);

    // Keep only last 1000 messages
    if (this.roomData.messages.length > 1000) {
      this.roomData.messages = this.roomData.messages.slice(-1000);
    }

    this.broadcast({
      type: 'chat_message',
      data: message
    });

    await this.saveRoomData();
  }

  // Handle state update
  private async handleStateUpdate(userId: string, data: any): Promise<void> {
    if (data.key && data.value !== undefined) {
      this.roomData.shared_state[data.key] = data.value;

      this.broadcast({
        type: 'state_updated',
        data: {
          user_id: userId,
          key: data.key,
          value: data.value,
          timestamp: new Date().toISOString()
        }
      });

      await this.saveRoomData();
    }
  }

  // Handle participant disconnect
  private async handleDisconnect(userId: string): Promise<void> {
    // Remove WebSocket session
    this.sessions.delete(userId);

    // Update participant status
    const participant = this.roomData.participants.find((p: any) => p.id === userId);
    if (participant) {
      participant.status = 'disconnected';
      participant.left_at = new Date().toISOString();
    }

    // Notify other participants
    this.broadcast({
      type: 'user_left',
      data: {
        user_id: userId,
        timestamp: new Date().toISOString()
      }
    });

    await this.saveRoomData();
  }

  // Broadcast message to all participants
  private broadcast(message: any, excludeUserId?: string): void {
    const messageStr = JSON.stringify(message);

    for (const [userId, ws] of this.sessions) {
      if (userId !== excludeUserId && ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(messageStr);
        } catch (error) {
          console.error('Error sending message to user:', userId, error);
        }
      }
    }
  }

  // HTTP endpoint handlers
  private async getRoomInfo(): Promise<Response> {
    return new Response(JSON.stringify({
      room: this.roomData,
      active_sessions: this.sessions.size,
      participants: this.roomData.participants.filter((p: any) => p.status === 'active')
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  private async joinRoom(request: Request): Promise<Response> {
    try {
      const data = await request.json();
      const userId = data.user_id;
      const userName = data.user_name || 'Anonymous';

      if (!userId) {
        return new Response(JSON.stringify({ error: 'User ID required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const participant = {
        id: userId,
        name: userName,
        joined_at: new Date().toISOString(),
        status: 'active'
      };

      if (!this.roomData.participants.find((p: any) => p.id === userId)) {
        this.roomData.participants.push(participant);
      }

      await this.saveRoomData();

      return new Response(JSON.stringify({
        success: true,
        room: this.roomData,
        participant
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: 'Invalid request' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  private async leaveRoom(request: Request): Promise<Response> {
    try {
      const data = await request.json();
      const userId = data.user_id;

      if (!userId) {
        return new Response(JSON.stringify({ error: 'User ID required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      await this.handleDisconnect(userId);

      return new Response(JSON.stringify({
        success: true,
        message: 'Left room successfully'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: 'Invalid request' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  private async sendMessage(request: Request): Promise<Response> {
    try {
      const data = await request.json();
      const userId = data.user_id;
      const content = data.content;

      if (!userId || !content) {
        return new Response(JSON.stringify({ error: 'User ID and content required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      await this.handleChatMessage(userId, { content });

      return new Response(JSON.stringify({
        success: true,
        message: 'Message sent successfully'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: 'Invalid request' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  private async updateState(request: Request): Promise<Response> {
    try {
      const data = await request.json();
      const userId = data.user_id;
      const key = data.key;
      const value = data.value;

      if (!userId || key === undefined || value === undefined) {
        return new Response(JSON.stringify({ error: 'User ID, key, and value required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      await this.handleStateUpdate(userId, { key, value });

      return new Response(JSON.stringify({
        success: true,
        message: 'State updated successfully'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: 'Invalid request' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // Persist room data
  private async saveRoomData(): Promise<void> {
    await this.state.storage.put('roomData', this.roomData);
  }

  // Load room data
  private async loadRoomData(): Promise<void> {
    const stored = await this.state.storage.get<any>('roomData');
    if (stored) {
      this.roomData = stored;
    } else {
      // Initialize new room
      this.roomData.id = `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      this.roomData.name = `Collaboration Room ${this.roomData.id}`;
      await this.saveRoomData();
    }
  }
}