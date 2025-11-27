# Scrible_it Backend Architecture

This document outlines the complete backend architecture for Scrible_it's real-time collaborative whiteboard.

## Overview

The backend consists of a WebSocket server with CRDT-based synchronization using Yjs, PostgreSQL for persistence, and Redis for presence/pub-sub.

## Architecture Diagram

```
┌─────────────┐     WebSocket      ┌──────────────────┐
│   Frontend  │◄───────────────────►│  WebSocket API   │
│  (tldraw)   │                     │   (Node.js)      │
└─────────────┘                     └────────┬─────────┘
                                             │
                         ┌───────────────────┼───────────────────┐
                         │                   │                   │
                    ┌────▼────┐         ┌────▼────┐       ┌─────▼─────┐
                    │  Yjs    │         │  Redis  │       │PostgreSQL │
                    │Provider │         │ Pub/Sub │       │   Rooms   │
                    └─────────┘         └─────────┘       │Snapshots  │
                                                           └───────────┘
```

## Tech Stack

### Core
- **Runtime**: Node.js 20+ with TypeScript
- **Framework**: NestJS (recommended) or Fastify
- **WebSocket**: `ws` library or `uWebSockets.js` for high performance
- **CRDT**: Yjs (`yjs` + `y-websocket`)

### Data Layer
- **Database**: PostgreSQL 15+ (for rooms, users, snapshots)
- **ORM**: Prisma (type-safe queries)
- **Cache**: Redis 7+ (for presence, pub/sub)
- **Storage**: AWS S3 or DigitalOcean Spaces (for exports, large snapshots)

### Infrastructure
- **Container**: Docker
- **Orchestration**: Kubernetes or Docker Compose
- **Reverse Proxy**: Nginx (for WebSocket upgrades)
- **CI/CD**: GitHub Actions

## Database Schema

```sql
-- Users (optional if implementing auth)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE,
  avatar_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Rooms
CREATE TABLE rooms (
  id VARCHAR(20) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  owner_id UUID REFERENCES users(id),
  visibility VARCHAR(10) NOT NULL CHECK (visibility IN ('public', 'private')),
  password_hash VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  last_active TIMESTAMP DEFAULT NOW(),
  settings JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_rooms_owner ON rooms(owner_id);
CREATE INDEX idx_rooms_last_active ON rooms(last_active);

-- Room Participants (current + historical)
CREATE TABLE room_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id VARCHAR(20) REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  client_id VARCHAR(50) NOT NULL,
  role VARCHAR(10) NOT NULL CHECK (role IN ('owner', 'editor', 'viewer')),
  joined_at TIMESTAMP DEFAULT NOW(),
  left_at TIMESTAMP
);

CREATE INDEX idx_participants_room ON room_participants(room_id);
CREATE INDEX idx_participants_user ON room_participants(user_id);

-- Yjs Snapshots (for persistence & recovery)
CREATE TABLE room_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id VARCHAR(20) REFERENCES rooms(id) ON DELETE CASCADE,
  snapshot_data BYTEA NOT NULL,
  state_vector BYTEA NOT NULL,
  version INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_snapshots_room_version ON room_snapshots(room_id, version DESC);

-- Exports
CREATE TABLE exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id VARCHAR(20) REFERENCES rooms(id),
  format VARCHAR(10) NOT NULL CHECK (format IN ('png', 'svg', 'json', 'pdf')),
  status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  file_url TEXT,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

CREATE INDEX idx_exports_room ON exports(room_id);
```

## WebSocket Server Implementation

### 1. Connection Manager

```typescript
// src/websocket/connection-manager.ts
import { WebSocket } from 'ws';
import { User, WSMessage } from './types';

export class ConnectionManager {
  private connections = new Map<string, WebSocket>();
  private clientRooms = new Map<string, string>();
  
  addConnection(clientId: string, ws: WebSocket, roomId: string) {
    this.connections.set(clientId, ws);
    this.clientRooms.set(clientId, roomId);
  }
  
  removeConnection(clientId: string) {
    this.connections.delete(clientId);
    this.clientRooms.delete(clientId);
  }
  
  broadcastToRoom(roomId: string, message: WSMessage, excludeClientId?: string) {
    for (const [clientId, ws] of this.connections.entries()) {
      if (this.clientRooms.get(clientId) === roomId && clientId !== excludeClientId) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(message));
        }
      }
    }
  }
  
  sendToClient(clientId: string, message: WSMessage) {
    const ws = this.connections.get(clientId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }
}
```

### 2. Yjs Document Manager

```typescript
// src/yjs/document-manager.ts
import * as Y from 'yjs';
import { PrismaClient } from '@prisma/client';

export class YjsDocumentManager {
  private documents = new Map<string, Y.Doc>();
  private prisma: PrismaClient;
  
  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }
  
  async getOrCreateDocument(roomId: string): Promise<Y.Doc> {
    let doc = this.documents.get(roomId);
    
    if (!doc) {
      doc = new Y.Doc();
      
      // Load latest snapshot from database
      const snapshot = await this.prisma.roomSnapshot.findFirst({
        where: { roomId },
        orderBy: { version: 'desc' },
      });
      
      if (snapshot) {
        Y.applyUpdate(doc, snapshot.snapshotData);
      }
      
      this.documents.set(roomId, doc);
      
      // Set up periodic snapshot saving
      this.setupSnapshotSaving(roomId, doc);
    }
    
    return doc;
  }
  
  private setupSnapshotSaving(roomId: string, doc: Y.Doc) {
    // Save snapshot every 5 minutes or on significant changes
    setInterval(async () => {
      await this.saveSnapshot(roomId, doc);
    }, 5 * 60 * 1000);
  }
  
  private async saveSnapshot(roomId: string, doc: Y.Doc) {
    const snapshot = Y.encodeStateAsUpdate(doc);
    const stateVector = Y.encodeStateVector(doc);
    
    const lastSnapshot = await this.prisma.roomSnapshot.findFirst({
      where: { roomId },
      orderBy: { version: 'desc' },
    });
    
    const version = (lastSnapshot?.version || 0) + 1;
    
    await this.prisma.roomSnapshot.create({
      data: {
        roomId,
        snapshotData: Buffer.from(snapshot),
        stateVector: Buffer.from(stateVector),
        version,
      },
    });
  }
  
  applyUpdate(roomId: string, update: Uint8Array) {
    const doc = this.documents.get(roomId);
    if (doc) {
      Y.applyUpdate(doc, update);
    }
  }
  
  getStateAsUpdate(roomId: string): Uint8Array | null {
    const doc = this.documents.get(roomId);
    return doc ? Y.encodeStateAsUpdate(doc) : null;
  }
}
```

### 3. Message Handlers

```typescript
// src/websocket/message-handler.ts
import { WSMessage, ConnectMessage, UpdateMessage, PresenceMessage } from './types';
import { ConnectionManager } from './connection-manager';
import { YjsDocumentManager } from '../yjs/document-manager';
import { RedisPresence } from './redis-presence';

export class MessageHandler {
  constructor(
    private connectionManager: ConnectionManager,
    private yjsManager: YjsDocumentManager,
    private redisPresence: RedisPresence
  ) {}
  
  async handleConnect(clientId: string, message: ConnectMessage, ws: WebSocket) {
    // Validate room access (check password, permissions, etc.)
    const canAccess = await this.validateRoomAccess(message.roomId, message.token);
    
    if (!canAccess) {
      ws.send(JSON.stringify({
        type: 'error',
        code: 'UNAUTHORIZED',
        message: 'Access denied to this room',
      }));
      ws.close();
      return;
    }
    
    // Add connection
    this.connectionManager.addConnection(clientId, ws, message.roomId);
    
    // Send current document state
    const doc = await this.yjsManager.getOrCreateDocument(message.roomId);
    const state = this.yjsManager.getStateAsUpdate(message.roomId);
    
    if (state) {
      ws.send(JSON.stringify({
        type: 'sync-response',
        snapshotData: Buffer.from(state).toString('base64'),
        version: 1,
      }));
    }
    
    // Broadcast join to room
    this.connectionManager.broadcastToRoom(message.roomId, {
      type: 'join',
      user: message.user,
      clientId,
      roomId: message.roomId,
    });
    
    // Add to Redis presence
    await this.redisPresence.addUser(message.roomId, clientId, message.user);
  }
  
  async handleUpdate(clientId: string, message: UpdateMessage) {
    const roomId = this.connectionManager.getRoomId(clientId);
    if (!roomId) return;
    
    // Decode and apply Yjs update
    const update = Buffer.from(message.delta, 'base64');
    this.yjsManager.applyUpdate(roomId, update);
    
    // Broadcast to other clients
    this.connectionManager.broadcastToRoom(roomId, message, clientId);
  }
  
  async handlePresence(clientId: string, message: PresenceMessage) {
    const roomId = this.connectionManager.getRoomId(clientId);
    if (!roomId) return;
    
    // Update Redis presence
    await this.redisPresence.updateCursor(roomId, clientId, message.cursor);
    
    // Broadcast to room
    this.connectionManager.broadcastToRoom(roomId, message, clientId);
  }
  
  private async validateRoomAccess(roomId: string, token?: string): Promise<boolean> {
    // Implement your access control logic
    // - Check if room exists
    // - Validate JWT token
    // - Check room password
    // - Verify user permissions
    return true;
  }
}
```

### 4. Redis Presence

```typescript
// src/websocket/redis-presence.ts
import { Redis } from 'ioredis';
import { User } from './types';

export class RedisPresence {
  constructor(private redis: Redis) {}
  
  async addUser(roomId: string, clientId: string, user: User) {
    await this.redis.hset(
      `room:${roomId}:users`,
      clientId,
      JSON.stringify({ ...user, lastSeen: Date.now() })
    );
    await this.redis.expire(`room:${roomId}:users`, 3600); // 1 hour TTL
  }
  
  async removeUser(roomId: string, clientId: string) {
    await this.redis.hdel(`room:${roomId}:users`, clientId);
  }
  
  async updateCursor(roomId: string, clientId: string, cursor: { x: number; y: number }) {
    await this.redis.hset(
      `room:${roomId}:cursors`,
      clientId,
      JSON.stringify({ ...cursor, timestamp: Date.now() })
    );
    await this.redis.expire(`room:${roomId}:cursors`, 60); // 1 minute TTL
  }
  
  async getRoomUsers(roomId: string): Promise<Map<string, User>> {
    const users = await this.redis.hgetall(`room:${roomId}:users`);
    const result = new Map<string, User>();
    
    for (const [clientId, userData] of Object.entries(users)) {
      result.set(clientId, JSON.parse(userData));
    }
    
    return result;
  }
}
```

## REST API Endpoints

```typescript
// src/api/rooms.controller.ts
import { Controller, Post, Get, Body, Param } from '@nestjs/common';
import { RoomsService } from './rooms.service';

@Controller('api/rooms')
export class RoomsController {
  constructor(private roomsService: RoomsService) {}
  
  @Post()
  async createRoom(@Body() dto: CreateRoomDto) {
    return await this.roomsService.createRoom(dto);
  }
  
  @Get(':roomId')
  async getRoom(@Param('roomId') roomId: string) {
    return await this.roomsService.getRoom(roomId);
  }
  
  @Post(':roomId/invite')
  async createInvite(@Param('roomId') roomId: string) {
    return await this.roomsService.createInviteLink(roomId);
  }
}

// src/api/exports.controller.ts
@Controller('api/exports')
export class ExportsController {
  constructor(private exportsService: ExportsService) {}
  
  @Post(':roomId')
  async requestExport(
    @Param('roomId') roomId: string,
    @Body() dto: ExportRequestDto
  ) {
    return await this.exportsService.createExportJob(roomId, dto);
  }
  
  @Get(':exportId')
  async getExport(@Param('exportId') exportId: string) {
    return await this.exportsService.getExport(exportId);
  }
}
```

## Deployment

### Docker Compose (Development)

```yaml
# docker-compose.yml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: scrible
      POSTGRES_USER: scrible
      POSTGRES_PASSWORD: password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  backend:
    build: .
    ports:
      - "3001:3001"
    environment:
      DATABASE_URL: postgresql://scrible:password@postgres:5432/scrible
      REDIS_URL: redis://redis:6379
      JWT_SECRET: your-secret-key
      PORT: 3001
    depends_on:
      - postgres
      - redis
    volumes:
      - ./src:/app/src

volumes:
  postgres_data:
  redis_data:
```

### Kubernetes (Production)

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: scrible-backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: scrible-backend
  template:
    metadata:
      labels:
        app: scrible-backend
    spec:
      containers:
      - name: backend
        image: your-registry/scrible-backend:latest
        ports:
        - containerPort: 3001
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: scrible-secrets
              key: database-url
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: scrible-secrets
              key: redis-url
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
---
apiVersion: v1
kind: Service
metadata:
  name: scrible-backend
spec:
  type: LoadBalancer
  selector:
    app: scrible-backend
  ports:
  - port: 80
    targetPort: 3001
```

## Scaling Considerations

### Horizontal Scaling
- Use Redis pub/sub for cross-instance communication
- Implement sticky sessions at load balancer
- Share Yjs documents via Redis (Y-Redis adapter)

### Performance Optimizations
- Compress WebSocket messages (deflate)
- Use binary protocols for Yjs updates
- Implement message batching
- Cache frequently accessed rooms in memory

### Monitoring
- Track WebSocket connections per instance
- Monitor Yjs document size and update frequency
- Alert on high memory usage or Redis latency
- Log slow database queries

## Security Checklist

- [ ] Implement JWT validation on WebSocket connect
- [ ] Rate limit messages per client (10-100 msg/sec)
- [ ] Validate all message types and payloads
- [ ] Sanitize room names and user inputs
- [ ] Use HTTPS/WSS in production
- [ ] Implement CORS properly
- [ ] Add helmet.js for HTTP headers
- [ ] Hash room passwords with bcrypt
- [ ] Rotate JWT secrets regularly
- [ ] Log security events (failed auth, etc.)

## Next Steps

1. **Set up project**: `npm init` with TypeScript
2. **Install dependencies**: ws, yjs, prisma, redis
3. **Create database schema**: Run Prisma migrations
4. **Implement WebSocket handlers**: Follow patterns above
5. **Test locally**: Connect frontend to `ws://localhost:3001`
6. **Deploy**: Use Fly.io, Heroku, or AWS ECS
7. **Monitor**: Set up Sentry, Datadog, or similar

## Resources

- [Yjs Documentation](https://docs.yjs.dev)
- [NestJS WebSockets](https://docs.nestjs.com/websockets/gateways)
- [Prisma Guide](https://www.prisma.io/docs)
- [Redis Best Practices](https://redis.io/docs/manual/patterns/)
