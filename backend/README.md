# Scrible_it Backend

Real-time collaborative whiteboard backend with Yjs CRDT synchronization.

## Quick Start

### With Docker (Recommended)

```bash
# Start all services (PostgreSQL, Redis, Backend)
docker-compose up -d

# View logs
docker-compose logs -f backend
```

### Local Development

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Start PostgreSQL and Redis (Docker)
docker-compose up -d postgres redis

# Generate Prisma client
npm run db:generate

# Run database migrations
npm run db:push

# Start development server
npm run dev
```

## API Endpoints

### REST API

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/api/stats` | Server statistics |
| `POST` | `/api/rooms` | Create a room |
| `GET` | `/api/rooms/:id` | Get room details |
| `GET` | `/api/rooms/:id/exists` | Check if room exists |
| `PATCH` | `/api/rooms/:id` | Update room |
| `DELETE` | `/api/rooms/:id` | Delete room |
| `GET` | `/api/rooms/:id/snapshots` | Get room snapshot history |

### WebSocket

Connect to `ws://localhost:3001/ws`

#### Client → Server Messages

```typescript
// Connect to a room
{ type: 'connect', roomId: string, user: User, token?: string }

// Send Yjs update
{ type: 'update', delta: string } // base64 encoded

// Send cursor position
{ type: 'presence', clientId: string, cursor: { x, y } }

// Send chat message
{ type: 'chat', userName: string, message: string, timestamp: number }

// Leave room
{ type: 'leave' }

// Heartbeat
{ type: 'heartbeat', timestamp: number }
```

#### Server → Client Messages

```typescript
// Initial sync
{ type: 'sync-response', snapshotData: string, participants: Participant[] }

// User joined
{ type: 'join', user: User, clientId: string, roomId: string }

// User left
{ type: 'leave', clientId: string, userId: string }

// Yjs update from another client
{ type: 'update', delta: string, from: string }

// Presence update
{ type: 'presence', clientId: string, cursor: { x, y } }

// Error
{ type: 'error', code: string, message: string }
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | HTTP server port |
| `DATABASE_URL` | - | PostgreSQL connection string |
| `REDIS_URL` | - | Redis connection string |
| `CORS_ORIGIN` | `http://localhost:8080` | Allowed CORS origin |
| `NODE_ENV` | `development` | Environment mode |

## Architecture

```
src/
├── server.ts           # Entry point
├── types.ts            # TypeScript interfaces
├── api/
│   └── rooms.ts        # REST API routes
├── websocket/
│   ├── server.ts       # WebSocket server setup
│   ├── connection-manager.ts  # Client tracking
│   └── message-handler.ts     # Message routing
└── yjs/
    └── document-manager.ts    # Yjs document management
```

## Database

Using Prisma with PostgreSQL:

```bash
# Open Prisma Studio (database GUI)
npm run db:studio

# Create migration
npm run db:migrate

# Reset database
npx prisma migrate reset
```

## Deployment

### Railway/Fly.io

1. Set environment variables
2. Deploy with Dockerfile
3. Run `npx prisma migrate deploy` after deployment

### Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Configure SSL/TLS
- [ ] Set up database backups
- [ ] Configure rate limiting
- [ ] Add monitoring (Sentry, etc.)
