# Scrible_it - Collaborative Whiteboard

A production-ready collaborative whiteboard application built with React, tldraw, and WebSocket for real-time collaboration.

## 🚀 Features

- **Real-time Collaboration**: Multiple users can draw together with live presence cursors
- **Powerful Drawing Tools**: Built on tldraw with full drawing capabilities
- **Room System**: Create and join rooms with unique IDs
- **Presence Awareness**: See who's in the room and their cursor positions
- **Share Functionality**: Easy room link sharing
- **Responsive Design**: Works on mobile, tablet, and desktop

## 🏗️ Architecture

### Frontend (This Repo)
- **Framework**: React + TypeScript + Vite
- **Drawing Engine**: tldraw
- **State Management**: Zustand
- **Styling**: Tailwind CSS + shadcn/ui
- **Real-time**: WebSocket client with reconnection logic

### Backend (Required - Deploy Separately)

You need to deploy a custom WebSocket server that implements the protocol defined in `src/types/protocol.ts`.

#### Recommended Tech Stack:
- **Runtime**: Node.js + TypeScript
- **Framework**: NestJS or Fastify
- **WebSocket**: ws or uWebSockets.js
- **CRDT**: Yjs for conflict-free collaborative editing
- **Database**: PostgreSQL (for room metadata, users)
- **Cache/Presence**: Redis (for real-time presence data)
- **Storage**: AWS S3 (for exports and snapshots)

#### Backend Implementation Guide:

1. **WebSocket Server**
   - Implement message handlers for all message types in `protocol.ts`
   - Handle connection lifecycle (connect, disconnect, reconnect)
   - Implement heartbeat for connection monitoring

2. **Yjs Integration**
   - Use y-websocket or custom Yjs provider
   - Persist Yjs documents to PostgreSQL as snapshots
   - Implement incremental sync for new clients

3. **Room Management**
   ```sql
   -- Schema example
   CREATE TABLE rooms (
     id VARCHAR PRIMARY KEY,
     name VARCHAR,
     owner_id VARCHAR,
     visibility VARCHAR,
     password_hash VARCHAR,
     created_at TIMESTAMP,
     last_active TIMESTAMP
   );
   
   CREATE TABLE room_participants (
     room_id VARCHAR,
     user_id VARCHAR,
     client_id VARCHAR,
     role VARCHAR,
     joined_at TIMESTAMP
   );
   
   CREATE TABLE room_snapshots (
     id UUID PRIMARY KEY,
     room_id VARCHAR,
     snapshot_data BYTEA,
     version INTEGER,
     created_at TIMESTAMP
   );
   ```

4. **REST API Endpoints**
   - `POST /api/rooms` - Create room
   - `GET /api/rooms/:roomId` - Get room info
   - `POST /api/rooms/:roomId/invite` - Generate invite link
   - `POST /api/exports/:roomId` - Export drawing

5. **Authentication (Optional)**
   - JWT-based auth
   - Magic link / OAuth (Google, GitHub)
   - Anonymous users supported

6. **Deployment**
   - Docker + Kubernetes or Fly.io
   - Load balancer with sticky sessions
   - Redis for cross-instance pub/sub
   - Environment variables for config

#### WebSocket Message Protocol

All messages are JSON and must conform to the types in `src/types/protocol.ts`:

```typescript
// Client -> Server
{
  type: 'connect',
  token?: string,
  roomId: string,
  user: { id, name, color }
}

{
  type: 'presence',
  clientId: string,
  cursor: { x, y },
  selection?: string[]
}

{
  type: 'update',
  clientId: string,
  delta: string, // base64 encoded Yjs update
  version: number
}

// Server -> Client
{
  type: 'join',
  user: User,
  clientId: string,
  roomId: string
}

{
  type: 'sync-response',
  snapshotData: string,
  version: number
}
```

## 🛠️ Development Setup

### Frontend Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure WebSocket URL**
   Create `.env.local`:
   ```
   VITE_WS_URL=ws://localhost:3001
   ```

3. **Run development server**
   ```bash
   npm run dev
   ```

### Backend Setup (Reference Implementation)

```bash
# Clone backend template (create this separately)
git clone <your-backend-repo>
cd scrible-backend

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your database, Redis, etc.

# Run migrations
npm run migrate

# Start server
npm run dev
```

## 📦 Deployment

### Frontend (Vercel)
```bash
# Connect to Vercel
vercel

# Set environment variables in Vercel dashboard
VITE_WS_URL=wss://your-websocket-server.com

# Deploy
vercel --prod
```

### Backend (Fly.io Example)
```bash
# Install flyctl
curl -L https://fly.io/install.sh | sh

# Launch app
fly launch

# Set secrets
fly secrets set DATABASE_URL=... REDIS_URL=...

# Deploy
fly deploy
```

## 🔒 Security Considerations

1. **WebSocket Authentication**: Implement JWT validation on connection
2. **Rate Limiting**: Limit messages per client to prevent DOS
3. **Input Validation**: Validate all messages on server
4. **Room Access Control**: Implement proper ACL (owner/editor/viewer)
5. **CORS**: Configure allowed origins
6. **XSS Prevention**: Sanitize any user-generated content

## 🧪 Testing

```bash
# Unit tests
npm test

# E2E tests (Playwright)
npm run test:e2e

# Load testing (WebSocket)
# Use a tool like artillery or k6
```

## 📊 Monitoring

Recommended monitoring setup:
- **Errors**: Sentry
- **Metrics**: Prometheus + Grafana or Datadog
- **Logs**: Winston/Pino with structured logging
- **WebSocket**: Track active connections, messages/sec, latency

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🙋 Support

For issues or questions:
- Create an issue in this repository
- Check the [tldraw documentation](https://tldraw.dev)
- Review the [Yjs documentation](https://docs.yjs.dev)

## 🎯 Roadmap

- [ ] Backend reference implementation
- [ ] User authentication
- [ ] Persistent room history
- [ ] Export functionality (PNG, SVG, PDF)
- [ ] Chat panel
- [ ] Video/voice integration
- [ ] Template library
- [ ] Session recording & playback

---

**Note**: This frontend requires a custom WebSocket backend to function fully. See the Backend Implementation Guide above for details.
