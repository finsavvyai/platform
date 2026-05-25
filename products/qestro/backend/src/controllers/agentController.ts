import { Request, Response } from 'express';
import { Server as SocketServer } from 'socket.io';
import { logger, logUserAction } from '../utils/logger.js';
import { db } from '../config/database.js';
import { users } from '../schema/index.js';
import { eq } from 'drizzle-orm';
import WebSocket, { WebSocketServer } from 'ws';

interface AgentConnection {
  id: string;
  socket: any;
  info: {
    agentId: string;
    version: string;
    capabilities: any;
    systemInfo: any;
  };
  devices: any[];
  status: 'online' | 'offline';
  lastSeen: Date;
  userId?: string;
}

export class AgentManager {
  private connectedAgents = new Map<string, AgentConnection>();
  private io: SocketServer;

  constructor(io: SocketServer) {
    this.io = io;
    this.setupAgentWebSocket();
  }

  private setupAgentWebSocket(): void {
    // Create WebSocket server for agent connections
    const wss = new WebSocketServer({
      port: 8001,
      path: '/agent'
    });

    wss.on('connection', (ws: WebSocket, req) => {
      logger.info('Agent attempting to connect');
      
      // Extract auth token from headers
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        ws.close(1008, 'Authentication required');
        return;
      }

      this.handleAgentConnection(ws, authHeader);
    });

    logger.info('Agent WebSocket server started on port 8001');
  }

  private async handleAgentConnection(ws: WebSocket, authHeader: string): Promise<void> {
    try {
      // Validate agent authentication
      const token = authHeader.replace('Bearer ', '');
      const userId = await this.validateAgentToken(token);
      
      if (!userId) {
        ws.close(1008, 'Invalid authentication token');
        return;
      }

      const agentId = `agent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Setup agent connection
      const agent: AgentConnection = {
        id: agentId,
        socket: ws,
        info: {
          agentId: '',
          version: '',
          capabilities: {},
          systemInfo: {}
        },
        devices: [],
        status: 'online',
        lastSeen: new Date(),
        userId
      };

      this.connectedAgents.set(agentId, agent);
      
      logger.info(`Agent connected: ${agentId} for user ${userId}`);

      // Setup message handlers
      ws.on('message', async (data: WebSocket.Data) => {
        try {
          const message = JSON.parse(data.toString());
          await this.handleAgentMessage(agentId, message);
        } catch (error) {
          logger.error('Error handling agent message:', error);
        }
      });

      ws.on('close', () => {
        this.handleAgentDisconnection(agentId);
      });

      ws.on('error', (error) => {
        logger.error(`Agent ${agentId} error:`, error);
        this.handleAgentDisconnection(agentId);
      });

      // Send welcome message
      this.sendToAgent(agentId, {
        type: 'WELCOME',
        payload: {
          agentId,
          cloudVersion: '1.0.0'
        },
        timestamp: Date.now()
      });

    } catch (error) {
      logger.error('Agent connection setup failed:', error);
      ws.close(1011, 'Connection setup failed');
    }
  }

  private async validateAgentToken(token: string): Promise<string | null> {
    try {
      // In a real implementation, validate JWT token
      // For now, we'll treat the token as a user ID
      const [user] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, token))
        .limit(1);

      return user?.id || null;
    } catch (error) {
      logger.error('Token validation failed:', error);
      return null;
    }
  }

  private async handleAgentMessage(agentId: string, message: any): Promise<void> {
    const agent = this.connectedAgents.get(agentId);
    if (!agent) return;

    agent.lastSeen = new Date();

    switch (message.type) {
      case 'AGENT_REGISTER':
        await this.handleAgentRegister(agentId, message.payload);
        break;

      case 'DEVICE_LIST':
        await this.handleDeviceList(agentId, message.payload);
        break;

      case 'RECORDING_STARTED':
        await this.handleRecordingStarted(agentId, message);
        break;

      case 'RECORDING_STOPPED':
        await this.handleRecordingStopped(agentId, message);
        break;

      case 'ACTION_RECORDED':
        await this.handleActionRecorded(agentId, message);
        break;

      case 'SCREEN_FRAME':
        await this.handleScreenFrame(agentId, message);
        break;

      case 'PONG':
        // Heartbeat response
        break;

      default:
        logger.warn(`Unknown message type from agent ${agentId}: ${message.type}`);
    }
  }

  private async handleAgentRegister(agentId: string, payload: any): Promise<void> {
    const agent = this.connectedAgents.get(agentId);
    if (!agent) return;

    agent.info = {
      agentId: payload.agentId,
      version: payload.version,
      capabilities: payload.capabilities,
      systemInfo: payload.systemInfo
    };
    agent.devices = payload.devices || [];

    logger.info(`Agent registered: ${agentId} (${payload.version})`);

    // Notify frontend that agent is connected
    this.io.to(`user:${agent.userId}`).emit('agent:connected', {
      id: agentId,
      name: `Agent ${payload.systemInfo?.hostname || agentId}`,
      version: payload.version,
      capabilities: payload.capabilities,
      devices: agent.devices,
      status: 'online'
    });

    logUserAction(agent.userId!, 'agent_connected', agentId);
  }

  private async handleDeviceList(agentId: string, payload: any): Promise<void> {
    const agent = this.connectedAgents.get(agentId);
    if (!agent) return;

    agent.devices = payload.devices || [];

    // Notify frontend of device updates
    this.io.to(`user:${agent.userId}`).emit('agent:devices_updated', {
      agentId,
      devices: agent.devices
    });

    logger.info(`Agent ${agentId} reported ${agent.devices.length} devices`);
  }

  private async handleRecordingStarted(agentId: string, message: any): Promise<void> {
    const agent = this.connectedAgents.get(agentId);
    if (!agent) return;

    // Forward to frontend
    this.io.to(`user:${agent.userId}`).emit('recording:started', {
      sessionId: message.sessionId,
      agentId,
      payload: message.payload
    });

    logger.info(`Recording started on agent ${agentId}: ${message.sessionId}`);
  }

  private async handleRecordingStopped(agentId: string, message: any): Promise<void> {
    const agent = this.connectedAgents.get(agentId);
    if (!agent) return;

    // Forward to frontend
    this.io.to(`user:${agent.userId}`).emit('recording:completed', {
      sessionId: message.sessionId,
      agentId,
      payload: message.payload
    });

    logger.info(`Recording stopped on agent ${agentId}: ${message.sessionId}`);
  }

  private async handleActionRecorded(agentId: string, message: any): Promise<void> {
    const agent = this.connectedAgents.get(agentId);
    if (!agent) return;

    // Forward real-time action to frontend
    this.io.to(`user:${agent.userId}`).emit('recording:action', {
      sessionId: message.sessionId,
      agentId,
      action: message.payload
    });
  }

  private async handleScreenFrame(agentId: string, message: any): Promise<void> {
    const agent = this.connectedAgents.get(agentId);
    if (!agent) return;

    // Forward screen frame to frontend (throttled)
    this.io.to(`user:${agent.userId}`).emit('device:screen_frame', {
      sessionId: message.sessionId,
      agentId,
      deviceId: message.payload.deviceId,
      frame: message.payload.frame,
      format: message.payload.format
    });
  }

  private handleAgentDisconnection(agentId: string): void {
    const agent = this.connectedAgents.get(agentId);
    if (!agent) return;

    agent.status = 'offline';

    // Notify frontend
    this.io.to(`user:${agent.userId}`).emit('agent:disconnected', {
      agentId
    });

    this.connectedAgents.delete(agentId);
    logger.info(`Agent disconnected: ${agentId}`);

    if (agent.userId) {
      logUserAction(agent.userId, 'agent_disconnected', agentId);
    }
  }

  private sendToAgent(agentId: string, message: any): void {
    const agent = this.connectedAgents.get(agentId);
    if (agent && agent.socket.readyState === WebSocket.OPEN) {
      agent.socket.send(JSON.stringify(message));
    }
  }

  // Public methods for controlling agents

  public async startRecording(agentId: string, sessionId: string, deviceId: string, config: any): Promise<void> {
    this.sendToAgent(agentId, {
      type: 'START_RECORDING',
      sessionId,
      payload: {
        sessionId,
        deviceId,
        appId: config.appId,
        recordingConfig: config
      },
      timestamp: Date.now()
    });
  }

  public async stopRecording(agentId: string, sessionId: string, recordingId: string): Promise<void> {
    this.sendToAgent(agentId, {
      type: 'STOP_RECORDING',
      sessionId,
      payload: {
        sessionId,
        recordingId
      },
      timestamp: Date.now()
    });
  }

  public async startStreaming(agentId: string, sessionId: string, deviceId: string): Promise<void> {
    this.sendToAgent(agentId, {
      type: 'START_STREAMING',
      sessionId,
      payload: {
        sessionId,
        deviceId
      },
      timestamp: Date.now()
    });
  }

  public async executeTest(agentId: string, sessionId: string, deviceId: string, testContent: string): Promise<void> {
    this.sendToAgent(agentId, {
      type: 'EXECUTE_TEST',
      sessionId,
      payload: {
        sessionId,
        deviceId,
        testContent
      },
      timestamp: Date.now()
    });
  }

  public async refreshDevices(agentId: string): Promise<void> {
    this.sendToAgent(agentId, {
      type: 'REFRESH_DEVICES',
      timestamp: Date.now()
    });
  }

  public getConnectedAgents(userId: string): any[] {
    return Array.from(this.connectedAgents.values())
      .filter(agent => agent.userId === userId)
      .map(agent => ({
        id: agent.id,
        name: `Agent ${agent.info.systemInfo?.hostname || agent.id}`,
        version: agent.info.version,
        capabilities: agent.info.capabilities,
        devices: agent.devices,
        status: agent.status,
        lastSeen: agent.lastSeen
      }));
  }

  public startHeartbeat(): void {
    setInterval(() => {
      this.connectedAgents.forEach((agent, agentId) => {
        this.sendToAgent(agentId, {
          type: 'PING',
          timestamp: Date.now()
        });
      });
    }, 30000); // Every 30 seconds
  }
}

// REST API endpoints
export const getConnectedAgents = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const agentManager = req.app.get('agentManager') as AgentManager;
    const agents = agentManager.getConnectedAgents(userId);

    res.json({
      success: true,
      agents
    });
  } catch (error) {
    logger.error('Failed to get connected agents:', error);
    res.status(500).json({
      error: 'Failed to get connected agents',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

export const refreshAgentDevices = async (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const agentManager = req.app.get('agentManager') as AgentManager;
    await agentManager.refreshDevices(agentId);

    res.json({
      success: true,
      message: 'Device refresh requested'
    });
  } catch (error) {
    logger.error('Failed to refresh agent devices:', error);
    res.status(500).json({
      error: 'Failed to refresh agent devices',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// AgentManager already exported above
