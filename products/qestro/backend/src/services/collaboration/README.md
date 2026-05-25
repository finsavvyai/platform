# Real-time Collaboration Service

Multiplayer test editor with WebSocket support and Operational Transform conflict resolution.

## Features

- **Real-time Synchronization**: Multiple users edit the same test simultaneously
- **Operational Transform (OT)**: Conflict-free concurrent editing algorithm
- **Presence Tracking**: See who's editing and where their cursor is
- **Automatic Conflict Resolution**: Concurrent operations are transformed to prevent conflicts
- **Session Management**: Create, join, and manage collaboration sessions
- **Audit Trail**: Full operation history for undo/redo and analysis

## Architecture

### Components

1. **CollaborationServer**: Main orchestrator for sessions and operations
2. **OperationalTransform**: OT algorithm implementation for conflict resolution
3. **Routes**: REST API for HTTP clients

### How It Works

```
User A edits → Operation OA
User B edits → Operation OB (concurrent)
                ↓
        Transform OA against OB
        Transform OB against OA
                ↓
        Both operations apply without conflict
        Final document = same for all users
```

## API Reference

### Session Management

#### Create Session
```http
POST /api/collaboration/sessions
Content-Type: application/json

{
  "testId": "test-123",
  "projectId": "project-456"
}
```

Response:
```json
{
  "success": true,
  "session": {
    "sessionId": "test-123-1712000000000",
    "testId": "test-123",
    "projectId": "project-456",
    "document": "",
    "version": 1,
    "participants": [],
    "isActive": true
  }
}
```

#### Join Session
```http
POST /api/collaboration/sessions/{sessionId}/join
```

#### Leave Session
```http
POST /api/collaboration/sessions/{sessionId}/leave
```

#### Get Session State
```http
GET /api/collaboration/sessions/{sessionId}
```

### Presence & Collaboration

#### Get Participants
```http
GET /api/collaboration/sessions/{sessionId}/participants
```

#### Update Presence
```http
POST /api/collaboration/sessions/{sessionId}/presence
Content-Type: application/json

{
  "status": "editing" // or "viewing", "idle"
}
```

#### Get Statistics
```http
GET /api/collaboration/stats
```

## WebSocket Protocol

When connected via WebSocket at `/ws/collaboration/{sessionId}`:

### Message Types

#### Join
```json
{
  "type": "join",
  "sessionId": "test-123-1712000000000",
  "userId": "user-1",
  "timestamp": 1712000000000
}
```

#### Edit
```json
{
  "type": "edit",
  "sessionId": "test-123-1712000000000",
  "payload": {
    "type": "insert",
    "position": 5,
    "content": "new code",
    "userId": "user-1",
    "version": 42,
    "timestamp": 1712000000000
  }
}
```

#### Cursor
```json
{
  "type": "cursor",
  "sessionId": "test-123-1712000000000",
  "payload": {
    "line": 10,
    "column": 5,
    "userId": "user-1",
    "userName": "Alice",
    "color": "#FF6B6B"
  }
}
```

#### Sync
Server sends full state to new clients:
```json
{
  "type": "sync",
  "sessionId": "test-123-1712000000000",
  "payload": {
    "document": "test code here...",
    "version": 42,
    "participants": [...],
    "operations": [...]
  }
}
```

#### Ack
Server acknowledges operation:
```json
{
  "type": "ack",
  "sessionId": "test-123-1712000000000",
  "payload": {
    "operationId": "user-1-1712000000000",
    "version": 43,
    "success": true
  }
}
```

## Usage Example

```typescript
import { collaborationServer } from './CollaborationServer.js';

// Create a session
const session = await collaborationServer.createSession(
  'test-123',
  'project-456',
  'user-1',
  'Alice'
);

// Join the session
const participant = await collaborationServer.joinSession(
  session.sessionId,
  'user-2',
  'Bob',
  'bob@example.com'
);

// Broadcast an edit
const op = {
  type: 'insert' as const,
  position: 0,
  content: 'const test = ',
  timestamp: Date.now(),
  userId: 'user-1',
  version: 1,
};

const ack = await collaborationServer.broadcastEdit(session.sessionId, op);
console.log(`Operation applied at version ${ack.payload.version}`);

// Update cursor position
await collaborationServer.broadcastCursor(session.sessionId, {
  line: 5,
  column: 10,
  userId: 'user-1',
  userName: 'Alice',
  color: '#FF6B6B',
});

// Get current state
const state = collaborationServer.getSessionState(session.sessionId);
console.log('Document:', state?.document);
console.log('Participants:', state?.participants);
```

## Operational Transform Algorithm

The OT algorithm ensures concurrent edits never conflict:

1. **Insert vs Insert**: If both insert at same position, transform second operation's position
2. **Delete vs Insert**: Adjust delete position if insert occurs before it
3. **Replace vs Replace**: Merge operations intelligently
4. **Compose**: Combine consecutive operations for optimization

### Example

```
Initial: "hello"
User A: insert "X" at position 0 → "Xhello"
User B: insert "Y" at position 0 (concurrent)
        Transform: position 0 + insert length 1 = position 1
        Result: insert "Y" at position 1 → "XYhello"
```

## Performance Considerations

- **Operation History**: Kept in memory (last 100 operations per session)
- **Session Timeout**: 30 minutes of inactivity
- **Max Participants**: 50 per session (configurable)
- **Garbage Collection**: Sessions closed when all participants leave

## Testing

Run tests:
```bash
npm test -- CollaborationServer.test.ts
```

## Events Emitted

```typescript
collaborationServer.on('session:created', ({ sessionId, testId }) => {});
collaborationServer.on('participant:joined', ({ sessionId, participant }) => {});
collaborationServer.on('participant:left', ({ sessionId, participant }) => {});
collaborationServer.on('edit:applied', ({ sessionId, operation, version }) => {});
collaborationServer.on('cursor:updated', ({ sessionId, cursor }) => {});
collaborationServer.on('presence:updated', ({ sessionId, userId, status }) => {});
collaborationServer.on('session:closed', ({ sessionId }) => {});
```

## Future Enhancements

- CRDT alternative to OT for better scalability
- Persistent operation log in database
- Selective operation syncing for large documents
- Conflict visualization UI
- Undo/Redo with OT
