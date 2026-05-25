import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { WebSocketService, WebSocketMessage } from '../../../../backend/src/services/WebSocketService';

// Mock Socket.io
const mockIoServerInstance = {
    on: jest.fn(),
    emit: jest.fn(),
    to: jest.fn().mockReturnThis(),
    except: jest.fn().mockReturnThis(),
    close: jest.fn(),
    sockets: {
        sockets: new Map()
    }
};

jest.mock('socket.io', () => {
    return {
        __esModule: true,
        Server: jest.fn().mockImplementation(() => mockIoServerInstance)
    };
});

describe('WebSocketService Integration', () => {
    let wsService: WebSocketService;
    let mockHttpServer: HTTPServer;
    let mockIoServer: any;

    beforeEach(() => {
        jest.clearAllMocks();
        mockHttpServer = new HTTPServer();
        wsService = new WebSocketService(mockHttpServer);
        mockIoServer = mockIoServerInstance;
    });

    afterEach(() => {
        wsService.shutdown();
    });

    describe('Connection & Authentication', () => {
        it('establishes connection and handles authentication', async () => {
            // Find the connection handler
            const connectionCall = mockIoServer.on.mock.calls.find((c: any) => c[0] === 'connection');
            expect(connectionCall).toBeDefined();
            const connectionHandler = connectionCall[1];

            // Simulate a socket connect
            const mockSocket = {
                id: 'socket_123',
                on: jest.fn(),
                emit: jest.fn(),
                join: jest.fn(),
                disconnect: jest.fn()
            };

            // Add socket to internal mock
            mockIoServer.sockets.sockets.set(mockSocket.id, mockSocket);

            // Trigger connection
            connectionHandler(mockSocket);

            expect(wsService.getConnectionCount()).toBe(1);

            // Find authenticate handler
            const authCall = mockSocket.on.mock.calls.find((c: any) => c[0] === 'authenticate');
            expect(authCall).toBeDefined();
            const authHandler = authCall[1];

            // Trigger authentication
            await authHandler({ userId: 'user_xyz', token: 'valid_token' });

            // Verify connection updated
            const connections = wsService.getConnectionsByUser('user_xyz');
            expect(connections.length).toBe(1);
            expect(mockSocket.join).toHaveBeenCalledWith('user:user_xyz');
            expect(mockSocket.emit).toHaveBeenCalledWith('authenticated', expect.objectContaining({ success: true }));
        });
    });

    describe('Message Routing', () => {
        it('routes incoming messages to registered handlers', async () => {
            const connectionCall = mockIoServer.on.mock.calls.find((c: any) => c[0] === 'connection');
            const connectionHandler = connectionCall[1];

            const mockSocket = {
                id: 'socket_456',
                on: jest.fn(),
                emit: jest.fn(),
                join: jest.fn(),
                disconnect: jest.fn()
            };

            mockIoServer.sockets.sockets.set(mockSocket.id, mockSocket);
            connectionHandler(mockSocket);

            // Mock user authentication
            const authHandler = mockSocket.on.mock.calls.find((c: any) => c[0] === 'authenticate')[1];
            await authHandler({ userId: 'user_456', token: 'token' });

            // Register route
            const mockRouteHandler = jest.fn().mockResolvedValue(undefined);
            wsService.addMessageRoute('test_action', mockRouteHandler);

            // Trigger message
            const messageHandler = mockSocket.on.mock.calls.find((c: any) => c[0] === 'message')[1];
            const testData = { type: 'test_action', payload: { foo: 'bar' } };
            await messageHandler(testData);

            expect(mockRouteHandler).toHaveBeenCalledTimes(1);
            const [msgArg, connArg] = mockRouteHandler.mock.calls[0];
            expect(msgArg.type).toBe('test_action');
            expect(msgArg.payload.foo).toBe('bar');
            expect(connArg.id).toBe('socket_456');
        });
    });

    describe('Broadcasting', () => {
        it('broadcasts messages to all connections except excluded', () => {
            wsService.broadcast({ type: 'sys_alert', payload: 'system going down' }, 'socket_skip');

            expect(mockIoServer.except).toHaveBeenCalledWith('socket_skip');
            expect(mockIoServer.emit).toHaveBeenCalledWith('message', expect.objectContaining({
                type: 'sys_alert',
                payload: 'system going down'
            }));
        });
    });
});
